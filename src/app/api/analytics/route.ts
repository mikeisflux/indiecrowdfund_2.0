import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProjectAnalytics } from "@/lib/tracking/index";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const days = parseInt(searchParams.get("days") || "30");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const analytics = await getProjectAnalytics(projectId, days);

    // Get additional stats
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [dailyPledges, rewardBreakdown, hourlyActivity] = await Promise.all([
      // Daily pledges
      db.pledge.groupBy({
        by: ["createdAt"],
        where: {
          projectId,
          status: "COMPLETED",
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Pledges by reward tier
      db.pledge.groupBy({
        by: ["rewardId"],
        where: {
          projectId,
          status: "COMPLETED",
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Activity by hour (last 48 hours)
      db.userBehavior.groupBy({
        by: ["eventType"],
        where: {
          projectId,
          timestamp: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
          },
        },
        _count: true,
      }),
    ]);

    // Get reward titles for breakdown
    const rewardIds = rewardBreakdown.map((r: { rewardId: string | null }) => r.rewardId).filter((id: string | null): id is string => id !== null);
    const rewards = await db.reward.findMany({
      where: { id: { in: rewardIds } },
      select: { id: true, title: true, amount: true },
    });

    const rewardMap = new Map<string, { id: string; title: string; amount: number }>(rewards.map((r: { id: string; title: string; amount: number }) => [r.id, r]));

    return NextResponse.json({
      ...analytics,
      dailyPledges: dailyPledges.map((d: { createdAt: Date; _sum: { amount: number | null }; _count: number }) => ({
        date: d.createdAt,
        amount: d._sum.amount || 0,
        count: d._count,
      })),
      rewardBreakdown: rewardBreakdown.map((r: { rewardId: string | null; _sum: { amount: number | null }; _count: number }) => ({
        rewardId: r.rewardId,
        title: r.rewardId ? rewardMap.get(r.rewardId)?.title || "Unknown" : "No Reward",
        tierAmount: r.rewardId ? rewardMap.get(r.rewardId)?.amount || 0 : 0,
        totalPledged: r._sum.amount || 0,
        backerCount: r._count,
      })),
      hourlyActivity: hourlyActivity.map((h: { eventType: string; _count: number }) => ({
        eventType: h.eventType,
        count: h._count,
      })),
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
