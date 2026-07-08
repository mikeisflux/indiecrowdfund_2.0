import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const deleteAccountLogger = logger.child({ module: "user-delete-account" });

export const dynamic = "force-dynamic";

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

// POST /api/user/delete-account
// Body: { password?: string, confirmText: "DELETE MY ACCOUNT" }
//
// Permanently deletes the calling user's account from the platform's
// perspective:
//   - Wipes all sensitive PII (password, OAuth, integration tokens,
//     image, bio, location, social links, Stripe customer ID, etc.)
//   - Sets `accountDeletedAt` so the auth flow can reject future
//     login attempts.
//   - Cancels all PENDING pledges, returning their reward slots and
//     decrementing the project backer counts.
//   - Anonymizes COMPLETED pledges in place: address replaced with the
//     "Account deleted" sentinel and PledgeAddon quantities zeroed.
//     Funds stay with the creator. Pledge row is preserved so the
//     creator's backer report still shows the original name + email
//     for audit / record-keeping.
//   - Deletes sessions (cascade), OAuth links (cascade), notifications,
//     follows, project notification preferences, saved addresses,
//     and project collections.
//
// Refuses to delete if the user owns LIVE projects — those need to be
// wound down first (creator support flow). FUNDED / FAILED / CANCELLED
// projects don't block deletion.
//
// This action is irreversible; the user is signed out client-side
// after the response.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { password?: string; confirmText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { password, confirmText } = body;

  // Typed-confirmation phrase prevents accidental clicks. The dialog
  // requires the user to type this string verbatim.
  if (confirmText !== "DELETE MY ACCOUNT") {
    return NextResponse.json(
      { error: 'Please type "DELETE MY ACCOUNT" to confirm.' },
      { status: 400 }
    );
  }

  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, password: true, accountDeletedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.accountDeletedAt) {
    return NextResponse.json(
      { error: "Account is already deleted." },
      { status: 410 }
    );
  }

  // Password verification: required if the user has one. OAuth-only
  // users (no password set) skip this since the typed confirmation
  // already gates the destructive action.
  if (user.password) {
    if (!password) {
      return NextResponse.json(
        { error: "Password required to delete account." },
        { status: 400 }
      );
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: "Password is incorrect." },
        { status: 401 }
      );
    }
  }

  // Refuse deletion while the user owns running campaigns. They need
  // to cancel or finish those first via the creator dashboard.
  const liveProjectCount = await db.project.count({
    where: { creatorId: userId, status: "LIVE", deletedAt: null },
  });
  if (liveProjectCount > 0) {
    return NextResponse.json(
      {
        error:
          "You have one or more LIVE campaigns. Please cancel or finish them before deleting your account, or contact support@indiecrowdfund.com.",
      },
      { status: 409 }
    );
  }

  // ---------------------------------------------------------------
  // Run the deletion routine in a single transaction so a partial
  // failure never leaves the account in a half-deleted state. Side
  // effects only — no return value to the caller other than success.
  // ---------------------------------------------------------------
  try {
    await db.$transaction(async (tx) => {
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
        const completedIds = completedPledges.map((p) => p.id);
        await tx.pledge.updateMany({
          where: { id: { in: completedIds } },
          data: {
            shippingAddress: DELETED_ADDRESS_SENTINEL,
            surveyResponses: undefined,
            surveyCompleted: false,
          },
        });
        await tx.pledgeAddon.updateMany({
          where: { pledgeId: { in: completedIds } },
          data: { quantity: 0 },
        });
      }

      // 3. Personal data + cross-reference cleanup. None of these
      // affect the creator-side backer record. Cascade deletes
      // (Account, Session) are handled automatically when we update
      // the User row at the end, but we proactively delete the rest.
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
          lockedAt: null,
          lockedReason: null,
          lockedById: null,
          lastKnownIP: null,
          failedLoginAttempts: 0,
          lastFailedLoginAt: null,
          divinityCoinBalance: 0,
        },
      });
    });
  } catch (err) {
    deleteAccountLogger.error(
      { err: String(err), userId },
      "Account deletion transaction failed"
    );
    return NextResponse.json(
      { error: "Account deletion failed. Please try again or contact support." },
      { status: 500 }
    );
  }

  deleteAccountLogger.info({ userId }, "Account deleted by user request");

  return NextResponse.json({
    success: true,
    message:
      "Your account has been deleted. You will be signed out shortly.",
  });
}
