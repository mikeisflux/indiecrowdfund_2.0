"use client";

import { DollarSign, Users, Eye, Clock } from "lucide-react";
import { GlowingStatCard } from "./GlowingStatCard";
import type { SelectedProject, Stats } from "../types";

interface StatsCardsProps {
  project: SelectedProject;
  stats: Stats;
}

export function StatsCards({ project, stats }: StatsCardsProps) {
  const fundingPercent = Number(project.goalAmount) > 0
    ? (Number(project.currentAmount) / Number(project.goalAmount)) * 100
    : 0;

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <GlowingStatCard
        title="Total Pledged"
        value={Number(project.currentAmount)}
        prefix="$"
        icon={DollarSign}
        color="green"
        subtitle={`${fundingPercent.toFixed(0)}% of $${Number(project.goalAmount).toLocaleString()} goal`}
        delay={0}
      />
      <GlowingStatCard
        title="Backers"
        value={project.backerCount}
        icon={Users}
        color="blue"
        trend={stats.todayBackers > 0 ? { value: stats.todayBackers, label: "today" } : undefined}
        subtitle={stats.todayBackers === 0 ? "No new backers today" : undefined}
        delay={100}
      />
      <GlowingStatCard
        title="Page Views"
        value={stats.todayViews}
        icon={Eye}
        color="purple"
        trend={stats.weeklyGrowth !== 0 ? { value: Math.abs(stats.weeklyGrowth), isPositive: stats.weeklyGrowth > 0, label: "this week" } : undefined}
        subtitle={stats.weeklyGrowth === 0 ? "No change this week" : undefined}
        delay={200}
      />
      <GlowingStatCard
        title="Days Remaining"
        value={project.daysRemaining}
        icon={Clock}
        color={project.daysRemaining <= 7 ? "amber" : "cyan"}
        subtitle={project.endDate ? `Ends ${new Date(project.endDate).toLocaleDateString()}` : "No end date set"}
        delay={300}
        pulse={project.daysRemaining <= 3}
      />
    </div>
  );
}
