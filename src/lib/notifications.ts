import { db } from "@/lib/db";

type NotificationType =
  | "COLLABORATOR_INVITE"
  | "COLLABORATOR_ACCEPTED"
  | "COLLABORATOR_DECLINED"
  | "PROJECT_UPDATE"
  | "PROJECT_FUNDED"
  | "PROJECT_LAUNCHED"
  | "PLEDGE_RECEIVED"
  | "PLEDGE_FAILED"
  | "COMMENT_REPLY"
  | "MESSAGE_RECEIVED"
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
