import { db } from "@/lib/db";
import { sendPledgeConfirmationEmail, sendPledgeModificationEmail, sendPledgeCancellationEmail } from "@/lib/email";
import { sendRefundRequestDecisionEmail } from "@/lib/email/email-templates-pledge";
import { createNotification } from "./core";
import type { NotificationType } from "./types";

import { logger } from "@/lib/logger";

const notificationsPledgeNotificationsLogger = logger.child({ module: "notifications-pledge-notifications" });


/**
 * Notify creator when they receive a pledge
 */
export async function notifyPledgeReceived(
  projectId: string,
  creatorId: string,
  backerName: string,
  amount: number
) {
  const project = await db.project.findFirst({
    where: { id: projectId , deletedAt: null },
    select: {
      title: true,
      slug: true,
      creator: { select: { vanityUrl: true } },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  await createNotification({
    userId: creatorId,
    type: "PLEDGE_RECEIVED",
    title: "New Pledge!",
    message: `${backerName} backed "${project.title}" for $${Number(amount).toFixed(2)}`,
    actionUrl: projectUrlPath,
    projectId,
  });
}

/**
 * Notify backer when their pledge fails
 */
export async function notifyPledgeFailed(
  projectId: string,
  userId: string,
  projectTitle: string,
  projectSlug: string,
  projectUrlPath?: string
) {
  // Use provided projectUrlPath or fallback to legacy slug-based URL
  const pledgeUrl = projectUrlPath
    ? `${projectUrlPath}/pledge`
    : `/projects/${projectSlug}/pledge`;

  await createNotification({
    userId,
    type: "PLEDGE_FAILED",
    title: "Pledge Failed",
    message: `Your pledge for "${projectTitle}" could not be processed. Please update your payment method.`,
    actionUrl: pledgeUrl,
    projectId,
  });
}

/**
 * Notify backer when their pledge is shipped
 */
export async function notifyPledgeShipped(
  pledgeId: string,
  projectTitle: string,
  projectSlug: string,
  trackingNumber?: string,
  projectUrlPath?: string
) {
  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
    select: { userId: true, projectId: true },
  });

  if (!pledge) return;

  // Use provided projectUrlPath or fallback to legacy slug-based URL
  const actionUrl = projectUrlPath || `/projects/${projectSlug}`;

  await createNotification({
    userId: pledge.userId,
    type: "PLEDGE_SHIPPED",
    title: "Your Pledge Has Shipped!",
    message: trackingNumber
      ? `Your rewards from "${projectTitle}" have shipped! Tracking: ${trackingNumber}`
      : `Your rewards from "${projectTitle}" have shipped!`,
    actionUrl,
    projectId: pledge.projectId,
  });
}

/**
 * Notify backer when their pledge is delivered
 */
export async function notifyPledgeDelivered(
  pledgeId: string,
  projectTitle: string,
  projectSlug: string,
  projectUrlPath?: string
) {
  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
    select: { userId: true, projectId: true },
  });

  if (!pledge) return;

  // Use provided projectUrlPath or fallback to legacy slug-based URL
  const actionUrl = projectUrlPath || `/projects/${projectSlug}`;

  await createNotification({
    userId: pledge.userId,
    type: "PLEDGE_DELIVERED",
    title: "Your Pledge Delivered!",
    message: `Your rewards from "${projectTitle}" have been delivered!`,
    actionUrl,
    projectId: pledge.projectId,
  });
}

/**
 * Notify backer when their pledge is confirmed (send confirmation email)
 */
export async function notifyBackerPledgeConfirmed(
  pledgeId: string,
  chargedImmediately: boolean
) {
  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId , deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          currency: true,
          creator: { select: { vanityUrl: true } },
        },
      },
      reward: {
        select: { title: true, amount: true },
      },
      addons: {
        select: {
          quantity: true,
          addon: { select: { title: true, amount: true } }
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!pledge || !pledge.user?.email) return;

  // Check if confirmation email was ACTUALLY delivered (prevent duplicates).
  //
  // We use EmailLog as the source of truth for delivery — NOT the
  // `confirmationEmailSent` flag on Pledge. Reason: the confirm route
  // atomically sets `confirmationEmailSent: true` BEFORE attempting the
  // email send, to de-dup concurrent confirm calls against double-
  // counting project stats. If the actual email provider call then
  // fails for any reason (transient network error, provider 5xx,
  // getEmailSettings returning null, etc.), the flag is already true
  // but no email was ever delivered. Checking the flag as the "already
  // sent" guard would cause those pledges to be permanently silent.
  //
  // EmailLog entries, on the other hand, are only created in the
  // success branch (this function below, plus the confirm route), so
  // an EmailLog of type PLEDGE_CONFIRMATION for this pledge
  // ACTUALLY means the email went out. The auto-reconcile job in
  // email-config.ts relies on the same source of truth to find and
  // retry missed confirmations.
  const existingConfirmationLog = await db.emailLog.findFirst({
    where: { pledgeId, type: "PLEDGE_CONFIRMATION" },
    select: { id: true },
  });
  if (existingConfirmationLog) {
    notificationsPledgeNotificationsLogger.info(`Confirmation email already delivered (EmailLog ${existingConfirmationLog.id}) for pledge ${pledgeId}`);
    return;
  }

  // Format addons for the email - convert Decimal amounts to numbers
  const addons = pledge.addons?.map((addonEntry: { quantity: number; addon: { title: string; amount: unknown } }) => ({
    title: addonEntry.addon.title,
    quantity: addonEntry.quantity,
    amount: Number(addonEntry.addon.amount) * addonEntry.quantity,
  })) || [];

  // Parse shipping address from JSON field
  const rawAddr = pledge.shippingAddress as Record<string, string> | null;
  const shippingInfo = rawAddr ? {
    name: rawAddr.name || null,
    address: rawAddr.line1 || rawAddr.address1 || null,
    city: rawAddr.city || null,
    state: rawAddr.state || null,
    postalCode: rawAddr.postalCode || rawAddr.zip || null,
    country: rawAddr.country || null,
  } : null;

  // Build project URL with vanity URL if available
  const projectUrlPath = pledge.project.creator?.vanityUrl
    ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
    : undefined;

  try {
    const result = await sendPledgeConfirmationEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      pledge.project.slug,
      Number(pledge.amount),
      pledge.reward?.title || null,
      chargedImmediately,
      pledge.project.imageUrl,
      pledge.project.currency,
      addons,
      shippingInfo,
      projectUrlPath,
      undefined, // rewardAmount
      undefined, // shippingAmount
      undefined, // paymentMethod
      pledge.backerNumber,
      pledge.id
    );

    if (result.success) {
      // Log to EmailLog for admin tracking
      await db.emailLog.create({
        data: {
          userId: pledge.user.id,
          projectId: pledge.project.id,
          pledgeId: pledge.id,
          type: "PLEDGE_CONFIRMATION",
          subject: result.subject,
          recipientEmail: pledge.user.email,
          htmlContent: result.html,
        },
      });

      // Mark email as sent on pledge
      await db.pledge.update({
        where: { id: pledgeId },
        data: { confirmationEmailSent: true },
      });

      notificationsPledgeNotificationsLogger.info(`Sent pledge confirmation email to ${pledge.user.email} for pledge ${pledgeId}`);
    } else if ("blocked" in result && result.blocked) {
      // Email address is on the blocklist - mark as sent to prevent infinite retry loop
      await db.pledge.update({
        where: { id: pledgeId },
        data: { confirmationEmailSent: true },
      });
      notificationsPledgeNotificationsLogger.info(`Pledge confirmation email blocked for ${pledge.user.email} (pledge ${pledgeId}) - address is on blocklist, marking as sent`);
    }
  } catch (error) {
    notificationsPledgeNotificationsLogger.error({ err: error }, `Failed to send pledge confirmation email for pledge ${pledgeId}:`);
  }
}

/**
 * Notify backers when a survey is sent
 */
export async function notifySurveySent(projectId: string, projectTitle: string) {
  const project = await db.project.findFirst({
    where: { id: projectId , deletedAt: null },
    select: {
      slug: true,
      pledges: {
        // Include PENDING so AoN / NMI backers (whose pledge is held
        // until the funded-cron fires) still receive survey
        // notifications if a survey lands before the cron converts
        // all PENDING → COMPLETED.
        where: { status: { in: ["COMPLETED", "PENDING"] }, deletedAt: null },
        select: { userId: true, id: true },
      },
    },
  });

  if (!project) return;

  const notifications = project.pledges.map((pledge: { userId: string; id: string }) => ({
    userId: pledge.userId,
    type: "SURVEY_SENT" as NotificationType,
    title: "Survey Available",
    message: `Please complete the backer survey for "${projectTitle}"`,
    actionUrl: `/dashboard/pledges/${pledge.id}/survey`,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }
}

/**
 * Notify backers that the survey has been updated and needs re-review
 */
export async function notifySurveyUpdateRequested(projectId: string, projectTitle: string) {
  const project = await db.project.findFirst({
    where: { id: projectId , deletedAt: null },
    select: {
      slug: true,
      pledges: {
        // Include PENDING so AoN / NMI backers receive survey-updated
        // notifications even if their pledge is still in the vault.
        where: { status: { in: ["COMPLETED", "PENDING"] }, deletedAt: null },
        select: { userId: true, id: true },
      },
    },
  });

  if (!project) return;

  const notifications = project.pledges.map((pledge: { userId: string; id: string }) => ({
    userId: pledge.userId,
    type: "SURVEY_UPDATE_REQUESTED" as NotificationType,
    title: "Survey Updated - Action Required",
    message: `The survey for "${projectTitle}" has been updated. Please review and resubmit your responses.`,
    actionUrl: `/dashboard/pledges/${pledge.id}/survey`,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }
}

/**
 * Notify backers with a survey reminder
 */
export async function notifySurveyReminder(projectId: string, projectTitle: string) {
  const project = await db.project.findFirst({
    where: { id: projectId , deletedAt: null },
    select: {
      slug: true,
      pledges: {
        // Include PENDING so AoN / NMI backers get survey reminders
        // even if their pledge is still vault-held.
        where: {
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
          surveyCompleted: false,
        },
        select: { userId: true, id: true },
      },
    },
  });

  if (!project) return;

  const notifications = project.pledges.map((pledge: { userId: string; id: string }) => ({
    userId: pledge.userId,
    type: "SURVEY_REMINDER" as NotificationType,
    title: "Survey Reminder",
    message: `Don't forget to complete the backer survey for "${projectTitle}"`,
    actionUrl: `/dashboard/pledges/${pledge.id}/survey`,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }
}

/**
 * Process unsent pledge confirmation emails
 * Called by cron job to retry failed email sends
 */
export async function processUnsentConfirmationEmails() {
  // Find completed pledges that haven't had confirmation email sent
  // Look at pledges completed in the last 24 hours to avoid processing very old records
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const unsentPledges = await db.pledge.findMany({
    where: {
      status: "COMPLETED",
      confirmationEmailSent: false,
      updatedAt: { gte: oneDayAgo },
      deletedAt: null,
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          currency: true,
          creator: { select: { vanityUrl: true } },
        },
      },
      reward: {
        select: { title: true },
      },
      addons: {
        select: {
          quantity: true,
          addon: { select: { title: true, amount: true } },
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    take: 100, // Process in batches
  });

  // Also find SetupIntent pledges (pending but payment method saved) that need emails.
  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — use `NOT: { field: null }` wrapper syntax instead.
  const unsentSetupPledges = await db.pledge.findMany({
    where: {
      status: "PENDING",
      NOT: { stripePaymentMethodId: null },
      confirmationEmailSent: false,
      updatedAt: { gte: oneDayAgo },
      deletedAt: null,
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          currency: true,
          creator: { select: { vanityUrl: true } },
        },
      },
      reward: {
        select: { title: true },
      },
      addons: {
        select: {
          quantity: true,
          addon: { select: { title: true, amount: true } },
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    take: 100,
  });

  const allUnsent = [...unsentPledges, ...unsentSetupPledges];

  const results = {
    total: allUnsent.length,
    successful: 0,
    failed: 0,
  };

  for (const pledge of allUnsent) {
    if (!pledge.user?.email) {
      results.failed++;
      continue;
    }

    try {
      // Format addons for the email - convert Decimal amounts to numbers
      const addons = pledge.addons?.map((addonEntry: { quantity: number; addon: { title: string; amount: unknown } }) => ({
        title: addonEntry.addon.title,
        quantity: addonEntry.quantity,
        amount: Number(addonEntry.addon.amount) * addonEntry.quantity,
      })) || [];

      // Parse shipping address from JSON field
      const rawAddr = pledge.shippingAddress as Record<string, string> | null;
      const shippingInfo = rawAddr ? {
        name: rawAddr.name || null,
        address: rawAddr.line1 || rawAddr.address1 || null,
        city: rawAddr.city || null,
        state: rawAddr.state || null,
        postalCode: rawAddr.postalCode || rawAddr.zip || null,
        country: rawAddr.country || null,
      } : null;

      // Build project URL with vanity URL if available
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
        pledge.project.currency,
        addons,
        shippingInfo,
        projectUrlPath,
        undefined, // rewardAmount
        undefined, // shippingAmount
        undefined, // paymentMethod
        pledge.backerNumber,
        pledge.id
      );

      if (emailResult.success) {
        // Log to EmailLog for admin tracking
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

        // Mark as sent
        await db.pledge.update({
          where: { id: pledge.id },
          data: { confirmationEmailSent: true },
        });

        results.successful++;
        notificationsPledgeNotificationsLogger.info(`Retry: Sent pledge confirmation email for pledge ${pledge.id}`);
      } else if ("blocked" in emailResult && emailResult.blocked) {
        // Email address is on the blocklist (bounced, spam complaint, etc.)
        // Mark as sent to stop the retry loop - the email can't be delivered
        await db.pledge.update({
          where: { id: pledge.id },
          data: { confirmationEmailSent: true },
        });

        results.failed++;
        notificationsPledgeNotificationsLogger.info(`Retry: Email blocked for pledge ${pledge.id} (${pledge.user.email}) - marking as sent to stop retries`);
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      notificationsPledgeNotificationsLogger.error({ err: error }, `Retry: Failed to send pledge confirmation email for pledge ${pledge.id}:`);
    }
  }

  return results;
}

/**
 * Notify backer when their pledge is modified (addon/reward swap)
 */
export async function notifyPledgeModified(
  pledgeId: string,
  oldAmount: number,
  newAmount: number,
  changeType: "upcharge" | "refund" | "no_change"
) {
  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true } },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            currency: true,
            creator: { select: { vanityUrl: true } },
          },
        },
        reward: { select: { title: true } },
        addons: {
          include: {
            addon: { select: { title: true, amount: true } },
          },
        },
      },
    });

    if (!pledge?.user?.email) return;

    const amountDiff = newAmount - oldAmount;
    const projectUrlPath = pledge.project.creator?.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;

    const addonsList = pledge.addons.map((a: { addon: { title: string; amount: number }; quantity: number }) => ({
      title: a.addon.title,
      quantity: a.quantity,
      amount: Number(a.addon.amount) * a.quantity,
    }));

    // In-app notification
    const notifMessage = changeType === "upcharge"
      ? `Your pledge for "${pledge.project.title}" was updated. Additional $${Math.abs(amountDiff).toFixed(2)} charged.`
      : changeType === "refund"
      ? `Your pledge for "${pledge.project.title}" was updated. $${Math.abs(amountDiff).toFixed(2)} refunded.`
      : `Your pledge for "${pledge.project.title}" was updated.`;

    await createNotification({
      userId: pledge.user.id,
      type: "PLEDGE_MODIFIED",
      title: "Pledge Updated",
      message: notifMessage,
      actionUrl: `/dashboard/pledges/${pledgeId}`,
      projectId: pledge.project.id,
    });

    // Email notification
    const emailResult = await sendPledgeModificationEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      oldAmount,
      newAmount,
      amountDiff,
      changeType,
      pledge.reward?.title || null,
      addonsList,
      projectUrlPath,
      pledge.project.currency || "USD"
    );

    if (emailResult.success) {
      await db.emailLog.create({
        data: {
          userId: pledge.user.id,
          projectId: pledge.project.id,
          pledgeId: pledge.id,
          type: "PLEDGE_MODIFICATION",
          subject: emailResult.subject,
          recipientEmail: pledge.user.email,
          htmlContent: emailResult.html,
        },
      });
    }
  } catch (error) {
    notificationsPledgeNotificationsLogger.error({ err: error }, `[notifyPledgeModified] Error for pledge ${pledgeId}:`);
  }
}

/**
 * Notify backer when their pledge is cancelled (with or without refund)
 */
export async function notifyPledgeCancelled(
  pledgeId: string,
  wasRefunded: boolean
) {
  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true } },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            currency: true,
            creator: { select: { id: true, vanityUrl: true } },
          },
        },
      },
    });

    if (!pledge?.user?.email) return;

    const projectUrlPath = pledge.project.creator?.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;

    // In-app notification for backer
    await createNotification({
      userId: pledge.user.id,
      type: "PLEDGE_CANCELLED",
      title: wasRefunded ? "Pledge Cancelled & Refunded" : "Pledge Cancelled",
      message: wasRefunded
        ? `Your $${Number(pledge.amount).toFixed(2)} pledge for "${pledge.project.title}" has been cancelled and refunded.`
        : `Your pledge for "${pledge.project.title}" has been cancelled.`,
      actionUrl: `/dashboard/pledges/${pledgeId}`,
      projectId: pledge.project.id,
    });

    // In-app notification for creator
    await createNotification({
      userId: pledge.project.creator.id,
      type: "PLEDGE_CANCELLED",
      title: "Pledge Cancelled",
      message: `${pledge.user.name || "A backer"} cancelled their $${Number(pledge.amount).toFixed(2)} pledge for "${pledge.project.title}".`,
      actionUrl: projectUrlPath,
      projectId: pledge.project.id,
    });

    // Email to backer
    const emailResult = await sendPledgeCancellationEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      Number(pledge.amount),
      wasRefunded,
      projectUrlPath,
      pledge.project.currency || "USD"
    );

    if (emailResult.success) {
      await db.emailLog.create({
        data: {
          userId: pledge.user.id,
          projectId: pledge.project.id,
          pledgeId: pledge.id,
          type: wasRefunded ? "PLEDGE_REFUND" : "PLEDGE_CANCELLATION",
          subject: emailResult.subject,
          recipientEmail: pledge.user.email,
          htmlContent: emailResult.html,
        },
      });
    }
  } catch (error) {
    notificationsPledgeNotificationsLogger.error({ err: error }, `[notifyPledgeCancelled] Error for pledge ${pledgeId}:`);
  }
}

/**
 * Notify backer when creator approves or denies their refund request
 */
export async function notifyRefundRequestDecision(
  pledgeId: string,
  decision: "approved" | "denied",
  creatorNote?: string | null
) {
  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true } },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            currency: true,
            creator: { select: { id: true, vanityUrl: true } },
          },
        },
      },
    });

    if (!pledge?.user?.email) return;

    const isApproved = decision === "approved";

    // In-app notification
    await createNotification({
      userId: pledge.user.id,
      type: "PLEDGE_REFUND_DECISION",
      title: isApproved ? "Refund Request Approved" : "Refund Request Denied",
      message: isApproved
        ? `Your refund request for "${pledge.project.title}" was approved. $${Number(pledge.amount).toFixed(2)} will be returned to your payment method.`
        : `Your refund request for "${pledge.project.title}" was reviewed but could not be approved at this time.`,
      actionUrl: `/dashboard/pledges/${pledgeId}`,
      projectId: pledge.project.id,
    });

    // Email
    const emailResult = await sendRefundRequestDecisionEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      Number(pledge.amount),
      decision,
      creatorNote,
      pledge.project.currency || "USD"
    );

    if (emailResult.success) {
      await db.emailLog.create({
        data: {
          userId: pledge.user.id,
          projectId: pledge.project.id,
          pledgeId: pledge.id,
          type: "PLEDGE_REFUND",
          subject: emailResult.subject,
          recipientEmail: pledge.user.email,
          htmlContent: emailResult.html,
        },
      });
    }
  } catch (error) {
    notificationsPledgeNotificationsLogger.error({ err: error }, `[notifyRefundRequestDecision] Error for pledge ${pledgeId}:`);
  }
}
