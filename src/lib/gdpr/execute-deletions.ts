import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

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
      // CAS on status: SCHEDULED → EXECUTING so two concurrent cron
      // runs don't both claim the same request and both execute
      // hardDeleteUserData(). While the delete operations are largely
      // idempotent (deleteMany), the user anonymization update would
      // run twice and the final status flip to COMPLETED would race.
      const claimCas = await db.dataDeletionRequest.updateMany({
        where: { id: request.id, status: "SCHEDULED" },
        data: { status: "EXECUTING" },
      });
      if (claimCas.count === 0) {
        // Another cron run already claimed this request
        continue;
      }

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

  // 2. User preferences & interest profiles. Use deleteMany so a
  // missing row doesn't throw P2025 (which used to be swallowed by
  // the broader try/catch anyway, but this is cleaner).
  const prefs = await db.userPreference.deleteMany({ where: { userId } });
  auditLog.preferences = prefs.count;
  const profile = await db.userInterestProfile.deleteMany({ where: { userId } });
  auditLog.interestProfile = profile.count;

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
