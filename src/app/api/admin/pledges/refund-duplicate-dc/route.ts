import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { verifyDcPayment } from "@/lib/payments/divinitycoin/saved-cards";
import { sendDuplicateChargeRefundedEmail } from "@/lib/email/email-templates-pledge";

const log = logger.child({ module: "admin-refund-duplicate-dc" });

export const dynamic = "force-dynamic";

// POST { pledgeId, paymentIntentId, reason? }
//
// Refund a SECOND successful charge against a pledge that is already paid.
// The multi-session checkout bug (one DC session per mount, no idempotency
// key) let a backer complete two sessions for one pledge; DC captured both.
// The pledge keeps the payment stamped on it; the stray intent is refunded
// at DC, recorded here as a REFUND transaction tied to the pledge, and the
// backer is told. Pledge status and campaign counters are untouched: the
// pledge was and remains paid exactly once.
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
    const strayIntent = typeof body.paymentIntentId === "string" ? body.paymentIntentId.trim() : "";
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : "Duplicate charge from a second checkout session";
    if (!pledgeId || !strayIntent) {
      return NextResponse.json({ error: "pledgeId and paymentIntentId are required" }, { status: 400 });
    }

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        status: true,
        amount: true,
        paymentProcessor: true,
        divinityCoinPaymentId: true,
        metadata: true,
        user: { select: { id: true, email: true, name: true } },
        project: { select: { id: true, title: true, slug: true, currency: true, creator: { select: { vanityUrl: true } } } },
      },
    });
    if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    if (pledge.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json({ error: "Not a DivinityCoin pledge" }, { status: 400 });
    }
    if (pledge.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Pledge is ${pledge.status}; only a paid (COMPLETED) pledge can have a duplicate charge. If the pledge itself is wrong, use the normal refund.` },
        { status: 400 }
      );
    }
    if (pledge.divinityCoinPaymentId === strayIntent) {
      return NextResponse.json(
        { error: "That is the payment the pledge was paid with. Refunding it would unpay the pledge; use the normal refund action for that." },
        { status: 400 }
      );
    }
    if (!pledge.divinityCoinPaymentId) {
      return NextResponse.json({ error: "Pledge carries no payment id of its own; recover it first so the kept charge is known" }, { status: 400 });
    }

    // Idempotency: never refund the same stray intent twice.
    const prior = await db.divinityCoinTransaction.findFirst({
      where: { pledgeId: pledge.id, type: "REFUND", metadata: { contains: strayIntent } },
      select: { id: true, createdAt: true },
    });
    if (prior) {
      return NextResponse.json(
        { error: `Payment ${strayIntent} was already refunded against this pledge on ${prior.createdAt.toISOString()}` },
        { status: 409 }
      );
    }

    // The stray intent must really be a captured charge.
    const verified = await verifyDcPayment(strayIntent);
    if (!verified.success) return NextResponse.json({ error: `DivinityCoin: ${verified.error}` }, { status: 400 });
    if (verified.status !== "succeeded") {
      return NextResponse.json(
        { error: `DivinityCoin reports ${strayIntent} as "${verified.status}", not succeeded — there is nothing to refund` },
        { status: 400 }
      );
    }
    const pledgeCents = Math.round(Number(pledge.amount) * 100);
    const refundCents = typeof verified.amount === "number" && verified.amount > 0 ? Math.round(verified.amount) : pledgeCents;

    const dcResult = await callDivinityCoinAPI("refund", {
      pledgeId: pledge.id,
      paymentId: strayIntent,
      amount: refundCents,
      reason: `Duplicate charge refunded by admin: ${reason}`.slice(0, 200),
      requestedBy: "admin",
    });
    if (!dcResult.success) {
      log.error({ pledgeId: pledge.id, strayIntent, err: dcResult.error }, "Duplicate-charge refund failed at DivinityCoin");
      return NextResponse.json({ error: dcResult.error || "DivinityCoin refund failed" }, { status: 400 });
    }
    const refundId =
      (dcResult.data && typeof dcResult.data.refundId === "string" && dcResult.data.refundId) ||
      (dcResult.data && typeof dcResult.data.id === "string" && dcResult.data.id) ||
      null;

    const refundDollars = refundCents / 100;
    const existingMeta = typeof pledge.metadata === "object" && pledge.metadata !== null ? (pledge.metadata as Record<string, unknown>) : {};
    const priorList = Array.isArray(existingMeta.duplicateChargeRefunds) ? (existingMeta.duplicateChargeRefunds as unknown[]) : [];
    await db.$transaction([
      db.divinityCoinTransaction.create({
        data: {
          userId: pledge.user.id,
          pledgeId: pledge.id,
          amount: -refundDollars,
          type: "REFUND",
          description: `Duplicate charge refunded on "${pledge.project.title}" (admin) — pledge remains paid via ${pledge.divinityCoinPaymentId}`,
          metadata: JSON.stringify({
            adminUserId: admin.id,
            reason,
            duplicateOf: pledge.divinityCoinPaymentId,
            refundedPaymentIntentId: strayIntent,
            refundId,
            dcRefundResult: dcResult.data,
            processedAt: new Date().toISOString(),
            kind: "duplicate-charge",
          }),
        },
      }),
      db.pledge.update({
        where: { id: pledge.id },
        data: {
          metadata: {
            ...existingMeta,
            duplicateChargeRefunds: [
              ...priorList,
              { paymentIntentId: strayIntent, amount: refundDollars, refundId, at: new Date().toISOString(), by: admin.id },
            ],
          },
        },
      }),
    ]);

    let emailed = false;
    if (pledge.user.email) {
      const path = pledge.project.creator?.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : `/projects/${pledge.project.slug}`;
      const r = await sendDuplicateChargeRefundedEmail(
        pledge.user.email,
        pledge.user.name || "there",
        pledge.project.title,
        Number(pledge.amount),
        refundDollars,
        path,
        pledge.project.currency || "USD"
      ).catch((err) => ({ success: false, error: String(err) }));
      emailed = r.success === true;
      if (!emailed) log.warn({ pledgeId: pledge.id, err: "error" in r ? r.error : undefined }, "duplicate-charge email not sent");
    }

    log.info({ pledgeId: pledge.id, strayIntent, refundCents, refundId, adminId: admin.id }, "Refunded duplicate DivinityCoin charge");
    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
      project: pledge.project.title,
      backer: pledge.user.email,
      keptPayment: pledge.divinityCoinPaymentId,
      refundedPayment: strayIntent,
      refunded: refundDollars,
      refundId,
      emailed,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "refund-duplicate-dc failed");
    return NextResponse.json({ error: "Refund failed — check server logs" }, { status: 500 });
  }
}
