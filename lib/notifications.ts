import { prisma } from "./db"

interface CreateNotificationParams {
  userId: string
  type: string
  title: string
  message: string
  link?: string
  metadata?: Record<string, any>
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        metadata,
      },
    })

    return notification
  } catch (error) {
    console.error("Failed to create notification:", error)
    return null
  }
}

export async function createNotificationForProjectBackers(
  projectId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>
) {
  try {
    // Get all unique backers for this project
    const backers = await prisma.pledge.findMany({
      where: {
        projectId,
        status: "COMPLETED",
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    })

    const notifications = backers.map((backer) => ({
      userId: backer.userId,
      type,
      title,
      message,
      link,
      metadata,
    }))

    await prisma.notification.createMany({
      data: notifications,
    })

    return notifications.length
  } catch (error) {
    console.error("Failed to create notifications for backers:", error)
    return 0
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
    return true
  } catch (error) {
    console.error("Failed to mark notification as read:", error)
    return false
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    })
    return true
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error)
    return false
  }
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    })
    return count
  } catch (error) {
    console.error("Failed to get unread notification count:", error)
    return 0
  }
}
