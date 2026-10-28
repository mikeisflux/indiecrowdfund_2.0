import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "merge-user" });

/**
 * Transfer all data from oldUserId to keeperUserId, then soft-delete the old user.
 */
export async function mergeUserInto(oldUserId: string, keeperUserId: string) {
  // Use a transaction for atomicity
  await db.$transaction(async (tx) => {
    // --- Many-to-one relations (just update the foreign key) ---

    // Pledges
    await tx.pledge.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Messages (sent and received)
    await tx.message.updateMany({
      where: { senderId: oldUserId },
      data: { senderId: keeperUserId },
    });
    await tx.message.updateMany({
      where: { recipientId: oldUserId },
      data: { recipientId: keeperUserId },
    });

    // Chat messages
    await tx.chatMessage.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Comments
    await tx.comment.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Notifications
    await tx.notification.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Email logs
    await tx.emailLog.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // User behaviors
    await tx.userBehavior.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Bug reports
    await tx.bugReport.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Media files
    await tx.mediaFile.updateMany({
      where: { uploaderId: oldUserId },
      data: { uploaderId: keeperUserId },
    });

    // Achievements
    await tx.userAchievement.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // DivinityCoin transactions
    await tx.divinityCoinTransaction.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // DivinityCoin redemptions
    await tx.divinityCoinRedemption.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Redemption bonus ledgers
    await tx.redemptionBonusLedger.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Redemption bonus applications
    await tx.redemptionBonusApplication.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Backer notes
    await tx.backerNote.updateMany({
      where: { createdById: oldUserId },
      data: { createdById: keeperUserId },
    });

    // Email campaign clicks
    await tx.emailCampaignClick.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Saved addresses
    await tx.userAddress.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Project collections
    await tx.projectCollection.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Project notification preferences
    await tx.projectNotificationPreference.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Creator follows (both directions)
    await tx.creatorFollow.updateMany({
      where: { followerId: oldUserId },
      data: { followerId: keeperUserId },
    });
    await tx.creatorFollow.updateMany({
      where: { creatorId: oldUserId },
      data: { creatorId: keeperUserId },
    });

    // Email list subscribers
    await tx.emailListSubscriber.updateMany({
      where: { creatorId: oldUserId },
      data: { creatorId: keeperUserId },
    });

    // Digital files (uploaded by user)
    await tx.digitalFile.updateMany({
      where: { uploadedById: oldUserId },
      data: { uploadedById: keeperUserId },
    });

    // ID Verifications
    await tx.iDVerification.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // API Keys
    await tx.apiKey.updateMany({
      where: { createdById: oldUserId },
      data: { createdById: keeperUserId },
    });

    // Projects (created by user)
    await tx.project.updateMany({
      where: { creatorId: oldUserId },
      data: { creatorId: keeperUserId },
    });

    // Project collaborations
    await tx.projectCollaborator.updateMany({
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
    });

    // Marketplace relations
    await tx.marketplaceBook.updateMany({
      where: { creatorId: oldUserId },
      data: { creatorId: keeperUserId },
    });
    await tx.marketplacePurchase.updateMany({
      where: { buyerId: oldUserId },
      data: { buyerId: keeperUserId },
    });
    await tx.marketplaceBookReview.updateMany({
      where: { reviewerId: oldUserId },
      data: { reviewerId: keeperUserId },
    });
    await tx.marketplaceDiscountCode.updateMany({
      where: { creatorId: oldUserId },
      data: { creatorId: keeperUserId },
    });
    await tx.marketplaceCodeRedemption.updateMany({
      where: { customerId: oldUserId },
      data: { customerId: keeperUserId },
    });

    // Changelog entries
    await tx.changelogEntry.updateMany({
      where: { authorId: oldUserId },
      data: { authorId: keeperUserId },
    });

    // --- One-to-one relations (keeper takes priority, delete old if keeper has one) ---

    // UserPreference
    const keeperPref = await tx.userPreference.findUnique({ where: { userId: keeperUserId } });
    if (keeperPref) {
      await tx.userPreference.deleteMany({ where: { userId: oldUserId } });
    } else {
      await tx.userPreference.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // UserInterestProfile
    const keeperInterest = await tx.userInterestProfile.findUnique({ where: { userId: keeperUserId } });
    if (keeperInterest) {
      await tx.userInterestProfile.deleteMany({ where: { userId: oldUserId } });
    } else {
      await tx.userInterestProfile.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // ChatPresence
    const keeperPresence = await tx.chatPresence.findUnique({ where: { userId: keeperUserId } });
    if (keeperPresence) {
      await tx.chatPresence.deleteMany({ where: { userId: oldUserId } });
    } else {
      await tx.chatPresence.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // StripeConfig
    const keeperStripe = await tx.stripeConfig.findUnique({ where: { userId: keeperUserId } });
    if (keeperStripe) {
      await tx.stripeConfig.deleteMany({ where: { userId: oldUserId } });
    } else {
      await tx.stripeConfig.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // DivinityCoinBankAccount
    const keeperBank = await tx.divinityCoinBankAccount.findUnique({ where: { userId: keeperUserId } });
    if (keeperBank) {
      await tx.divinityCoinBankAccount.deleteMany({ where: { userId: oldUserId } });
    } else {
      await tx.divinityCoinBankAccount.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // CompanyProfile
    const keeperCompany = await tx.companyProfile.findUnique({ where: { userId: keeperUserId } });
    if (keeperCompany) {
      await tx.companyProfile.deleteMany({ where: { userId: oldUserId } });
    } else {
      await tx.companyProfile.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // Retailer (optional userId, @unique)
    const keeperRetailer = await tx.retailer.findFirst({ where: { userId: keeperUserId } });
    if (keeperRetailer) {
      // Unlink old user's retailer (don't delete the retailer application itself)
      await tx.retailer.updateMany({ where: { userId: oldUserId }, data: { userId: null } });
    } else {
      await tx.retailer.updateMany({ where: { userId: oldUserId }, data: { userId: keeperUserId } });
    }

    // --- Merge DivinityCoin balance ---
    // Lock the old user row FOR UPDATE so any in-flight DC webhook that
    // would modify the old user's balance is serialized out — otherwise we
    // might read a stale balance, increment the keeper by that stale value,
    // and lose the webhook's delta when the old user gets soft-deleted.
    await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${oldUserId} FOR UPDATE`;
    const oldUserData = await tx.user.findUnique({
      where: { id: oldUserId },
      select: { divinityCoinBalance: true },
    });
    if (oldUserData && Number(oldUserData.divinityCoinBalance) > 0) {
      await tx.user.update({
        where: { id: keeperUserId },
        data: {
          divinityCoinBalance: {
            increment: Number(oldUserData.divinityCoinBalance),
          },
        },
      });
      // Zero out the old user's balance atomically so a future read of the
      // soft-deleted row can't double-count.
      await tx.user.update({
        where: { id: oldUserId },
        data: { divinityCoinBalance: 0 },
      });
    }

    // --- Clean up old user's auth data ---
    // Delete sessions for old user
    await tx.session.deleteMany({ where: { userId: oldUserId } });

    // Delete accounts (OAuth) for old user
    await tx.account.deleteMany({ where: { userId: oldUserId } });

    // --- Soft-delete the old user ---
    await tx.user.update({
      where: { id: oldUserId },
      data: {
        deletedAt: new Date(),
        email: `merged_${oldUserId}@deleted.local`, // Free up the email
      },
    });

    log.info({ oldUserId, keeperUserId }, "[MergeAccounts] merged user");
  });
}
