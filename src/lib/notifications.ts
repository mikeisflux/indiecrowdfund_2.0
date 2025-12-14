import { db } from "@/lib/db";
import { sendEmail, sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type NotificationType =
  | "COLLABORATOR_INVITE"
  | "COLLABORATOR_ACCEPTED"
  | "COLLABORATOR_DECLINED"
  | "PROJECT_UPDATE"
  | "PROJECT_FUNDED"
  | "PROJECT_LAUNCHED"
  | "PROJECT_ENDED"
  | "PLEDGE_RECEIVED"
  | "PLEDGE_FAILED"
  | "PLEDGE_SHIPPED"
  | "PLEDGE_DELIVERED"
  | "COMMENT_REPLY"
  | "COMMENT_NEW"
  | "MESSAGE_RECEIVED"
  | "SURVEY_SENT"
  | "SURVEY_REMINDER"
  | "FOLLOWED_PROJECT_LAUNCHED"
  | "SYSTEM";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  projectId?: string;
  senderId?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  return db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      projectId: params.projectId,
      senderId: params.senderId,
    },
  });
}

/**
 * Send project funded email
 */
async function sendProjectFundedEmail(
  email: string,
  projectTitle: string,
  projectSlug: string,
  imageUrl?: string | null
) {
  const projectUrl = `${APP_URL}/projects/${projectSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Funded!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Project Funded!</h2>

          ${imageUrl ? `<img src="${imageUrl}" alt="${projectTitle}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin: 20px auto; display: block;">` : ""}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${projectTitle}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">has reached its funding goal!</p>
          </div>

          <p style="text-align: center;">Thanks to you and other backers, this project is now fully funded and will become a reality!</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">The creator will start working on bringing the project to life. You'll receive updates as the project progresses, and we'll send you a survey to collect your delivery details closer to the estimated delivery date.</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View Project Updates
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you backed this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `"${projectTitle}" has been funded!`,
    html,
  });
}

/**
 * Notify backers when a project is funded
 */
export async function notifyProjectFunded(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      imageUrl: true,
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
    },
  });

  if (!project) return;

  // Notify all unique backers
  const notifications = project.pledges.map((pledge: { userId: string }) => ({
    userId: pledge.userId,
    type: "PROJECT_FUNDED" as NotificationType,
    title: "Project Funded!",
    message: `"${project.title}" has reached its funding goal!`,
    actionUrl: `/projects/${project.slug}`,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Get backer emails and send email notifications
  const backerIds = project.pledges.map((p: { userId: string }) => p.userId);
  if (backerIds.length > 0) {
    const backers = await db.user.findMany({
      where: { id: { in: backerIds } },
      select: { email: true },
    });

    const uniqueEmails = Array.from(new Set(backers.map((b) => b.email)));

    // Send emails in batches
    const batchSize = 10;
    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      const batch = uniqueEmails.slice(i, i + batchSize);
      await Promise.all(
        batch.map((email) =>
          sendProjectFundedEmail(email, project.title, project.slug, project.imageUrl)
        )
      );
    }

    if (uniqueEmails.length > 0) {
      console.log(`Sent project funded emails to ${uniqueEmails.length} backers for project: ${project.title}`);
    }
  }
}

/**
 * Send project launch email
 */
async function sendProjectLaunchEmail(
  email: string,
  projectTitle: string,
  projectSlug: string,
  creatorName: string,
  imageUrl?: string | null
) {
  const projectUrl = `${APP_URL}/projects/${projectSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project You Follow Is Live!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">A Project You Follow Is Now Live!</h2>

          ${imageUrl ? `<img src="${imageUrl}" alt="${projectTitle}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin-bottom: 20px;">` : ""}

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${projectTitle}</h3>
            <p style="margin: 0; color: #666;">by ${creatorName}</p>
          </div>

          <p>The project you signed up to be notified about has just launched! Be one of the first backers and help bring this project to life.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              View Project & Back Now
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0; text-align: center;">
            Early backers often get the best rewards!
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you signed up for launch notifications for this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `"${projectTitle}" is now live on ${APP_NAME}!`,
    html,
  });
}

/**
 * Notify followers when a project launches
 */
export async function notifyProjectLaunched(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      imageUrl: true,
      creatorId: true,
      creator: {
        select: { name: true },
      },
      followers: {
        select: { userId: true, email: true },
      },
    },
  });

  if (!project) return;

  // Collect emails to send - both from user accounts and direct email followers
  const emailsToSend: string[] = [];

  // Get user emails for logged-in followers
  const userIds = project.followers
    .filter((f: { userId: string | null }) => f.userId && f.userId !== project.creatorId)
    .map((f: { userId: string | null }) => f.userId as string);

  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    });
    users.forEach((u) => emailsToSend.push(u.email));
  }

  // Add email-only followers (prelaunch sign-ups without accounts)
  project.followers
    .filter((f: { userId: string | null; email: string | null }) => !f.userId && f.email)
    .forEach((f: { email: string | null }) => {
      if (f.email) emailsToSend.push(f.email);
    });

  // Notify all followers (except the creator) - in-app notifications
  const notifications = project.followers
    .filter((f: { userId: string | null }) => f.userId && f.userId !== project.creatorId)
    .map((follower: { userId: string | null }) => ({
      userId: follower.userId!,
      type: "PROJECT_LAUNCHED" as NotificationType,
      title: "Project Launched!",
      message: `"${project.title}" is now live!`,
      actionUrl: `/projects/${project.slug}`,
      projectId,
    }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Notify the creator
  await createNotification({
    userId: project.creatorId,
    type: "PROJECT_LAUNCHED",
    title: "Your project is live!",
    message: `"${project.title}" has been launched successfully.`,
    actionUrl: `/projects/${project.slug}`,
    projectId,
  });

  // Send emails to all followers (deduplicated)
  const uniqueEmails = Array.from(new Set(emailsToSend));
  const creatorName = project.creator?.name || "Creator";

  // Send emails in parallel (but not all at once to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < uniqueEmails.length; i += batchSize) {
    const batch = uniqueEmails.slice(i, i + batchSize);
    await Promise.all(
      batch.map((email) =>
        sendProjectLaunchEmail(
          email,
          project.title,
          project.slug,
          creatorName,
          project.imageUrl
        )
      )
    );
  }

  // Log the email sends
  if (uniqueEmails.length > 0) {
    console.log(`Sent project launch emails to ${uniqueEmails.length} followers for project: ${project.title}`);
  }
}

/**
 * Notify creator when they receive a pledge
 */
export async function notifyPledgeReceived(
  projectId: string,
  creatorId: string,
  backerName: string,
  amount: number
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { title: true, slug: true },
  });

  if (!project) return;

  await createNotification({
    userId: creatorId,
    type: "PLEDGE_RECEIVED",
    title: "New Pledge!",
    message: `${backerName} backed "${project.title}" for $${amount.toFixed(2)}`,
    actionUrl: `/projects/${project.slug}`,
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
  projectSlug: string
) {
  await createNotification({
    userId,
    type: "PLEDGE_FAILED",
    title: "Pledge Failed",
    message: `Your pledge for "${projectTitle}" could not be processed. Please update your payment method.`,
    actionUrl: `/projects/${projectSlug}/pledge`,
    projectId,
  });
}

/**
 * Send project update email
 */
async function sendProjectUpdateEmail(
  email: string,
  projectTitle: string,
  projectSlug: string,
  updateTitle: string,
  creatorName: string
) {
  const projectUrl = `${APP_URL}/projects/${projectSlug}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Project Update</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">New Update from ${creatorName}</h2>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">${projectTitle}</p>
            <h3 style="margin: 0; color: #333;">${updateTitle}</h3>
          </div>

          <p>The creator has posted a new update for this project. Click below to read the full update.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${projectUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Read Update
            </a>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you're following or have backed this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `New update for "${projectTitle}": ${updateTitle}`,
    html,
  });
}

/**
 * Notify backers when a project update is posted
 */
export async function notifyProjectUpdate(
  projectId: string,
  updateTitle: string
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      creatorId: true,
      creator: {
        select: { name: true },
      },
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
      followers: {
        select: { userId: true, email: true },
      },
    },
  });

  if (!project) return;

  // Combine backers and followers (unique users except creator)
  const userIds = new Set<string>();
  project.pledges.forEach((p: { userId: string }) => userIds.add(p.userId));
  project.followers.forEach((f: { userId: string | null }) => {
    if (f.userId) userIds.add(f.userId);
  });
  userIds.delete(project.creatorId);

  const notifications = Array.from(userIds).map((userId) => ({
    userId,
    type: "PROJECT_UPDATE" as NotificationType,
    title: "New Update",
    message: `"${project.title}" posted: ${updateTitle}`,
    actionUrl: `/projects/${project.slug}`,
    projectId,
    senderId: project.creatorId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Check if project update notifications are enabled before sending emails
  const projectUpdateEnabled = await isEmailTypeEnabled("projectUpdate");

  if (!projectUpdateEnabled) {
    console.log(`Project update notifications are disabled in settings`);
    return;
  }

  // Send emails to all users (backers + followers with userId) and email-only followers
  const emailsToSend: string[] = [];

  // Get emails for user-based followers and backers
  const allUserIds = Array.from(userIds);
  if (allUserIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: { email: true },
    });
    users.forEach((u) => emailsToSend.push(u.email));
  }

  // Add email-only followers
  project.followers
    .filter((f: { userId: string | null; email: string | null }) => !f.userId && f.email)
    .forEach((f: { email: string | null }) => {
      if (f.email) emailsToSend.push(f.email);
    });

  const uniqueEmails = Array.from(new Set(emailsToSend));
  const creatorName = project.creator?.name || "Creator";

  // Send emails in batches
  const batchSize = 10;
  for (let i = 0; i < uniqueEmails.length; i += batchSize) {
    const batch = uniqueEmails.slice(i, i + batchSize);
    await Promise.all(
      batch.map((email) =>
        sendProjectUpdateEmail(
          email,
          project.title,
          project.slug,
          updateTitle,
          creatorName
        )
      )
    );
  }

  if (uniqueEmails.length > 0) {
    console.log(`Sent project update emails to ${uniqueEmails.length} users for project: ${project.title}`);
  }
}

/**
 * Notify user when they receive a message
 */
export async function notifyMessageReceived(
  recipientId: string,
  senderId: string,
  senderName: string,
  projectId: string,
  subject: string
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { title: true, slug: true },
  });

  if (!project) return;

  await createNotification({
    userId: recipientId,
    type: "MESSAGE_RECEIVED",
    title: "New Message",
    message: `${senderName} sent you a message about "${project.title}": ${subject || "No subject"}`,
    actionUrl: `/messages`,
    projectId,
    senderId,
  });
}

/**
 * Notify user when someone replies to their comment
 */
export async function notifyCommentReply(
  userId: string,
  replierName: string,
  projectId: string,
  projectTitle: string,
  projectSlug: string
) {
  await createNotification({
    userId,
    type: "COMMENT_REPLY",
    title: "New Reply",
    message: `${replierName} replied to your comment on "${projectTitle}"`,
    actionUrl: `/projects/${projectSlug}#comments`,
    projectId,
  });
}

/**
 * Notify collaborator when invited
 */
export async function notifyCollaboratorInvite(
  userId: string,
  inviterName: string,
  projectId: string,
  projectTitle: string,
  projectSlug: string,
  inviterId: string
) {
  await createNotification({
    userId,
    type: "COLLABORATOR_INVITE",
    title: "Collaboration Invite",
    message: `${inviterName} has invited you to collaborate on "${projectTitle}"`,
    actionUrl: `/projects/${projectSlug}`,
    projectId,
    senderId: inviterId,
  });
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}

/**
 * Mark notifications as read
 */
export async function markAsRead(notificationIds: string[]) {
  return db.notification.updateMany({
    where: { id: { in: notificationIds } },
    data: { read: true, readAt: new Date() },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  return db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

/**
 * Notify backers when a survey is sent
 */
export async function notifySurveySent(projectId: string, projectTitle: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      slug: true,
      pledges: {
        where: { status: "COMPLETED" },
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
 * Notify backers with a survey reminder
 */
export async function notifySurveyReminder(projectId: string, projectTitle: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      slug: true,
      pledges: {
        where: { status: "COMPLETED", surveyCompleted: false },
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
 * Notify backer when their pledge is confirmed (send confirmation email)
 */
export async function notifyBackerPledgeConfirmed(
  pledgeId: string,
  chargedImmediately: boolean
) {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    include: {
      project: {
        select: { id: true, title: true, slug: true, imageUrl: true, currency: true },
      },
      reward: {
        select: { title: true, amount: true },
      },
      addons: {
        select: {
          quantity: true,
          reward: { select: { title: true, amount: true } }
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!pledge || !pledge.user.email) return;

  // Check if confirmation email was already sent (prevent duplicates)
  if (pledge.confirmationEmailSent) {
    console.log(`Confirmation email already sent for pledge ${pledgeId}`);
    return;
  }

  // Format addons for the email
  const addons = pledge.addons?.map((addon: { quantity: number; reward: { title: string; amount: number } }) => ({
    title: addon.reward.title,
    quantity: addon.quantity,
    amount: addon.reward.amount * addon.quantity,
  })) || [];

  // Get shipping info
  const shippingInfo = {
    name: pledge.shippingName || null,
    address: pledge.shippingAddress || null,
    city: pledge.shippingCity || null,
    state: pledge.shippingState || null,
    postalCode: pledge.shippingPostalCode || null,
    country: pledge.shippingCountry || null,
  };

  try {
    const result = await sendPledgeConfirmationEmail(
      pledge.user.email,
      pledge.user.name || "Backer",
      pledge.project.title,
      pledge.project.slug,
      pledge.amount,
      pledge.reward?.title || null,
      chargedImmediately,
      pledge.project.imageUrl,
      pledge.project.currency,
      addons,
      shippingInfo
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

      console.log(`Sent pledge confirmation email to ${pledge.user.email} for pledge ${pledgeId}`);
    }
  } catch (error) {
    console.error(`Failed to send pledge confirmation email for pledge ${pledgeId}:`, error);
  }
}

/**
 * Notify backers when their project ends
 */
export async function notifyProjectEnded(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      creatorId: true,
      currentAmount: true,
      goalAmount: true,
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
    },
  });

  if (!project) return;

  const funded = project.currentAmount >= project.goalAmount;
  const message = funded
    ? `"${project.title}" has successfully ended! Thanks for your support.`
    : `"${project.title}" has ended. Unfortunately, it did not reach its funding goal.`;

  const notifications = project.pledges.map((pledge: { userId: string }) => ({
    userId: pledge.userId,
    type: "PROJECT_ENDED" as NotificationType,
    title: funded ? "Campaign Successful!" : "Campaign Ended",
    message,
    actionUrl: `/projects/${project.slug}`,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Notify creator
  await createNotification({
    userId: project.creatorId,
    type: "PROJECT_ENDED",
    title: funded ? "Your Campaign Succeeded!" : "Your Campaign Has Ended",
    message: funded
      ? `"${project.title}" reached its goal!`
      : `"${project.title}" ended without reaching its goal.`,
    actionUrl: `/projects/${project.slug}`,
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
  trackingNumber?: string
) {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { userId: true, projectId: true },
  });

  if (!pledge) return;

  await createNotification({
    userId: pledge.userId,
    type: "PLEDGE_SHIPPED",
    title: "Your Pledge Has Shipped!",
    message: trackingNumber
      ? `Your rewards from "${projectTitle}" have shipped! Tracking: ${trackingNumber}`
      : `Your rewards from "${projectTitle}" have shipped!`,
    actionUrl: `/projects/${projectSlug}`,
    projectId: pledge.projectId,
  });
}

/**
 * Notify backer when their pledge is delivered
 */
export async function notifyPledgeDelivered(
  pledgeId: string,
  projectTitle: string,
  projectSlug: string
) {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    select: { userId: true, projectId: true },
  });

  if (!pledge) return;

  await createNotification({
    userId: pledge.userId,
    type: "PLEDGE_DELIVERED",
    title: "Your Pledge Delivered!",
    message: `Your rewards from "${projectTitle}" have been delivered!`,
    actionUrl: `/projects/${projectSlug}`,
    projectId: pledge.projectId,
  });
}

/**
 * Notify user when someone comments on their project
 */
export async function notifyNewComment(
  creatorId: string,
  commenterName: string,
  projectId: string,
  projectTitle: string,
  projectSlug: string,
  commenterId: string
) {
  await createNotification({
    userId: creatorId,
    type: "COMMENT_NEW",
    title: "New Comment",
    message: `${commenterName} commented on "${projectTitle}"`,
    actionUrl: `/projects/${projectSlug}#comments`,
    projectId,
    senderId: commenterId,
  });
}

/**
 * Notify followers when a project they follow launches
 * Note: This is an alias for notifyProjectLaunched which now handles both
 * in-app notifications and email notifications for all followers
 */
export async function notifyFollowedProjectLaunched(projectId: string) {
  // The main notifyProjectLaunched function now handles everything
  // including email notifications for both logged-in and email-only followers
  await notifyProjectLaunched(projectId);
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
    },
    include: {
      project: {
        select: { id: true, title: true, slug: true, imageUrl: true, currency: true },
      },
      reward: {
        select: { title: true },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    take: 100, // Process in batches
  });

  // Also find SetupIntent pledges (pending but payment method saved) that need emails
  const unsentSetupPledges = await db.pledge.findMany({
    where: {
      status: "PENDING",
      stripePaymentMethodId: { not: null },
      confirmationEmailSent: false,
      updatedAt: { gte: oneDayAgo },
    },
    include: {
      project: {
        select: { id: true, title: true, slug: true, imageUrl: true, currency: true },
      },
      reward: {
        select: { title: true },
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
    if (!pledge.user.email) {
      results.failed++;
      continue;
    }

    try {
      const emailResult = await sendPledgeConfirmationEmail(
        pledge.user.email,
        pledge.user.name || "Backer",
        pledge.project.title,
        pledge.project.slug,
        pledge.amount,
        pledge.reward?.title || null,
        pledge.chargedImmediately,
        pledge.project.imageUrl,
        pledge.project.currency
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
        console.log(`Retry: Sent pledge confirmation email for pledge ${pledge.id}`);
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      console.error(`Retry: Failed to send pledge confirmation email for pledge ${pledge.id}:`, error);
    }
  }

  return results;
}
