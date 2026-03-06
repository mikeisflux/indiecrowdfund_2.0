import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }
  return { user: session.user };
}

// GET - Find all duplicate email accounts (case-insensitive)
export async function GET() {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // Find duplicate emails using case-insensitive grouping
    const duplicates = await db.$queryRaw<
      Array<{ lower_email: string; count: bigint }>
    >`
      SELECT LOWER(email) as lower_email, COUNT(*) as count
      FROM "User"
      WHERE "deletedAt" IS NULL
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      return NextResponse.json({ duplicates: [], totalGroups: 0 });
    }

    // For each duplicate group, fetch the full user records
    const groups = await Promise.all(
      duplicates.map(async (dup) => {
        const users = await db.user.findMany({
          where: {
            email: { contains: dup.lower_email, mode: "insensitive" },
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            role: true,
            _count: {
              select: {
                pledges: true,
                createdProjects: true,
                sessions: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

        // The keeper is the one most recently active (most recent updatedAt)
        const keeper = users[0];
        const duplicateUsers = users.slice(1);

        return {
          email: dup.lower_email,
          count: Number(dup.count),
          keeper,
          duplicates: duplicateUsers,
        };
      })
    );

    return NextResponse.json({
      duplicates: groups,
      totalGroups: groups.length,
    });
  } catch (error) {
    console.error("Error finding duplicate accounts:", error);
    return NextResponse.json(
      { error: "Failed to find duplicate accounts" },
      { status: 500 }
    );
  }
}

// POST - Merge duplicate accounts
export async function POST() {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // Find duplicate emails
    const duplicates = await db.$queryRaw<
      Array<{ lower_email: string; count: bigint }>
    >`
      SELECT LOWER(email) as lower_email, COUNT(*) as count
      FROM "User"
      WHERE "deletedAt" IS NULL
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      return NextResponse.json({
        message: "No duplicate accounts found",
        merged: 0,
      });
    }

    const results: Array<{
      email: string;
      keeperId: string;
      mergedIds: string[];
    }> = [];

    for (const dup of duplicates) {
      const users = await db.user.findMany({
        where: {
          email: { contains: dup.lower_email, mode: "insensitive" },
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (users.length < 2) continue;

      // Keeper is the most recently active user
      const keeper = users[0];
      const toMerge = users.slice(1);
      const mergedIds: string[] = [];

      for (const oldUser of toMerge) {
        await mergeUser(oldUser.id, keeper.id);
        mergedIds.push(oldUser.id);
      }

      // Normalize the keeper's email to lowercase
      await db.user.update({
        where: { id: keeper.id },
        data: { email: dup.lower_email },
      });

      results.push({
        email: dup.lower_email,
        keeperId: keeper.id,
        mergedIds,
      });
    }

    return NextResponse.json({
      message: `Merged ${results.length} duplicate account group(s)`,
      merged: results.length,
      results,
    });
  } catch (error) {
    console.error("Error merging duplicate accounts:", error);
    return NextResponse.json(
      { error: "Failed to merge duplicate accounts" },
      { status: 500 }
    );
  }
}

/**
 * Transfer all data from oldUserId to keeperUserId, then soft-delete the old user.
 */
async function mergeUser(oldUserId: string, keeperUserId: string) {
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
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
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
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
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
      where: { userId: oldUserId },
      data: { userId: keeperUserId },
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
    const oldUserData = await tx.user.findUnique({
      where: { id: oldUserId },
      select: { divinityCoinBalance: true },
    });
    if (oldUserData && Number(oldUserData.divinityCoinBalance) > 0) {
      await tx.user.update({
        where: { id: keeperUserId },
        data: {
          divinityCoinBalance: {
            increment: oldUserData.divinityCoinBalance,
          },
        },
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

    console.log(`[MergeAccounts] Merged user ${oldUserId} into ${keeperUserId}`);
  });
}
