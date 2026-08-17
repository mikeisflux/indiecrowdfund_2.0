import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "account-deletion" });

// Prisma's sentinel for "set this JSON column to SQL NULL".
//
// Passing plain `null` to a nullable Json field is rejected at runtime, and
// passing `undefined` silently means "leave it as it is" — which is exactly
// how the survey answers below went on surviving deletion. The value exists on
// the runtime client but this project's generated types expose `Prisma` as a
// namespace only, so it is read through a narrow cast rather than imported.
const DB_NULL = (
  require("@prisma/client") as { Prisma: { DbNull: unknown } }
).Prisma.DbNull as never;

// Sentinel object written to Pledge.shippingAddress when the backer
// deletes their account. Backer reports render this verbatim so the
// creator sees a clear "this person is gone, do not ship" signal
// instead of a stale address.
const DELETED_ADDRESS_SENTINEL = {
  name: "Account deleted",
  line1: "Account deleted",
  line2: null,
  city: "Account deleted",
  state: "",
  postalCode: "",
  country: "",
  phone: null,
  accountDeleted: true as const,
};

// Executes the irreversible deletion. Extracted from the user-facing route
// so admin approval of a creator's deletion request runs the exact same
// routine — two implementations would inevitably drift, and this one is the
// side of the system that can't be undone.
//
// Callers are responsible for authorization and for the eligibility gate
// (see ./eligibility.ts). This function only performs the wipe.
//
//   - Wipes all sensitive PII (password, OAuth, integration tokens,
//     image, bio, location, social links, Stripe customer ID, etc.)
//   - Sets `accountDeletedAt`, which the auth flow rejects on login,
//     password reset, and re-registration.
//   - Cancels all PENDING pledges, returning their reward slots and
//     decrementing the project backer counts.
//   - Anonymizes COMPLETED pledges in place: address replaced with the
//     "Account deleted" sentinel and PledgeAddon quantities zeroed.
//     Funds stay with the creator. Pledge row is preserved so the
//     creator's backer report still shows the original name + email
//     for audit / record-keeping.
//   - Deletes sessions, OAuth links, notifications, follows, project
//     notification preferences, saved addresses, and collections.
//
// Runs in a single transaction so a partial failure never leaves the
// account half-deleted. Throws on failure; callers map that to a response.
export async function performAccountDeletion(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    // 0. Was this account banned on the way out?
    //
    // It matters before anything else is touched. Deletion used to null
    // lockedAt / lockedReason / lockedById / lastKnownIP unconditionally,
    // which handed every banned user a one-click way to erase their own
    // enforcement record: press Delete Account and the ban goes with it.
    //
    // The damage went further than the row. enforce-chargeback-bans picks its
    // source bans by looking for users whose lockedReason mentions a
    // chargeback, so a banned user who deleted their account stopped
    // propagating to new signups sharing their IP — the exact evasion the
    // Terms say is not allowed.
    const existing = await tx.user.findUnique({
      where: { id: userId },
      select: { lockedAt: true, lastKnownIP: true },
    });
    const wasBanned = !!existing?.lockedAt;

    // 1. Cancel PENDING pledges. These were never charged, so the
    // money side is a no-op — we just flip status and free the
    // reward slot back up so a new backer can claim it.
    const pendingPledges = await tx.pledge.findMany({
      where: { userId, status: "PENDING", deletedAt: null },
      select: { id: true, projectId: true, rewardId: true },
    });
    if (pendingPledges.length > 0) {
      await tx.pledge.updateMany({
        where: { id: { in: pendingPledges.map((p) => p.id) } },
        data: { status: "CANCELLED" },
      });
      // Decrement claimed quantity on any tier rewards the cancelled
      // pledges held. Pledges without a rewardId (no-reward pledges)
      // contribute nothing to claim counts.
      const rewardIdsToFree = pendingPledges
        .map((p) => p.rewardId)
        .filter((id): id is string => !!id);
      if (rewardIdsToFree.length > 0) {
        // Group by reward id so we issue one decrement per reward.
        const counts = new Map<string, number>();
        for (const id of rewardIdsToFree) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        for (const [rewardId, count] of counts) {
          await tx.reward.update({
            where: { id: rewardId },
            data: { quantityClaimed: { decrement: count } },
          });
        }
      }
      // Decrement project backer counts to match.
      const projectCancellations = new Map<string, number>();
      for (const p of pendingPledges) {
        projectCancellations.set(
          p.projectId,
          (projectCancellations.get(p.projectId) ?? 0) + 1
        );
      }
      for (const [projectId, count] of projectCancellations) {
        await tx.project.update({
          where: { id: projectId },
          data: { backerCount: { decrement: count } },
        });
      }
    }

    // 2. For COMPLETED pledges, the creator keeps the money and the
    // pledge row stays so their backer report is preserved. We
    // anonymize the address and zero addon quantities so the creator
    // doesn't try to ship to a deleted account.
    const completedPledges = await tx.pledge.findMany({
      where: { userId, status: "COMPLETED", deletedAt: null },
      select: { id: true },
    });
    if (completedPledges.length > 0) {
      const completedIds = completedPledges.map((p: { id: string }) => p.id);
      await tx.pledge.updateMany({
        where: { id: { in: completedIds } },
        data: {
          shippingAddress: DELETED_ADDRESS_SENTINEL,
          // Prisma reads `undefined` as "leave this field alone", so the
          // previous value here cleared nothing at all — the backer's survey
          // answers stayed on the pledge after deletion. DbNull is how a JSON
          // column is actually set to NULL.
          surveyResponses: DB_NULL,
          surveyCompleted: false,
        },
      });
      await tx.pledgeAddon.updateMany({
        where: { pledgeId: { in: completedIds } },
        data: { quantity: 0 },
      });
    }

    // 2b. The survey response is a separate row, and it is the one that counts.
    //
    // resolvePledgeShippingAddress() reads the survey address FIRST and only
    // falls back to the pledge address. Writing the sentinel to the pledge
    // while leaving SurveyResponse.shippingAddress intact meant the deleted
    // backer's real home address was still what every fulfilment surface
    // returned — backer reports, CSV exports, and the ShipStation push. The
    // "Account deleted" marker was written to a field nothing read.
    //
    // Covers every pledge the user made, not only completed ones: a cancelled
    // pledge's survey answers are just as personal.
    const allPledges = await tx.pledge.findMany({
      where: { userId },
      select: { id: true },
    });
    if (allPledges.length > 0) {
      await tx.surveyResponse.updateMany({
        where: { pledgeId: { in: allPledges.map((p: { id: string }) => p.id) } },
        data: {
          shippingAddress: DELETED_ADDRESS_SENTINEL,
          // Free-text answers routinely contain names, addresses and phone
          // numbers regardless of what the question asked for.
          backerResponses: DB_NULL,
          itemResponses: DB_NULL,
        },
      });
    }

    // 3. Personal data + cross-reference cleanup. None of these
    // affect the creator-side backer record.
    await Promise.all([
      tx.notification.deleteMany({ where: { userId } }),
      tx.creatorFollow.deleteMany({
        where: { OR: [{ followerId: userId }, { creatorId: userId }] },
      }),
      tx.projectNotificationPreference.deleteMany({ where: { userId } }),
      tx.userAddress.deleteMany({ where: { userId } }),
      tx.projectCollection.deleteMany({ where: { userId } }),
      tx.userPreference.deleteMany({ where: { userId } }),
      tx.userBehavior.deleteMany({ where: { userId } }),
      tx.session.deleteMany({ where: { userId } }),
      tx.account.deleteMany({ where: { userId } }),
    ]);

    // 4. Wipe sensitive User fields. name + email are intentionally
    // preserved so creators retain backer records on completed
    // pledges. role is reset to USER so a deleted admin doesn't
    // retain elevated access if the row is ever inspected.
    await tx.user.update({
      where: { id: userId },
      data: {
        accountDeletedAt: new Date(),
        password: null,
        image: null,
        heroImage: null,
        bio: null,
        location: null,
        timezone: null,
        vanityUrl: null,
        websites: [],
        socialLinks: undefined,
        showNameOnly: false,
        role: "USER",
        retailerAccess: false,
        creatorEmailHandle: null,
        stripeCustomerId: null,
        shopifyApiKey: null,
        shopifyApiSecret: null,
        shopifyAccessToken: null,
        shopifyShopDomain: null,
        shipstationApiKey: null,
        shipstationApiSecret: null,
        shippoApiToken: null,
        easypostApiKey: null,
        stampsIntegrationId: null,
        stampsUsername: null,
        stampsPassword: null,
        emailUnsubscribedAt: new Date(), // Hard email opt-out
        idVerified: false,
        idVerifiedAt: null,
        idVerificationId: null,
        dateOfBirth: null,
        chatBannedAt: null,
        chatBannedById: null,
        chatBanReason: null,
        // A ban outlives the account that earned it. For an unbanned user
        // these still clear, so an ordinary deletion drops the IP as it
        // always did; for a banned one `undefined` leaves the enforcement
        // record standing. See the note at the top of the transaction.
        lockedAt: wasBanned ? undefined : null,
        lockedReason: wasBanned ? undefined : null,
        lockedById: wasBanned ? undefined : null,
        lastKnownIP: wasBanned ? undefined : null,
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        divinityCoinBalance: 0,
      },
    });

    // 5. Pin a banned account's last IP into the blocklist.
    //
    // The User row is not a durable home for this: a later privacy sweep,
    // or a hard delete, takes the ban enforcement with it. IPBlocklist is
    // the table the signup path and enforce-chargeback-bans already consult,
    // and it survives the user record. Same upsert shape the chargeback cron
    // uses, so a row it already wrote is left alone.
    if (wasBanned && existing?.lastKnownIP) {
      await tx.iPBlocklist.upsert({
        where: { ipAddress: existing.lastKnownIP },
        update: {},
        create: {
          ipAddress: existing.lastKnownIP,
          userId,
          reason: "Banned account deleted — retained to prevent ban evasion",
        },
      });
    }
  });

  log.info({ userId }, "Account deletion completed");
}
