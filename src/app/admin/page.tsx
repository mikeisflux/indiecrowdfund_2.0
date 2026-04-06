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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  ExternalLink,
  Zap,
  Users,
  FolderKanban,
  DollarSign,
  AlertTriangle,
  UserPlus,
  Loader2,
  Mail,
  FileText,
  Shield,
  Settings,
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
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

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  user?: string;
  timestamp: string;
}

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  error?: string;
}

interface HealthData {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: string;
  checks: HealthCheck[];
}

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const fetchHealthData = useCallback(async () => {
    try {
      const response = await fetch("/api/health");
      if (response.ok) {
        const data = await response.json();
        setHealthData({ ...data, checks: data.checks || [] });
      }
    } catch {
      // Health check failed
      setHealthData({
        status: "unhealthy",
        uptime: 0,
        timestamp: new Date().toISOString(),
        checks: [{ name: "api", status: "unhealthy", error: "Failed to fetch health status" }],
      });
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentProjects(data.recentActivity?.projects || []);
        // Combine projects and users activity
        const allActivity: ActivityItem[] = [
          ...(data.recentActivity?.projects || []),
          ...(data.recentActivity?.users || []),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setActivityItems(allActivity.slice(0, 10));
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchHealthData();

    // Refresh health data every 30 seconds
    const healthInterval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(healthInterval);
  }, [fetchDashboardData, fetchHealthData]);

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

  // Get health status display info
  const getHealthDisplay = () => {
    if (!healthData) {
      return { text: "Loading...", percentage: "—", color: "zinc", icon: Loader2 };
    }

    const checks = healthData.checks || [];
    const healthyChecks = checks.filter((c) => c.status === "healthy").length;
    const totalChecks = checks.length;
    const percentage = totalChecks > 0 ? Math.round((healthyChecks / totalChecks) * 100) : 0;

    switch (healthData.status) {
      case "healthy":
        return { text: "All Systems Operational", percentage: "100%", color: "emerald", icon: CheckCircle2 };
      case "degraded":
        return { text: "Partial Outage", percentage: `${percentage}%`, color: "amber", icon: AlertCircle };
      case "unhealthy":
        return { text: "System Issues", percentage: `${percentage}%`, color: "red", icon: XCircle };
      default:
        return { text: "Unknown", percentage: "—", color: "zinc", icon: AlertCircle };
    }
  };

  const healthDisplay = getHealthDisplay();

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Zap className="mr-2 h-4 w-4" />
                Quick Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/admin/users">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Manage Users
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/projects?status=SUBMITTED">
                  <FileText className="mr-2 h-4 w-4" />
                  Review Pending Projects
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/email">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/notifications">
                  <Bell className="mr-2 h-4 w-4" />
                  Send Notification
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/payouts">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Process Payouts
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/moderation">
                  <Shield className="mr-2 h-4 w-4" />
                  View Reports
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Platform Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                              {Number(project.goalAmount) > 0 ? Math.round((Number(project.currentAmount) / Number(project.goalAmount)) * 100) : 0}%
                            </span>
                          </div>
                          <Progress value={Number(project.goalAmount) > 0 ? (Number(project.currentAmount) / Number(project.goalAmount)) * 100 : 0} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/admin/projects?tab=pending">
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
              {activityItems.length === 0 ? (
                <p className="text-center text-zinc-500 py-4">No recent activity</p>
              ) : (
                activityItems.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`mt-0.5 ${activity.type === "user" ? "text-emerald-500" : "text-blue-500"}`}>
                      {activity.type === "user" ? (
                        <UserPlus className="h-5 w-5" />
                      ) : (
                        <FolderKanban className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{activity.title}</p>
                      <p className="text-xs text-zinc-500">{formatRelativeTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
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

        <Card className={`bg-gradient-to-br text-white ${
          healthDisplay.color === "emerald" ? "from-emerald-500 to-teal-600" :
          healthDisplay.color === "amber" ? "from-amber-500 to-orange-600" :
          healthDisplay.color === "red" ? "from-red-500 to-rose-600" :
          "from-blue-500 to-indigo-600"
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">System Health</p>
                <div className="mt-1 flex items-center gap-2">
                  <healthDisplay.icon className={`h-5 w-5 ${healthDisplay.color === "zinc" ? "animate-spin" : ""}`} />
                  <span className="text-2xl font-bold">{healthDisplay.percentage}</span>
                </div>
                <p className="mt-1 text-xs text-white/70">{healthDisplay.text}</p>
              </div>
              <Link href="/admin/settings">
                <Button size="sm" variant="secondary">Details</Button>
              </Link>
            </div>
            {healthData && healthData.checks?.some(c => c.status !== "healthy") && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="flex flex-wrap gap-2">
                  {(healthData.checks || []).filter(c => c.status !== "healthy").map((check) => (
                    <Badge
                      key={check.name}
                      variant="secondary"
                      className="bg-white/20 text-white text-xs"
                    >
                      {check.name}: {check.status}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
