import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminAiMarketingServicesLogger = logger.child({ module: "admin-ai-marketing-services" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  personalizeEmailForUser,
  predictUserBehavior,
  batchPredictUsers,
  generateSmartSegments,
  getOptimalSendTime,
  batchOptimalSendTimes,
  generateContentVariants,
  createABTest,
  analyzeABTestResults,
} from "@/lib/ai/marketing-services";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
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
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// POST - Execute an AI service
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const { service, params } = body;

    if (!service) {
      return NextResponse.json(
        { error: "Service name is required" },
        { status: 400 }
      );
    }

    let result;

    switch (service) {
      // ==========================================
      // EMAIL PERSONALIZATION
      // ==========================================
      case "personalizeEmail": {
        const { userId, campaignType, projectIds } = params;

        if (!userId) {
          return NextResponse.json(
            { error: "userId is required" },
            { status: 400 }
          );
        }

        // Get projects
        const projects = await db.project.findMany({
          where: projectIds?.length
            ? { id: { in: projectIds } }
            : { status: "ACTIVE" },
          take: 10,
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
          },
        });

        result = await personalizeEmailForUser(
          userId,
          campaignType || "weekly-digest",
          projects.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description || "",
            category: p.category || "General",
          }))
        );
        break;
      }

      case "personalizeEmailBatch": {
        const { userIds, campaignType, projectIds } = params;

        if (!userIds?.length) {
          return NextResponse.json(
            { error: "userIds array is required" },
            { status: 400 }
          );
        }

        const projects = await db.project.findMany({
          where: projectIds?.length
            ? { id: { in: projectIds } }
            : { status: "ACTIVE" },
          take: 10,
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
          },
        });

        const projectsFormatted = projects.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description || "",
          category: p.category || "General",
        }));

        result = await Promise.all(
          userIds.slice(0, 50).map((userId: string) =>
            personalizeEmailForUser(userId, campaignType || "weekly-digest", projectsFormatted)
              .then((content) => ({ userId, content, success: true }))
              .catch((error) => ({
                userId,
                success: false,
                error: error.message,
              }))
          )
        );
        break;
      }

      // ==========================================
      // PREDICTIVE ANALYTICS
      // ==========================================
      case "predictUser": {
        const { userId } = params;

        if (!userId) {
          return NextResponse.json(
            { error: "userId is required" },
            { status: 400 }
          );
        }

        result = await predictUserBehavior(userId);
        break;
      }

      case "predictUsersBatch": {
        const { userIds } = params;

        if (!userIds?.length) {
          return NextResponse.json(
            { error: "userIds array is required" },
            { status: 400 }
          );
        }

        result = await batchPredictUsers(userIds.slice(0, 100));
        break;
      }

      case "getHighValueProspects": {
        const { limit = 50 } = params;

        // Get users with recent activity
        const activeUsers = await db.user.findMany({
          where: {
            behaviors: {
              some: {
                timestamp: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
          },
          take: limit,
          select: { id: true },
        });

        const predictions = await batchPredictUsers(
          activeUsers.map((u) => u.id)
        );

        // Sort by conversion probability
        result = predictions
          .sort((a, b) => b.conversionProbability - a.conversionProbability)
          .slice(0, limit);
        break;
      }

      case "getAtRiskUsers": {
        const { limit = 50 } = params;

        // Get users who have backed before but haven't been active
        const users = await db.user.findMany({
          where: {
            pledges: { some: {} },
          },
          take: 200,
          select: { id: true },
        });

        const predictions = await batchPredictUsers(users.map((u) => u.id));

        // Sort by churn risk
        result = predictions
          .filter((p) => p.churnRisk > 0.3)
          .sort((a, b) => b.churnRisk - a.churnRisk)
          .slice(0, limit);
        break;
      }

      // ==========================================
      // SMART SEGMENTATION
      // ==========================================
      case "generateSegments": {
        result = await generateSmartSegments();
        break;
      }

      case "getSegmentUsers": {
        const { segmentId, limit = 100 } = params;

        if (!segmentId) {
          return NextResponse.json(
            { error: "segmentId is required" },
            { status: 400 }
          );
        }

        // Fetch users based on segment criteria
        let users;
        switch (segmentId) {
          case "high-value-backers":
            users = await db.user.findMany({
              where: {
                pledges: { some: {} },
              },
              include: {
                pledges: true,
              },
              take: 500,
            });
            users = users.filter((u) => {
              const total = u.pledges.reduce(
                (sum: number, p: { amount: number | string }) => sum + Number(p.amount),
                0
              );
              return total > 500 || u.pledges.length >= 5;
            });
            break;

          case "at-risk-churners":
            users = await db.user.findMany({
              where: {
                pledges: { some: {} },
                behaviors: {
                  none: {
                    timestamp: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                  },
                },
              },
              take: limit,
            });
            break;

          case "new-users":
            users = await db.user.findMany({
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                },
              },
              take: limit,
            });
            break;

          default:
            users = [];
        }

        result = {
          segmentId,
          userCount: users.length,
          users: users.slice(0, limit).map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
          })),
        };
        break;
      }

      // ==========================================
      // SEND TIME OPTIMIZATION
      // ==========================================
      case "getOptimalSendTime": {
        const { userId } = params;

        if (!userId) {
          return NextResponse.json(
            { error: "userId is required" },
            { status: 400 }
          );
        }

        result = await getOptimalSendTime(userId);
        break;
      }

      case "getOptimalSendTimesBatch": {
        const { userIds } = params;

        if (!userIds?.length) {
          return NextResponse.json(
            { error: "userIds array is required" },
            { status: 400 }
          );
        }

        const timesMap = await batchOptimalSendTimes(userIds.slice(0, 100));
        result = Array.from(timesMap.values());
        break;
      }

      case "getCampaignSchedule": {
        const { campaignId, userIds } = params;

        if (!userIds?.length) {
          return NextResponse.json(
            { error: "userIds array is required" },
            { status: 400 }
          );
        }

        const timesMap = await batchOptimalSendTimes(userIds);

        // Group by hour for scheduling
        const schedule = new Map<number, string[]>();
        Array.from(timesMap.entries()).forEach(([uid, time]) => {
          const hour = time.optimalHour;
          if (!schedule.has(hour)) {
            schedule.set(hour, []);
          }
          schedule.get(hour)!.push(uid);
        });

        result = {
          campaignId,
          totalRecipients: userIds.length,
          schedule: Array.from(schedule.entries())
            .map(([hour, users]) => ({
              hour,
              userCount: users.length,
              userIds: users,
            }))
            .sort((a, b) => a.hour - b.hour),
        };
        break;
      }

      // ==========================================
      // CONTENT OPTIMIZATION
      // ==========================================
      case "generateVariants": {
        const { content, contentType, context } = params;

        if (!content || !contentType) {
          return NextResponse.json(
            { error: "content and contentType are required" },
            { status: 400 }
          );
        }

        result = await generateContentVariants(
          content,
          contentType,
          context || { campaignType: "general", targetAudience: "all" }
        );
        break;
      }

      case "optimizeSubjectLine": {
        const { subject, campaignType, targetAudience } = params;

        if (!subject) {
          return NextResponse.json(
            { error: "subject is required" },
            { status: 400 }
          );
        }

        result = await generateContentVariants(subject, "subject", {
          campaignType: campaignType || "promotional",
          targetAudience: targetAudience || "all subscribers",
        });
        break;
      }

      // ==========================================
      // A/B TESTING
      // ==========================================
      case "createABTest": {
        const { campaignId, testName, variants } = params;

        if (!campaignId || !testName || !variants?.length) {
          return NextResponse.json(
            { error: "campaignId, testName, and variants are required" },
            { status: 400 }
          );
        }

        result = await createABTest(campaignId, testName, variants);
        break;
      }

      case "analyzeABTest": {
        const { test } = params;

        if (!test) {
          return NextResponse.json(
            { error: "test object is required" },
            { status: 400 }
          );
        }

        result = await analyzeABTestResults(test);
        break;
      }

      case "getABTestRecommendation": {
        const { testId } = params;

        // Fetch test from DB and analyze
        // Placeholder - would need ABTest model
        result = {
          testId,
          recommendation: "Continue testing for statistical significance",
          currentLeader: "variant-a",
          confidence: 0.78,
          samplesNeeded: 250,
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown service: ${service}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      service,
      result,
    });
  } catch (error) {
    adminAiMarketingServicesLogger.error({ err: String(error) }, "AI service error:");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute AI service",
      },
      { status: 500 }
    );
  }
}

// GET - Get service status and capabilities
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Check if Anthropic is configured (from database or env)
    const settings = await db.platformSettings.findFirst({
      select: { anthropicApiKey: true },
    });
    const aiConfigured = !!(settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY);

    return NextResponse.json({
      status: aiConfigured ? "operational" : "not_configured",
      services: {
        emailPersonalization: {
          name: "Email Personalization",
          description: "Personalize email content per user based on behavior and preferences",
          endpoints: ["personalizeEmail", "personalizeEmailBatch"],
          status: aiConfigured ? "available" : "unavailable",
        },
        predictiveAnalytics: {
          name: "Predictive Analytics",
          description: "Predict user behavior, conversion likelihood, and churn risk",
          endpoints: ["predictUser", "predictUsersBatch", "getHighValueProspects", "getAtRiskUsers"],
          status: "available",
        },
        smartSegmentation: {
          name: "Smart Segmentation",
          description: "Automatically create user segments based on behavior patterns",
          endpoints: ["generateSegments", "getSegmentUsers"],
          status: "available",
        },
        sendTimeOptimization: {
          name: "Send Time Optimization",
          description: "Calculate optimal send times based on user activity patterns",
          endpoints: ["getOptimalSendTime", "getOptimalSendTimesBatch", "getCampaignSchedule"],
          status: "available",
        },
        contentOptimization: {
          name: "Content Optimization",
          description: "Generate A/B test variants for email content",
          endpoints: ["generateVariants", "optimizeSubjectLine"],
          status: aiConfigured ? "available" : "unavailable",
        },
        abTesting: {
          name: "A/B Testing",
          description: "Create and analyze A/B tests for campaigns",
          endpoints: ["createABTest", "analyzeABTest", "getABTestRecommendation"],
          status: "available",
        },
      },
    });
  } catch (error) {
    adminAiMarketingServicesLogger.error({ err: String(error) }, "Error checking AI services:");
    return NextResponse.json(
      { error: "Failed to check AI services" },
      { status: 500 }
    );
  }
}
