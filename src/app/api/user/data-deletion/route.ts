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

  // Check for existing pending request
  const existingRequest = await db.dataDeletionRequest.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "SCHEDULED"] },
    },
  });

  if (existingRequest) {
    return NextResponse.json({
      error: "You already have a pending deletion request",
      requestId: existingRequest.id,
      scheduledFor: existingRequest.scheduledFor,
    }, { status: 409 });
  }

  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const request = await db.dataDeletionRequest.create({
    data: {
      userId,
      userEmail: session.user.email,
      status: "SCHEDULED",
      reason,
      scheduledFor,
    },
  });

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

/**
 * Execute pending deletions (called by a cron job).
 * This performs the actual hard deletion of user data.
 */
export async function executePendingDeletions(): Promise<number> {
  const now = new Date();

  const pendingDeletions = await db.dataDeletionRequest.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: now },
    },
  });

  let deletedCount = 0;

  for (const request of pendingDeletions) {
    try {
      await db.dataDeletionRequest.update({
        where: { id: request.id },
        data: { status: "EXECUTING" },
      });

      // Hard delete all user data
      const auditLog = await hardDeleteUserData(request.userId);

      await db.dataDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          executedAt: new Date(),
          auditLog,
        },
      });

      deletedCount++;
      logger.info({ userId: request.userId, requestId: request.id },
        "GDPR hard deletion completed");
    } catch (error) {
      logger.error({ userId: request.userId, requestId: request.id, err: error instanceof Error ? error.message : String(error) },
        "GDPR hard deletion failed");
    }
  }

  return deletedCount;
}

/**
 * Hard delete all user data. Returns an audit summary.
 */
async function hardDeleteUserData(userId: string): Promise<Record<string, unknown>> {
  const auditLog: Record<string, number> = {};

  // Delete in order to respect foreign key constraints

  // 1. Behavior/tracking data
  const behaviors = await db.userBehavior.deleteMany({ where: { userId } });
  auditLog.behaviorRecords = behaviors.count;

  // 2. User preferences & interest profiles
  try { await db.userPreference.delete({ where: { userId } }); auditLog.preferences = 1; } catch { auditLog.preferences = 0; }
  try { await db.userInterestProfile.delete({ where: { userId } }); auditLog.interestProfile = 1; } catch { auditLog.interestProfile = 0; }

  // 3. Notifications
  const notifications = await db.notification.deleteMany({ where: { userId } });
  auditLog.notifications = notifications.count;

  // 4. Comments
  const comments = await db.comment.deleteMany({ where: { userId } });
  auditLog.comments = comments.count;

  // 5. Addresses
  const addresses = await db.userAddress.deleteMany({ where: { userId } });
  auditLog.addresses = addresses.count;

  // 6. Email logs
  const emailLogs = await db.emailLog.deleteMany({ where: { userId } });
  auditLog.emailLogs = emailLogs.count;

  // 7. Sessions
  const sessions = await db.session.deleteMany({ where: { userId } });
  auditLog.sessions = sessions.count;

  // 8. Accounts (OAuth)
  const accounts = await db.account.deleteMany({ where: { userId } });
  auditLog.accounts = accounts.count;

  // 9. CCPA opt-outs
  const ccpaOptOuts = await db.ccpaOptOut.deleteMany({ where: { userId } });
  auditLog.ccpaOptOuts = ccpaOptOuts.count;

  // 10. Data export requests
  const exports = await db.dataExportRequest.deleteMany({ where: { userId } });
  auditLog.exportRequests = exports.count;

  // 11. Anonymize the user record (keep for financial records / pledge history)
  await db.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.local`,
      name: "[Deleted User]",
      password: null,
      bio: null,
      location: null,
      timezone: null,
      vanityUrl: null,
      websites: [],
      socialLinks: null,
      image: null,
      heroImage: null,
      dateOfBirth: null,
      emailUnsubscribedAt: new Date(),
    },
  });
  auditLog.userAnonymized = 1;

  return { deletedAt: new Date().toISOString(), ...auditLog };
}
