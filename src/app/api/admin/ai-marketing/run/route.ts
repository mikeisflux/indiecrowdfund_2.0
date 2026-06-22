import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminAiMarketingRunLogger = logger.child({ module: "admin-ai-marketing-run" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateSmartSegments,
  batchPredictUsers,
  batchOptimalSendTimes,
  personalizeEmailForUser,
  generateContentVariants,
} from "@/lib/ai/marketing-services";
import { autoTagProject } from "@/lib/ai/anthropic";
import { getAISettings, clearSettingsCache } from "@/lib/ai/settings-integration";
import { batchUpdateUserInterests } from "@/lib/ai/user-interests";
import { runAutomatedMarketing } from "@/lib/ai/automation";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
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
            deletedAt: null,
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
            deletedAt: null,
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
            deletedAt: null,
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
      // RUN USER INTEREST PROFILING
      // ==========================================
      case "runUserProfiling": {
        const limit = params?.limit || 50;

        // Get users with behavior data or pledges who need profiling
        const usersNeedingProfiles = await db.user.findMany({
          where: {
            deletedAt: null,
            OR: [
              { behaviors: { some: {} } },
              { pledges: { some: { status: "COMPLETED" } } },
            ],
            interestProfile: null,
          },
          take: limit,
          select: { id: true },
        });

        // Also get users with stale profiles (older than 7 days)
        const usersWithStaleProfiles = await db.userInterestProfile.findMany({
          where: {
            lastCalculatedAt: {
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          take: Math.max(0, limit - usersNeedingProfiles.length),
          select: { userId: true },
        });

        const userIds = [
          ...usersNeedingProfiles.map((u: { id: string }) => u.id),
          ...usersWithStaleProfiles.map((u: { userId: string }) => u.userId),
        ];

        if (userIds.length === 0) {
          result = {
            success: true,
            message: "All user profiles are up to date",
            processed: 0,
          };
          break;
        }

        const updateResults = await batchUpdateUserInterests(userIds);

        // Get updated stats
        const [totalProfiles, avgScore] = await Promise.all([
          db.userInterestProfile.count(),
          db.userInterestProfile.aggregate({
            _avg: { profileScore: true },
          }),
        ]);

        result = {
          success: true,
          message: `Updated ${updateResults.processed} user interest profiles`,
          processed: updateResults.processed,
          failed: updateResults.failed,
          stats: {
            totalProfiles,
            avgProfileScore: avgScore._avg.profileScore?.toFixed(1) || "0",
          },
        };
        break;
      }

      // ==========================================
      // RUN FULL AUTOMATED MARKETING
      // ==========================================
      case "runAutomation": {
        const automationResult = await runAutomatedMarketing();

        result = {
          success: automationResult.success,
          message: automationResult.success
            ? `Automation complete: ${automationResult.campaignsCreated} campaigns, ${automationResult.emailsQueued} emails queued (${(automationResult.duration / 1000).toFixed(1)}s)`
            : `Automation finished with ${automationResult.errors.length} error(s)`,
          steps: automationResult.steps,
          campaignsCreated: automationResult.campaignsCreated,
          emailsQueued: automationResult.emailsQueued,
          errors: automationResult.errors,
          duration: automationResult.duration,
        };
        break;
      }

      // ==========================================
      // GET AUTOMATION STATUS
      // ==========================================
      case "getAutomationStatus": {
        // Get last automated campaign
        const lastAutoCampaign = await db.emailCampaign.findFirst({
          where: {
            status: "SENT",
            filters: { path: ["automated"], equals: true },
          },
          orderBy: { sentAt: "desc" },
          select: {
            id: true,
            name: true,
            sentAt: true,
            sentCount: true,
            openCount: true,
            clickCount: true,
            recipientCount: true,
            filters: true,
          },
        });

        // Get all automated campaigns in last 30 days
        const recentAutoCampaigns = await db.emailCampaign.findMany({
          where: {
            filters: { path: ["automated"], equals: true },
            sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { sentAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            sentAt: true,
            sentCount: true,
            openCount: true,
            clickCount: true,
            recipientCount: true,
            filters: true,
          },
        });

        // Calculate aggregate performance
        type CampaignRow = { id: string; name: string; status: string; sentAt: Date | null; sentCount: number; openCount: number; clickCount: number; recipientCount: number; filters: unknown };
        const sentCampaigns = recentAutoCampaigns.filter((c: CampaignRow) => c.status === "SENT" && c.sentCount > 0);
        const totalSent = sentCampaigns.reduce((sum: number, c: CampaignRow) => sum + c.sentCount, 0);
        const totalOpens = sentCampaigns.reduce((sum: number, c: CampaignRow) => sum + c.openCount, 0);
        const totalClicks = sentCampaigns.reduce((sum: number, c: CampaignRow) => sum + c.clickCount, 0);

        result = {
          success: true,
          lastRun: lastAutoCampaign?.sentAt || null,
          lastCampaign: lastAutoCampaign
            ? {
                id: lastAutoCampaign.id,
                name: lastAutoCampaign.name,
                sentAt: lastAutoCampaign.sentAt,
                recipients: lastAutoCampaign.recipientCount,
                sent: lastAutoCampaign.sentCount,
                opens: lastAutoCampaign.openCount,
                clicks: lastAutoCampaign.clickCount,
                type: (lastAutoCampaign.filters as { campaignType?: string } | null)?.campaignType || "unknown",
              }
            : null,
          recentCampaigns: recentAutoCampaigns.map((c: CampaignRow) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            sentAt: c.sentAt,
            sent: c.sentCount,
            opens: c.openCount,
            clicks: c.clickCount,
            type: (c.filters as { campaignType?: string } | null)?.campaignType || "unknown",
          })),
          performance: {
            campaignsSent: sentCampaigns.length,
            totalEmailsSent: totalSent,
            avgOpenRate: totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) + "%" : "N/A",
            avgClickRate: totalOpens > 0 ? ((totalClicks / totalOpens) * 100).toFixed(1) + "%" : "N/A",
          },
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

      // ==========================================
      // TEST EMAIL PERSONALIZATION
      // ==========================================
      // The UI's "Run Now" on the Email Personalization card hits
      // this. We pick a representative recent backer, pull a few
      // LIVE projects to use as candidates, and run one personalize
      // pass so the operator can see the AI is actually wired up
      // and what the output looks like.
      case "testEmailPersonalization": {
        const settings = await getAISettings();
        if (!settings.emailPersonalization) {
          return NextResponse.json({
            success: false,
            message: "Email Personalization is disabled. Enable it in AI Settings first.",
          });
        }

        const sampleUser = await db.user.findFirst({
          where: { deletedAt: null, lockedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, name: true },
        });
        if (!sampleUser) {
          return NextResponse.json({
            success: false,
            message: "No users available to use as a sample for the personalization test.",
          });
        }

        const sampleProjects = await db.project.findMany({
          where: { status: "LIVE", deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, title: true, description: true, category: true },
        });
        if (sampleProjects.length === 0) {
          return NextResponse.json({
            success: false,
            message: "No LIVE projects to use as personalization candidates.",
          });
        }

        try {
          const personalized = await personalizeEmailForUser(
            sampleUser.id,
            params?.campaignType || "weekly_digest",
            sampleProjects.map((p: { id: string; title: string; description: string | null; category: string | null }) => ({
              id: p.id,
              title: p.title,
              description: p.description || "",
              category: p.category || "general",
            }))
          );
          result = {
            success: true,
            message: `Personalized email content for ${sampleUser.email}`,
            sampleUser: { id: sampleUser.id, email: sampleUser.email, name: sampleUser.name },
            campaignType: params?.campaignType || "weekly_digest",
            candidateCount: sampleProjects.length,
            personalized,
          };
        } catch (err) {
          return NextResponse.json({
            success: false,
            message:
              "Personalization call failed -- check ANTHROPIC_API_KEY in admin settings and PM2 logs for the Anthropic error.",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      // ==========================================
      // TEST CONTENT OPTIMIZATION (A/B variant generation)
      // ==========================================
      // The UI's "Run Now" on Content Optimization. We generate 3
      // A/B variants of a sample subject line so the operator can
      // see real Anthropic output. Real-world use is wired into the
      // campaign-builder; this just smoke-tests the path.
      case "testContentOptimization": {
        const settings = await getAISettings();
        if (!settings.contentOptimization) {
          return NextResponse.json({
            success: false,
            message: "Content Optimization is disabled. Enable it in AI Settings first.",
          });
        }

        const sampleContent: string =
          params?.content || "Back this comic and get exclusive variant covers";
        const contentType: "subject" | "body" | "cta" =
          params?.contentType === "body" || params?.contentType === "cta"
            ? params.contentType
            : "subject";
        const context = {
          campaignType: params?.campaignType || "project_launch",
          targetAudience: params?.targetAudience || "comic backers",
        };

        try {
          const variants = await generateContentVariants(
            sampleContent,
            contentType,
            context
          );
          result = {
            success: true,
            message: `Generated ${variants.variants?.length || 0} ${contentType} variants`,
            sample: sampleContent,
            contentType,
            context,
            variants,
          };
        } catch (err) {
          return NextResponse.json({
            success: false,
            message:
              "Content variant generation failed -- check ANTHROPIC_API_KEY in admin settings and PM2 logs for the Anthropic error.",
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    adminAiMarketingRunLogger.error({ err: formatError(error) }, "AI run error:");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run AI service" },
      { status: 500 }
    );
  }
}
