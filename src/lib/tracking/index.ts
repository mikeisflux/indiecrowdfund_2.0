import { db } from "@/lib/db";

interface ProjectViewResult {
  date: Date;
  views: number;
  uniqueViews: number;
}

interface ReferrerGroupResult {
  referrerType: string;
  _sum: {
    visits: number | null;
    pledges: number | null;
    pledgeAmount: number | null;
  };
}

interface BehaviorGroupResult {
  eventType: string;
  _count: number;
}

// Must match BehaviorEventType enum in Prisma schema
export type EventType =
  | "PAGE_VIEW"
  | "PAGE_EXIT"
  | "PROJECT_VIEW"
  | "PROJECT_CLICK"
  | "REWARD_CLICK"
  | "VIDEO_PLAY"
  | "VIDEO_COMPLETE"
  | "SEARCH"
  | "FILTER_APPLY"
  | "PROJECT_SAVE"
  | "PROJECT_SHARE"
  | "COMMENT_POST"
  | "PLEDGE_START"
  | "PLEDGE_COMPLETE"
  | "SCROLL_DEPTH"
  | "HOVER"
  | "CREATOR_VIEW";

interface TrackEventParams {
  eventType: EventType;
  userId?: string;
  sessionId: string;
  projectId?: string;
  rewardId?: string;
  metadata?: Record<string, unknown>;
  referrer?: string;
  page?: string;
}

/**
 * Track user behavior for analytics and recommendations
 */
export async function trackEvent({
  eventType,
  userId,
  sessionId,
  projectId,
  rewardId,
  metadata,
  referrer,
  page,
}: TrackEventParams) {
  try {
    await db.userBehavior.create({
      data: {
        eventType,
        userId,
        sessionId,
        projectId,
        rewardId,
        metadata: metadata || {},
        referrer,
        path: page || "/",
      },
    });
  } catch (error) {
    // Don't throw - tracking should never break the user experience
    console.error("Failed to track event:", error);
  }
}

/**
 * Track project view and update view counts
 */
export async function trackProjectView(
  projectId: string,
  userId?: string,
  sessionId?: string,
  referrer?: string
) {
  try {
    // Track the event
    await trackEvent({
      eventType: "PROJECT_VIEW",
      userId,
      sessionId: sessionId || "anonymous",
      projectId,
      referrer,
      page: `/projects/${projectId}`,
    });

    // Update or create project view record
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db.projectView.upsert({
      where: {
        projectId_date: {
          projectId,
          date: today,
        },
      },
      create: {
        projectId,
        date: today,
        views: 1,
        uniqueViews: 1,
      },
      update: {
        views: { increment: 1 },
        // Note: uniqueViews would need more sophisticated handling
        // to properly count unique visitors
      },
    });
  } catch (error) {
    console.error("Failed to track project view:", error);
  }
}

/**
 * Track referrer source for attribution
 */
export async function trackReferrer(
  projectId: string,
  referrer: string,
  tag?: string
) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine referrer type
    const referrerType = categorizeReferrer(referrer);

    await db.referralTracker.upsert({
      where: {
        projectId_referrer_date: {
          projectId,
          referrer: referrer || "direct",
          date: today,
        },
      },
      create: {
        projectId,
        referrer: referrer || "direct",
        referrerType,
        tag,
        date: today,
        visits: 1,
        pledges: 0,
        pledgeAmount: 0,
      },
      update: {
        visits: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("Failed to track referrer:", error);
  }
}

/**
 * Update referrer stats when a pledge is made
 */
export async function trackReferrerConversion(
  projectId: string,
  referrer: string,
  pledgeAmount: number
) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db.referralTracker.updateMany({
      where: {
        projectId,
        referrer: referrer || "direct",
        date: today,
      },
      data: {
        pledges: { increment: 1 },
        pledgeAmount: { increment: pledgeAmount },
      },
    });
  } catch (error) {
    console.error("Failed to track referrer conversion:", error);
  }
}

/**
 * Categorize referrer source
 */
function categorizeReferrer(referrer: string): string {
  if (!referrer) return "direct";

  const url = referrer.toLowerCase();

  // Social media
  if (url.includes("twitter.com") || url.includes("t.co")) return "twitter";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "facebook";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("reddit.com")) return "reddit";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("youtube.com")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";

  // Search engines
  if (url.includes("google.")) return "google";
  if (url.includes("bing.com")) return "bing";
  if (url.includes("duckduckgo.com")) return "duckduckgo";

  // Email
  if (url.includes("mail.") || url.includes("email.")) return "email";

  // Internal
  if (url.includes(process.env.NEXT_PUBLIC_APP_URL || "")) return "internal";

  return "other";
}

/**
 * Get analytics data for a project
 */
export async function getProjectAnalytics(
  projectId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const [views, referrers, behaviors] = await Promise.all([
    // Daily views
    db.projectView.findMany({
      where: {
        projectId,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
    }),

    // Referrer breakdown
    db.referralTracker.groupBy({
      by: ["referrerType"],
      where: {
        projectId,
        date: { gte: startDate },
      },
      _sum: {
        visits: true,
        pledges: true,
        pledgeAmount: true,
      },
    }),

    // Behavior events
    db.userBehavior.groupBy({
      by: ["eventType"],
      where: {
        projectId,
        createdAt: { gte: startDate },
      },
      _count: true,
    }),
  ]);

  return {
    views: views.map((v: ProjectViewResult) => ({
      date: v.date,
      views: v.views,
      uniqueViews: v.uniqueViews,
    })),
    referrers: referrers.map((r: ReferrerGroupResult) => ({
      source: r.referrerType,
      visits: r._sum.visits || 0,
      pledges: r._sum.pledges || 0,
      amount: r._sum.pledgeAmount || 0,
    })),
    events: behaviors.reduce((acc: Record<string, number>, b: BehaviorGroupResult) => {
      acc[b.eventType] = b._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Generate session ID for anonymous tracking
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
