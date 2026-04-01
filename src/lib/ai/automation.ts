/**
 * AI Marketing Automation Orchestrator
 *
 * Runs on a cron schedule (daily) to automatically:
 * 1. Refresh user interest profiles
 * 2. Generate smart segments
 * 3. Create and send targeted campaigns based on platform activity
 * 4. Use past campaign performance to improve future ones
 *
 * This makes the AI marketing system self-sufficient — no manual intervention needed.
 */

import { db } from "@/lib/db";
import { generateCampaignContent } from "@/lib/ai/anthropic";
import { generateSmartSegments } from "@/lib/ai/marketing-services";
import { getAISettings, canSendEmail } from "@/lib/ai/settings-integration";
import { batchUpdateUserInterests } from "@/lib/ai/user-interests";
import { queueEmail, EMAIL_PRIORITY } from "@/lib/email";
import { logger } from "@/lib/logger";

const automationLogger = logger.child({ module: "ai-marketing-automation" });

interface AutomationResult {
  success: boolean;
  steps: AutomationStepResult[];
  campaignsCreated: number;
  emailsQueued: number;
  errors: string[];
  duration: number;
}

interface AutomationStepResult {
  step: string;
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Main orchestrator — called by cron daily
 *
 * Decides what to do based on:
 * - What campaigns have been sent recently
 * - What live projects exist
 * - What user segments look like
 * - Past campaign performance
 */
export async function runAutomatedMarketing(): Promise<AutomationResult> {
  const startTime = Date.now();
  const steps: AutomationStepResult[] = [];
  const errors: string[] = [];
  let campaignsCreated = 0;
  let totalEmailsQueued = 0;

  try {
    const settings = await getAISettings();

    // =============================================
    // STEP 1: Refresh user interest profiles
    // =============================================
    try {
      const profileResult = await refreshUserProfiles();
      steps.push(profileResult);
    } catch (err) {
      const msg = `Profile refresh failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      steps.push({ step: "Refresh user profiles", success: false, message: msg });
    }

    // =============================================
    // STEP 2: Check if we should send campaigns today
    // =============================================
    const shouldSend = await shouldSendCampaignToday();
    if (!shouldSend.send) {
      steps.push({
        step: "Campaign eligibility check",
        success: true,
        message: `Skipping campaigns: ${shouldSend.reason}`,
      });

      return {
        success: true,
        steps,
        campaignsCreated: 0,
        emailsQueued: 0,
        errors,
        duration: Date.now() - startTime,
      };
    }

    steps.push({
      step: "Campaign eligibility check",
      success: true,
      message: "Platform is eligible for automated campaigns today",
    });

    // =============================================
    // STEP 3: Generate smart segments if enabled
    // =============================================
    let segments: Awaited<ReturnType<typeof generateSmartSegments>> = [];
    if (settings.smartSegmentation) {
      try {
        segments = await generateSmartSegments();
        steps.push({
          step: "Smart segmentation",
          success: true,
          message: `Generated ${segments.length} segments`,
          details: { segments: segments.map(s => ({ name: s.name, userCount: s.userCount })) },
        });
      } catch (err) {
        const msg = `Segmentation failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        steps.push({ step: "Smart segmentation", success: false, message: msg });
      }
    }

    // =============================================
    // STEP 4: Determine which campaigns to create
    // =============================================
    const campaignPlans = await planCampaigns(segments);

    if (campaignPlans.length === 0) {
      steps.push({
        step: "Campaign planning",
        success: true,
        message: "No campaigns needed right now",
      });
    } else {
      steps.push({
        step: "Campaign planning",
        success: true,
        message: `Planned ${campaignPlans.length} campaign(s)`,
        details: { plans: campaignPlans.map(p => ({ type: p.type, audience: p.audience })) },
      });
    }

    // =============================================
    // STEP 5: Create and send each campaign
    // =============================================
    for (const plan of campaignPlans) {
      try {
        const result = await createAndSendCampaign(plan);
        steps.push(result.step);
        if (result.created) campaignsCreated++;
        totalEmailsQueued += result.emailsQueued;
      } catch (err) {
        const msg = `Campaign "${plan.type}" failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        steps.push({ step: `Send ${plan.type} campaign`, success: false, message: msg });
      }
    }

    return {
      success: errors.length === 0,
      steps,
      campaignsCreated,
      emailsQueued: totalEmailsQueued,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    automationLogger.error({ err }, "Automation orchestrator failed");
    return {
      success: false,
      steps,
      campaignsCreated,
      emailsQueued: totalEmailsQueued,
      errors: [...errors, err instanceof Error ? err.message : String(err)],
      duration: Date.now() - startTime,
    };
  }
}

// ============================================
// STEP 1: Refresh user interest profiles
// ============================================

async function refreshUserProfiles(): Promise<AutomationStepResult> {
  // Find users needing profile updates (no profile or stale > 7 days)
  const usersNeedingProfiles = await db.user.findMany({
    where: {
      OR: [
        { behaviors: { some: {} } },
        { pledges: { some: { status: "COMPLETED" } } },
      ],
      interestProfile: null,
    },
    take: 100,
    select: { id: true },
  });

  const usersWithStaleProfiles = await db.userInterestProfile.findMany({
    where: {
      lastCalculatedAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    take: Math.max(0, 100 - usersNeedingProfiles.length),
    select: { userId: true },
  });

  const userIds = [
    ...usersNeedingProfiles.map((u: { id: string }) => u.id),
    ...usersWithStaleProfiles.map((u: { userId: string }) => u.userId),
  ];

  if (userIds.length === 0) {
    return {
      step: "Refresh user profiles",
      success: true,
      message: "All profiles up to date",
    };
  }

  const result = await batchUpdateUserInterests(userIds);

  return {
    step: "Refresh user profiles",
    success: true,
    message: `Updated ${result.processed} profiles (${result.failed} failed)`,
    details: { processed: result.processed, failed: result.failed },
  };
}

// ============================================
// STEP 2: Should we send campaigns today?
// ============================================

async function shouldSendCampaignToday(): Promise<{ send: boolean; reason: string }> {
  // Check if daily email limit is already hit
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const settings = await getAISettings();

  const todayEmailCount = await db.emailLog.count({
    where: { sentAt: { gte: today } },
  });

  if (todayEmailCount >= settings.dailyEmailLimit) {
    return { send: false, reason: "Daily email limit already reached" };
  }

  // Check when last automated campaign was sent (minimum 3 days apart)
  const lastAutoCampaign = await db.emailCampaign.findFirst({
    where: {
      status: "SENT",
      filters: { path: ["automated"], equals: true },
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  if (lastAutoCampaign?.sentAt) {
    const daysSince = (Date.now() - lastAutoCampaign.sentAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSince < 3) {
      return {
        send: false,
        reason: `Last automated campaign was ${daysSince.toFixed(1)} days ago (minimum 3 days)`,
      };
    }
  }

  // Check if there are live projects to promote
  const liveProjectCount = await db.project.count({
    where: { status: "LIVE", deletedAt: null },
  });

  if (liveProjectCount === 0) {
    return { send: false, reason: "No live projects to promote" };
  }

  // Check if there are recipients
  const subscriberCount = await db.newsletterSubscriber.count({
    where: { isActive: true },
  });
  const verifiedUserCount = await db.user.count({
    where: { emailVerified: { not: null }, deletedAt: null },
  });

  if (subscriberCount + verifiedUserCount === 0) {
    return { send: false, reason: "No subscribers or verified users" };
  }

  return { send: true, reason: "Eligible" };
}

// ============================================
// STEP 4: Plan which campaigns to create
// ============================================

interface CampaignPlan {
  type: "weekly_discovery" | "new_projects" | "ending_soon" | "win_back" | "abandoned_cart";
  audience: string;
  name: string;
  projects: Array<{
    id: string;
    title: string;
    slug: string;
    description: string;
    category: string;
    goalAmount: number;
    vanityUrl: string | null;
  }>;
  // Only populated for abandoned_cart campaigns
  abandonedPledgeUserIds?: string[];
}

async function planCampaigns(
  segments: Awaited<ReturnType<typeof generateSmartSegments>>
): Promise<CampaignPlan[]> {
  const plans: CampaignPlan[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, etc.

  // Get recent campaign types so we don't repeat
  const recentCampaigns = await db.emailCampaign.findMany({
    where: {
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      status: "SENT",
      filters: { path: ["automated"], equals: true },
    },
    select: { filters: true, sentAt: true },
  });

  const recentTypes = new Set(
    recentCampaigns.map((c: { filters: unknown }) => {
      const filters = c.filters as { campaignType?: string } | null;
      return filters?.campaignType;
    }).filter(Boolean)
  );

  // Get live projects for recommendations
  const liveProjects = await db.project.findMany({
    where: { status: "LIVE", deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      goalAmount: true,
      createdAt: true,
      endDate: true,
      creator: { select: { vanityUrl: true } },
    },
  });

  if (liveProjects.length === 0) return plans;

  const formatProject = (p: typeof liveProjects[0]) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description || "",
    category: p.category || "General",
    goalAmount: Number(p.goalAmount),
    vanityUrl: p.creator?.vanityUrl || null,
  });

  // WEEKLY DISCOVERY — send on Tuesday or Wednesday if not sent recently
  if ((dayOfWeek === 2 || dayOfWeek === 3) && !recentTypes.has("weekly_discovery")) {
    plans.push({
      type: "weekly_discovery",
      audience: "subscriber",
      name: `Weekly Discovery — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: liveProjects.slice(0, 5).map(formatProject),
    });
  }

  // NEW PROJECTS — if there are projects created in last 7 days and we haven't sent this recently
  const newProjects = liveProjects.filter(
    p => p.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );
  if (newProjects.length >= 2 && !recentTypes.has("new_projects")) {
    plans.push({
      type: "new_projects",
      audience: "subscriber",
      name: `New on IndieCrowdfund — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: newProjects.slice(0, 5).map(formatProject),
    });
  }

  // ENDING SOON — projects ending within 7 days (send on any day)
  const endingSoon = liveProjects.filter(
    p => p.endDate && p.endDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && p.endDate > now
  );
  if (endingSoon.length >= 1 && !recentTypes.has("ending_soon")) {
    plans.push({
      type: "ending_soon",
      audience: "subscriber",
      name: `Last Chance — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: endingSoon.slice(0, 5).map(formatProject),
    });
  }

  // WIN BACK — for at-risk churners (Saturday only, if segment exists)
  const atRiskSegment = segments.find(s => s.id === "at-risk-churners");
  if (dayOfWeek === 6 && atRiskSegment && atRiskSegment.userCount > 0 && !recentTypes.has("win_back")) {
    plans.push({
      type: "win_back",
      audience: "subscriber",
      name: `We Miss You — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: liveProjects.slice(0, 5).map(formatProject),
    });
  }

  // ABANDONED CART — users with PENDING pledges older than 2 hours but younger than 48 hours
  // Covers all payment processors: Stripe (no payment method saved), DivinityCoin (no payment ID),
  // and PayPal (paypalOrderId set but order never captured).
  if (!recentTypes.has("abandoned_cart")) {
    const abandonedCutoffOld = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago — older than this are just stale
    const abandonedCutoffRecent = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago — newer than this, still in-progress

    const abandonedPledges = await db.pledge.findMany({
      where: {
        status: "PENDING",
        deletedAt: null,
        createdAt: { gte: abandonedCutoffOld, lte: abandonedCutoffRecent },
        OR: [
          // Stripe pledges where no payment method was ever saved
          {
            paymentProcessor: "STRIPE",
            stripePaymentMethodId: null,
          },
          // DivinityCoin pledges where payment was never completed
          {
            paymentProcessor: "DIVINITYCOIN",
            divinityCoinPaymentId: null,
          },
          // PayPal pledges where an order was created but never captured/approved
          {
            paymentProcessor: "PAYPAL",
            paypalOrderId: { not: null },
          },
          // PayPal pledges where no order was even created (checkout was abandoned immediately)
          {
            paymentProcessor: "PAYPAL",
            paypalOrderId: null,
          },
        ],
      },
      select: { userId: true },
      distinct: ["userId"],
    });

    if (abandonedPledges.length >= 1) {
      const abandonedUserIds = abandonedPledges.map((p: { userId: string }) => p.userId);
      plans.push({
        type: "abandoned_cart",
        audience: "backer",
        name: `Complete Your Pledge — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        projects: liveProjects.slice(0, 5).map(formatProject),
        abandonedPledgeUserIds: abandonedUserIds,
      });
    }
  }

  // Only send 1 campaign per run to avoid fatigue
  return plans.slice(0, 1);
}

// ============================================
// STEP 5: Create and send a campaign
// ============================================

async function createAndSendCampaign(plan: CampaignPlan): Promise<{
  step: AutomationStepResult;
  created: boolean;
  emailsQueued: number;
}> {
  // Get past campaign performance to inform content generation
  const pastPerformance = await getPastPerformance();

  // Map campaign type to descriptions for the AI
  const typeDescriptions: Record<string, { audience: string; tone: string }> = {
    weekly_discovery: {
      audience: "Newsletter subscribers and platform users who enjoy discovering new projects",
      tone: "Friendly, curated, like a personal recommendation from a friend",
    },
    new_projects: {
      audience: "Users interested in being early backers of fresh projects",
      tone: "Exciting, fresh, emphasizing the newness and early-bird opportunity",
    },
    ending_soon: {
      audience: "Users who might miss out on backing a project they'd love",
      tone: "Urgent but not pushy, emphasizing last chance and momentum",
    },
    win_back: {
      audience: "Users who haven't been active in a while",
      tone: "Warm, welcoming back, highlighting what they've missed without guilt",
    },
    abandoned_cart: {
      audience: "Users who started a pledge but didn't complete payment",
      tone: "Helpful and gentle reminder, not pushy — offer to help them finish backing the project they chose",
    },
  };

  const typeInfo = typeDescriptions[plan.type] || typeDescriptions.weekly_discovery;

  // Build a performance hint for AI
  let performanceHint = "";
  if (pastPerformance.bestSubjectStyle) {
    performanceHint = `\n\nPast performance insight: ${pastPerformance.bestSubjectStyle}`;
  }

  // Generate AI content
  const aiContent = await generateCampaignContent({
    campaignName: plan.name,
    targetAudience: typeInfo.audience,
    projectCategory: "all",
    subjectTemplate: "",
    introMessage: performanceHint,
    projects: plan.projects.map(p => ({
      title: p.title,
      description: p.description,
      category: p.category,
      goalAmount: p.goalAmount,
    })),
  });

  // Generate email HTML
  const htmlContent = generateAutomatedEmailHtml(aiContent, plan);

  // Create campaign record
  const campaign = await db.emailCampaign.create({
    data: {
      name: plan.name,
      subject: aiContent.subject,
      htmlContent,
      targetAudience: plan.audience,
      status: "SENDING",
      sentAt: new Date(),
      filters: {
        automated: true,
        campaignType: plan.type,
        aiGenerated: true,
        preheader: aiContent.preheader,
        bodyText: aiContent.personalizedIntro,
      },
    },
  });

  // Get recipients
  const recipientMap = new Map<string, { email: string; name: string | null }>();

  if (plan.type === "abandoned_cart" && plan.abandonedPledgeUserIds && plan.abandonedPledgeUserIds.length > 0) {
    // Abandoned cart campaigns: send only to users with pending pledges
    const abandonedUsers = await db.user.findMany({
      where: {
        id: { in: plan.abandonedPledgeUserIds },
        emailVerified: { not: null },
        deletedAt: null,
      },
      select: { id: true, email: true, name: true },
    });

    for (const u of abandonedUsers) {
      const sendCheck = await canSendEmail(u.id);
      if (sendCheck.canSend) {
        recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
      }
    }
  } else {
    // Standard campaigns: newsletter subscribers + verified users

    // Newsletter subscribers (excluding retailers)
    const subscribers = await db.newsletterSubscriber.findMany({
      where: {
        isActive: true,
        NOT: { source: { contains: "retailer", mode: "insensitive" } },
      },
      select: { email: true, name: true },
    });

    subscribers.forEach((s: { email: string; name: string | null }) => {
      recipientMap.set(s.email.toLowerCase(), { email: s.email.toLowerCase(), name: s.name });
    });

    // Verified users
    const users = await db.user.findMany({
      where: { emailVerified: { not: null }, deletedAt: null },
      select: { id: true, email: true, name: true },
    });

    for (const u of users) {
      // Check frequency cap for registered users
      const sendCheck = await canSendEmail(u.id);
      if (sendCheck.canSend) {
        const existing = recipientMap.get(u.email.toLowerCase());
        if (!existing || (u.name && !existing.name)) {
          recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name });
        }
      }
    }
  }

  const recipients = Array.from(recipientMap.values());

  automationLogger.info(
    `Automated campaign "${plan.name}" — queuing ${recipients.length} emails`
  );

  let queuedCount = 0;
  let failedCount = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

  for (const recipient of recipients) {
    try {
      // Personalize
      let personalizedHtml = htmlContent
        .replace(/\{\{USER_NAME\}\}/gi, recipient.name?.split(" ")[0] || "there")
        .replace(/\{\{SITE_URL\}\}/gi, baseUrl);

      // Add tracking pixel
      const encodedEmail = Buffer.from(recipient.email).toString("base64");
      const trackingPixel = `<img src="${baseUrl}/api/email/track/open?c=${campaign.id}&e=${encodedEmail}" width="1" height="1" style="display:none;" alt="" />`;
      if (personalizedHtml.includes("</body>")) {
        personalizedHtml = personalizedHtml.replace("</body>", `${trackingPixel}</body>`);
      } else {
        personalizedHtml = personalizedHtml + trackingPixel;
      }

      // Wrap internal links for click tracking
      const linkRegex = /href="(https?:\/\/(?:www\.)?indiecrowdfund\.com[^"]*)"/gi;
      personalizedHtml = personalizedHtml.replace(linkRegex, (_, url) => {
        const encodedUrl = Buffer.from(url).toString("base64");
        return `href="${baseUrl}/api/email/track/click?c=${campaign.id}&e=${encodedEmail}&url=${encodedUrl}"`;
      });

      const result = await queueEmail({
        to: recipient.email,
        subject: aiContent.subject,
        html: personalizedHtml,
        priority: EMAIL_PRIORITY.AI_MARKETING,
      });

      if (result.success) {
        await db.emailLog.create({
          data: {
            recipientEmail: recipient.email,
            subject: aiContent.subject,
            htmlContent: personalizedHtml,
            sentAt: new Date(),
            type: "WEEKLY_DISCOVERY",
          },
        });
        queuedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  // Update campaign with final counts
  await db.emailCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "SENT",
      sentCount: queuedCount,
      recipientCount: recipients.length,
    },
  });

  automationLogger.info(
    `Automated campaign "${plan.name}" complete: ${queuedCount} queued, ${failedCount} failed`
  );

  return {
    step: {
      step: `Send "${plan.type}" campaign`,
      success: true,
      message: `"${plan.name}" — ${queuedCount} emails queued to ${recipients.length} recipients`,
      details: { campaignId: campaign.id, queued: queuedCount, failed: failedCount },
    },
    created: true,
    emailsQueued: queuedCount,
  };
}

// ============================================
// Performance feedback loop
// ============================================

interface PastPerformance {
  avgOpenRate: number;
  avgClickRate: number;
  bestSubjectStyle: string | null;
}

async function getPastPerformance(): Promise<PastPerformance> {
  const recentCampaigns = await db.emailCampaign.findMany({
    where: {
      status: "SENT",
      sentCount: { gt: 0 },
      sentAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { sentAt: "desc" },
    take: 10,
    select: {
      subject: true,
      sentCount: true,
      openCount: true,
      clickCount: true,
    },
  });

  if (recentCampaigns.length === 0) {
    return { avgOpenRate: 0, avgClickRate: 0, bestSubjectStyle: null };
  }

  type CampaignMetrics = { subject: string; sentCount: number; openCount: number; clickCount: number };
  const totalSent = recentCampaigns.reduce((sum: number, c: CampaignMetrics) => sum + c.sentCount, 0);
  const totalOpens = recentCampaigns.reduce((sum: number, c: CampaignMetrics) => sum + c.openCount, 0);
  const totalClicks = recentCampaigns.reduce((sum: number, c: CampaignMetrics) => sum + c.clickCount, 0);

  const avgOpenRate = totalSent > 0 ? totalOpens / totalSent : 0;
  const avgClickRate = totalOpens > 0 ? totalClicks / totalOpens : 0;

  // Find best performing subject for guidance
  const best = recentCampaigns
    .filter((c: CampaignMetrics) => c.sentCount > 0)
    .sort((a: CampaignMetrics, b: CampaignMetrics) => (b.openCount / b.sentCount) - (a.openCount / a.sentCount))[0];

  let bestSubjectStyle: string | null = null;
  if (best && best.openCount / best.sentCount > 0.1) {
    bestSubjectStyle = `Subject lines similar to "${best.subject}" performed well (${((best.openCount / best.sentCount) * 100).toFixed(0)}% open rate). Use a similar style.`;
  }

  return { avgOpenRate, avgClickRate, bestSubjectStyle };
}

// ============================================
// HTML template for automated emails
// ============================================

function generateAutomatedEmailHtml(
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
  plan: CampaignPlan
): string {
  const projectCards = aiContent.projectRecommendations
    .map((rec, i) => {
      const project = plan.projects.find(p => p.title === rec.projectTitle) || plan.projects[i];
      if (!project) return "";

      const projectUrl = project.vanityUrl
        ? `/projects/${project.vanityUrl}/${project.slug}`
        : `/projects/${project.slug}`;

      return `
        <div style="margin-bottom: 24px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
          <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 18px;">${project.title}</h3>
          <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">${rec.recommendationReason}</p>
          <a href="{{SITE_URL}}${projectUrl}"
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
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${aiContent.preheader}
      </div>

      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #10b981; margin: 0;">IndieCrowdfund</h1>
      </div>

      <div style="margin-bottom: 32px;">
        <p style="font-size: 16px; color: #374151;">Hi {{USER_NAME}},</p>
        <p style="font-size: 16px; color: #374151;">${aiContent.personalizedIntro}</p>
      </div>

      <div style="margin-bottom: 32px;">
        ${projectCards}
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #6b7280; font-size: 14px;">${aiContent.footer}</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
          <a href="{{SITE_URL}}/unsubscribe" style="color: #9ca3af;">Unsubscribe</a> |
          <a href="{{SITE_URL}}" style="color: #9ca3af;">Visit IndieCrowdfund</a>
        </p>
        <p style="color: #d1d5db; font-size: 10px; margin-top: 8px;">
          This email was curated by AI based on your interests.
        </p>
      </div>
    </body>
    </html>
  `;
}
