// Behavior Tracking Library
// Captures user interactions for analytics and personalization

import { db } from "@/lib/db";

type EventType =
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

interface TrackingEvent {
  eventType: EventType;
  projectId?: string;
  categoryId?: string;
  rewardId?: string;
  searchQuery?: string;
  timeSpent?: number;
  scrollDepth?: number;
  metadata?: Record<string, unknown>;
}

// Session ID management
function getSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem("tracking_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem("tracking_session_id", sessionId);
  }
  return sessionId;
}

// Track an event
export async function trackEvent(event: TrackingEvent): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const sessionId = getSessionId();
    const path = window.location.pathname;
    const referrer = document.referrer || undefined;

    // Use sendBeacon for better reliability (especially on page unload)
    const payload = JSON.stringify({
      ...event,
      sessionId,
      path,
      referrer,
    });

    // Try sendBeacon first, fall back to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
    } else {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch (error) {
    // Silently fail - don't interrupt user experience
    console.debug("Tracking error:", error);
  }
}

// Convenience methods
export const tracking = {
  pageView: () => trackEvent({ eventType: "PAGE_VIEW" }),

  pageExit: (timeSpent: number) => trackEvent({
    eventType: "PAGE_EXIT",
    timeSpent
  }),

  projectView: (projectId: string) => trackEvent({
    eventType: "PROJECT_VIEW",
    projectId
  }),

  projectClick: (projectId: string) => trackEvent({
    eventType: "PROJECT_CLICK",
    projectId
  }),

  rewardClick: (projectId: string, rewardId: string) => trackEvent({
    eventType: "REWARD_CLICK",
    projectId,
    rewardId
  }),

  videoPlay: (projectId: string) => trackEvent({
    eventType: "VIDEO_PLAY",
    projectId
  }),

  videoComplete: (projectId: string) => trackEvent({
    eventType: "VIDEO_COMPLETE",
    projectId
  }),

  search: (query: string) => trackEvent({
    eventType: "SEARCH",
    searchQuery: query
  }),

  filterApply: (categoryId: string) => trackEvent({
    eventType: "FILTER_APPLY",
    categoryId
  }),

  projectSave: (projectId: string) => trackEvent({
    eventType: "PROJECT_SAVE",
    projectId
  }),

  projectShare: (projectId: string, platform?: string) => trackEvent({
    eventType: "PROJECT_SHARE",
    projectId,
    metadata: platform ? { platform } : undefined
  }),

  commentPost: (projectId: string) => trackEvent({
    eventType: "COMMENT_POST",
    projectId
  }),

  pledgeStart: (projectId: string, rewardId?: string) => trackEvent({
    eventType: "PLEDGE_START",
    projectId,
    rewardId
  }),

  pledgeComplete: (projectId: string, rewardId?: string, amount?: number) => trackEvent({
    eventType: "PLEDGE_COMPLETE",
    projectId,
    rewardId,
    metadata: amount ? { amount } : undefined
  }),

  scrollDepth: (depth: number, projectId?: string) => trackEvent({
    eventType: "SCROLL_DEPTH",
    scrollDepth: depth,
    projectId
  }),

  hover: (projectId: string) => trackEvent({
    eventType: "HOVER",
    projectId
  }),

  creatorView: (creatorId: string) => trackEvent({
    eventType: "CREATOR_VIEW",
    metadata: { creatorId }
  }),
};

// Scroll depth tracking utility
export function setupScrollTracking(projectId?: string): () => void {
  if (typeof window === "undefined") return () => {};

  let maxDepth = 0;
  const thresholds = [25, 50, 75, 90, 100];
  const trackedThresholds = new Set<number>();

  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const depth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

    if (depth > maxDepth) {
      maxDepth = depth;

      // Track when crossing thresholds
      for (const threshold of thresholds) {
        if (depth >= threshold && !trackedThresholds.has(threshold)) {
          trackedThresholds.add(threshold);
          tracking.scrollDepth(threshold, projectId);
        }
      }
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
}

// Time on page tracking utility
export function setupTimeTracking(): () => void {
  if (typeof window === "undefined") return () => {};

  const startTime = Date.now();

  const handleUnload = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    tracking.pageExit(timeSpent);
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);

  return () => {
    window.removeEventListener("beforeunload", handleUnload);
    window.removeEventListener("pagehide", handleUnload);
  };
}

// Video tracking utility
export function setupVideoTracking(
  videoElement: HTMLVideoElement,
  projectId: string
): () => void {
  if (!videoElement) return () => {};

  let hasStarted = false;

  const handlePlay = () => {
    if (!hasStarted) {
      hasStarted = true;
      tracking.videoPlay(projectId);
    }
  };

  const handleEnded = () => {
    tracking.videoComplete(projectId);
  };

  videoElement.addEventListener("play", handlePlay);
  videoElement.addEventListener("ended", handleEnded);

  return () => {
    videoElement.removeEventListener("play", handlePlay);
    videoElement.removeEventListener("ended", handleEnded);
  };
}

// Server-side tracking functions

/**
 * Track a project view on the server side
 */
export async function trackProjectView(
  projectId: string,
  userId?: string,
  sessionId?: string,
  referrer?: string
): Promise<void> {
  try {
    await db.userBehavior.create({
      data: {
        eventType: "PROJECT_VIEW",
        projectId,
        userId: userId || null,
        sessionId: sessionId || `anon_${Date.now()}`,
        referrer: referrer || null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error tracking project view:", error);
  }
}

/**
 * Track referrer source for a project
 */
export async function trackReferrer(
  projectId: string,
  referrer: string
): Promise<void> {
  try {
    // Extract domain from referrer
    let source = "direct";
    try {
      const url = new URL(referrer);
      source = url.hostname;
    } catch {
      source = referrer;
    }

    // Update or create referrer tracking
    await db.projectReferrer.upsert({
      where: {
        projectId_source: {
          projectId,
          source,
        },
      },
      update: {
        count: { increment: 1 },
        lastVisit: new Date(),
      },
      create: {
        projectId,
        source,
        count: 1,
        lastVisit: new Date(),
      },
    });
  } catch (error) {
    console.error("Error tracking referrer:", error);
  }
}

/**
 * Get analytics data for a project
 */
export async function getProjectAnalytics(
  projectId: string,
  days: number = 30
): Promise<{
  views: number;
  uniqueVisitors: number;
  topReferrers: { source: string; count: number }[];
  viewsByDay: { date: string; count: number }[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Get total views
    const views = await db.userBehavior.count({
      where: {
        projectId,
        eventType: "PROJECT_VIEW",
        timestamp: { gte: startDate },
      },
    });

    // Get unique visitors (by sessionId)
    const uniqueSessions = await db.userBehavior.findMany({
      where: {
        projectId,
        eventType: "PROJECT_VIEW",
        timestamp: { gte: startDate },
      },
      select: { sessionId: true },
      distinct: ["sessionId"],
    });

    // Get top referrers
    const referrers = await db.projectReferrer.findMany({
      where: {
        projectId,
        lastVisit: { gte: startDate },
      },
      orderBy: { count: "desc" },
      take: 10,
    });

    // Get views by day
    const viewsByDay = await db.userBehavior.groupBy({
      by: ["timestamp"],
      where: {
        projectId,
        eventType: "PROJECT_VIEW",
        timestamp: { gte: startDate },
      },
      _count: true,
    });

    return {
      views,
      uniqueVisitors: uniqueSessions.length,
      topReferrers: referrers.map((r) => ({
        source: r.source,
        count: r.count,
      })),
      viewsByDay: viewsByDay.map((v) => ({
        date: v.timestamp.toISOString().split("T")[0],
        count: v._count,
      })),
    };
  } catch (error) {
    console.error("Error getting project analytics:", error);
    return {
      views: 0,
      uniqueVisitors: 0,
      topReferrers: [],
      viewsByDay: [],
    };
  }
}

export default tracking;
