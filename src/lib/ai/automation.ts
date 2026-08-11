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
import { generateCampaignContent, generateCreatorNewsletter } from "@/lib/ai/anthropic";
import {
  renderCampaignEmailHtml,
  renderCreatorNewsletterHtml,
  preferProjectsWithEmailableImage,
} from "@/lib/ai/campaign-email-template";
import { generateSmartSegments } from "@/lib/ai/marketing-services";
import { getAISettings, canSendEmail } from "@/lib/ai/settings-integration";
import { batchUpdateUserInterests, calculateProjectMatchScore } from "@/lib/ai/user-interests";
import { queueEmail, EMAIL_PRIORITY, getUnsubscribeUrl } from "@/lib/email";
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
    // Acquire advisory lock so two overlapping cron invocations can't
    // both pass the shouldSendCampaignToday check and both create
    // campaigns. The second caller blocks until the first finishes.
    await db.$executeRaw`SELECT pg_advisory_lock(hashtext('run-automated-marketing'))`;

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
    // STEP 1b: Creator newsletter (twice a week)
    // Runs on its own Mon/Thu cadence, independent of the project-campaign
    // eligibility gate below.
    // =============================================
    try {
      const newsletterStep = await maybeSendCreatorNewsletter();
      if (newsletterStep) {
        steps.push(newsletterStep);
        campaignsCreated++;
      }
    } catch (err) {
      const msg = `Creator newsletter failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      steps.push({ step: "Creator newsletter", success: false, message: msg });
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
  } finally {
    // Release advisory lock so the next cron invocation can proceed.
    await db.$executeRaw`SELECT pg_advisory_unlock(hashtext('run-automated-marketing'))`.catch(() => {});
  }
}

// ============================================
// STEP 1: Refresh user interest profiles
// ============================================

async function refreshUserProfiles(): Promise<AutomationStepResult> {
  // Find users needing profile updates (no profile or stale > 7 days)
  const usersNeedingProfiles = await db.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { behaviors: { some: {} } },
        { pledges: { some: { status: "COMPLETED" } } },
      ],
      interestProfile: null,
    },
    take: 500,
    select: { id: true },
  });

  const usersWithStaleProfiles = await db.userInterestProfile.findMany({
    where: {
      lastCalculatedAt: {
        lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    take: Math.max(0, 500 - usersNeedingProfiles.length),
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

// Marketing volume controls. These were each halved deliberately — the
// automation was running an automated campaign every single day, a creator
// newsletter twice a week, and allowing three marketing emails per person
// per week on top of that. Raising any of these raises how often real
// people hear from us, so change them together and on purpose.
//
// Minimum days between automated campaigns. Was effectively 1 (one per
// calendar day); 2 halves the platform-level send rate.
const AUTOMATED_CAMPAIGN_GAP_DAYS = 2;

// Day of week the creator newsletter goes out (1 = Monday). Was Mon + Thu.
const CREATOR_NEWSLETTER_DAY = 1;

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

  // Cadence: at most one automated campaign per AUTOMATED_CAMPAIGN_GAP_DAYS.
  // This used to be one per day, which meant seven automated sends a week
  // with only the per-user cap holding volume down. The gap halves the
  // platform-level send rate to roughly 3–4 a week.
  const gapStart = new Date(
    Date.now() - AUTOMATED_CAMPAIGN_GAP_DAYS * 24 * 60 * 60 * 1000
  );
  const sentInGap = await db.emailCampaign.count({
    where: {
      status: "SENT",
      sentAt: { gte: gapStart },
      filters: { path: ["automated"], equals: true },
    },
  });
  if (sentInGap > 0) {
    return {
      send: false,
      reason: `An automated campaign went out within the last ${AUTOMATED_CAMPAIGN_GAP_DAYS} days`,
    };
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
  type: "weekly_discovery" | "new_projects" | "ending_soon" | "win_back" | "abandoned_cart" | "daily_digest" | "high_value_outreach" | "high_engagement";
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
    tags: string[];
    imageUrl: string | null;
  }>;
  // Only populated for abandoned_cart campaigns
  abandonedPledgeUserIds?: string[];
}

// Recent creator-facing features/updates the newsletter can highlight. A few
// are picked at random each send. Intentionally EXCLUDES PayPal Connect,
// which isn't ready for public use yet.
const CREATOR_FEATURES: { title: string; description: string }[] = [
  { title: "Order Lock", description: "Send backers a “confirm & lock your order” request. When they approve, we lock the order and collect payment so you can send it straight to production — no waiting on stragglers." },
  { title: "Printing Comics — bulk print runs", description: "Order a professional print run of your book right inside IndieKit, with a live price quote as you configure trim, paper, and cover stock. Cartons ship to you." },
  { title: "Hard-copy & PDF proofs", description: "Request a proof from the printer and review it before the full run. Production doesn’t start until you approve, so surprises stay off the press." },
  { title: "Shipping-carrier integrations", description: "Buy labels and track shipments through Shippo, ShipStation, EasyPost, and Stamps.com — connected directly to your backer list." },
  { title: "Shopify integration", description: "Sync your campaign fulfillment with your Shopify store, SKU mapping included, so orders flow into the tools you already use." },
  { title: "Backer surveys & pledge manager", description: "Collect addresses and reward choices, then charge for add-ons — all in one place, no third-party pledge manager required." },
  { title: "À-la-carte add-ons & late pledges", description: "Offer add-ons backers can stack onto any tier, and keep taking pledges after your campaign ends." },
  { title: "Digital downloads & the Digital Library", description: "Deliver digital rewards instantly; backers read and re-download them anytime from their Digital Library." },
  { title: "Production order tracking", description: "See needed vs. already-shipped counts at a glance so you never over-produce a print run." },
  { title: "Your own storefront", description: "Keep selling after the campaign — list books, music, movies, and physical media in the IndieCrowdfund shop." },
  { title: "AI marketing that promotes you", description: "We automatically feature your live campaign to backers whose interests match, so discovery keeps working while you focus on making." },
];

// Creator "what's new" newsletter — goes out weekly (Mon) to anyone who has
// created at least a draft project. Feature-driven (not
// project-recommendation based); picks a few features at random each send.
//
// Was Mon + Thu. Halved to Monday only: the content is a rotating sample of
// the same fixed CREATOR_FEATURES list, so twice a week meant creators saw
// the same features come round twice as fast for no extra information.
async function maybeSendCreatorNewsletter(): Promise<AutomationStepResult | null> {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  if (day !== CREATOR_NEWSLETTER_DAY) return null;

  // Dedupe: at most one creator newsletter per 6-day window. Guards against
  // multiple cron fires in a day and keeps the cadence at once a week (6
  // rather than 7 so a slightly early run on the same weekday isn't skipped).
  const recent = await db.emailCampaign.findFirst({
    where: {
      sentAt: { gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
      filters: { path: ["campaignType"], equals: "creator_newsletter" },
    },
    select: { id: true },
  });
  if (recent) return null;

  // Pick up to 3 random features (no repeats within a send).
  const pool = [...CREATOR_FEATURES];
  const picked: { title: string; description: string }[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  const content = await generateCreatorNewsletter({ features: picked });
  const html = renderCreatorNewsletterHtml({
    ...content,
    ctaLabel: "Open your dashboard",
    ctaUrl: "/dashboard",
  });

  const campaign = await db.emailCampaign.create({
    data: {
      name: `Creator Newsletter — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      subject: content.subject,
      htmlContent: html,
      targetAudience: "creator",
      status: "SENDING",
      sentAt: new Date(),
      filters: {
        automated: true,
        campaignType: "creator_newsletter",
        aiGenerated: true,
        preheader: content.preheader,
      },
    },
  });

  // Recipients: anyone who has created at least one (non-deleted) project of
  // ANY status — including DRAFT — with a verified email, respecting the
  // per-user frequency cap.
  const creators = await db.user.findMany({
    where: {
      emailVerified: { not: null },
      deletedAt: null,
      createdProjects: { some: { deletedAt: null } },
    },
    select: { id: true, email: true, name: true },
  });

  const recipients: { id: string; email: string; name: string | null }[] = [];
  for (const u of creators) {
    const check = await canSendEmail(u.id);
    if (check.canSend) recipients.push({ id: u.id, email: u.email.toLowerCase(), name: u.name });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  let queuedCount = 0;
  for (const r of recipients) {
    try {
      let personalized = html
        .replace(/\{\{USER_NAME\}\}/gi, r.name?.split(" ")[0] || "there")
        .replace(/\{\{SITE_URL\}\}/gi, baseUrl);
      const encodedEmail = Buffer.from(r.email).toString("base64");
      const pixel = `<img src="${baseUrl}/api/email/track/open?c=${campaign.id}&e=${encodedEmail}" width="1" height="1" style="display:none;" alt="" />`;
      personalized = personalized.includes("</body>")
        ? personalized.replace("</body>", `${pixel}</body>`)
        : personalized + pixel;
      const linkRegex = /href="(https?:\/\/(?:www\.)?indiecrowdfund\.com[^"]*)"/gi;
      personalized = personalized.replace(linkRegex, (_m, url) => {
        const encodedUrl = Buffer.from(url).toString("base64");
        return `href="${baseUrl}/api/email/track/click?c=${campaign.id}&e=${encodedEmail}&url=${encodedUrl}"`;
      });
      personalized = personalized.replace(/\{\{UNSUBSCRIBE_URL\}\}/gi, getUnsubscribeUrl(r.email));

      const result = await queueEmail({
        to: r.email,
        subject: content.subject,
        html: personalized,
        priority: EMAIL_PRIORITY.AI_MARKETING,
      });
      if (result.success) queuedCount++;
    } catch {
      // Skip a single failed recipient; keep sending the rest.
    }
  }

  await db.emailCampaign.update({
    where: { id: campaign.id },
    data: { status: "SENT", sentCount: queuedCount, recipientCount: recipients.length },
  });

  return {
    step: "Creator newsletter",
    success: true,
    message: `Sent creator newsletter to ${queuedCount} creator(s): ${picked.map((f) => f.title).join(", ")}`,
  };
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
      tags: true,
      imageUrl: true,
      creator: { select: { vanityUrl: true } },
    },
  });

  if (liveProjects.length === 0) return plans;

  // Lead every marketing email with campaigns that have a real, emailable
  // cover image (newest-first within each group). Sorts in place so every
  // campaign type built below benefits.
  preferProjectsWithEmailableImage(liveProjects);

  const formatProject = (p: typeof liveProjects[0]) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description || "",
    category: p.category || "General",
    goalAmount: Number(p.goalAmount),
    vanityUrl: p.creator?.vanityUrl || null,
    tags: p.tags || [],
    imageUrl: p.imageUrl || null,
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
          // PayPal pledges where an order was created but never captured/approved.
          // Prisma 7 rejects `{ field: { not: null } }` on nullable string
          // fields at runtime — use `NOT: { field: null }` wrapper syntax.
          {
            paymentProcessor: "PAYPAL",
            NOT: { paypalOrderId: null },
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

  // HIGH-VALUE BACKER OUTREACH — Thursday: re-engage your biggest backers
  // (targeted at high-spend backers in createAndSendCampaign) with a curated
  // pick. Skipped if one went out in the last 14 days.
  if (dayOfWeek === 4 && !recentTypes.has("high_value_outreach")) {
    plans.push({
      type: "high_value_outreach",
      audience: "backer",
      name: `Picked For You — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: liveProjects.slice(0, 5).map(formatProject),
    });
  }

  // HIGH ENGAGEMENT PROJECTS — Friday: showcase the projects getting the
  // most traction to the whole list.
  if (dayOfWeek === 5 && !recentTypes.has("high_engagement")) {
    plans.push({
      type: "high_engagement",
      audience: "subscriber",
      name: `Trending on IndieCrowdfund — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: liveProjects.slice(0, 5).map(formatProject),
    });
  }

  // DIGEST — the fallback so something relevant still goes out on a run
  // where no special campaign (new projects, ending soon, win-back,
  // abandoned cart) is eligible. Despite the type name this is no longer
  // daily: runs are gated by AUTOMATED_CAMPAIGN_GAP_DAYS, and the per-user
  // frequency cap (EMAIL_FREQUENCY_WINDOW_DAYS) decides who actually
  // receives one. Projects are reordered to each recipient's interests at
  // send time, and delivered at their optimal hour.
  if (plans.length === 0 && liveProjects.length > 0) {
    plans.push({
      type: "daily_digest",
      audience: "subscriber",
      name: `Today on IndieCrowdfund — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      projects: liveProjects.slice(0, 5).map(formatProject),
    });
  }

  // Only send 1 campaign per run to avoid fatigue
  return plans.slice(0, 1);
}

// ============================================
// STEP 5: Create and send a campaign
// ============================================

// Next occurrence of `hour` (0-23) in server-local time. optimalSendHour is
// computed from behavior timestamps using the same server clock, so no
// timezone conversion is needed. The automation runs ~3 AM, so most hours
// land later the same day; the queue's scheduledFor holds the email till then.
function nextOptimalSlot(hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

type AiRecommendation = {
  projectTitle: string;
  recommendationReason: string;
  callToAction: string;
};

// Reorder a campaign's AI project recommendations so the projects that best
// match THIS user's interest profile (category + tag affinities) appear
// first. Pure + in-memory (calculateProjectMatchScore does no DB), so it's
// safe to run per-recipient in the send loop. No profile -> original order.
function personalizeRecommendations(
  recommendations: AiRecommendation[],
  projects: CampaignPlan["projects"],
  interests: { categoryInterests: Record<string, number>; tagInterests: Record<string, number> } | undefined
): AiRecommendation[] {
  if (!interests) return recommendations;
  return recommendations
    .map((rec) => {
      const project = projects.find((p) => p.title === rec.projectTitle);
      const score = project
        ? calculateProjectMatchScore(interests, { category: project.category, tags: project.tags })
        : 0;
      return { rec, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.rec);
}

async function createAndSendCampaign(plan: CampaignPlan): Promise<{
  step: AutomationStepResult;
  created: boolean;
  emailsQueued: number;
}> {
  // Get past campaign performance to inform content generation
  const pastPerformance = await getPastPerformance();

  // Map campaign type to descriptions for the AI
  const typeDescriptions: Record<string, { audience: string; tone: string }> = {
    high_value_outreach: {
      audience: "Your most valuable backers — people who've pledged generously before",
      tone: "Warm, appreciative, a touch exclusive — a VIP pick from someone who knows their taste",
    },
    high_engagement: {
      audience: "Subscribers and backers who like to see what's catching fire on the platform",
      tone: "Energetic and social-proof-driven — the projects everyone's backing right now",
    },
    daily_digest: {
      audience: "Backers and subscribers who like a daily pulse of fresh projects matched to their taste",
      tone: "Warm, curated, and concise — like a trusted friend's daily pick, never a hard sell",
    },
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
  const recipientMap = new Map<string, { email: string; name: string | null; userId?: string }>();

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
        recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name, userId: u.id });
      }
    }
  } else if (plan.type === "win_back") {
    // Win-back is TARGETED, not a blast: only registered users our
    // predictive model flags as high churn risk (>= 0.5). Previously this
    // emailed the entire list, which defeats the purpose of a win-back.
    const atRiskScores = await db.userMarketingScore.findMany({
      where: { churnRisk: { gte: 0.5 } },
      select: { userId: true },
    });
    const atRiskIds = atRiskScores.map((s: { userId: string }) => s.userId);
    if (atRiskIds.length > 0) {
      const atRiskUsers = await db.user.findMany({
        where: { id: { in: atRiskIds }, emailVerified: { not: null }, deletedAt: null },
        select: { id: true, email: true, name: true },
      });
      for (const u of atRiskUsers) {
        const sendCheck = await canSendEmail(u.id);
        if (sendCheck.canSend) {
          recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name, userId: u.id });
        }
      }
    }
  } else if (plan.type === "high_value_outreach") {
    // High-value backers: total completed pledges over $100 (same
    // definition as the admin "high-value" audience). Your most valuable
    // supporters — re-engage them with a curated pick.
    const highValueGroups = await db.pledge.groupBy({
      by: ["userId"],
      where: { status: "COMPLETED", deletedAt: null },
      _sum: { amount: true },
      having: { amount: { _sum: { gt: 100 } } },
    });
    const highValueIds = highValueGroups.map((g: { userId: string }) => g.userId);
    if (highValueIds.length > 0) {
      const hvUsers = await db.user.findMany({
        where: { id: { in: highValueIds }, emailVerified: { not: null }, deletedAt: null },
        select: { id: true, email: true, name: true },
      });
      for (const u of hvUsers) {
        const sendCheck = await canSendEmail(u.id);
        if (sendCheck.canSend) {
          recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name, userId: u.id });
        }
      }
    }
  } else {
    // Standard broadcasts: newsletter subscribers + verified users

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
        if (!existing) {
          recipientMap.set(u.email.toLowerCase(), { email: u.email.toLowerCase(), name: u.name, userId: u.id });
        } else {
          // Already added as a subscriber — attach the userId (and name)
          // so they get send-time optimization too.
          existing.userId = u.id;
          if (u.name && !existing.name) existing.name = u.name;
        }
      }
    }
  }

  const recipients = Array.from(recipientMap.values());

  // Batch-load each registered recipient's optimal send hour in ONE query
  // (no per-recipient DB calls in the send loop below).
  const recipientUserIds = recipients
    .map((r) => r.userId)
    .filter((id): id is string => !!id);
  const sendHourByUser = new Map<string, number | null>();
  if (recipientUserIds.length > 0) {
    const scores = await db.userMarketingScore.findMany({
      where: { userId: { in: recipientUserIds } },
      select: { userId: true, optimalSendHour: true },
    });
    scores.forEach((s: { userId: string; optimalSendHour: number | null }) =>
      sendHourByUser.set(s.userId, s.optimalSendHour)
    );
  }

  // Batch-load interest profiles so each email's projects can be reordered
  // to the recipient's interests (one query; pure scoring in the loop).
  const interestsByUser = new Map<string, { categoryInterests: Record<string, number>; tagInterests: Record<string, number> }>();
  if (recipientUserIds.length > 0) {
    const profiles = await db.userInterestProfile.findMany({
      where: { userId: { in: recipientUserIds } },
      select: { userId: true, categoryInterests: true, tagInterests: true },
    });
    profiles.forEach((p: { userId: string; categoryInterests: unknown; tagInterests: unknown }) =>
      interestsByUser.set(p.userId, {
        categoryInterests: (p.categoryInterests as Record<string, number>) ?? {},
        tagInterests: (p.tagInterests as Record<string, number>) ?? {},
      })
    );
  }

  automationLogger.info(
    `Automated campaign "${plan.name}" — queuing ${recipients.length} emails`
  );

  let queuedCount = 0;
  let failedCount = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

  for (const recipient of recipients) {
    try {
      // Personalize: reorder this email's projects to the recipient's
      // interests, then fill in name + site URL.
      const interests = recipient.userId ? interestsByUser.get(recipient.userId) : undefined;
      const recs = personalizeRecommendations(aiContent.projectRecommendations, plan.projects, interests);
      let personalizedHtml = generateAutomatedEmailHtml(aiContent, plan, recs)
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

      // Resolve the unsubscribe placeholder AFTER click-tracking so the
      // opt-out link stays a clean, direct signed URL. (The old template
      // linked to {{SITE_URL}}/unsubscribe, which is a 404 — there is no
      // such page, only the /api/unsubscribe?token= endpoint.)
      personalizedHtml = personalizedHtml.replace(
        /\{\{UNSUBSCRIBE_URL\}\}/gi,
        getUnsubscribeUrl(recipient.email)
      );

      // Deliver at the recipient's optimal hour when we know it; otherwise
      // send as soon as the queue drains (scheduledFor undefined = now).
      const optimalHour = recipient.userId ? sendHourByUser.get(recipient.userId) : null;
      const scheduledFor =
        optimalHour !== null && optimalHour !== undefined ? nextOptimalSlot(optimalHour) : undefined;

      const result = await queueEmail({
        to: recipient.email,
        subject: aiContent.subject,
        html: personalizedHtml,
        priority: EMAIL_PRIORITY.AI_MARKETING,
        scheduledFor,
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
  plan: CampaignPlan,
  recommendations: AiRecommendation[] = aiContent.projectRecommendations
): string {
  return renderCampaignEmailHtml(
    { ...aiContent, projectRecommendations: recommendations },
    plan.projects.map((p) => ({
      title: p.title,
      url: p.vanityUrl ? `/projects/${p.vanityUrl}/${p.slug}` : `/projects/${p.slug}`,
      imageUrl: p.imageUrl,
      category: p.category,
    }))
  );
}
