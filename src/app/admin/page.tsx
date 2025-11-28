"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  ExternalLink,
  Sparkles,
  Brain,
  Zap,
  Users,
  FolderKanban,
  DollarSign,
  AlertTriangle,
  UserPlus,
  CheckCircle,
  Flag,
  Loader2,
  type LucideIcon,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  newUsersThisMonth: number;
  userGrowth: number;
  totalProjects: number;
  liveProjects: number;
  pendingProjects: number;
  projectsThisMonth: number;
  totalPledges: number;
  completedPledgeCount: number;
  totalRevenue: number;
  revenueThisMonth: number;
  revenueGrowth: number;
  pendingReports: number;
}

interface RecentProject {
  id: string;
  title: string;
  status: string;
  category: string;
  createdAt: string;
  goalAmount: number;
  currentAmount: number;
  creator: {
    name: string | null;
    email: string;
  };
}

interface StatCard {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  color: string;
  icon: LucideIcon;
}

interface RecentActivity {
  title: string;
  time: string;
  icon: LucideIcon;
  color: string;
}

const aiInsights = [
  {
    title: "Unusual Traffic Pattern",
    description: "We detected a 340% spike in traffic from Reddit. Consider engaging with the community.",
    priority: "medium",
    action: "View Details",
  },
  {
    title: "High Churn Risk Users",
    description: "AI identified 23 users with high churn probability. Personalized outreach recommended.",
    priority: "high",
    action: "View Users",
  },
  {
    title: "Category Trend",
    description: "Technology projects are converting 2.3x better than average this week.",
    priority: "low",
    action: "See Trends",
  },
];

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentProjects(data.recentActivity?.projects || []);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending Review</Badge>;
      case "APPROVED":
      case "LIVE":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Approved</Badge>;
      case "DRAFT":
        return <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Build stat cards from API data
  const statCards: StatCard[] = stats ? [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      change: `${stats.userGrowth >= 0 ? "+" : ""}${stats.userGrowth.toFixed(1)}%`,
      trend: stats.userGrowth >= 0 ? "up" : "down",
      color: "blue",
      icon: Users,
    },
    {
      title: "Total Projects",
      value: stats.totalProjects.toLocaleString(),
      change: `+${stats.projectsThisMonth} this month`,
      trend: "up",
      color: "emerald",
      icon: FolderKanban,
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      change: `${stats.revenueGrowth >= 0 ? "+" : ""}${stats.revenueGrowth.toFixed(1)}%`,
      trend: stats.revenueGrowth >= 0 ? "up" : "down",
      color: "violet",
      icon: DollarSign,
    },
    {
      title: "Pending Reports",
      value: stats.pendingReports.toString(),
      change: stats.pendingReports > 0 ? "Needs attention" : "All clear",
      trend: stats.pendingReports > 0 ? "down" : "up",
      color: "amber",
      icon: AlertTriangle,
    },
  ] : [];

  // Recent activity items
  const recentActivity: RecentActivity[] = [
    { title: "New user registered: Sarah Johnson", time: "2 minutes ago", icon: UserPlus, color: "text-emerald-500" },
    { title: "Project 'Indie Game Dev' submitted for review", time: "15 minutes ago", icon: FolderKanban, color: "text-blue-500" },
    { title: "Large pledge received: $500", time: "1 hour ago", icon: DollarSign, color: "text-violet-500" },
    { title: "Project 'Artisan Coffee' reached goal", time: "2 hours ago", icon: CheckCircle, color: "text-emerald-500" },
    { title: "Content flagged for review", time: "3 hours ago", icon: Flag, color: "text-amber-500" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-zinc-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
          <p className="text-zinc-500">Welcome back! Here&apos;s what&apos;s happening with your platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Zap className="mr-2 h-4 w-4" />
            Quick Actions
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-500">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-lg p-2.5 ${
                  stat.color === "blue" ? "bg-blue-100 dark:bg-blue-900/30" :
                  stat.color === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                  stat.color === "violet" ? "bg-violet-100 dark:bg-violet-900/30" :
                  "bg-amber-100 dark:bg-amber-900/30"
                }`}>
                  <stat.icon className={`h-5 w-5 ${
                    stat.color === "blue" ? "text-blue-600" :
                    stat.color === "emerald" ? "text-emerald-600" :
                    stat.color === "violet" ? "text-violet-600" :
                    "text-amber-600"
                  }`} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                {stat.trend === "up" ? (
                  <span className="flex items-center text-sm font-medium text-emerald-600">
                    <ArrowUpRight className="h-4 w-4" />
                    {stat.change}
                  </span>
                ) : (
                  <span className="flex items-center text-sm font-medium text-red-600">
                    <ArrowDownRight className="h-4 w-4" />
                    {stat.change}
                  </span>
                )}
                <span className="text-sm text-zinc-500">vs last period</span>
              </div>
            </CardContent>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${
              stat.color === "blue" ? "from-blue-500 to-blue-400" :
              stat.color === "emerald" ? "from-emerald-500 to-emerald-400" :
              stat.color === "violet" ? "from-violet-500 to-violet-400" :
              "from-amber-500 to-amber-400"
            }`} />
          </Card>
        ))}
      </div>

      {/* AI Insights Banner */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 dark:border-violet-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <CardTitle className="text-lg">AI Insights</CardTitle>
            <Badge className="bg-violet-600 hover:bg-violet-700">
              <Sparkles className="mr-1 h-3 w-3" />
              3 New
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {aiInsights.map((insight, i) => (
              <div
                key={i}
                className="rounded-lg border border-violet-200 bg-white/80 p-4 dark:border-violet-800 dark:bg-zinc-900/50"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h4 className="font-medium text-zinc-900 dark:text-white">{insight.title}</h4>
                  <Badge
                    variant="outline"
                    className={
                      insight.priority === "high"
                        ? "border-red-200 text-red-700"
                        : insight.priority === "medium"
                        ? "border-amber-200 text-amber-700"
                        : "border-emerald-200 text-emerald-700"
                    }
                  >
                    {insight.priority}
                  </Badge>
                </div>
                <p className="mb-3 text-sm text-zinc-500">{insight.description}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {insight.action}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects needing attention */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Projects Requiring Action</CardTitle>
            <Link href="/admin/projects">
              <Button variant="ghost" size="sm">
                View All
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProjects.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No projects requiring action</p>
              ) : (
                recentProjects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-zinc-900 truncate dark:text-white">
                          {project.title}
                        </h4>
                        {getStatusBadge(project.status)}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-zinc-500">
                        <span>by {project.creator?.name || project.creator?.email}</span>
                        <span>•</span>
                        <span>{project.category}</span>
                        <span>•</span>
                        <span>{formatDate(project.createdAt)}</span>
                      </div>
                      {project.currentAmount > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-zinc-500">
                              {formatCurrency(project.currentAmount)} / {formatCurrency(project.goalAmount)}
                            </span>
                            <span className="font-medium">
                              {Math.round((project.currentAmount / project.goalAmount) * 100)}%
                            </span>
                          </div>
                          <Progress value={(project.currentAmount / project.goalAmount) * 100} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/projects/${project.id}`}>
                        <Button variant="outline" size="sm">Review</Button>
                      </Link>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`mt-0.5 ${activity.color}`}>
                    <activity.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{activity.title}</p>
                    <p className="text-xs text-zinc-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="mt-4 w-full">
              View All Activity
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Pending Payouts</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats ? formatCurrency(stats.totalRevenue * 0.1) : "$0"}
                </p>
              </div>
              <Link href="/admin/payouts">
                <Button size="sm" variant="secondary">Process</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Pending Reviews</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats?.pendingProjects || 0} Projects
                </p>
              </div>
              <Link href="/admin/projects?status=SUBMITTED">
                <Button size="sm" variant="secondary">Review</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Open Reports</p>
                <p className="mt-1 text-2xl font-bold">
                  {stats?.pendingReports || 0} Reports
                </p>
              </div>
              <Link href="/admin/moderation">
                <Button size="sm" variant="secondary">View</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">System Health</p>
                <p className="mt-1 text-2xl font-bold">99.9%</p>
              </div>
              <Link href="/admin/settings">
                <Button size="sm" variant="secondary">Status</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
