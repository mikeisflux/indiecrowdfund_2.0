import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { calculateInternationalFees } from "@/lib/payouts/international-fees";

const paypalPayoutsLogger = logger.child({ module: "admin-paypal-payouts" });

export const dynamic = "force-dynamic";

// PayPal Advanced Checkout processing fee (passed through to creator)
const PAYPAL_FEE_RATE = 0.0349;   // 3.49%
const PAYPAL_FEE_FIXED = 0.49;    // $0.49 per transaction (multiplied by pledge count)

function calcPayoutAmounts(grossAmount: number, platformFeePercent: number, pledgeCount: number) {
  const paypalFee = Math.round((grossAmount * PAYPAL_FEE_RATE + PAYPAL_FEE_FIXED * pledgeCount) * 100) / 100;
  const platformFee = Math.round(grossAmount * (platformFeePercent / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - paypalFee - platformFee) * 100) / 100;
  return { paypalFee, platformFee, netAmount };
}

const payoutSchema = z.object({
  projectId: z.string(),
  grossAmount: z.number().positive(),
  platformFeePercent: z.number().min(0).max(100).default(3),
  note: z.string().optional(),
});

// GET - List PayPal payouts
export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const payouts = await db.payPalPayout.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        payoutConfig: { select: { paypalEmail: true, user: { select: { name: true, email: true } } } },
        paypalBankAccount: {
          select: {
            bankNameDisplay: true,
            accountLastFour: true,
            accountType: true,
            isVerified: true,
            user: { select: { name: true, email: true } },
          },
        },
        project: { select: { title: true, slug: true } },
      },
    });

    return NextResponse.json({ payouts });
  } catch (error) {
    paypalPayoutsLogger.error({ err: String(error) }, "Failed to list payouts");
    return NextResponse.json({ error: "Failed to list payouts" }, { status: 500 });
  }
}

// POST - Trigger a PayPal payout to a creator for a specific project
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const data = payoutSchema.parse(body);

    // Get project + creator's PayPal bank account
    const project = await db.project.findFirst({
      where: { id: data.projectId , deletedAt: null },
      select: {
        id: true,
        title: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            paypalBankAccount: {
              select: {
                id: true,
                bankNameDisplay: true,
                accountLastFour: true,
                accountType: true,
                isVerified: true,
                bankCountry: true,
              },
            },
            paypalPayoutConfig: { select: { id: true, paypalEmail: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const bankAccount = project.creator.paypalBankAccount;
    const payoutConfig = project.creator.paypalPayoutConfig;

    if (!bankAccount) {
      return NextResponse.json(
        { error: `Creator has not added a bank account for PayPal payouts. Ask them to add it in their campaign settings.` },
        { status: 400 }
      );
    }

    // Count completed pledges to compute per-transaction fees correctly
    const pledgeCount = await db.pledge.count({
      where: { projectId: project.id, status: "COMPLETED", deletedAt: null },
    });

    const grossAmount = data.grossAmount;
    const { paypalFee, platformFee, netAmount: netBeforeIntl } = calcPayoutAmounts(grossAmount, data.platformFeePercent, pledgeCount);

    // International wire surcharges only apply when the destination
    // bank is non-US. CC fee is 1.5% of the post-platform-fees subtotal.
    const intlFees = calculateInternationalFees(bankAccount.bankCountry, netBeforeIntl);
    const netAmount = Math.round((netBeforeIntl - intlFees.totalInternationalFees) * 100) / 100;

    if (netAmount <= 0) {
      return NextResponse.json({ error: "Net payout amount is zero or negative" }, { status: 400 });
    }

    // Create a payout record linked to the creator's bank account.
    // Guarded by a Postgres advisory lock keyed by project id so a
    // double-click doesn't create two separate PayPalPayout rows for
    // the same campaign (real money, hard to reverse). Inside the
    // lock we also check for an existing non-failed payout and return
    // 409 instead of creating a second one.
    const feeNote = intlFees.isInternational
      ? `PayPal fee: $${paypalFee.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}, Wire fee: $${intlFees.wireFee.toFixed(2)}, FX fee (1.5%): $${intlFees.currencyConversionFee.toFixed(2)}`
      : `PayPal fee: $${paypalFee.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}`;
    let payout;
    try {
      payout = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`paypal-payout-${project.id}`}))`;

        const existing = await tx.payPalPayout.findFirst({
          where: {
            projectId: project.id,
            status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
          },
        });
        if (existing) {
          throw new Error("PAYOUT_ALREADY_EXISTS");
        }

        return tx.payPalPayout.create({
          data: {
            paypalBankAccountId: bankAccount.id,
            ...(payoutConfig ? { payoutConfigId: payoutConfig.id } : {}),
            projectId: project.id,
            projectName: project.title,
            grossAmount,
            platformFee: platformFee + paypalFee + intlFees.totalInternationalFees,
            netAmount,
            status: "PENDING",
            initiatedAt: new Date(),
            processedBy: session.user.id,
            adminNotes: data.note ? `${data.note} | ${feeNote}` : feeNote,
          },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "PAYOUT_ALREADY_EXISTS") {
        return NextResponse.json(
          { error: "A PayPal payout for this project already exists or is in flight" },
          { status: 409 }
        );
      }
      throw err;
    }

    paypalPayoutsLogger.info(
      {
        payoutId: payout.id,
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bankNameDisplay,
        accountLastFour: bankAccount.accountLastFour,
        netAmount,
      },
      "PayPal bank payout record created — pending manual ACH transfer"
    );

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        netAmount,
        status: "PENDING",
        bankAccount: {
          bankName: bankAccount.bankNameDisplay,
          accountLastFour: bankAccount.accountLastFour,
          accountType: bankAccount.accountType,
          isVerified: bankAccount.isVerified,
        },
        creatorEmail: project.creator.email,
        creatorName: project.creator.name,
      },
      message: `Payout of $${netAmount.toFixed(2)} recorded. Transfer to ${bankAccount.bankNameDisplay} ****${bankAccount.accountLastFour}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid data" }, { status: 400 });
    }
    paypalPayoutsLogger.error({ err: String(error) }, "Payout initiation error");
    return NextResponse.json({ error: "Failed to initiate payout" }, { status: 500 });
  }
}
