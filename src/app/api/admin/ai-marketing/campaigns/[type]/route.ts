import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateCampaignContent } from "@/lib/ai";
import {
  getAISettings,
  generateVariantsIfEnabled,
  scheduleWithOptimalTimes,
  canSendEmail,
} from "@/lib/ai/settings-integration";
import {
  findMatchingUsersForProject,
  calculateProjectMatchScore,
} from "@/lib/ai/user-interests";

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

// GET - Get campaign type configuration and potential recipients
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { type } = await params;

    let recipients: { id: string; email: string; name: string | null }[] = [];
    let recipientCount = 0;
    let description = "";

    switch (type) {
      case "subscriber":
        // Newsletter subscribers - users with email verified
        recipients = await db.user.findMany({
          where: {
            emailVerified: { not: null },
          },
          select: { id: true, email: true, name: true },
          take: 100,
        });
        recipientCount = await db.user.count({
          where: { emailVerified: { not: null } },
        });
        description = "Target newsletter subscribers with verified email addresses";
        break;

      case "backer":
        // Previous backers - users who have made pledges
        const backerIds = await db.pledge.findMany({
          where: { status: "COMPLETED" },
          select: { userId: true },
          distinct: ["userId"],
        });
        const backerUserIds = backerIds.map((b) => b.userId);
        recipients = await db.user.findMany({
          where: { id: { in: backerUserIds } },
          select: { id: true, email: true, name: true },
          take: 100,
        });
        recipientCount = backerUserIds.length;
        description = "Engage previous backers who have supported projects";
        break;

      case "creator":
        // Project creators
        recipients = await db.user.findMany({
          where: {
            projects: { some: {} },
          },
          select: { id: true, email: true, name: true },
          take: 100,
        });
        recipientCount = await db.user.count({
          where: { projects: { some: {} } },
        });
        description = "Notify project creators about platform updates and tips";
        break;

      default:
        return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
    }

    // Get AI settings
    const aiSettings = await getAISettings();

    // Get recommended projects for this audience
    const projects = await db.project.findMany({
      where: { status: "LIVE" },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        goalAmount: true,
        currentAmount: true,
        imageUrl: true,
        tags: true,
      },
    });

    // Get user interest profile stats for this audience
    const recipientIds = recipients.map((r) => r.id);
    const interestProfiles = await db.userInterestProfile.findMany({
      where: { userId: { in: recipientIds } },
      select: {
        profileScore: true,
        totalProjectsBacked: true,
        categoryInterests: true,
      },
    });

    // Calculate audience insights
    const profiledUsers = interestProfiles.length;
    const avgProfileScore =
      interestProfiles.length > 0
        ? interestProfiles.reduce((sum: number, p: { profileScore: number }) => sum + p.profileScore, 0) / interestProfiles.length
        : 0;

    // Aggregate category interests
    const categoryAggregates: Record<string, number> = {};
    for (const profile of interestProfiles) {
      const interests = profile.categoryInterests as Record<string, number>;
      for (const [category, score] of Object.entries(interests)) {
        if (score >= 0.5) {
          categoryAggregates[category] = (categoryAggregates[category] || 0) + 1;
        }
      }
    }

    const topCategories = Object.entries(categoryAggregates)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return NextResponse.json({
      type,
      description,
      recipientCount,
      sampleRecipients: recipients.slice(0, 10),
      projects,
      aiSettings: {
        emailPersonalization: aiSettings.emailPersonalization,
        sendTimeOptimization: aiSettings.sendTimeOptimization,
        contentOptimization: aiSettings.contentOptimization,
      },
      audienceInsights: {
        profiledUsers,
        avgProfileScore: avgProfileScore.toFixed(1),
        topCategories,
        usersWithProfiles: profiledUsers,
        usersWithoutProfiles: recipientCount - profiledUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching campaign type:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign configuration" },
      { status: 500 }
    );
  }
}

// POST - Create and send a campaign for this type
export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { type } = await params;
    const body = await request.json();
    const { name, subjectTemplate, introMessage, projectIds, scheduleFor } = body;

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    // Get recipients based on campaign type
    let recipientUserIds: string[] = [];

    switch (type) {
      case "subscriber":
        const subscribers = await db.user.findMany({
          where: { emailVerified: { not: null } },
          select: { id: true },
        });
        recipientUserIds = subscribers.map((s) => s.id);
        break;

      case "backer":
        const backers = await db.pledge.findMany({
          where: { status: "COMPLETED" },
          select: { userId: true },
          distinct: ["userId"],
        });
        recipientUserIds = backers.map((b) => b.userId);
        break;

      case "creator":
        const creators = await db.user.findMany({
          where: { projects: { some: {} } },
          select: { id: true },
        });
        recipientUserIds = creators.map((c) => c.id);
        break;

      default:
        return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
    }

    if (recipientUserIds.length === 0) {
      return NextResponse.json({ error: "No recipients found for this campaign type" }, { status: 400 });
    }

    // Get AI settings
    const aiSettings = await getAISettings();

    // Get selected projects or default to recent live projects
    const projectWhere = projectIds?.length > 0
      ? { id: { in: projectIds } }
      : { status: "LIVE" as const };

    const projects = await db.project.findMany({
      where: projectWhere,
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        subcategory: true,
        tags: true,
        goalAmount: true,
      },
    });

    if (projects.length === 0) {
      return NextResponse.json({ error: "No projects available for campaign" }, { status: 400 });
    }

    // Use interest matching to prioritize recipients
    let matchedRecipients: Array<{ userId: string; matchScore: number }> = [];
    let unmatchedRecipients: string[] = [];

    if (aiSettings.emailPersonalization) {
      // Get user interest profiles for recipients
      const profiles = await db.userInterestProfile.findMany({
        where: { userId: { in: recipientUserIds } },
        select: {
          userId: true,
          categoryInterests: true,
          tagInterests: true,
          profileScore: true,
        },
      });

      type ProfileEntry = { userId: string; categoryInterests: unknown; tagInterests: unknown; profileScore: number };
      const profileMap = new Map<string, ProfileEntry>(
        profiles.map((p: ProfileEntry) => [p.userId, p])
      );

      // Calculate match scores for each recipient against the projects
      for (const userId of recipientUserIds) {
        const profile = profileMap.get(userId);
        if (profile && profile.profileScore >= 20) {
          // Calculate average match score across all projects
          let totalScore = 0;
          for (const project of projects) {
            const score = calculateProjectMatchScore(
              {
                categoryInterests: profile.categoryInterests as Record<string, number>,
                tagInterests: profile.tagInterests as Record<string, number>,
              },
              {
                category: project.category,
                subcategory: project.subcategory,
                tags: project.tags as string[],
              }
            );
            totalScore += score;
          }
          const avgScore = totalScore / projects.length;
          matchedRecipients.push({ userId, matchScore: avgScore });
        } else {
          unmatchedRecipients.push(userId);
        }
      }

      // Sort matched recipients by score (highest first)
      matchedRecipients.sort((a, b) => b.matchScore - a.matchScore);
    } else {
      // No personalization - all recipients are unmatched
      unmatchedRecipients = recipientUserIds;
    }

    // Generate AI content
    let aiContent;
    try {
      aiContent = await generateCampaignContent({
        campaignName: name,
        targetAudience: type,
        projectCategory: "all",
        subjectTemplate: subjectTemplate || "",
        introMessage: introMessage || "",
        projects: projects.map((p) => ({
          title: p.title,
          description: p.description || "",
          category: p.category || undefined,
          goalAmount: p.goalAmount ? Number(p.goalAmount) : undefined,
        })),
      });
    } catch {
      // Fallback content
      aiContent = {
        subject: subjectTemplate || `New projects you might love`,
        preheader: "Discover projects picked just for you",
        personalizedIntro: introMessage || "We found some projects we think you'll love!",
        projectRecommendations: projects.slice(0, 5).map((p) => ({
          projectTitle: p.title,
          recommendationReason: `This ${p.category?.toLowerCase() || "creative"} project might be perfect for you.`,
          callToAction: "Check it out",
        })),
        footer: "Happy exploring!",
      };
    }

    // Generate content variants if enabled
    let subjectVariants: string[] | null = null;
    if (aiSettings.contentOptimization) {
      const variantsResult = await generateVariantsIfEnabled(aiContent.subject, "subject", {
        campaignType: type,
        targetAudience: type,
      });
      if (variantsResult && variantsResult.variants) {
        subjectVariants = variantsResult.variants.map((v) => v.content);
      }
    }

    // Get optimal send times if enabled
    let optimalSchedule: Map<string, { hour: number; day: number }> | null = null;
    if (aiSettings.sendTimeOptimization && !scheduleFor) {
      // Prioritize matched recipients for send time optimization
      const sampleIds = matchedRecipients.length > 0
        ? matchedRecipients.slice(0, 100).map(r => r.userId)
        : recipientUserIds.slice(0, 100);
      optimalSchedule = await scheduleWithOptimalTimes(sampleIds);
    }

    // Build ordered recipient list (matched first, then unmatched)
    const orderedRecipientIds = [
      ...matchedRecipients.map(r => r.userId),
      ...unmatchedRecipients,
    ];

    // Filter recipients based on email limits
    const eligibleRecipients: Array<{ userId: string; matchScore?: number }> = [];
    let skippedDueToLimits = 0;

    for (const userId of orderedRecipientIds) {
      const canSend = await canSendEmail(userId);
      if (canSend.canSend) {
        const matched = matchedRecipients.find(r => r.userId === userId);
        eligibleRecipients.push({
          userId,
          matchScore: matched?.matchScore,
        });
      } else {
        skippedDueToLimits++;
      }
    }

    // Calculate match statistics
    const matchedEligible = eligibleRecipients.filter(r => r.matchScore !== undefined);
    const highMatchCount = matchedEligible.filter(r => (r.matchScore || 0) >= 50).length;
    const avgMatchScore = matchedEligible.length > 0
      ? matchedEligible.reduce((sum, r) => sum + (r.matchScore || 0), 0) / matchedEligible.length
      : 0;

    // Create the campaign
    const campaign = await db.emailCampaign.create({
      data: {
        name,
        subject: aiContent.subject,
        preheader: aiContent.preheader,
        bodyHtml: generateCampaignHtml(aiContent, projects),
        bodyText: generateCampaignText(aiContent, projects),
        status: scheduleFor ? "SCHEDULED" : "DRAFT",
        recipientCount: eligibleRecipients.length,
        targetAudience: type,
        projectCategory: "all",
        scheduledAt: scheduleFor ? new Date(scheduleFor) : null,
        aiGenerated: true,
        aiContent: {
          ...aiContent as object,
          subjectVariants: subjectVariants || undefined,
          hasOptimalSchedule: !!optimalSchedule,
          campaignType: type,
          interestMatching: {
            enabled: aiSettings.emailPersonalization,
            matchedRecipients: matchedEligible.length,
            highMatchRecipients: highMatchCount,
            avgMatchScore: Math.round(avgMatchScore),
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        recipientCount: campaign.recipientCount,
        eligibleRecipients: eligibleRecipients.length,
        totalRecipients: recipientUserIds.length,
        skippedDueToLimits,
      },
      interestMatching: {
        enabled: aiSettings.emailPersonalization,
        matchedRecipients: matchedEligible.length,
        unmatchedRecipients: eligibleRecipients.length - matchedEligible.length,
        highMatchRecipients: highMatchCount,
        avgMatchScore: Math.round(avgMatchScore),
      },
      aiContent,
      subjectVariants,
      hasOptimalSchedule: !!optimalSchedule,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}

// Helper to generate HTML content
function generateCampaignHtml(
  aiContent: {
    subject: string;
    preheader: string;
    personalizedIntro: string;
    projectRecommendations: Array<{
      projectTitle: string;
      recommendationReason: string;
      callToAction: string;
    }>;
    footer: string;
  },
  projects: Array<{ id: string; title: string }>
): string {
  const projectCards = aiContent.projectRecommendations
    .map((rec) => {
      const project = projects.find((p) => p.title === rec.projectTitle);
      if (!project) return "";

      return `
      <div style="margin-bottom: 24px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
        <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 18px;">${project.title}</h3>
        <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">${rec.recommendationReason}</p>
        <a href="{{SITE_URL}}/projects/${project.id}"
           style="display: inline-block; padding: 10px 20px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
          ${rec.callToAction}
        </a>
      </div>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${aiContent.subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="display: none; max-height: 0; overflow: hidden;">${aiContent.preheader}</div>
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #10b981; margin: 0;">IndieCrowdfund</h1>
      </div>
      <div style="margin-bottom: 32px;">
        <p style="font-size: 16px; color: #374151;">Hi {{USER_NAME}},</p>
        <p style="font-size: 16px; color: #374151;">${aiContent.personalizedIntro}</p>
      </div>
      <div style="margin-bottom: 32px;">
        <h2 style="color: #111827; font-size: 20px; margin-bottom: 16px;">Projects We Think You'll Love</h2>
        ${projectCards}
      </div>
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #6b7280; font-size: 14px;">${aiContent.footer}</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
          <a href="{{UNSUBSCRIBE_URL}}" style="color: #9ca3af;">Unsubscribe</a> |
          <a href="{{SITE_URL}}" style="color: #9ca3af;">Visit IndieCrowdfund</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

// Helper to generate plain text content
function generateCampaignText(
  aiContent: {
    subject: string;
    preheader: string;
    personalizedIntro: string;
    projectRecommendations: Array<{
      projectTitle: string;
      recommendationReason: string;
      callToAction: string;
    }>;
    footer: string;
  },
  projects: Array<{ id: string; title: string }>
): string {
  const projectList = aiContent.projectRecommendations
    .map((rec) => {
      const project = projects.find((p) => p.title === rec.projectTitle);
      if (!project) return "";

      return `
${project.title}
${rec.recommendationReason}
View project: {{SITE_URL}}/projects/${project.id}
`;
    })
    .join("\n---\n");

  return `
Hi {{USER_NAME}},

${aiContent.personalizedIntro}

PROJECTS WE THINK YOU'LL LOVE
=============================
${projectList}

---

${aiContent.footer}

Unsubscribe: {{UNSUBSCRIBE_URL}}
Visit IndieCrowdfund: {{SITE_URL}}
  `.trim();
}
