import { db } from "@/lib/db";
import { createNotification } from "./core";
import { sendCommentReplyEmail } from "./email-templates";

import { logger } from "@/lib/logger";

const notificationsSocialNotificationsLogger = logger.child({ module: "notifications-social-notifications" });


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
      notificationsSocialNotificationsLogger.info(`Sent comment reply email to ${user.email}`);
    }
  } catch (error) {
    notificationsSocialNotificationsLogger.error({ err: error }, "Failed to send comment reply email:");
    // Don't throw - in-app notification was still created
  }
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
