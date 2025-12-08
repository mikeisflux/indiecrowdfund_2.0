import { db } from "@/lib/db";

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
 * Notify backers when a project is funded
 */
export async function notifyProjectFunded(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
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
      creatorId: true,
      followers: {
        select: { userId: true },
      },
    },
  });

  if (!project) return;

  // Notify all followers (except the creator)
  const notifications = project.followers
    .filter((f: { userId: string }) => f.userId !== project.creatorId)
    .map((follower: { userId: string }) => ({
      userId: follower.userId,
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
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
      followers: {
        select: { userId: true },
      },
    },
  });

  if (!project) return;

  // Combine backers and followers (unique users except creator)
  const userIds = new Set<string>();
  project.pledges.forEach((p: { userId: string }) => userIds.add(p.userId));
  project.followers.forEach((f: { userId: string }) => userIds.add(f.userId));
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
 */
export async function notifyFollowedProjectLaunched(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      creatorId: true,
      followers: {
        select: { userId: true },
        where: { userId: { not: null } },
      },
    },
  });

  if (!project) return;

  const notifications = project.followers
    .filter((f: { userId: string | null }) => f.userId && f.userId !== project.creatorId)
    .map((follower: { userId: string | null }) => ({
      userId: follower.userId!,
      type: "FOLLOWED_PROJECT_LAUNCHED" as NotificationType,
      title: "Project You Follow Is Live!",
      message: `"${project.title}" just launched!`,
      actionUrl: `/projects/${project.slug}`,
      projectId,
    }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }
}
