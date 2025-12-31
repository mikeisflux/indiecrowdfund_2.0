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
  | "MARKETPLACE_PURCHASE"
  | "MARKETPLACE_SALE"
  | "MARKETPLACE_BOOK_APPROVED"
  | "MARKETPLACE_BOOK_REJECTED"
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
  projectUrlPath: string,
  imageUrl?: string | null
) {
  const projectUrl = `${APP_URL}${projectUrlPath}`;

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
      creator: {
        select: { vanityUrl: true },
      },
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  // Notify all unique backers
  const notifications = project.pledges.map((pledge: { userId: string }) => ({
    userId: pledge.userId,
    type: "PROJECT_FUNDED" as NotificationType,
    title: "Project Funded!",
    message: `"${project.title}" has reached its funding goal!`,
    actionUrl: projectUrlPath,
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
          sendProjectFundedEmail(email, project.title, projectUrlPath, project.imageUrl)
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
  projectUrlPath: string,
  creatorName: string,
  imageUrl?: string | null
) {
  const projectUrl = `${APP_URL}${projectUrlPath}`;

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
        select: { name: true, vanityUrl: true },
      },
      followers: {
        select: { userId: true, email: true },
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

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
      actionUrl: projectUrlPath,
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
    actionUrl: projectUrlPath,
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
          projectUrlPath,
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
 * Send project update email
 */
async function sendProjectUpdateEmail(
  email: string,
  projectTitle: string,
  projectUrlPath: string,
  updateTitle: string,
  creatorName: string
) {
  const projectUrl = `${APP_URL}${projectUrlPath}`;

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
        select: { name: true, vanityUrl: true },
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

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

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
    actionUrl: projectUrlPath,
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
          projectUrlPath,
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
 * Send comment reply email
 */
async function sendCommentReplyEmail(
  email: string,
  userName: string,
  replierName: string,
  projectTitle: string,
  projectUrlPath: string,
  replyContent: string
) {
  const commentsUrl = `${APP_URL}${projectUrlPath}?tab=comments`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Reply to Your Comment</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Hi ${userName},</h2>

          <p><strong>${replierName}</strong> replied to your comment on <strong>"${projectTitle}"</strong>:</p>

          <div style="background: #fff; border-left: 4px solid #05ce78; padding: 15px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0; color: #333; white-space: pre-wrap;">${replyContent}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${commentsUrl}" style="display: inline-block; background: #05ce78; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Conversation
            </a>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you commented on this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${replierName} replied to your comment on "${projectTitle}"`,
    html,
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
  projectSlug: string,
  replyContent?: string,
  projectUrlPath?: string
) {
  // Use provided projectUrlPath or fallback to legacy slug-based URL
  const commentsUrl = projectUrlPath
    ? `${projectUrlPath}?tab=comments`
    : `/projects/${projectSlug}?tab=comments`;

  // Create in-app notification
  await createNotification({
    userId,
    type: "COMMENT_REPLY",
    title: "New Reply",
    message: `${replierName} replied to your comment on "${projectTitle}"`,
    actionUrl: commentsUrl,
    projectId,
  });

  // Send email notification
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email && replyContent) {
      await sendCommentReplyEmail(
        user.email,
        user.name || "there",
        replierName,
        projectTitle,
        projectUrlPath || `/projects/${projectSlug}`,
        replyContent
      );
      console.log(`Sent comment reply email to ${user.email}`);
    }
  } catch (error) {
    console.error("Failed to send comment reply email:", error);
    // Don't throw - in-app notification was still created
  }
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
  inviterId: string,
  projectUrlPath?: string
) {
  // Use provided projectUrlPath or fallback to legacy slug-based URL
  const actionUrl = projectUrlPath || `/projects/${projectSlug}`;

  await createNotification({
    userId,
    type: "COLLABORATOR_INVITE",
    title: "Collaboration Invite",
    message: `${inviterName} has invited you to collaborate on "${projectTitle}"`,
    actionUrl,
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

  if (!pledge || !pledge.user.email) return;

  // Check if confirmation email was already sent (prevent duplicates)
  if (pledge.confirmationEmailSent) {
    console.log(`Confirmation email already sent for pledge ${pledgeId}`);
    return;
  }

  // Format addons for the email - convert Decimal amounts to numbers
  const addons = pledge.addons?.map((addonEntry: { quantity: number; addon: { title: string; amount: unknown } }) => ({
    title: addonEntry.addon.title,
    quantity: addonEntry.quantity,
    amount: Number(addonEntry.addon.amount) * addonEntry.quantity,
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
      projectUrlPath
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
      creator: {
        select: { vanityUrl: true },
      },
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  const funded = Number(project.currentAmount) >= Number(project.goalAmount);
  const message = funded
    ? `"${project.title}" has successfully ended! Thanks for your support.`
    : `"${project.title}" has ended. Unfortunately, it did not reach its funding goal.`;

  const notifications = project.pledges.map((pledge: { userId: string }) => ({
    userId: pledge.userId,
    type: "PROJECT_ENDED" as NotificationType,
    title: funded ? "Campaign Successful!" : "Campaign Ended",
    message,
    actionUrl: projectUrlPath,
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
    actionUrl: projectUrlPath,
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
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
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
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
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
 * Notify user when someone comments on their project
 */
export async function notifyNewComment(
  creatorId: string,
  commenterName: string,
  projectId: string,
  projectTitle: string,
  projectSlug: string,
  commenterId: string,
  projectUrlPath?: string
) {
  // Use provided projectUrlPath or fallback to legacy slug-based URL
  const actionUrl = projectUrlPath
    ? `${projectUrlPath}#comments`
    : `/projects/${projectSlug}#comments`;

  await createNotification({
    userId: creatorId,
    type: "COMMENT_NEW",
    title: "New Comment",
    message: `${commenterName} commented on "${projectTitle}"`,
    actionUrl,
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
    if (!pledge.user.email) {
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

      // Get shipping info from pledge
      const shippingInfo = {
        name: pledge.shippingName || null,
        address: pledge.shippingAddress || null,
        city: pledge.shippingCity || null,
        state: pledge.shippingState || null,
        postalCode: pledge.shippingPostalCode || null,
        country: pledge.shippingCountry || null,
      };

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
        projectUrlPath
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

// ============================================================================
// MARKETPLACE NOTIFICATIONS
// ============================================================================

/**
 * Send marketplace purchase confirmation email to buyer
 */
async function sendMarketplacePurchaseEmail(
  email: string,
  buyerName: string,
  bookTitle: string,
  bookSlug: string,
  amount: number,
  currency: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN",
  coverImageUrl?: string | null
) {
  const libraryUrl = `${APP_URL}/dashboard/backer?tab=digital-library`;

  const paymentMethodLabel = paymentMethod === "DIVINITYCOIN" ? "DivinityCoin" : "Card";
  const amountFormatted = paymentMethod === "DIVINITYCOIN"
    ? `${amount.toFixed(2)} DC`
    : `$${amount.toFixed(2)} ${currency}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Confirmed!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME} Marketplace</h1>
        </div>

        <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Purchase Confirmed!</h2>

          ${coverImageUrl ? `<img src="${coverImageUrl}" alt="${bookTitle}" style="width: 100%; max-width: 300px; height: auto; border-radius: 8px; margin: 20px auto; display: block; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">` : ""}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${bookTitle}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">has been added to your Digital Library!</p>
          </div>

          <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 15px; margin-top: 20px;">
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 5px 0;">Payment Method:</td>
                <td style="text-align: right; padding: 5px 0;">${paymentMethodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Total:</strong></td>
                <td style="text-align: right; padding: 5px 0;"><strong>${amountFormatted}</strong></td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${libraryUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Read in Digital Library
          </a>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What's next?</strong></p>
          <p style="margin: 0; color: #666;">Your book is now available in your Digital Library. You can read it anytime, on any device. Just sign in to your account and visit the Digital Library.</p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you made a purchase on ${APP_NAME} Marketplace.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Purchase confirmed: "${bookTitle}"`,
    html,
  });
}

/**
 * Send marketplace sale notification email to creator
 */
async function sendMarketplaceSaleEmail(
  email: string,
  creatorName: string,
  bookTitle: string,
  bookSlug: string,
  saleAmount: number,
  platformFee: number,
  payout: number,
  currency: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN",
  buyerName: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/marketplace`;

  const paymentMethodLabel = paymentMethod === "DIVINITYCOIN" ? "DivinityCoin" : "Stripe";
  const formatAmount = (amt: number) => paymentMethod === "DIVINITYCOIN"
    ? `${amt.toFixed(2)} DC`
    : `$${amt.toFixed(2)} ${currency}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Sale!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME} Marketplace</h1>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">You made a sale!</h2>

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${bookTitle}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">purchased by ${buyerName}</p>
          </div>

          <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 15px; margin-top: 20px;">
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 5px 0;">Sale Amount:</td>
                <td style="text-align: right; padding: 5px 0;">${formatAmount(saleAmount)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">Platform Fee (3%):</td>
                <td style="text-align: right; padding: 5px 0;">-${formatAmount(platformFee)}</td>
              </tr>
              <tr style="border-top: 1px solid rgba(255,255,255,0.3);">
                <td style="padding: 10px 0 5px 0;"><strong>Your Payout:</strong></td>
                <td style="text-align: right; padding: 10px 0 5px 0;"><strong>${formatAmount(payout)}</strong></td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 14px;">Payment Method:</td>
                <td style="text-align: right; padding: 5px 0; font-size: 14px;">${paymentMethodLabel}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            View Dashboard
          </a>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0; color: #666;">
            ${paymentMethod === "DIVINITYCOIN"
              ? "Your DivinityCoin balance has been credited automatically."
              : "Your payout will be processed according to your Stripe Connect settings."}
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because someone purchased your book on ${APP_NAME} Marketplace.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `New sale: "${bookTitle}" - ${formatAmount(payout)} earned!`,
    html,
  });
}

/**
 * Notify buyer when their marketplace purchase is confirmed
 */
export async function notifyMarketplacePurchase(
  purchaseId: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN"
) {
  const purchase = await db.marketplacePurchase.findUnique({
    where: { id: purchaseId },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageUrl: true,
          pdfCoverImageUrl: true,
        },
      },
      buyer: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!purchase || !purchase.buyer.email) return;

  const libraryUrl = `/dashboard/backer?tab=digital-library`;

  // Create in-app notification for buyer
  await createNotification({
    userId: purchase.buyer.id,
    type: "MARKETPLACE_PURCHASE",
    title: "Purchase Confirmed!",
    message: `"${purchase.book.title}" has been added to your Digital Library.`,
    actionUrl: libraryUrl,
  });

  // Send email to buyer
  try {
    await sendMarketplacePurchaseEmail(
      purchase.buyer.email,
      purchase.buyer.name || "there",
      purchase.book.title,
      purchase.book.slug,
      Number(purchase.amount),
      purchase.currency,
      paymentMethod,
      purchase.book.coverImageUrl || purchase.book.pdfCoverImageUrl
    );
    console.log(`Sent marketplace purchase email to ${purchase.buyer.email} for purchase ${purchaseId}`);
  } catch (error) {
    console.error(`Failed to send marketplace purchase email for ${purchaseId}:`, error);
  }
}

/**
 * Notify creator when they receive a marketplace sale
 */
export async function notifyMarketplaceSale(
  purchaseId: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN"
) {
  const purchase = await db.marketplacePurchase.findUnique({
    where: { id: purchaseId },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          creator: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      buyer: {
        select: { name: true },
      },
    },
  });

  if (!purchase || !purchase.book.creator.email) return;

  const dashboardUrl = `/dashboard/marketplace`;
  const buyerName = purchase.buyer.name || "A customer";

  // Create in-app notification for creator
  await createNotification({
    userId: purchase.book.creator.id,
    type: "MARKETPLACE_SALE",
    title: "New Sale!",
    message: `${buyerName} purchased "${purchase.book.title}" for $${Number(purchase.amount).toFixed(2)}`,
    actionUrl: dashboardUrl,
  });

  // Send email to creator
  try {
    await sendMarketplaceSaleEmail(
      purchase.book.creator.email,
      purchase.book.creator.name || "Creator",
      purchase.book.title,
      purchase.book.slug,
      Number(purchase.amount),
      Number(purchase.platformFee),
      Number(purchase.creatorPayout),
      purchase.currency,
      paymentMethod,
      buyerName
    );
    console.log(`Sent marketplace sale email to ${purchase.book.creator.email} for purchase ${purchaseId}`);
  } catch (error) {
    console.error(`Failed to send marketplace sale email for ${purchaseId}:`, error);
  }
}

/**
 * Notify creator when their marketplace book is reviewed (approved or rejected)
 */
export async function notifyMarketplaceBookReview(
  bookId: string,
  action: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  const book = await db.marketplaceBook.findUnique({
    where: { id: bookId },
    include: {
      creator: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!book || !book.creator.email) return;

  const isApproved = action === "APPROVED";
  const dashboardUrl = `/dashboard/marketplace`;
  const bookUrl = isApproved ? `/marketplace/books/${book.slug}` : dashboardUrl;

  // Create in-app notification
  await createNotification({
    userId: book.creator.id,
    type: isApproved ? "MARKETPLACE_BOOK_APPROVED" : "MARKETPLACE_BOOK_REJECTED",
    title: isApproved ? "Book Approved! 🎉" : "Book Review Update",
    message: isApproved
      ? `Your book "${book.title}" has been approved and is now live on the marketplace!`
      : `Your book "${book.title}" was not approved. ${rejectionReason ? `Reason: ${rejectionReason}` : "Please check your dashboard for details."}`,
    actionUrl: bookUrl,
  });

  // Send email
  try {
    const creatorName = book.creator.name || "Creator";

    if (isApproved) {
      await sendEmail({
        to: book.creator.email,
        subject: `🎉 "${book.title}" is now live on the marketplace!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .book-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; }
              .button { display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Your Book is Live!</h1>
              </div>
              <div class="content">
                <p>Hi ${creatorName},</p>
                <p>Great news! Your book has been approved and is now live on the marketplace:</p>
                <p class="book-title">"${book.title}"</p>
                <p>Readers can now discover and purchase your book. Share the link with your audience to start making sales!</p>
                <p style="text-align: center;">
                  <a href="${APP_URL}${bookUrl}" class="button">View Your Book</a>
                </p>
                <p>Tips for success:</p>
                <ul>
                  <li>Share your book link on social media</li>
                  <li>Add it to your email signature</li>
                  <li>Consider creating promotional content</li>
                </ul>
                <p>Congratulations on publishing your book!</p>
                <p>Best,<br>The ${APP_NAME} Team</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } else {
      await sendEmail({
        to: book.creator.email,
        subject: `Update on your book "${book.title}"`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .book-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; }
              .reason-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .button { display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Book Review Update</h1>
              </div>
              <div class="content">
                <p>Hi ${creatorName},</p>
                <p>We've reviewed your book submission:</p>
                <p class="book-title">"${book.title}"</p>
                <p>Unfortunately, we were unable to approve it at this time.</p>
                ${rejectionReason ? `
                <div class="reason-box">
                  <strong>Feedback:</strong><br>
                  ${rejectionReason}
                </div>
                ` : ""}
                <p>You can make changes to your book and resubmit it for review. We're here to help you succeed!</p>
                <p style="text-align: center;">
                  <a href="${APP_URL}${dashboardUrl}" class="button">Edit Your Book</a>
                </p>
                <p>If you have questions about the review, please don't hesitate to reach out to our support team.</p>
                <p>Best,<br>The ${APP_NAME} Team</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    }
    console.log(`Sent marketplace book review email to ${book.creator.email} for book ${bookId}`);
  } catch (error) {
    console.error(`Failed to send marketplace book review email for ${bookId}:`, error);
  }
}
