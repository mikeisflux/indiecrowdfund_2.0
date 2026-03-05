"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Target,
  Users,
  Award,
  Store,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/stats/utils";

interface HomeStats {
  totalPledged: number;
  projectsFunded: number;
  successRate: number;
  backerPool: number;
  certifiedRetailers: number;
}

interface HomeStatsPollerProps {
  initialStats: HomeStats;
}

export function HomeStatsPoller({ initialStats }: HomeStatsPollerProps) {
  const [stats, setStats] = useState<HomeStats>(initialStats);

  useEffect(() => {
    const pollStats = async () => {
      try {
        const response = await fetch("/api/home-stats", { cache: "no-store" });
        if (response.ok) {
          const freshStats = await response.json();
          setStats(freshStats);
        }
      } catch {
        // Silently fail
      }
    };

    // Poll every 30 seconds
    const intervalId = setInterval(pollStats, 30000);

    // Also poll when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pollStats();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
      <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/20 mb-3 group-hover:glow-pulse transition-all">
          <TrendingUp className="w-6 h-6 text-primary" />
        </div>
        <p className="text-3xl font-bold stat-value mb-1">
          {stats.totalPledged > 0 ? `${formatCurrency(stats.totalPledged)}+` : "$0"}
        </p>
        <p className="text-sm text-muted-foreground">Pledged to projects</p>
      </div>
      <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-3 group-hover:glow-pulse-cyan transition-all">
          <Target className="w-6 h-6 text-cyan-500" />
        </div>
        <p className="text-3xl font-bold stat-value mb-1">
          {stats.projectsFunded > 0 ? formatNumber(stats.projectsFunded) : "0"}
        </p>
        <p className="text-sm text-muted-foreground">Projects funded</p>
      </div>
      <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-3 group-hover:glow-pulse-purple transition-all">
          <Users className="w-6 h-6 text-purple-500" />
        </div>
        <p className="text-3xl font-bold stat-value mb-1">
          {stats.backerPool > 0 ? formatNumber(stats.backerPool) : "0"}
        </p>
        <p className="text-sm text-muted-foreground">Backer pool</p>
      </div>
      <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 mb-3 group-hover:glow-pulse transition-all">
          <Award className="w-6 h-6 text-amber-500" />
        </div>
        <p className="text-3xl font-bold stat-value mb-1">
          {stats.successRate > 0 ? `${stats.successRate}%` : "0%"}
        </p>
        <p className="text-sm text-muted-foreground">Success rate</p>
      </div>
      <Link href="/retailers" className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-3 group-hover:glow-pulse transition-all">
          <Store className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-3xl font-bold stat-value mb-1">
          {stats.certifiedRetailers > 0 ? formatNumber(stats.certifiedRetailers) : "0"}
        </p>
        <p className="text-sm text-muted-foreground">Certified Retailers</p>
      </Link>
    </div>
  );
}
