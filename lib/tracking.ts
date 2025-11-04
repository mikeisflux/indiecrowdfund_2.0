import { prisma } from "./db"

type EventType =
  | "VIEW"
  | "CLICK"
  | "SEARCH"
  | "WATCH"
  | "PLEDGE_ATTEMPT"
  | "WATCHLIST_ADD"
  | "SHARE"
  | "COMMENT"

type EntityType = "PROJECT" | "CATEGORY" | "USER" | "REWARD"

export async function trackBehavior({
  userId,
  eventType,
  entityType,
  entityId,
  metadata,
}: {
  userId: string
  eventType: EventType
  entityType?: EntityType
  entityId?: string
  metadata?: Record<string, any>
}) {
  try {
    await prisma.behaviorLog.create({
      data: {
        userId,
        eventType,
        entityType: entityType || null,
        entityId: entityId || null,
        metadata: metadata || null,
      },
    })
  } catch (error) {
    console.error("Failed to track behavior:", error)
    // Don't throw - tracking failures shouldn't break the app
  }
}

export async function getUserBehaviorProfile(userId: string) {
  const behaviors = await prisma.behaviorLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  // Analyze behaviors
  const viewedProjects = behaviors
    .filter((b) => b.eventType === "VIEW" && b.entityType === "PROJECT")
    .map((b) => b.entityId)
    .filter(Boolean)

  const viewedCategories = behaviors
    .filter((b) => b.eventType === "VIEW" && b.entityType === "CATEGORY")
    .map((b) => b.entityId)
    .filter(Boolean)

  const searchQueries = behaviors
    .filter((b) => b.eventType === "SEARCH")
    .map((b) => b.metadata as any)
    .filter(Boolean)

  return {
    viewedProjects,
    viewedCategories,
    searchQueries,
    totalInteractions: behaviors.length,
  }
}

export async function getRecommendedProjects(userId: string, limit: number = 10) {
  try {
    const profile = await getUserBehaviorProfile(userId)

    // Get user's pledge history
    const pledges = await prisma.pledge.findMany({
      where: { backerId: userId },
      include: { project: true },
    })

    const pledgedCategories = pledges.map((p) => p.project.category)

    // Find projects in similar categories
    const recommendations = await prisma.project.findMany({
      where: {
        status: "LIVE",
        category: {
          in: pledgedCategories.length > 0 ? pledgedCategories : undefined,
        },
        id: {
          notIn: pledges.map((p) => p.projectId),
        },
      },
      include: {
        creator: {
          select: {
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        currentAmount: "desc",
      },
      take: limit,
    })

    return recommendations
  } catch (error) {
    console.error("Failed to get recommendations:", error)
    return []
  }
}
