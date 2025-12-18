import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateCampaignContent } from "@/lib/ai";
import {
  getAISettings,
  generateVariantsIfEnabled,
  scheduleWithOptimalTimes,
  generateSegmentsIfEnabled,
} from "@/lib/ai/settings-integration";

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
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// Helper to get recipient count by audience type
async function getRecipientCountByAudience(audience: string): Promise<number> {
  switch (audience) {
    case "subscriber":
      const [nlSubCount, verifiedCount] = await Promise.all([
        db.newsletterSubscriber.count({
          where: {
            isActive: true,
            NOT: { source: { contains: "retailer", mode: "insensitive" } },
          },
        }),
        db.user.count({ where: { emailVerified: { not: null } } }),
      ]);
      return nlSubCount + verifiedCount;
    case "backers":
      const backerIds = await db.pledge.findMany({
        where: { status: "COMPLETED" },
        select: { userId: true },
        distinct: ["userId"],
      });
      return backerIds.length;
    case "creators":
      return db.user.count({ where: { createdProjects: { some: {} } } });
    case "retailer":
      return db.newsletterSubscriber.count({
        where: {
          isActive: true,
          source: { contains: "retailer", mode: "insensitive" },
        },
      });
    case "all":
    default:
      return db.user.count({ where: { emailVerified: { not: null } } });
  }
}

// GET - Fetch all campaigns with live recipient counts
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const campaigns = await db.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Recalculate recipient counts for each campaign based on current data
    const campaignsWithCounts = await Promise.all(
      campaigns.map(async (campaign: { targetAudience: string | null; [key: string]: unknown }) => {
        const recipientCount = await getRecipientCountByAudience(campaign.targetAudience || "all");
        return {
          ...campaign,
          recipientCount,
        };
      })
    );

    return NextResponse.json({ campaigns: campaignsWithCounts });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST - Create a new AI-powered campaign
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const {
      name,
      targetAudience,
      projectCategory,
      subjectTemplate,
      introMessage,
      scheduleFor,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    // Get AI settings to check which features are enabled
    const aiSettings = await getAISettings();

    // Get projects matching the category filter
    const projectWhere: { status: string; category?: string } = {
      status: "LIVE",
    };

    if (projectCategory && projectCategory !== "all") {
      projectWhere.category = projectCategory.toUpperCase();
    }

    const projects = await db.project.findMany({
      where: projectWhere,
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        goalAmount: true,
      },
    });

    if (projects.length === 0) {
      return NextResponse.json(
        { error: "No projects available for this campaign. Please ensure there are live projects in the selected category." },
        { status: 400 }
      );
    }

    // Get target recipients count based on audience
    let recipientCount = 0;

    switch (targetAudience) {
      case "all":
        recipientCount = await db.user.count({
          where: { emailVerified: { not: null } }
        });
        break;
      case "backers":
        const backerIds = await db.pledge.findMany({
          where: { status: "COMPLETED" },
          select: { userId: true },
          distinct: ["userId"],
        });
        recipientCount = backerIds.length;
        break;
      case "high-value":
        const highValueBackers = await db.pledge.groupBy({
          by: ["userId"],
          where: { status: "COMPLETED" },
          _sum: { amount: true },
          having: { amount: { _sum: { gt: 100 } } },
        });
        recipientCount = highValueBackers.length;
        break;
      case "creators":
        recipientCount = await db.user.count({
          where: {
            createdProjects: { some: {} }
          }
        });
        break;
      case "subscriber":
        // Newsletter subscribers (excluding retailers) + verified users
        const [nlSubCount, verifiedCount] = await Promise.all([
          db.newsletterSubscriber.count({
            where: {
              isActive: true,
              NOT: { source: { contains: "retailer", mode: "insensitive" } },
            },
          }),
          db.user.count({ where: { emailVerified: { not: null } } }),
        ]);
        // Estimate combined (some overlap expected)
        recipientCount = nlSubCount + verifiedCount;
        break;
      case "retailer":
        recipientCount = await db.newsletterSubscriber.count({
          where: {
            isActive: true,
            source: { contains: "retailer", mode: "insensitive" },
          },
        });
        break;
      default:
        recipientCount = await db.user.count({
          where: { emailVerified: { not: null } }
        });
    }

    // Generate AI content for the campaign
    let aiContent;
    try {
      aiContent = await generateCampaignContent({
        campaignName: name,
        targetAudience: targetAudience || "all",
        projectCategory: projectCategory || "all",
        subjectTemplate: subjectTemplate || "",
        introMessage: introMessage || "",
        projects: projects.map(p => ({
          title: p.title,
          description: p.description || "",
          category: p.category || undefined,
          goalAmount: p.goalAmount ? Number(p.goalAmount) : undefined,
        })),
      });
    } catch (aiError) {
      console.error("AI content generation error:", aiError);
      // Fallback to template-based content if AI fails
      aiContent = {
        subject: subjectTemplate || `Check out these amazing ${projectCategory !== "all" ? projectCategory : ""} projects`,
        preheader: "Discover projects picked just for you",
        personalizedIntro: introMessage || "We found some projects we think you'll love!",
        projectRecommendations: projects.slice(0, 5).map(p => ({
          projectTitle: p.title,
          recommendationReason: `This ${p.category?.toLowerCase() || "creative"} project might be perfect for you.`,
          callToAction: "Check it out",
        })),
        footer: "Happy exploring!",
      };
    }

    // Generate content variants for A/B testing if Content Optimization is enabled
    let subjectVariants: string[] | null = null;
    if (aiSettings.contentOptimization) {
      const variantsResult = await generateVariantsIfEnabled(
        aiContent.subject,
        "subject",
        { campaignType: targetAudience || "all", targetAudience: targetAudience || "all" }
      );
      if (variantsResult && variantsResult.variants) {
        subjectVariants = variantsResult.variants.map((v) => v.content);
      }
    }

    // Get optimal send times if Send Time Optimization is enabled
    let optimalSchedule: Map<string, { hour: number; day: number }> | null = null;
    if (aiSettings.sendTimeOptimization && !scheduleFor) {
      // Get sample of recipient user IDs for optimization
      const sampleUsers = await db.user.findMany({
        where: { emailVerified: { not: null } },
        take: 100,
        select: { id: true },
      });
      optimalSchedule = await scheduleWithOptimalTimes(sampleUsers.map(u => u.id));
    }

    // Use Smart Segmentation to refine audience if enabled
    let segmentInfo = null;
    if (aiSettings.smartSegmentation && targetAudience === "all") {
      const segments = await generateSegmentsIfEnabled();
      if (segments && segments.length > 0) {
        segmentInfo = segments;
      }
    }

    // Create the campaign in the database
    const campaign = await db.emailCampaign.create({
      data: {
        name,
        subject: aiContent.subject,
        preheader: aiContent.preheader,
        bodyHtml: generateEmailHtml(aiContent, projects),
        bodyText: generateEmailText(aiContent, projects),
        status: scheduleFor ? "SCHEDULED" : "DRAFT",
        recipientCount,
        targetAudience: targetAudience || "all",
        projectCategory: projectCategory || "all",
        scheduledAt: scheduleFor ? new Date(scheduleFor) : null,
        aiGenerated: true,
        aiContent: {
          ...aiContent as object,
          subjectVariants: subjectVariants || undefined,
          hasOptimalSchedule: !!optimalSchedule,
          segmentInfo: segmentInfo || undefined,
        },
      },
    });

    // Build feature usage message
    const featuresUsed: string[] = [];
    if (subjectVariants) featuresUsed.push(`${subjectVariants.length} subject variants generated`);
    if (optimalSchedule) featuresUsed.push("optimal send times calculated");
    if (segmentInfo) featuresUsed.push(`${segmentInfo.length} smart segments identified`);

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        recipientCount: campaign.recipientCount,
        aiContent,
        subjectVariants,
        hasOptimalSchedule: !!optimalSchedule,
      },
      featuresEnabled: {
        emailPersonalization: aiSettings.emailPersonalization,
        contentOptimization: aiSettings.contentOptimization,
        sendTimeOptimization: aiSettings.sendTimeOptimization,
        smartSegmentation: aiSettings.smartSegmentation,
        abTesting: aiSettings.abTesting,
        predictiveAnalytics: aiSettings.predictiveAnalytics,
      },
      message: scheduleFor
        ? `Campaign scheduled for ${new Date(scheduleFor).toLocaleString()}`
        : `Campaign created as draft.${featuresUsed.length > 0 ? ` AI features: ${featuresUsed.join(", ")}.` : ""} Review and send when ready.`,
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}

// Helper to generate HTML email content
function generateEmailHtml(
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
  projects: Array<{ id: string; title: string; description: string | null; category: string | null; goalAmount: unknown }>
): string {
  const projectCards = aiContent.projectRecommendations.map((rec, i) => {
    const project = projects.find(p => p.title === rec.projectTitle) || projects[i];
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
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${aiContent.subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Preheader -->
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${aiContent.preheader}
      </div>

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #10b981; margin: 0;">IndieCrowdfund</h1>
      </div>

      <!-- Intro -->
      <div style="margin-bottom: 32px;">
        <p style="font-size: 16px; color: #374151;">Hi {{USER_NAME}},</p>
        <p style="font-size: 16px; color: #374151;">${aiContent.personalizedIntro}</p>
      </div>

      <!-- Projects -->
      <div style="margin-bottom: 32px;">
        <h2 style="color: #111827; font-size: 20px; margin-bottom: 16px;">Projects We Think You'll Love</h2>
        ${projectCards}
      </div>

      <!-- Footer -->
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

// Helper to generate plain text email content
function generateEmailText(
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
  projects: Array<{ id: string; title: string; description: string | null; category: string | null; goalAmount: unknown }>
): string {
  const projectList = aiContent.projectRecommendations.map((rec, i) => {
    const project = projects.find(p => p.title === rec.projectTitle) || projects[i];
    if (!project) return "";

    return `
${project.title}
${rec.recommendationReason}
View project: {{SITE_URL}}/projects/${project.id}
`;
  }).join("\n---\n");

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
