import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getDcCheckoutSession } from "@/lib/payments/divinitycoin/checkout-sessions";
import { verifyDcPayment } from "@/lib/payments/divinitycoin/saved-cards";
import { handlePaymentSucceeded } from "@/lib/payments/divinitycoin/payments";

const log = logger.child({ module: "admin-recover-dc-pledge" });

export const dynamic = "force-dynamic";

// POST { sessionId, rewardId? }  — rebuild a pledge from a DivinityCoin
//                                   hosted-checkout session and commit it
// POST { paymentIntentId, projectId, userEmail, amount, rewardId? }
//                                 — same, from a bare payment when the
//                                   session id is unknown
//
// For the case where a backer paid at DC but our pledge row is gone or was
// never committed. DC's session record carries the original pledgeId,
// projectId, platform user and amount, so the pledge is recreated under
// its original id (or undeleted) and then committed through the same
// handler the webhook uses: counters, backer number, confirmation email.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { id: true, role: true } });
  if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rewardId = typeof body.rewardId === "string" && body.rewardId.trim() ? body.rewardId.trim() : null;

    let pledgeId: string | null = null;
    let projectId: string | null = null;
    let userId: string | null = null;
    let amountDollars: number | null = null;
    let paymentIntentId: string | null = null;
    let sessionId: string | null = null;
    let source = "";

    if (typeof body.sessionId === "string" && body.sessionId.trim()) {
      const sid: string = body.sessionId.trim();
      sessionId = sid;
      const r = await getDcCheckoutSession(sid);
      if (!r.success) return NextResponse.json({ error: `DivinityCoin: ${r.error}` }, { status: 400 });
      const s = r.session;
      if (s.mode !== "payment") {
        return NextResponse.json({ error: `Session is ${s.mode} mode; only payment sessions can be recovered here` }, { status: 400 });
      }
      if (s.status !== "complete") {
        return NextResponse.json({ error: `DivinityCoin reports this session as "${s.status}", not complete — nothing was paid` }, { status: 400 });
      }
      if (!s.paymentIntentId) {
        return NextResponse.json({ error: "Session is complete but carries no payment id" }, { status: 400 });
      }
      pledgeId = s.pledgeId;
      projectId = s.projectId;
      paymentIntentId = s.paymentIntentId;
      amountDollars = typeof s.amount === "number" ? Math.round(s.amount) / 100 : null;
      source = `session ${sessionId}`;
      if (s.platformUserId) {
        const u = await db.user.findFirst({ where: { id: s.platformUserId }, select: { id: true } });
        userId = u?.id ?? null;
      }
      if (!userId && s.email) {
        const u = await db.user.findFirst({ where: { email: s.email.toLowerCase() }, select: { id: true } });
        userId = u?.id ?? null;
      }
    } else if (typeof body.paymentIntentId === "string" && body.paymentIntentId.trim()) {
      const pid: string = body.paymentIntentId.trim();
      paymentIntentId = pid;
      const v = await verifyDcPayment(pid);
      if (!v.success) return NextResponse.json({ error: `DivinityCoin: ${v.error}` }, { status: 400 });
      if (v.status !== "succeeded") {
        return NextResponse.json({ error: `DivinityCoin reports this payment as "${v.status}"` }, { status: 400 });
      }
      projectId = typeof body.projectId === "string" ? body.projectId.trim() : null;
      const email = typeof body.userEmail === "string" ? body.userEmail.trim().toLowerCase() : "";
      const u = email ? await db.user.findFirst({ where: { email }, select: { id: true } }) : null;
      userId = u?.id ?? null;
      amountDollars =
        typeof v.amount === "number" ? Math.round(v.amount) / 100 : typeof body.amount === "number" ? body.amount : null;
      source = `payment ${paymentIntentId}`;
    } else {
      return NextResponse.json({ error: "sessionId or paymentIntentId is required" }, { status: 400 });
    }

    if (!projectId) return NextResponse.json({ error: "Could not determine the project; pass projectId" }, { status: 400 });
    if (!userId) return NextResponse.json({ error: "Could not match the backer to an account; pass userEmail" }, { status: 400 });
    if (!amountDollars || amountDollars <= 0) return NextResponse.json({ error: "Could not determine the amount" }, { status: 400 });

    const project = await db.project.findFirst({ where: { id: projectId }, select: { id: true, title: true, deletedAt: true } });
    if (!project || project.deletedAt) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Already a live pledge with this payment? Then just commit it.
    const byPayment = await db.pledge.findFirst({
      where: { divinityCoinPaymentId: paymentIntentId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (byPayment) {
      pledgeId = byPayment.id;
    } else {
      const existing = pledgeId ? await db.pledge.findUnique({ where: { id: pledgeId }, select: { id: true, status: true, deletedAt: true } }) : null;
      if (existing) {
        // Soft-deleted or cancelled: bring it back to PENDING for the commit.
        await db.pledge.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            status: "PENDING",
            divinityCoinPaymentId: paymentIntentId,
            ...(sessionId ? { divinityCoinCheckoutSessionId: sessionId } : {}),
            ...(rewardId ? { rewardId } : {}),
            lastFailureReason: null,
          },
        });
      } else {
        const created = await db.pledge.create({
          data: {
            ...(pledgeId ? { id: pledgeId } : {}),
            userId,
            projectId,
            rewardId,
            amount: amountDollars,
            status: "PENDING",
            paymentProcessor: "DIVINITYCOIN",
            chargedImmediately: true,
            divinityCoinPaymentId: paymentIntentId,
            divinityCoinCheckoutSessionId: sessionId,
            metadata: {
              recovered: { by: admin.id, at: new Date().toISOString(), from: source },
            },
          },
          select: { id: true },
        });
        pledgeId = created.id;
      }
    }

    const result = await handlePaymentSucceeded({ pledgeId: pledgeId as string, paymentId: paymentIntentId as string });
    const after = await db.pledge.findUnique({
      where: { id: pledgeId as string },
      select: { id: true, status: true, backerNumber: true, amount: true, confirmationEmailSent: true, user: { select: { email: true } } },
    });
    log.info({ pledgeId, paymentIntentId, source, adminId: admin.id, result }, "Recovered DivinityCoin pledge");
    return NextResponse.json({
      ok: true,
      pledge: after,
      project: project.title,
      commit: result,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "recover-dc failed");
    return NextResponse.json({ error: "Recovery failed — check server logs" }, { status: 500 });
  }
}
