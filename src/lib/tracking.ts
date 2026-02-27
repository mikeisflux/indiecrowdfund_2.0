// Behavior Tracking Library (Client-side only)
// Captures user interactions for analytics and personalization
// NOTE: Server-side tracking functions are in @/lib/tracking/index.ts
// Respects user consent preferences from the consent banner

import { getConsentPreferences } from "@/lib/consent";

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

// Map event types to consent categories
// "analytics" = basic usage tracking; "aiTracking" = personalization/recommendation data
const eventConsentCategory: Record<EventType, "analytics" | "aiTracking"> = {
  PAGE_VIEW: "analytics",
  PAGE_EXIT: "analytics",
  SCROLL_DEPTH: "analytics",
  VIDEO_PLAY: "analytics",
  VIDEO_COMPLETE: "analytics",
  SEARCH: "analytics",
  FILTER_APPLY: "analytics",
  COMMENT_POST: "analytics",
  PLEDGE_START: "analytics",
  PLEDGE_COMPLETE: "analytics",
  // AI/personalization events — used for recommendations, behavioral profiling
  PROJECT_VIEW: "aiTracking",
  PROJECT_CLICK: "aiTracking",
  REWARD_CLICK: "aiTracking",
  PROJECT_SAVE: "aiTracking",
  PROJECT_SHARE: "aiTracking",
  HOVER: "aiTracking",
  CREATOR_VIEW: "aiTracking",
};

function isEventAllowed(eventType: EventType): boolean {
  const prefs = getConsentPreferences();
  const category = eventConsentCategory[eventType];
  return prefs[category] === true;
}

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

// Track an event (respects user consent preferences)
export async function trackEvent(event: TrackingEvent): Promise<void> {
  if (typeof window === "undefined") return;

  // Check consent before tracking
  if (!isEventAllowed(event.eventType)) return;

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

export default tracking;
