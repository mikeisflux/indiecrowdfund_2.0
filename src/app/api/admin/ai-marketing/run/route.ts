import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminAiMarketingRunLogger = logger.child({ module: "admin-ai-marketing-run" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateSmartSegments,
  predictUserBehavior,
  getOptimalSendTime,
  personalizeEmailForUser,
  generateContentVariants,
} from "@/lib/ai/marketing-services";
import { autoTagProject, GENERIC_PROJECT_TAGS } from "@/lib/ai/anthropic";
import { getAISettings, clearSettingsCache } from "@/lib/ai/settings-integration";
import { batchUpdateUserInterests } from "@/lib/ai/user-interests";
import { runAutomatedMarketing } from "@/lib/ai/automation";

export const dynamic = "force-dynamic";
// Full-user-base predictive/send-time runs are chunked but can still take
// a couple of minutes for a large list; allow up to 5 minutes.
export const maxDuration = 300;

// Process items in small SEQUENTIAL chunks with a pause between them.
// Predictive Analytics and Send-Time Optimization are pure statistics (no
// AI cost) computed from each user's own behavior, so they run across the
// WHOLE user base — but firing ~1,600 concurrent DB reads would swamp the
// connection pool (the "timeout exceeded when trying to connect" failure).
// Chunking keeps the single worker handling this request responsive; the
// per-service cron runs it off-peak so that core is idle anyway.
async function processInChunks<T>(
  items: T[],
  handler: (item: T) => Promise<void>,
  opts: { chunkSize?: number; pauseMs?: number } = {}
): Promise<void> {
  const chunkSize = opts.chunkSize ?? 10;
  const pauseMs = opts.pauseMs ?? 200;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await Promise.all(chunk.map((item) => handler(item).catch(() => {})));
    if (i + chunkSize < items.length && pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }
}

async function requireAdmin(request: Request) {
  // Server-to-server: the AI-services scheduler cron calls this with
  // Bearer CRON_SECRET (no user session). Authorize it so scheduled
  // runs reuse the exact same run logic + run-log writing as manual
  // "Run Now" clicks instead of duplicating it.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return { cron: true as const };
  }

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

// GET - Recent AI service run history (persisted; survives refreshes
// and includes cron-triggered runs). ?limit=N (default 50, max 200).
export async function GET(request: Request) {
  const authResult = await requireAdmin(request);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "50") || 50));
  const serviceId = url.searchParams.get("serviceId");

  const runs = await db.aiRunLog.findMany({
    where: serviceId ? { serviceId } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      serviceId: true,
      success: true,
      message: true,
      trigger: true,
      durationMs: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ runs });
}

// POST - Run an AI service manually
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin(request);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { action, params } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    // Map a run action to the UI-facing service id so the history tab
    // can label/group rows. Returns null for non-run actions
    // (getStatus, refreshSettings, getAutomationStatus) which we don't
    // log — they're polls, not runs.
    const SERVICE_ID_BY_ACTION: Record<string, string> = {
      runAutoTagging: "auto-tagging",
      runPredictiveAnalytics: "predictive-analytics",
      runSegmentation: "smart-segmentation",
      runSendTimeOptimization: "send-time-optimization",
      testEmailPersonalization: "email-personalization",
      testContentOptimization: "content-optimization",
      runUserProfiling: "user-profiling",
      runAutomation: "automation",
    };
    const loggedServiceId = SERVICE_ID_BY_ACTION[action] || null;
    const runStartedAt = Date.now();
    const trigger =
      request.headers.get("x-cron-trigger") === "1" ? "cron" : "manual";
    const triggeredById =
      "user" in authResult ? authResult.user?.id ?? null : null;

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

        // Score the ENTIRE active user base (was capped at 100). Optional
        // params.limit only for a quick manual spot-check.
        const limit = typeof params?.limit === "number" ? params.limit : undefined;
        const users = await db.user.findMany({
          where: {
            deletedAt: null,
            behaviors: {
              some: {
                timestamp: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
              },
            },
          },
          ...(limit ? { take: limit } : {}),
          select: { id: true },
        });

        let analyzed = 0;
        let highValue = 0;
        let atRiskCount = 0;
        let predictedRevenue = 0;
        const topProspects: Array<{ userId: string; conversionProbability: number; predictedLifetimeValue: number }> = [];
        const atRiskTop: Array<{ userId: string; churnRisk: number }> = [];

        await processInChunks(users.map((u) => u.id), async (id) => {
          const p = await predictUserBehavior(id);
          // Persist so the daily automation can target campaigns by score.
          await db.userMarketingScore.upsert({
            where: { userId: id },
            create: {
              userId: id,
              conversionProbability: p.conversionProbability,
              churnRisk: p.churnRisk,
              predictedLtv: p.predictedLifetimeValue,
              nextAction: p.nextActionPrediction,
              predictionConfidence: p.confidence,
              predictionsCalculatedAt: new Date(),
            },
            update: {
              conversionProbability: p.conversionProbability,
              churnRisk: p.churnRisk,
              predictedLtv: p.predictedLifetimeValue,
              nextAction: p.nextActionPrediction,
              predictionConfidence: p.confidence,
              predictionsCalculatedAt: new Date(),
            },
          });
          analyzed++;
          predictedRevenue += p.predictedLifetimeValue;
          if (p.conversionProbability > 0.6) {
            highValue++;
            if (topProspects.length < 10) {
              topProspects.push({ userId: id, conversionProbability: p.conversionProbability, predictedLifetimeValue: p.predictedLifetimeValue });
            }
          }
          if (p.churnRisk > 0.5) {
            atRiskCount++;
            if (atRiskTop.length < 10) atRiskTop.push({ userId: id, churnRisk: p.churnRisk });
          }
        });

        result = {
          success: true,
          message: `Analyzed ${analyzed} users`,
          summary: {
            totalAnalyzed: analyzed,
            highValueProspects: highValue,
            atRiskUsers: atRiskCount,
            predictedRevenue: Math.round(predictedRevenue),
          },
          topProspects,
          atRiskUsers: atRiskTop,
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

        // Compute for the ENTIRE base with behavior data (was capped at 100).
        const limit = typeof params?.limit === "number" ? params.limit : undefined;
        const users = await db.user.findMany({
          where: {
            deletedAt: null,
            behaviors: { some: {} },
          },
          ...(limit ? { take: limit } : {}),
          select: { id: true },
        });

        let analyzed = 0;
        const hourDistribution = new Map<number, number>();

        await processInChunks(users.map((u) => u.id), async (id) => {
          const t = await getOptimalSendTime(id);
          // Persist so the automation can deliver each email at the user's hour.
          await db.userMarketingScore.upsert({
            where: { userId: id },
            create: {
              userId: id,
              optimalSendHour: t.optimalHour,
              optimalSendDay: t.optimalDay,
              sendTimezone: t.timezone,
              sendTimeConfidence: t.confidence,
              sendTimeCalculatedAt: new Date(),
            },
            update: {
              optimalSendHour: t.optimalHour,
              optimalSendDay: t.optimalDay,
              sendTimezone: t.timezone,
              sendTimeConfidence: t.confidence,
              sendTimeCalculatedAt: new Date(),
            },
          });
          analyzed++;
          hourDistribution.set(t.optimalHour, (hourDistribution.get(t.optimalHour) || 0) + 1);
        });

        const distribution = Array.from(hourDistribution.entries())
          .map(([hour, count]) => ({ hour, count }))
          .sort((a, b) => a.hour - b.hour);

        result = {
          success: true,
          message: `Calculated optimal send times for ${analyzed} users`,
          summary: {
            totalAnalyzed: analyzed,
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
            OR: [
              { tags: { isEmpty: true } },
              // Re-tag projects stuck with only generic format tags
              // ("comics", "comic-books", …) from the old tagger — they
              // all looked identical and gave search/segmentation nothing.
              { tags: { hasSome: GENERIC_PROJECT_TAGS } },
            ],
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

    // Persist a run-log row so the admin Run History tab survives
    // refreshes and captures cron-triggered runs. Only log actual run
    // actions (loggedServiceId non-null); skip getStatus/polls.
    if (loggedServiceId) {
      const r = result as unknown as { success?: boolean; message?: string } | undefined;
      const summary =
        r?.message ||
        (r?.success === false ? "Run reported failure" : "Completed");
      // Cap the stored payload so a huge result (e.g. hundreds of
      // segment users) doesn't bloat the row.
      let resultJson: unknown = result;
      try {
        const serialized = JSON.stringify(result);
        if (serialized.length > 20000) {
          resultJson = { truncated: true, message: summary, success: r?.success ?? true };
        }
      } catch {
        resultJson = { message: summary };
      }
      await db.aiRunLog.create({
        data: {
          action,
          serviceId: loggedServiceId,
          success: r?.success !== false,
          message: summary,
          resultJson: resultJson as object,
          trigger,
          triggeredById,
          durationMs: Date.now() - runStartedAt,
        },
      }).catch((e: unknown) => adminAiMarketingRunLogger.error({ err: formatError(e) }, "Failed to write AI run log"));
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
