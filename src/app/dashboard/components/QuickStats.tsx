"use client";

import { Target, DollarSign, TrendingUp } from "lucide-react";
import { GlowingStatCard } from "./GlowingStatCard";
import type { Stats } from "../types";

interface QuickStatsProps {
  stats: Stats;
}

export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <GlowingStatCard
        title="Conversion Rate"
        value={stats.conversionRate}
        suffix="%"
        icon={Target}
        color="purple"
        subtitle="Visitors who pledge"
        delay={0}
      />
      <GlowingStatCard
        title="Average Pledge"
        value={stats.avgPledge}
        prefix="$"
        icon={DollarSign}
        color="green"
        subtitle="Per backer"
        delay={100}
      />
      <GlowingStatCard
        title="Today's Pledges"
        value={stats.todayPledges}
        prefix="$"
        icon={TrendingUp}
        color="blue"
        trend={stats.dailyChange !== 0 ? { value: Math.abs(stats.dailyChange), isPositive: stats.dailyChange > 0, label: "vs yesterday" } : undefined}
        subtitle={stats.dailyChange === 0 ? "Same as yesterday" : undefined}
        delay={200}
      />
    </div>
  );
}
