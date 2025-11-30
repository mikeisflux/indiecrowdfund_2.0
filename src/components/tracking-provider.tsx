"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { tracking, setupScrollTracking, setupTimeTracking } from "@/lib/tracking";

interface TrackingProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * TrackingProvider - Automatically tracks page views, scroll depth, and time on page
 *
 * Add this to your root layout to enable automatic tracking:
 *
 * <TrackingProvider enabled={true}>
 *   {children}
 * </TrackingProvider>
 */
export function TrackingProvider({ children, enabled = true }: TrackingProviderProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;

    // Track page view
    tracking.pageView();

    // Set up scroll tracking
    const cleanupScroll = setupScrollTracking();

    // Set up time tracking
    const cleanupTime = setupTimeTracking();

    return () => {
      cleanupScroll();
      cleanupTime();
    };
  }, [pathname, enabled]);

  return <>{children}</>;
}

/**
 * useProjectTracking - Hook for tracking project-specific interactions
 */
export function useProjectTracking(projectId: string) {
  useEffect(() => {
    if (!projectId) return;

    // Track project view
    tracking.projectView(projectId);

    // Set up scroll tracking with project ID
    const cleanupScroll = setupScrollTracking(projectId);

    return () => {
      cleanupScroll();
    };
  }, [projectId]);

  return {
    trackRewardClick: (rewardId: string) => tracking.rewardClick(projectId, rewardId),
    trackVideoPlay: () => tracking.videoPlay(projectId),
    trackVideoComplete: () => tracking.videoComplete(projectId),
    trackSave: () => tracking.projectSave(projectId),
    trackShare: (platform?: string) => tracking.projectShare(projectId, platform),
    trackCommentPost: () => tracking.commentPost(projectId),
    trackPledgeStart: (rewardId?: string) => tracking.pledgeStart(projectId, rewardId),
    trackPledgeComplete: (rewardId?: string, amount?: number) =>
      tracking.pledgeComplete(projectId, rewardId, amount),
  };
}

/**
 * useSearchTracking - Hook for tracking search interactions
 */
export function useSearchTracking() {
  return {
    trackSearch: (query: string) => tracking.search(query),
    trackFilterApply: (categoryId: string) => tracking.filterApply(categoryId),
  };
}

export default TrackingProvider;
