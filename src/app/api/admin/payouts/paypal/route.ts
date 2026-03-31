import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { z } from "zod";
import { logger } from "@/lib/logger";

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

    // Get project + creator's PayPal config
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: {
        id: true,
        title: true,
        creator: {
          select: {
            id: true,
            name: true,
            paypalPayoutConfig: { select: { id: true, paypalEmail: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const payoutConfig = project.creator.paypalPayoutConfig;
    if (!payoutConfig) {
      return NextResponse.json(
        { error: `Creator has not set up a PayPal payout email. Ask them to add it in their settings.` },
        { status: 400 }
      );
    }

    // Count completed pledges to compute per-transaction fees correctly
    const pledgeCount = await db.pledge.count({
      where: { projectId: project.id, status: "COMPLETED", deletedAt: null },
    });

    const grossAmount = data.grossAmount;
    const { paypalFee, platformFee, netAmount } = calcPayoutAmounts(grossAmount, data.platformFeePercent, pledgeCount);

    if (netAmount <= 0) {
      return NextResponse.json({ error: "Net payout amount is zero or negative" }, { status: 400 });
    }

    // Create a payout record in PROCESSING state
    const payout = await db.payPalPayout.create({
      data: {
        payoutConfigId: payoutConfig.id,
        projectId: project.id,
        projectName: project.title,
        grossAmount,
        platformFee: platformFee + paypalFee, // total fees retained by platform (platform fee + PayPal processing fee)
        netAmount,
        status: "PROCESSING",
        initiatedAt: new Date(),
        processedBy: session.user.id,
        adminNotes: data.note ? `${data.note} | PayPal fee: $${paypalFee.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}` : `PayPal fee: $${paypalFee.toFixed(2)}, Platform fee: $${platformFee.toFixed(2)}`,
      },
    });

    // Call PayPal Payouts API
    const config = await getPayPalConfig();
    const accessToken = await getPayPalAccessToken();

    const senderBatchId = `payout_${payout.id}_${Date.now()}`;
    const payoutPayload = {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: `Your IndieCrowdfund payout for "${project.title}"`,
        email_message: `Congratulations! Your campaign "${project.title}" has been funded. Here is your payout of $${netAmount.toFixed(2)} USD.`,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: netAmount.toFixed(2), currency: "USD" },
          receiver: payoutConfig.paypalEmail,
          sender_item_id: payout.id,
          note: data.note || `Payout for "${project.title}" campaign`,
        },
      ],
    };

    const payoutsRes = await fetch(`${config.baseUrl}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payoutPayload),
    });

    if (!payoutsRes.ok) {
      const errBody = await payoutsRes.text();
      paypalPayoutsLogger.error({ payoutId: payout.id, err: errBody }, "PayPal Payouts API error");

      await db.payPalPayout.update({
        where: { id: payout.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: `PayPal API error: ${errBody.slice(0, 500)}`,
        },
      });

      return NextResponse.json({ error: "PayPal Payouts API call failed", details: errBody }, { status: 502 });
    }

    const payoutsData = await payoutsRes.json();
    const batchId = payoutsData.batch_header?.payout_batch_id as string | undefined;
    const itemId = payoutsData.items?.[0]?.payout_item_id as string | undefined;

    await db.payPalPayout.update({
      where: { id: payout.id },
      data: {
        paypalBatchId: batchId,
        paypalItemId: itemId,
        status: "PROCESSING",
      },
    });

    paypalPayoutsLogger.info(
      { payoutId: payout.id, batchId, recipientEmail: payoutConfig.paypalEmail, netAmount },
      "PayPal payout initiated"
    );

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        paypalBatchId: batchId,
        paypalItemId: itemId,
        netAmount,
        recipientEmail: payoutConfig.paypalEmail,
        status: "PROCESSING",
      },
      message: `Payout of $${netAmount.toFixed(2)} initiated to ${payoutConfig.paypalEmail}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid data" }, { status: 400 });
    }
    paypalPayoutsLogger.error({ err: String(error) }, "Payout initiation error");
    return NextResponse.json({ error: "Failed to initiate payout" }, { status: 500 });
  }
}
