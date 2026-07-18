import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { z } from "zod";
import { notifyOrderLockRequested } from "@/lib/notifications";
import { sendOrderLockRequestEmail } from "@/lib/email/email-templates-misc";

const log = logger.child({ module: "creator-lock-orders" });

export const dynamic = "force-dynamic";

// Committed-pledge filter: same rule the survey uses so we reach real
// backers (COMPLETED, or PENDING with a confirmation / saved card) without
// spamming abandoned carts.
const committedPledgeWhere = {
  deletedAt: null,
  OR: [
    { status: "COMPLETED" as const },
    { status: "PENDING" as const, confirmationEmailSent: true },
    { status: "PENDING" as const, NOT: { divinityCoinPaymentMethodId: null } },
    { status: "PENDING" as const, NOT: { nmiCustomerVaultId: null } },
  ],
};

// Verify the caller owns (or can coordinate fulfillment for) the project.
async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { creatorId: userId },
        { collaborators: { some: { userId, status: "ACCEPTED" } } },
      ],
    },
    select: { id: true, title: true, creator: { select: { name: true } } },
  });
  return project;
}

// GET /api/creator/indiekit/lock-orders?projectId=... — status board.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const pledges = await db.pledge.findMany({
      where: { projectId, ...committedPledgeWhere },
      select: {
        id: true,
        orderLockStatus: true,
        orderLockRequestedAt: true,
        orderLockedAt: true,
        backerNumber: true,
        user: { select: { name: true, email: true } },
        reward: { select: { title: true } },
      },
      orderBy: { backerNumber: "asc" },
    });

    const counts = { eligible: 0, requested: 0, locked: 0, declined: 0 };
    for (const p of pledges) {
      if (p.orderLockStatus === "LOCKED") counts.locked++;
      else if (p.orderLockStatus === "LOCK_REQUESTED") counts.requested++;
      else if (p.orderLockStatus === "DECLINED") counts.declined++;
      else counts.eligible++;
    }

    return NextResponse.json({
      counts,
      total: pledges.length,
      backers: pledges.map((p) => ({
        pledgeId: p.id,
        name: p.user?.name || "Backer",
        email: p.user?.email || "",
        backerNumber: p.backerNumber,
        reward: p.reward?.title || null,
        lockStatus: p.orderLockStatus,
        requestedAt: p.orderLockRequestedAt,
        lockedAt: p.orderLockedAt,
      })),
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "lock-orders GET failed");
    return NextResponse.json({ error: "Failed to load lock status" }, { status: 500 });
  }
}

const postSchema = z.object({
  projectId: z.string().min(1),
  action: z.enum(["request", "remind", "unlock"]).default("request"),
  // Specific pledges to target; omit to target all eligible backers.
  pledgeIds: z.array(z.string()).optional(),
});

// POST /api/creator/indiekit/lock-orders — send (or resend) lock requests.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { projectId, action, pledgeIds } = postSchema.parse(body);

    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // "unlock" reverses a completed lock so the backer can edit their order
    // again. Only touches currently-LOCKED pledges. Does not refund — it just
    // lifts the freeze. Targets specific pledgeIds (per-backer from the UI) or
    // all locked backers when none are given.
    if (action === "unlock") {
      const unlockTargets = await db.pledge.findMany({
        where: {
          projectId,
          ...committedPledgeWhere,
          orderLockStatus: "LOCKED",
          ...(pledgeIds && pledgeIds.length > 0 ? { id: { in: pledgeIds } } : {}),
        },
        select: { id: true },
      });
      if (unlockTargets.length === 0) {
        return NextResponse.json({ requested: 0, message: "No locked orders to unlock." });
      }
      await db.pledge.updateMany({
        where: { id: { in: unlockTargets.map((t) => t.id) } },
        data: { orderLockStatus: "UNLOCKED", orderLockedAt: null },
      });
      return NextResponse.json({
        requested: unlockTargets.length,
        message: `Unlocked ${unlockTargets.length} order${unlockTargets.length === 1 ? "" : "s"}.`,
      });
    }

    // "request" targets not-yet-locked backers (fresh or previously
    // declined); "remind" re-pings those already in LOCK_REQUESTED.
    const targetStatuses =
      action === "remind"
        ? (["LOCK_REQUESTED"] as const)
        : (["UNLOCKED", "DECLINED"] as const);

    const targets = await db.pledge.findMany({
      where: {
        projectId,
        ...committedPledgeWhere,
        orderLockStatus: { in: targetStatuses as unknown as ("UNLOCKED" | "DECLINED" | "LOCK_REQUESTED")[] },
        ...(pledgeIds && pledgeIds.length > 0 ? { id: { in: pledgeIds } } : {}),
      },
      select: { id: true, userId: true, user: { select: { name: true, email: true } } },
    });

    if (targets.length === 0) {
      return NextResponse.json({ requested: 0, message: "No eligible backers to notify." });
    }

    // Flag the pledges (only the fresh-request action flips status; a
    // reminder leaves LOCK_REQUESTED as-is and just re-notifies).
    if (action === "request") {
      await db.pledge.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { orderLockStatus: "LOCK_REQUESTED", orderLockRequestedAt: new Date(), orderLockDeclinedAt: null },
      });
    }

    // Audit-log the request on the project.
    await db.fulfillmentActivity
      .create({
        data: {
          projectId,
          type: "ORDER_LOCK_REQUESTED",
          title: `${action === "remind" ? "Reminded" : "Requested order lock from"} ${targets.length} backer(s)`,
          userId: session.user.id,
        },
      })
      .catch((e: unknown) => log.warn({ err: String(e) }, "activity log failed (non-fatal)"));

    // In-app notifications (batched).
    await notifyOrderLockRequested(
      projectId,
      project.title,
      targets.map((t) => ({ userId: t.userId, id: t.id }))
    );

    // Emails (best-effort per backer; queued).
    const creatorName = project.creator?.name || "The creator";
    await Promise.all(
      targets
        .filter((t) => t.user?.email)
        .map((t) =>
          sendOrderLockRequestEmail(t.user!.email!, t.user?.name || "Backer", project.title, creatorName, t.id).catch(
            (e) => log.warn({ err: String(e), pledgeId: t.id }, "lock request email failed (non-fatal)")
          )
        )
    );

    return NextResponse.json({
      requested: targets.length,
      message: `${action === "remind" ? "Reminder sent to" : "Lock request sent to"} ${targets.length} backer(s).`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 });
    }
    log.error({ err: formatError(error) }, "lock-orders POST failed");
    return NextResponse.json({ error: "Failed to send lock requests" }, { status: 500 });
  }
}
