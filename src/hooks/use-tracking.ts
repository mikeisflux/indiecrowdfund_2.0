"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

type EventType =
  | "PAGE_VIEW"
  | "PROJECT_VIEW"
  | "REWARD_VIEW"
  | "PLEDGE_START"
  | "PLEDGE_COMPLETE"
  | "SHARE"
  | "SAVE"
  | "SEARCH"
  | "CATEGORY_BROWSE"
  | "VIDEO_PLAY"
  | "SCROLL_DEPTH";

interface TrackingOptions {
  projectId?: string;
  rewardId?: string;
  metadata?: Record<string, unknown>;
}

const SESSION_KEY = "indiecrowdfund_session_id";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function useTracking() {
  const { data: session } = useSession();
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  const track = useCallback(
    async (eventType: EventType, options: TrackingOptions = {}) => {
      try {
        await fetch("/api/tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            userId: session?.user?.id,
            sessionId: sessionIdRef.current,
            projectId: options.projectId,
            rewardId: options.rewardId,
            metadata: options.metadata,
            referrer: typeof document !== "undefined" ? document.referrer : undefined,
            page: typeof window !== "undefined" ? window.location.pathname : undefined,
          }),
        });
      } catch (error) {
        // Silent fail - tracking should never break UX
        console.error("Tracking failed:", error);
      }
    },
    [session?.user?.id]
  );

  const trackPageView = useCallback(
    (projectId?: string) => {
      track("PAGE_VIEW", { projectId });
    },
    [track]
  );

  const trackProjectView = useCallback(
    (projectId: string) => {
      track("PROJECT_VIEW", { projectId });
    },
    [track]
  );

  const trackRewardView = useCallback(
    (projectId: string, rewardId: string) => {
      track("REWARD_VIEW", { projectId, rewardId });
    },
    [track]
  );

  const trackPledgeStart = useCallback(
    (projectId: string, rewardId?: string) => {
      track("PLEDGE_START", { projectId, rewardId });
    },
    [track]
  );

  const trackPledgeComplete = useCallback(
    (projectId: string, rewardId: string, amount: number) => {
      track("PLEDGE_COMPLETE", {
        projectId,
        rewardId,
        metadata: { amount },
      });
    },
    [track]
  );

  const trackShare = useCallback(
    (projectId: string, platform: string) => {
      track("SHARE", {
        projectId,
        metadata: { platform },
      });
    },
    [track]
  );

  const trackSave = useCallback(
    (projectId: string, saved: boolean) => {
      track("SAVE", {
        projectId,
        metadata: { saved },
      });
    },
    [track]
  );

  const trackSearch = useCallback(
    (query: string, resultsCount: number) => {
      track("SEARCH", {
        metadata: { query, resultsCount },
      });
    },
    [track]
  );

  const trackCategoryBrowse = useCallback(
    (category: string) => {
      track("CATEGORY_BROWSE", {
        metadata: { category },
      });
    },
    [track]
  );

  const trackVideoPlay = useCallback(
    (projectId: string, duration?: number) => {
      track("VIDEO_PLAY", {
        projectId,
        metadata: { duration },
      });
    },
    [track]
  );

  const trackScrollDepth = useCallback(
    (projectId: string, depth: number) => {
      track("SCROLL_DEPTH", {
        projectId,
        metadata: { depth },
      });
    },
    [track]
  );

  return {
    track,
    trackPageView,
    trackProjectView,
    trackRewardView,
    trackPledgeStart,
    trackPledgeComplete,
    trackShare,
    trackSave,
    trackSearch,
    trackCategoryBrowse,
    trackVideoPlay,
    trackScrollDepth,
  };
}

/**
 * Hook to track scroll depth on project pages
 */
export function useScrollTracking(projectId: string) {
  const { trackScrollDepth } = useTracking();
  const trackedDepths = useRef<Set<number>>(new Set());

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.round((scrollTop / docHeight) * 100);

      // Track at 25%, 50%, 75%, 100%
      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        if (scrollPercent >= milestone && !trackedDepths.current.has(milestone)) {
          trackedDepths.current.add(milestone);
          trackScrollDepth(projectId, milestone);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [projectId, trackScrollDepth]);
}

/**
 * Hook to track time spent on page
 */
export function useTimeOnPage(projectId: string) {
  const { track } = useTracking();
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    startTime.current = Date.now();

    return () => {
      const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
      track("PAGE_VIEW", {
        projectId,
        metadata: { timeSpent },
      });
    };
  }, [projectId, track]);
}
