import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { reconcileDcRefundAttempt } from "@/lib/payments/divinitycoin/refunds";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { role: true } });
  return user?.role === "SUPER_ADMIN" ? session.user : null;
}

// GET - Refund attempts DivinityCoin never gave a clear answer to. Each one
// blocks further refunds of its payment until an admin reconciles it.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const attempts = await db.dcRefundAttempt.findMany({
    where: { status: { in: ["UNCERTAIN", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, paymentId: true, pledgeId: true, amountCents: true, purpose: true, requestedBy: true, status: true, error: true, createdAt: true },
  });
  const pledgeIds = attempts.map((a: { pledgeId: string | null }) => a.pledgeId).filter((x: string | null): x is string => !!x);
  const pledges = pledgeIds.length
    ? await db.pledge.findMany({
        where: { id: { in: pledgeIds } },
        select: { id: true, user: { select: { email: true, name: true } }, project: { select: { title: true } } },
      })
    : [];
  const byPledge = new Map(pledges.map((p: { id: string }) => [p.id, p]));
  return NextResponse.json({
    attempts: attempts.map((a: { pledgeId: string | null }) => ({ ...a, pledge: a.pledgeId ? byPledge.get(a.pledgeId) ?? null : null })),
  });
}

// POST - { attemptId, refunded: boolean, refundId? } after checking the
// payment in DC's dashboard. refunded:true records the refund as done (and
// it counts toward the over-refund cap); false records that nothing moved.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const attemptId = typeof body.attemptId === "string" ? body.attemptId : "";
  if (!attemptId || typeof body.refunded !== "boolean") {
    return NextResponse.json({ error: "attemptId and refunded (true/false) are required" }, { status: 400 });
  }
  const refundId = body.refunded ? (typeof body.refundId === "string" && body.refundId.trim()) || "reconciled-by-admin" : null;
  const ok = await reconcileDcRefundAttempt(attemptId, admin.id, refundId);
  if (!ok) return NextResponse.json({ error: "Attempt not found or already settled" }, { status: 404 });
  auditLog({
    action: "PAYOUT_SETTINGS_CHANGE",
    actorId: admin.id,
    actorEmail: admin.email || undefined,
    targetId: attemptId,
    targetType: "PAYOUT",
    details: { what: "dc-refund-attempt-reconciled", refunded: body.refunded, refundId },
  });
  return NextResponse.json({ ok: true });
}
