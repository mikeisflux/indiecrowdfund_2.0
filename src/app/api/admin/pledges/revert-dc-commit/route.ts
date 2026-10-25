import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { lookupDcPledgePayment, verifyDcPayment } from "@/lib/payments/divinitycoin/saved-cards";
import { unwindCountedPledge } from "@/lib/payments/unwind-counted-pledge";
import { createNotification } from "@/lib/notifications/core";
import { sendPledgeConfirmationRevokedEmail } from "@/lib/email/email-templates-pledge";

const log = logger.child({ module: "admin-revert-dc-commit" });

export const dynamic = "force-dynamic";

// POST { pledgeId, reason, confirmedUnpaidInStripe: true, force?: boolean }
//
// Undo a pledge that was marked COMPLETED without the money ever arriving.
// This happened when DC's hosted checkout reported a session "complete"
// (and verify-payment echoed "succeeded") for a PaymentIntent Stripe never
// captured; our reconcile sweep then committed it: counters, backer
// number, confirmation email, creator "New Pledge!".
//
// Reverses all of that: COMPLETED → CANCELLED (never FAILED/PENDING, which
// the sweeper would pick straight back up), counters and reward/add-on
// slots released, the PAYMENT transaction retyped so nothing downstream
// treats it as evidence of money, backer and creator told. No refund is
// issued — there is nothing to refund.
//
// Guard rails: DC's payment records (lookup-payment) must agree there is
// no successful charge, unless `force` is set, and the admin must attest
// they checked the intent in Stripe. The pledge's own verify-payment answer
// is reported but not trusted; it is the thing that lied.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { id: true, role: true } });
  if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const pledgeId = typeof body.pledgeId === "string" ? body.pledgeId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    const force = body.force === true;
    if (!pledgeId) return NextResponse.json({ error: "pledgeId is required" }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "A reason is required (it is kept on the pledge)" }, { status: 400 });
    if (body.confirmedUnpaidInStripe !== true) {
      return NextResponse.json({ error: "Confirm in Stripe that the payment intent is not succeeded before reversing" }, { status: 400 });
    }

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        status: true,
        amount: true,
        rewardId: true,
        backerNumber: true,
        confirmationEmailSent: true,
        fulfillmentStatus: true,
        shippedAt: true,
        paymentProcessor: true,
        divinityCoinPaymentId: true,
        divinityCoinCheckoutSessionId: true,
        metadata: true,
        projectId: true,
        user: { select: { id: true, email: true, name: true } },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            endDate: true,
            currency: true,
            creatorId: true,
            creator: { select: { vanityUrl: true } },
          },
        },
      },
    });
    if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    if (pledge.paymentProcessor !== "DIVINITYCOIN") return NextResponse.json({ error: "Not a DivinityCoin pledge" }, { status: 400 });
    if (pledge.status !== "COMPLETED") {
      return NextResponse.json({ error: `Pledge is ${pledge.status}; only a COMPLETED pledge can be reversed here` }, { status: 400 });
    }

    // Has anything been shipped against it? Then this is not a phantom
    // pledge and a reversal would strand real goods.
    if (pledge.fulfillmentStatus === "SHIPPED" || pledge.fulfillmentStatus === "DELIVERED" || pledge.shippedAt) {
      return NextResponse.json({ error: `This pledge is ${pledge.fulfillmentStatus}; it cannot be reversed as unpaid` }, { status: 409 });
    }

    // DC's payment records: the authority on "was any charge captured".
    const record = await lookupDcPledgePayment(pledge.id);
    const dcPaid = record.success ? record.paid : null;
    const dcPaidIntent = record.success && record.paid ? record.paymentIntentId : null;
    if (dcPaid === true && !force) {
      return NextResponse.json(
        {
          error: `DivinityCoin's payment records say this pledge WAS paid (${dcPaidIntent ?? "intent unknown"}). Check that intent in Stripe; if Stripe disagrees, re-run with force.`,
          dcPaid,
          dcPaidIntent,
        },
        { status: 409 }
      );
    }
    if (dcPaid === null && !force) {
      return NextResponse.json(
        { error: `Could not reach DivinityCoin's payment records (${record.success ? "" : record.error}). Re-run with force to reverse on Stripe's word alone.` },
        { status: 502 }
      );
    }
    let verifyStatus: string | null = null;
    if (pledge.divinityCoinPaymentId) {
      const v = await verifyDcPayment(pledge.divinityCoinPaymentId);
      verifyStatus = v.success ? v.status : `error: ${v.error}`;
    }

    const now = new Date();
    const existingMeta = typeof pledge.metadata === "object" && pledge.metadata !== null ? (pledge.metadata as Record<string, unknown>) : {};
    const reverted = {
      by: admin.id,
      at: now.toISOString(),
      reason,
      previousStatus: pledge.status,
      previousBackerNumber: pledge.backerNumber,
      paymentIntentId: pledge.divinityCoinPaymentId,
      checkoutSessionId: pledge.divinityCoinCheckoutSessionId,
      statsWereCounted: pledge.confirmationEmailSent,
      dcLookupPaid: dcPaid,
      dcVerifyStatus: verifyStatus,
      forced: force,
    };

    // CAS COMPLETED → CANCELLED. CANCELLED is terminal for every sweeper and
    // cleanup job, so the row cannot be re-committed behind our back.
    const cas = await db.pledge.updateMany({
      where: { id: pledge.id, status: "COMPLETED", deletedAt: null },
      data: {
        status: "CANCELLED",
        backerNumber: null,
        lastFailureReason: `Payment never completed at the processor; confirmation reversed by admin: ${reason}`.slice(0, 500),
        metadata: { ...existingMeta, revertedCommit: reverted },
      },
    });
    if (cas.count === 0) return NextResponse.json({ error: "Pledge changed under us; reload and try again" }, { status: 409 });

    // Counters, reward slot, add-on slots — only if this pledge was counted.
    await unwindCountedPledge({
      id: pledge.id,
      projectId: pledge.projectId,
      amount: pledge.amount,
      rewardId: pledge.rewardId,
      confirmationEmailSent: pledge.confirmationEmailSent,
    });

    // The PAYMENT row is what every "was this pledge paid" check reads
    // (reconcile, cleanup, process-pledges). Keep it for audit, retype it.
    const retyped = await db.divinityCoinTransaction.updateMany({
      where: { pledgeId: pledge.id, type: "PAYMENT" },
      data: {
        type: "VOIDED_PAYMENT",
        description: `Voided: payment ${pledge.divinityCoinPaymentId ?? "?"} never completed at the processor (reversed by admin ${now.toISOString()})`,
      },
    });

    const projectPath = pledge.project.creator?.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;
    const campaignOpen = pledge.project.status === "LIVE" && (!pledge.project.endDate || new Date(pledge.project.endDate) > now);

    // Tell the backer (email + bell) and the creator (bell).
    let emailed = false;
    if (pledge.user.email) {
      const r = await sendPledgeConfirmationRevokedEmail(
        pledge.user.email,
        pledge.user.name || "there",
        pledge.project.title,
        Number(pledge.amount),
        campaignOpen,
        projectPath,
        pledge.project.currency || "USD"
      ).catch((err) => ({ success: false, error: String(err) }));
      emailed = r.success === true;
      if (!emailed) log.warn({ pledgeId: pledge.id, err: "error" in r ? r.error : undefined }, "revoked-confirmation email not sent");
    }
    await createNotification({
      userId: pledge.user.id,
      type: "PLEDGE_CANCELLED",
      title: "Pledge not paid",
      message: `Your $${Number(pledge.amount).toFixed(2)} pledge for "${pledge.project.title}" was never charged, so it has been removed. No money was taken.${campaignOpen ? " The campaign is still open if you would like to back it again." : ""}`,
      actionUrl: campaignOpen ? projectPath : "/dashboard/pledges",
      projectId: pledge.project.id,
    }).catch((err) => log.warn({ err: String(err) }, "backer notification failed"));
    await createNotification({
      userId: pledge.project.creatorId,
      type: "PLEDGE_CANCELLED",
      title: "Pledge reversed — payment never completed",
      message: `The $${Number(pledge.amount).toFixed(2)} pledge from ${pledge.user.name || pledge.user.email || "a backer"} on "${pledge.project.title}" was confirmed in error: the processor never captured the payment. It has been removed from your total.`,
      actionUrl: projectPath,
      projectId: pledge.project.id,
    }).catch((err) => log.warn({ err: String(err) }, "creator notification failed"));

    log.warn({ pledgeId: pledge.id, adminId: admin.id, reverted, retyped: retyped.count }, "Reversed a committed DivinityCoin pledge as unpaid");
    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      project: pledge.project.title,
      backer: pledge.user.email,
      amount: Number(pledge.amount),
      previousBackerNumber: pledge.backerNumber,
      countersReversed: pledge.confirmationEmailSent,
      transactionsVoided: retyped.count,
      dcLookupPaid: dcPaid,
      dcVerifyStatus: verifyStatus,
      campaignOpen,
      emailed,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "revert-dc-commit failed");
    return NextResponse.json({ error: "Reversal failed — check server logs" }, { status: 500 });
  }
}
