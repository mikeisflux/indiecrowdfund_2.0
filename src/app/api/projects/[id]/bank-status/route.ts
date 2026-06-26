import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export const dynamic = "force-dynamic";

// GET /api/projects/[id]/bank-status
//
// Reports whether the project's creator has a payout bank account on
// file for the project's payment processor -- the same check the
// launch route enforces. Used by the admin project-detail panel to
// show a "Bank Account: On File / Missing" badge next to the
// chargeback-card status, so an admin can see at a glance whether a
// funded campaign can actually be paid out.
//
// Returns:
//   {
//     processor,          // the project's payment processor
//     exists,             // bank account / payout config present?
//     accountType,        // "bank" | "paypal_config" | "stripe_connect" | null
//     last4,              // masked account/last-four if available
//     bankName,           // masked bank name if available
//     bankCountry,        // ISO country for the payout
//     label               // human-readable processor name
//   }
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true, paymentProcessor: true, stripeAccountId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
    if (project.creatorId !== session.user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const processor = String(project.paymentProcessor || "STRIPE");
    const creatorId = project.creatorId;

    // Safely decrypt a possibly-encrypted display field; never throw.
    const safeDecrypt = (v: string | null | undefined): string | null => {
      if (!v) return null;
      try {
        return decrypt(v);
      } catch {
        return null;
      }
    };
    // Show only the last 4 of an account number for display.
    const tail = (s: string | null): string | null =>
      s && s.length >= 4 ? s.slice(-4) : s;

    if (processor === "DIVINITYCOIN") {
      const acct = await db.divinityCoinBankAccount.findUnique({
        where: { userId: creatorId },
        select: {
          bankNameEncrypted: true,
          accountNumberEncrypted: true,
          bankCountry: true,
        },
      });
      return NextResponse.json({
        processor,
        label: "Divinity Payments",
        exists: !!acct,
        accountType: acct ? "bank" : null,
        bankName: acct ? safeDecrypt(acct.bankNameEncrypted) : null,
        last4: acct ? tail(safeDecrypt(acct.accountNumberEncrypted)) : null,
        bankCountry: acct?.bankCountry ?? null,
      });
    }

    if (processor === "PAYPAL") {
      const [acct, payoutConfig] = await Promise.all([
        db.payPalBankAccount.findUnique({
          where: { userId: creatorId },
          select: { bankNameEncrypted: true, accountNumberEncrypted: true, bankCountry: true },
        }),
        db.payPalPayoutConfig.findUnique({
          where: { userId: creatorId },
          select: { id: true },
        }),
      ]);
      if (acct) {
        return NextResponse.json({
          processor,
          label: "PayPal",
          exists: true,
          accountType: "bank",
          bankName: safeDecrypt(acct.bankNameEncrypted),
          last4: tail(safeDecrypt(acct.accountNumberEncrypted)),
          bankCountry: acct.bankCountry ?? null,
        });
      }
      return NextResponse.json({
        processor,
        label: "PayPal",
        exists: !!payoutConfig,
        accountType: payoutConfig ? "paypal_config" : null,
        bankName: null,
        last4: null,
        bankCountry: null,
      });
    }

    if (processor === "WHOP") {
      const acct = await db.whopBankAccount.findUnique({
        where: { userId: creatorId },
        select: { bankNameEncrypted: true, accountNumberEncrypted: true, bankCountry: true },
      });
      return NextResponse.json({
        processor,
        label: "Whop",
        exists: !!acct,
        accountType: acct ? "bank" : null,
        bankName: acct ? safeDecrypt(acct.bankNameEncrypted) : null,
        last4: acct ? tail(safeDecrypt(acct.accountNumberEncrypted)) : null,
        bankCountry: acct?.bankCountry ?? null,
      });
    }

    // STRIPE (legacy) -- relies on the project's Stripe Connect
    // account id rather than a per-user bank row.
    return NextResponse.json({
      processor,
      label: "Stripe",
      exists: !!project.stripeAccountId,
      accountType: project.stripeAccountId ? "stripe_connect" : null,
      bankName: null,
      last4: null,
      bankCountry: null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to check bank status" }, { status: 500 });
  }
}
