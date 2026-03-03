import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - SEO Dashboard stats
export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      latestAudit,
      totalPages,
      totalKeywords,
      trackedKeywords,
      recentCronLogs,
      lowScorePages,
    ] = await Promise.all([
      // Latest completed audit
      db.seoAudit.findFirst({
        where: { status: "completed" },
        orderBy: { createdAt: "desc" },
      }),
      // Total pages tracked
      db.seoPageMeta.count(),
      // Total keywords
      db.seoKeyword.count(),
      // Tracked keywords
      db.seoKeyword.count({ where: { isTracked: true } }),
      // Recent cron logs (last 5)
      db.seoCronLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Pages with low audit scores (< 60)
      db.seoPageMeta.findMany({
        where: {
          lastAuditScore: { lt: 60 },
        },
        orderBy: { lastAuditScore: "asc" },
      }),
    ]);

    // Calculate issue counts from latest audit
    const issueStats = {
      critical: latestAudit?.criticalIssues ?? 0,
      warnings: latestAudit?.warnings ?? 0,
      passed: latestAudit?.passed ?? 0,
      total: latestAudit?.issuesFound ?? 0,
    };

    return NextResponse.json({
      data: {
        latestAudit,
        totalPages,
        totalKeywords,
        trackedKeywords,
        recentCronLogs,
        lowScorePages,
        issueStats,
        overallScore: latestAudit?.overallScore ?? null,
      },
      stats: {
        totalPages,
        totalKeywords,
        trackedKeywords,
        lowScoreCount: lowScorePages.length,
        lastAuditDate: latestAudit?.completedAt ?? latestAudit?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching SEO dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch SEO dashboard stats" },
      { status: 500 }
    );
  }
}
