import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import { notifyPledgeReceived, notifyProjectFunded } from "@/lib/notifications";
import { claimRewardSlot, claimAddonSlots, assignBackerNumber } from "@/lib/payments/rewards";

const log = logger.child({ module: "pledges-confirm-dc-setup" });

// Phase 2 of the DivinityCoin AoN saved-card flow.
//
// /api/pledges (POST) created the pledge in PENDING state and returned a
// SetupIntent clientSecret. The browser confirmed the SetupIntent via
// stripe.confirmSetup() pointed at DC's publishable key; that succeeded
// and produced a payment_method id (pm_...). The browser now POSTs that
// pm id back here so we can persist it on the pledge — the AoN
// charge-on-success cron will later call DC's
// /charge-saved-payment-method with this pm to capture the funds.
//
// We never see card data; only the durable pm_... handle.
//
// COMMIT BOOKKEEPING: for the saved-card flow there is NO later confirm
// step — confirm/route.ts explicitly rejects non-chargedImmediately
// pledges. So saving the card here IS the commit, and this route must
// do the same bookkeeping confirm/route.ts does for the charge-now
// flows: atomically flip confirmationEmailSent (the codebase-wide
// "counted toward the goal" flag — see lib/stats.ts), bump the project's
// denormalized currentAmount / backerCount, claim reward + addon slots,
// assign a backer number, notify the creator, and send the confirmation
// email. Skipping this is what made AoN DivinityCoin campaigns show
// $0 / 0 backers despite real saved-card pledges.
//
// The atomic confirmationEmailSent claim makes the route safe to call
// repeatedly — double-submit, retry, or healing an older pledge that
// had its card saved before this bookkeeping existed.

const bodySchema = z.object({
  setupIntentId: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;
    const body = await req.json();
    const parse = bodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Missing setupIntentId or paymentMethodId" }, { status: 400 });
    }
    const { setupIntentId, paymentMethodId } = parse.data;

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
        user: {
          select: { id: true, email: true, name: true },
        },
        reward: {
          select: { id: true, title: true, amount: true },
        },
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
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pledge.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json(
        { error: "Pledge is not on DivinityCoin" },
        { status: 400 }
      );
    }
    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: `Pledge is already ${pledge.status.toLowerCase()}` },
        { status: 400 }
      );
    }
    if (pledge.chargedImmediately) {
      // KIA / already-funded-AoN DivinityCoin pledges charge immediately
      // and are committed through /api/pledges/[id]/confirm once the
      // PaymentIntent succeeds. They must NOT be committed here, where
      // there is no payment-success verification — doing so would count
      // an unpaid pledge toward the goal.
      return NextResponse.json(
        { error: "Pledge is not on the saved-card flow" },
        { status: 400 }
      );
    }

    // Persist the saved card. Idempotent — re-saving the same pm/intent
    // is a no-op write; a DIFFERENT pm replaces the prior one (the cron
    // charges whatever is on file when it runs). We deliberately do NOT
    // early-return when the pm matches: the commit bookkeeping below is
    // keyed off confirmationEmailSent, not the card, so a pledge with a
    // card on file but the flag still false self-heals on the next call.
    if (
      pledge.divinityCoinPaymentMethodId !== paymentMethodId ||
      pledge.divinityCoinSetupIntentId !== setupIntentId
    ) {
      await db.pledge.update({
        where: { id: pledge.id },
        data: {
          divinityCoinSetupIntentId: setupIntentId,
          divinityCoinPaymentMethodId: paymentMethodId,
        },
      });
      log.info(
        { pledgeId: pledge.id, setupIntentId },
        "[Confirm DC Setup] Card saved on pledge for AoN charge-on-success"
      );
    }

    // ── COMMIT BOOKKEEPING ──
    // Atomically flip confirmationEmailSent false→true. If two requests
    // race (double-submit), only one matches the WHERE clause and runs
    // the bookkeeping; the loser sees count === 0 and returns early.
    const claim = await db.pledge.updateMany({
      where: { id: pledge.id, confirmationEmailSent: false },
      data: { confirmationEmailSent: true },
    });

    if (claim.count === 0) {
      return NextResponse.json({
        ok: true,
        pledgeId: pledge.id,
        alreadyConfirmed: true,
      });
    }

    // Count the pledge toward the project goal. lib/stats.ts counts
    // confirmationEmailSent PENDING pledges, but currentAmount /
    // backerCount are denormalized counters the dashboards read directly.
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
        log.error({ err: String(err) }, "notifyProjectFunded failed")
      );
    }

    // Claim reward + addon slots.
    if (pledge.reward?.id) {
      const claimed = await claimRewardSlot(pledge.reward.id);
      if (!claimed) {
        log.warn(
          { pledgeId: pledge.id, rewardId: pledge.reward.id },
          "[Confirm DC Setup] Reward sold out"
        );
      }
    }
    if (pledge.addons?.length) {
      await claimAddonSlots(
        pledge.addons.map((a: { addonId: string; quantity: number }) => ({
          id: a.addonId,
          quantity: a.quantity,
        }))
      ).catch((err) => log.error({ err: String(err) }, "claimAddonSlots failed"));
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
        { err: String(notifyError) },
        `[Confirm DC Setup] Failed to notify creator for pledge ${pledge.id}`
      );
    }

    // Assign a backer number before the email so it can include it.
    let assignedBackerNumber = pledge.backerNumber;
    if (!assignedBackerNumber) {
      try {
        assignedBackerNumber = await assignBackerNumber(pledge.projectId, pledge.id);
      } catch (bnError) {
        log.error(
          { err: String(bnError) },
          `[Confirm DC Setup] Failed to assign backer number for pledge ${pledge.id}`
        );
      }
    }

    // Send the confirmation email. chargedImmediately is false here, so
    // the email tells the backer they'll be charged when the campaign
    // succeeds rather than that they were charged now.
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
            { err: String(logErr) },
            `[Confirm DC Setup] Failed to log confirmation email for pledge ${pledge.id}`
          );
        }
      } else {
        log.error(
          { err: String(emailResult.error) },
          `[Confirm DC Setup] Failed to send confirmation email for pledge ${pledge.id}`
        );
      }
    }

    log.info(
      { pledgeId: pledge.id, setupIntentId },
      "[Confirm DC Setup] Pledge committed for AoN charge-on-success"
    );

    return NextResponse.json({
      ok: true,
      pledgeId: pledge.id,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "confirm-dc-setup error"
    );
    return NextResponse.json(
      { error: "Failed to save card" },
      { status: 500 }
    );
  }
}
