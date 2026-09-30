import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import {
  attemptRecoupCharge,
  waiveRecoup,
  openChargebackRecoup,
  CHARGEBACK_RECOUP_FEE_USD,
} from "@/lib/payments/chargeback-recoup";

const log = logger.child({ module: "admin-chargeback-recoups" });

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true, role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") return null;
  return user;
}

function serialize(r: {
  id: string;
  projectId: string;
  pledgeId: string;
  disputeId: string | null;
  processor: string | null;
  reason: string | null;
  disputedAmount: unknown;
  feeAmount: unknown;
  amount: unknown;
  status: string;
  attempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  divinityCoinPaymentId: string | null;
  chargedAt: Date | null;
  waivedAt: Date | null;
  waivedReason: string | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    projectId: r.projectId,
    pledgeId: r.pledgeId,
    disputeId: r.disputeId,
    processor: r.processor,
    reason: r.reason,
    disputedAmount: Number(r.disputedAmount),
    feeAmount: Number(r.feeAmount),
    amount: Number(r.amount),
    status: r.status,
    attempts: r.attempts,
    nextAttemptAt: r.nextAttemptAt,
    lastError: r.lastError,
    paymentId: r.divinityCoinPaymentId,
    chargedAt: r.chargedAt,
    waivedAt: r.waivedAt,
    waivedReason: r.waivedReason,
    createdAt: r.createdAt,
  };
}

// GET ?projectId= — recoups for one project (admin payouts dialog), or
// every open recoup platform-wide when projectId is omitted.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const projectId = new URL(req.url).searchParams.get("projectId");
  const rows = await db.chargebackRecoup.findMany({
    where: projectId
      ? { projectId }
      : { status: { in: ["PENDING", "FAILED", "HELD_BACK"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const pledgeIds = [...new Set(rows.map((r: { pledgeId: string }) => r.pledgeId))];
  const pledges = pledgeIds.length
    ? await db.pledge.findMany({
        where: { id: { in: pledgeIds } },
        select: { id: true, backerNumber: true, user: { select: { name: true, email: true } } },
      })
    : [];
  const byPledge = new Map(pledges.map((p) => [p.id, p]));

  return NextResponse.json({
    fee: CHARGEBACK_RECOUP_FEE_USD,
    recoups: rows.map((r: Parameters<typeof serialize>[0]) => {
      const p = byPledge.get(r.pledgeId);
      return {
        ...serialize(r),
        backerNumber: p?.backerNumber ?? null,
        backerName: p?.user?.name ?? null,
        backerEmail: p?.user?.email ?? null,
      };
    }),
  });
}

// POST { action: "charge" | "waive" | "create", ... }
//   charge: { recoupId }            — try the creator's card now
//   waive:  { recoupId, reason }    — stop collecting
//   create: { pledgeId, amount? }   — open a recoup for a CHARGEBACK pledge
//                                     that predates automatic recoups
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "charge") {
      const recoupId = typeof body.recoupId === "string" ? body.recoupId : "";
      if (!recoupId) return NextResponse.json({ error: "recoupId is required" }, { status: 400 });
      const res = await attemptRecoupCharge(recoupId, { actorId: admin.id, force: true });
      return NextResponse.json({ ok: res.status === "CHARGED", ...res });
    }

    if (action === "waive") {
      const recoupId = typeof body.recoupId === "string" ? body.recoupId : "";
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!recoupId || !reason) {
        return NextResponse.json({ error: "recoupId and reason are required" }, { status: 400 });
      }
      const ok = await waiveRecoup(recoupId, admin.id, reason);
      return NextResponse.json({ ok, status: ok ? "WAIVED" : "unchanged" });
    }

    if (action === "create") {
      const pledgeId = typeof body.pledgeId === "string" ? body.pledgeId : "";
      if (!pledgeId) return NextResponse.json({ error: "pledgeId is required" }, { status: 400 });
      const pledge = await db.pledge.findFirst({
        where: { id: pledgeId, deletedAt: null },
        select: { id: true, projectId: true, amount: true, status: true, metadata: true },
      });
      if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      if (pledge.status !== "CHARGEBACK") {
        return NextResponse.json({ error: "Pledge is not marked CHARGEBACK" }, { status: 400 });
      }
      const meta = (pledge.metadata && typeof pledge.metadata === "object"
        ? (pledge.metadata as Record<string, unknown>)
        : {}) as { dispute?: { disputeId?: string; reason?: string; processor?: string } };
      const amount = typeof body.amount === "number" && body.amount > 0 ? body.amount : Number(pledge.amount);
      const res = await openChargebackRecoup({
        pledgeId,
        projectId: pledge.projectId,
        disputedAmount: amount,
        processor: meta.dispute?.processor || "manual",
        disputeId: meta.dispute?.disputeId || null,
        reason: meta.dispute?.reason || null,
      });
      const row = await db.chargebackRecoup.findUnique({ where: { id: res.recoupId } });
      return NextResponse.json({ ok: true, created: res.created, recoup: row ? serialize(row) : null });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    log.error({ err: formatError(error) }, "chargeback-recoups POST failed");
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
