import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingBehaviorLogger = logger.child({ module: "admin-ai-marketing-behavior" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Fetch recent behavior events
export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    // Validate limit parameter
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const eventType = searchParams.get("eventType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query conditions
    const where: {
      eventType?: string;
      timestamp?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    if (eventType) {
      where.eventType = eventType;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // Get recent events
    const events = await db.userBehavior.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        sessionId: true,
        eventType: true,
        projectId: true,
        searchQuery: true,
        path: true,
        timeSpent: true,
        scrollDepth: true,
        timestamp: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        project: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });

    // Get aggregate stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayCount,
      yesterdayCount,
      weekCount,
      eventTypeStats,
      topProjects,
      topSearches,
    ] = await Promise.all([
      db.userBehavior.count({ where: { timestamp: { gte: today } } }),
      db.userBehavior.count({ where: { timestamp: { gte: yesterday, lt: today } } }),
      db.userBehavior.count({ where: { timestamp: { gte: lastWeek } } }),
      db.userBehavior.groupBy({
        by: ["eventType"],
        _count: { id: true },
        where: { timestamp: { gte: lastWeek } },
        orderBy: { _count: { id: "desc" } },
      }),
      db.userBehavior.groupBy({
        by: ["projectId"],
        _count: { id: true },
        where: {
          timestamp: { gte: lastWeek },
          projectId: { not: null },
          eventType: { in: ["PROJECT_VIEW", "PROJECT_CLICK", "PLEDGE_START"] }
        },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      db.userBehavior.groupBy({
        by: ["searchQuery"],
        _count: { id: true },
        where: {
          timestamp: { gte: lastWeek },
          searchQuery: { not: null },
        },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
    ]);

    // Get project titles for top projects
    const projectIds = topProjects.map(p => p.projectId).filter(Boolean) as string[];
    const projects = await db.project.findMany({
      where: { id: { in: projectIds }, deletedAt: null },
      select: { id: true, title: true },
    });
    const projectMap = new Map(projects.map(p => [p.id, p.title]));

    // Calculate trend
    const trend = yesterdayCount > 0
      ? (((todayCount - yesterdayCount) / yesterdayCount) * 100).toFixed(1)
      : todayCount > 0 ? "+100" : "0";

    return NextResponse.json({
      events: events.map(e => ({
        id: e.id,
        sessionId: e.sessionId.substring(0, 12) + "...",
        eventType: e.eventType,
        path: e.path,
        projectId: e.projectId,
        projectTitle: e.project?.title,
        searchQuery: e.searchQuery,
        timeSpent: e.timeSpent,
        scrollDepth: e.scrollDepth,
        timestamp: e.timestamp.toISOString(),
        userId: e.user?.id,
        userName: e.user?.name || e.user?.email?.split("@")[0],
      })),
      stats: {
        todayCount,
        yesterdayCount,
        weekCount,
        trend: `${trend}%`,
      },
      eventTypeBreakdown: eventTypeStats.map(e => ({
        eventType: e.eventType,
        count: e._count.id,
      })),
      topProjects: topProjects.map(p => ({
        projectId: p.projectId,
        projectTitle: projectMap.get(p.projectId!) || "Unknown",
        count: p._count.id,
      })),
      topSearches: topSearches
        .filter(s => s.searchQuery)
        .map(s => ({
          query: s.searchQuery,
          count: s._count.id,
        })),
    });
  } catch (error) {
    adminAiMarketingBehaviorLogger.error({ err: String(error) }, "Error fetching behavior data:");
    return NextResponse.json(
      { error: "Failed to fetch behavior data" },
      { status: 500 }
    );
  }
}
