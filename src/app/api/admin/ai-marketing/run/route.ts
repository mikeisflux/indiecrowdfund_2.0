import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateSmartSegments,
  batchPredictUsers,
  batchOptimalSendTimes,
} from "@/lib/ai/marketing-services";
import { autoTagProject } from "@/lib/ai/openai";
import { getAISettings, clearSettingsCache } from "@/lib/ai/settings-integration";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 };
  }
  return { user: session.user };
}

// POST - Run an AI service manually
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { action, params } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    let result;

    switch (action) {
      // ==========================================
      // RUN SMART SEGMENTATION
      // ==========================================
      case "runSegmentation": {
        const settings = await getAISettings();
        if (!settings.smartSegmentation) {
          return NextResponse.json({
            success: false,
            message: "Smart Segmentation is disabled. Enable it in AI Settings first.",
          });
        }

        const segments = await generateSmartSegments();

        // Store segments in database (could create a Segments table)
        // For now, just return the results
        result = {
          success: true,
          message: `Generated ${segments.length} user segments`,
          segments,
          totalUsers: segments.reduce((sum, s) => sum + s.userCount, 0),
        };
        break;
      }

      // ==========================================
      // RUN PREDICTIVE ANALYTICS
      // ==========================================
      case "runPredictiveAnalytics": {
        const settings = await getAISettings();
        if (!settings.predictiveAnalytics) {
          return NextResponse.json({
            success: false,
            message: "Predictive Analytics is disabled. Enable it in AI Settings first.",
          });
        }

        const limit = params?.limit || 100;

        // Get active users
        const users = await db.user.findMany({
          where: {
            behaviors: {
              some: {
                timestamp: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
              },
            },
          },
          take: limit,
          select: { id: true },
        });

        const predictions = await batchPredictUsers(users.map((u) => u.id));

        // Categorize results
        const highValue = predictions.filter((p) => p.conversionProbability > 0.6);
        const atRisk = predictions.filter((p) => p.churnRisk > 0.5);
        const predictedRevenue = predictions.reduce((sum, p) => sum + p.predictedLifetimeValue, 0);

        result = {
          success: true,
          message: `Analyzed ${predictions.length} users`,
          summary: {
            totalAnalyzed: predictions.length,
            highValueProspects: highValue.length,
            atRiskUsers: atRisk.length,
            predictedRevenue: Math.round(predictedRevenue),
          },
          topProspects: highValue.slice(0, 10),
          atRiskUsers: atRisk.slice(0, 10),
        };
        break;
      }

      // ==========================================
      // RUN SEND TIME OPTIMIZATION
      // ==========================================
      case "runSendTimeOptimization": {
        const settings = await getAISettings();
        if (!settings.sendTimeOptimization) {
          return NextResponse.json({
            success: false,
            message: "Send Time Optimization is disabled. Enable it in AI Settings first.",
          });
        }

        const limit = params?.limit || 100;

        // Get users with behavior data
        const users = await db.user.findMany({
          where: {
            behaviors: { some: {} },
          },
          take: limit,
          select: { id: true, email: true },
        });

        const times = await batchOptimalSendTimes(users.map((u) => u.id));

        // Aggregate by hour
        const hourDistribution = new Map<number, number>();
        Array.from(times.values()).forEach((time) => {
          hourDistribution.set(time.optimalHour, (hourDistribution.get(time.optimalHour) || 0) + 1);
        });

        const distribution = Array.from(hourDistribution.entries())
          .map(([hour, count]) => ({ hour, count }))
          .sort((a, b) => a.hour - b.hour);

        result = {
          success: true,
          message: `Calculated optimal send times for ${times.size} users`,
          summary: {
            totalAnalyzed: times.size,
            peakHour: distribution.reduce((max, curr) => (curr.count > max.count ? curr : max), distribution[0])?.hour,
          },
          hourlyDistribution: distribution,
        };
        break;
      }

      // ==========================================
      // RUN AUTO-TAGGING
      // ==========================================
      case "runAutoTagging": {
        const settings = await getAISettings();
        if (!settings.autoTagging) {
          return NextResponse.json({
            success: false,
            message: "Auto-Tagging is disabled. Enable it in AI Settings first.",
          });
        }

        const limit = params?.limit || 20;

        // Get projects without tags
        const projects = await db.project.findMany({
          where: {
            OR: [{ tags: { isEmpty: true } }, { tags: { equals: [] } }],
          },
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            goalAmount: true,
            rewards: { select: { title: true, description: true, amount: true } },
          },
        });

        if (projects.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No projects need tagging",
            tagged: 0,
          });
        }

        const results = await Promise.all(
          projects.map(async (project) => {
            try {
              const tags = await autoTagProject({
                title: project.title,
                description: project.description || "",
                category: project.category || undefined,
                goalAmount: project.goalAmount ? Number(project.goalAmount) : undefined,
                rewards: project.rewards.map((r: { title: string; description: string | null; amount: number }) => ({
                  title: r.title,
                  description: r.description || "",
                  amount: Number(r.amount),
                })),
              });

              // Only apply if confidence meets threshold
              if (tags.confidence * 100 >= settings.autoTagConfidence) {
                await db.project.update({
                  where: { id: project.id },
                  data: {
                    tags: tags.tags.slice(0, settings.maxTags),
                    category: tags.primaryCategory.toUpperCase(),
                  },
                });
                return { projectId: project.id, success: true, tags: tags.tags };
              }
              return { projectId: project.id, success: false, reason: "Below confidence threshold" };
            } catch (error) {
              return { projectId: project.id, success: false, reason: String(error) };
            }
          })
        );

        const successful = results.filter((r) => r.success).length;

        result = {
          success: true,
          message: `Tagged ${successful} of ${projects.length} projects`,
          results,
        };
        break;
      }

      // ==========================================
      // REFRESH SETTINGS CACHE
      // ==========================================
      case "refreshSettings": {
        clearSettingsCache();
        const settings = await getAISettings();
        result = {
          success: true,
          message: "Settings cache refreshed",
          settings,
        };
        break;
      }

      // ==========================================
      // GET CURRENT STATUS
      // ==========================================
      case "getStatus": {
        const settings = await getAISettings();

        // Count relevant data
        const [userCount, projectCount, behaviorCount, emailCount] = await Promise.all([
          db.user.count(),
          db.project.count(),
          db.userBehavior.count({
            where: { timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          }),
          db.emailLog.count({
            where: { sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          }),
        ]);

        result = {
          success: true,
          settings,
          stats: {
            totalUsers: userCount,
            totalProjects: projectCount,
            behaviorEvents: behaviorCount,
            emailsSent: emailCount,
          },
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run AI service" },
      { status: 500 }
    );
  }
}
