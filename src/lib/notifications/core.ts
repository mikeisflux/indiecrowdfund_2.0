import { db } from "@/lib/db";
import type { CreateNotificationParams } from "./types";

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
 * Everyone who should receive a project's creator-facing notifications: the
 * creator plus every accepted collaborator with a linked account.
 *
 * Collaborators run campaigns alongside the creator — coordinating
 * fulfillment, answering backers — but only the creator was ever notified, so
 * a collaborator had to keep reloading the dashboard to notice a new pledge.
 *
 * Noise rule for platform staff: a SUPER_ADMIN is attached to many projects
 * for support reasons and does not want every backer event from all of them.
 * They only receive notifications for projects owned by another SUPER_ADMIN
 * (the platform's own campaigns). A SUPER_ADMIN who owns the project is always
 * notified — this filter only applies to them as a collaborator.
 */
export async function getProjectNotificationRecipients(
  projectId: string
): Promise<string[]> {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { creatorId: true, creator: { select: { role: true } } },
  });
  if (!project) return [];

  const collaborators = await db.projectCollaborator.findMany({
    where: { projectId, status: "ACCEPTED", userId: { not: null } },
    select: { userId: true, user: { select: { role: true, deletedAt: true } } },
  });

  const creatorIsSuperAdmin = project.creator?.role === "SUPER_ADMIN";
  const recipients = new Set<string>([project.creatorId]);

  for (const c of collaborators) {
    if (!c.userId || c.user?.deletedAt) continue;
    if (c.user?.role === "SUPER_ADMIN" && !creatorIsSuperAdmin) continue;
    recipients.add(c.userId);
  }

  return [...recipients];
}

/**
 * Send one notification to the whole project team (creator + collaborators).
 * `excludeUserId` skips the person who caused the event, so nobody is told
 * about their own action.
 */
export async function notifyProjectTeam(
  projectId: string,
  params: Omit<CreateNotificationParams, "userId"> & { excludeUserId?: string }
) {
  const { excludeUserId, ...notification } = params;
  const recipients = (await getProjectNotificationRecipients(projectId)).filter(
    (id) => id !== excludeUserId
  );
  if (recipients.length === 0) return;

  await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      projectId: notification.projectId ?? projectId,
      senderId: notification.senderId,
    })),
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
