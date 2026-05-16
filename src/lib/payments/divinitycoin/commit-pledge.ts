import { db } from "@/lib/db";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { assignBackerNumber, claimRewardSlot, claimAddonSlots } from "@/lib/payments/rewards";
import { paymentsDivinitycoinLogger as log } from "./config";

// Shared commit bookkeeping for DivinityCoin saved-card (SETUP-mode)
// pledges. Two callers in Phase 2+:
//
//   1. /api/pledges/[pledgeId]/confirm-dc-setup
//      The browser confirmed the SetupIntent and POSTs the pm_... back
//      (or the server resolves it via get-setup-intent after a 3DS
//      redirect). Same flow that's been live since the inline Stripe
//      Elements integration.
//
//   2. /api/pledges/[pledgeId]/confirm-dc-checkout (Phase 2 new)
//      The user finished a hosted-checkout SETUP session on
//      divinitycoin.com and we resolved the pm_... via
//      get-checkout-session.
//
//   3. handleCheckoutCompleted webhook (Phase 1 stub → Phase 2 wired)
//      DC fires checkout.completed for the same session. Both paths
//      can win; the CAS on confirmationEmailSent guarantees exactly
//      one commit runs the side effects.
//
// PAYMENT-mode pledges (KIA / already-funded AoN / hosted-checkout
// PAYMENT mode) are NOT committed here — they ride the existing
// handlePaymentSucceeded path keyed off the payment.succeeded webhook.
// That handler does its own status-flip CAS and runs an overlapping
// confirmationEmailSent CAS, so a PAYMENT-mode pledge that also routed
// through here would be safely deduped — but in practice we never
// call commitDcPledge for a PAYMENT-mode pledge.
//
// Behavior MUST stay byte-identical to the pre-extraction logic in
// confirm-dc-setup/route.ts — that's the whole bookkeeping contract:
// atomic confirmationEmailSent flip, project counter bumps, just-
// reached-goal notification, reward + addon slot claims, creator
// notification, backer number assignment, confirmation email + log.

export interface CommitDcPledgeInput {
  pledgeId: string;
  // Saved-card evidence collected by the caller. At least
  // paymentMethodId should be set for a real commit; setupIntentId is
  // optional context for logging + persistence consistency.
  paymentMethodId?: string;
  setupIntentId?: string;
  // Optional source label for logs ("confirm-dc-setup" |
  // "confirm-dc-checkout" | "checkout-webhook"). Helps tag which path
  // won the CAS race when both fire.
  source?: string;
}

export interface CommitDcPledgeResult {
  ok: true;
  pledgeId: string;
  alreadyCommitted: boolean;
  /** True when this commit pushed currentAmount across goalAmount. */
  justReachedGoal: boolean;
}

export async function commitDcPledge(
  input: CommitDcPledgeInput
): Promise<{ ok: false; error: string } | CommitDcPledgeResult> {
  const { pledgeId, paymentMethodId, setupIntentId, source = "unknown" } = input;

  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId, deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          currency: true,
          goalAmount: true,
          currentAmount: true,
          creatorId: true,
          creator: { select: { vanityUrl: true } },
        },
      },
      user: { select: { id: true, email: true, name: true } },
      reward: { select: { id: true, title: true, amount: true } },
      addons: {
        select: {
          addonId: true,
          quantity: true,
          addon: { select: { title: true, amount: true } },
        },
      },
    },
  });

  if (!pledge) {
    return { ok: false, error: "Pledge not found" };
  }

  // Persist saved-card evidence. Idempotent — re-saving the same pm
  // is a no-op write; a different pm replaces the prior one (the
  // charge-on-success cron will use whatever's on file when it runs).
  // We deliberately do NOT early-return when the pm matches: the
  // commit bookkeeping below is keyed on confirmationEmailSent, not
  // the card, so a pledge with a card on file but the flag still
  // false self-heals on the next call.
  const effectiveSetupIntentId = setupIntentId || pledge.divinityCoinSetupIntentId || null;
  if (
    (paymentMethodId && pledge.divinityCoinPaymentMethodId !== paymentMethodId) ||
    (effectiveSetupIntentId && pledge.divinityCoinSetupIntentId !== effectiveSetupIntentId)
  ) {
    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        ...(paymentMethodId ? { divinityCoinPaymentMethodId: paymentMethodId } : {}),
        ...(effectiveSetupIntentId ? { divinityCoinSetupIntentId: effectiveSetupIntentId } : {}),
      },
    });
    log.info(
      { pledgeId: pledge.id, setupIntentId: effectiveSetupIntentId, source },
      "[commitDcPledge] Saved-card evidence persisted on pledge"
    );
  }

  // Atomic confirmationEmailSent flip. The loser of any race (double-
  // submit, retry, webhook firing in parallel with the return-from-DC
  // confirm) gets count === 0 here and returns early — its side
  // effects don't run, so counters aren't double-incremented, slots
  // aren't double-claimed, and the email isn't sent twice.
  const claim = await db.pledge.updateMany({
    where: { id: pledge.id, confirmationEmailSent: false },
    data: { confirmationEmailSent: true },
  });

  if (claim.count === 0) {
    log.info(
      { pledgeId: pledge.id, source },
      "[commitDcPledge] Lost CAS — already committed by another path"
    );
    return { ok: true, pledgeId: pledge.id, alreadyCommitted: true, justReachedGoal: false };
  }

  // Bump the project's denormalized counters.
  const updatedProject = await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { increment: Number(pledge.amount) },
      backerCount: { increment: 1 },
    },
  });

  // Notify the creator if the project just hit its goal.
  const projectIsFunded =
    Number(updatedProject.currentAmount) >= Number(updatedProject.goalAmount);
  const justReachedGoal =
    projectIsFunded &&
    Number(updatedProject.currentAmount) - Number(pledge.amount) <
      Number(updatedProject.goalAmount);
  if (justReachedGoal) {
    await notifyProjectFunded(pledge.projectId).catch((err) =>
      log.error({ err: String(err) }, "[commitDcPledge] notifyProjectFunded failed")
    );
  }

  // Claim reward + addon slots.
  if (pledge.reward?.id) {
    const claimed = await claimRewardSlot(pledge.reward.id);
    if (!claimed) {
      log.warn(
        { pledgeId: pledge.id, rewardId: pledge.reward.id, source },
        "[commitDcPledge] Reward sold out"
      );
    }
  }
  if (pledge.addons?.length) {
    await claimAddonSlots(
      pledge.addons.map((a: { addonId: string; quantity: number }) => ({
        id: a.addonId,
        quantity: a.quantity,
      }))
    ).catch((err) => log.error({ err: String(err) }, "[commitDcPledge] claimAddonSlots failed"));
  }

  // Notify the creator of the new pledge.
  try {
    await notifyPledgeReceived(
      pledge.projectId,
      pledge.project.creatorId,
      pledge.user.name || "A backer",
      pledge.amount
    );
  } catch (notifyError) {
    log.error(
      { err: String(notifyError), pledgeId: pledge.id },
      "[commitDcPledge] Failed to notify creator"
    );
  }

  // Assign a backer number before sending the email so it can include it.
  let assignedBackerNumber = pledge.backerNumber;
  if (!assignedBackerNumber) {
    try {
      assignedBackerNumber = await assignBackerNumber(pledge.projectId, pledge.id);
    } catch (bnError) {
      log.error(
        { err: String(bnError), pledgeId: pledge.id },
        "[commitDcPledge] Failed to assign backer number"
      );
    }
  }

  // Send the confirmation email. chargedImmediately is false for
  // SETUP-mode pledges, so the email tells the backer they'll be
  // charged when the campaign succeeds.
  const pledgeEmailEnabled = await isEmailTypeEnabled("pledgeConfirmation");
  if (pledge.user.email && pledgeEmailEnabled) {
    const addons =
      pledge.addons?.map(
        (addonEntry: {
          quantity: number;
          addon: { title: string; amount: unknown };
        }) => ({
          title: addonEntry.addon.title,
          quantity: addonEntry.quantity,
          amount: Number(addonEntry.addon.amount) * addonEntry.quantity,
        })
      ) || [];

    const rawAddr = pledge.shippingAddress as Record<string, string> | null;
    const shippingInfo = rawAddr
      ? {
          name: rawAddr.name || null,
          address: rawAddr.line1 || rawAddr.address1 || null,
          city: rawAddr.city || null,
          state: rawAddr.state || null,
          postalCode: rawAddr.postalCode || rawAddr.zip || null,
          country: rawAddr.country || null,
        }
      : null;

    const projectUrlPath = pledge.project.creator?.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : undefined;

    const emailResult = await sendPledgeConfirmationEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      pledge.project.slug,
      Number(pledge.amount),
      pledge.reward?.title || null,
      pledge.chargedImmediately,
      pledge.project.imageUrl,
      pledge.project.currency || "USD",
      addons,
      shippingInfo,
      projectUrlPath,
      Number(pledge.rewardAmount) || undefined,
      Number(pledge.shippingAmount) || undefined,
      pledge.paymentProcessor as "STRIPE" | "DIVINITYCOIN" | "PAYPAL",
      assignedBackerNumber,
      pledge.id
    );

    if (emailResult.success) {
      try {
        await db.emailLog.create({
          data: {
            userId: pledge.user.id,
            projectId: pledge.project.id,
            pledgeId: pledge.id,
            type: "PLEDGE_CONFIRMATION",
            subject: emailResult.subject,
            recipientEmail: pledge.user.email,
            htmlContent: emailResult.html,
          },
        });
      } catch (logErr) {
        log.error(
          { err: String(logErr), pledgeId: pledge.id },
          "[commitDcPledge] Failed to log confirmation email"
        );
      }
    } else {
      log.error(
        { err: String(emailResult.error), pledgeId: pledge.id },
        "[commitDcPledge] Failed to send confirmation email"
      );
    }
  }

  log.info(
    { pledgeId: pledge.id, source, justReachedGoal },
    "[commitDcPledge] Pledge committed"
  );

  return {
    ok: true,
    pledgeId: pledge.id,
    alreadyCommitted: false,
    justReachedGoal,
  };
}
