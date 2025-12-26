"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Award,
  Rocket,
  Star,
  Trophy,
  Crown,
  Zap,
  ClipboardCheck,
  Sparkles,
  TrendingUp,
  Info,
} from "lucide-react";

interface BadgeInfo {
  type: string;
  earnedAt: string;
  label: {
    name: string;
    description: string;
    icon: string;
  };
}

interface BadgesData {
  badges: BadgeInfo[];
  badgeCount: number;
  bonus: {
    rawPercent: string;
    availablePercent: string;
    perBadge: string;
    monthlyCap: string;
  };
  monthlyStats: {
    appliedThisMonth: string;
    remainingCap: string;
    totalSavedThisMonth: string;
  };
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  star: Star,
  trophy: Trophy,
  crown: Crown,
  zap: Zap,
  "clipboard-check": ClipboardCheck,
  award: Award,
};

export function BadgesDisplay() {
  const [data, setData] = useState<BadgesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchBadges();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchBadges = async () => {
    try {
      const response = await fetch("/api/backer/badges", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch badges");
      }
      const badgeData = await response.json();
      setData(badgeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const hasCheckedBadges = useRef(false);

  const checkForNewBadges = useCallback(async () => {
    try {
      const response = await fetch("/api/backer/badges", {
        method: "POST",
        headers: { ...getCSRFHeaders() },
      });
      if (response.ok) {
        const result = await response.json();
        if (result.newBadges?.length > 0) {
          // Refresh badges data
          fetchBadges();
        }
      }
    } catch (err) {
      console.error("Error checking for new badges:", err);
    }
  }, []);

  // Check for new badges on mount (once data is loaded)
  useEffect(() => {
    if (!loading && data && !hasCheckedBadges.current) {
      hasCheckedBadges.current = true;
      checkForNewBadges();
    }
  }, [loading, data, checkForNewBadges]);

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Silently fail - badges are non-critical
  }

  const displayBadges = showAll ? data?.badges : data?.badges.slice(0, 5);
  const hasMoreBadges = (data?.badges.length || 0) > 5;

  return (
    <Card className={cn(
      "glass-card glass-card-hover transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20">
              <Award className="h-4 w-4 text-amber-500" />
            </div>
            Achievement Badges
          </div>
          {data && data.badgeCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
              {data.badgeCount} earned
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data || data.badgeCount === 0 ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
              <Award className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No badges yet. Back projects to earn badges!
            </p>
          </div>
        ) : (
          <>
            {/* Badge Icons */}
            <TooltipProvider>
              <div className="flex flex-wrap gap-2">
                {displayBadges?.map((badge, index) => {
                  const IconComponent = iconMap[badge.label.icon] || Award;
                  return (
                    <Tooltip key={badge.type}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer",
                            "bg-gradient-to-br from-amber-500/20 to-orange-500/20",
                            "border border-amber-500/30 hover:border-amber-500/50",
                            "transition-all duration-300 hover:scale-110",
                            "animate-in fade-in zoom-in"
                          )}
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <IconComponent className="h-5 w-5 text-amber-500" />
                          <div className="absolute inset-0 rounded-full glow-pulse opacity-50" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-semibold">{badge.label.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {badge.label.description}
                          </p>
                          <p className="text-xs text-amber-500">
                            +0.05% redemption bonus
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {hasMoreBadges && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      "bg-muted/50 border border-border/50 hover:border-primary/30",
                      "transition-all duration-300 hover:scale-110 text-sm font-medium"
                    )}
                  >
                    +{data.badges.length - 5}
                  </button>
                )}
              </div>
            </TooltipProvider>

            {/* Bonus Info */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Total Bonus
                </span>
                <span className="font-semibold text-amber-500">
                  {data.bonus.rawPercent}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Saved This Month
                </span>
                <span className="font-semibold text-emerald-500">
                  {data.monthlyStats.totalSavedThisMonth}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Monthly cap: {data.bonus.monthlyCap}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
