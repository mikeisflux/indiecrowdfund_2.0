import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const GRACE_PERIOD_DAYS = 30; // 30-day grace period before hard deletion

/**
 * POST /api/user/data-deletion
 * GDPR Article 17: Right to erasure ("right to be forgotten").
 * Schedules a hard deletion of all personal data after a grace period.
 */
export async function POST(req: Request) {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const reason = body.reason || null;

  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // Guarded existence-check + create via advisory lock keyed to userId.
  // Without the lock, two concurrent POSTs could both pass the "existing
  // pending" check and both create DataDeletionRequest rows — resulting
  // in two schedule entries for the same user.
  let request;
  try {
    request = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`data-deletion-${userId}`}))`;

      const existingRequest = await tx.dataDeletionRequest.findFirst({
        where: {
          userId,
          status: { in: ["PENDING", "SCHEDULED"] },
        },
      });

      if (existingRequest) {
        throw new Error(`DELETION_ALREADY_SCHEDULED:${existingRequest.id}:${existingRequest.scheduledFor?.toISOString() ?? ""}`);
      }

      return tx.dataDeletionRequest.create({
        data: {
          userId,
          userEmail: session.user.email,
          status: "SCHEDULED",
          reason,
          scheduledFor,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("DELETION_ALREADY_SCHEDULED:")) {
      const [, requestId, scheduledForStr] = err.message.split(":");
      return NextResponse.json({
        error: "You already have a pending deletion request",
        requestId,
        scheduledFor: scheduledForStr || null,
      }, { status: 409 });
    }
    throw err;
  }

  logger.info({ userId, requestId: request.id, scheduledFor: scheduledFor.toISOString() },
    "GDPR deletion request created");

  return NextResponse.json({
    success: true,
    requestId: request.id,
    scheduledFor: scheduledFor.toISOString(),
    gracePeriodDays: GRACE_PERIOD_DAYS,
    message: `Your account and all associated data will be permanently deleted on ${scheduledFor.toLocaleDateString()}. You can cancel this request before then.`,
  });
}

/**
 * GET /api/user/data-deletion
 * Check the status of data deletion requests.
 */
export async function GET() {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await db.dataDeletionRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      reason: true,
      scheduledFor: true,
      executedAt: true,
      cancelledAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ requests });
}

/**
 * DELETE /api/user/data-deletion
 * Cancel a pending deletion request (within grace period).
 */
export async function DELETE(req: Request) {
  const session = await validateSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const request = await db.dataDeletionRequest.findFirst({
    where: {
      id: requestId,
      userId: session.user.id,
      status: { in: ["PENDING", "SCHEDULED"] },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Deletion request not found or already processed" }, { status: 404 });
  }

  await db.dataDeletionRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  logger.info({ userId: session.user.id, requestId }, "GDPR deletion request cancelled");

  return NextResponse.json({ success: true, message: "Deletion request cancelled" });
}

