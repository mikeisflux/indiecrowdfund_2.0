"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Users,
  Clock,
  Eye,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Settings,
  BarChart3,
  MessageSquare,
  Package,
  Truck,
  Sparkles,
  Plus,
  Loader2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";

interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  projectUrl: string;
}

interface SelectedProject {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  daysRemaining: number;
  endDate: string | null;
  launchedAt: string | null;
  projectUrl: string;
}

interface Stats {
  todayPledges: number;
  todayBackers: number;
  todayViews: number;
  weeklyGrowth: number;
  conversionRate: number;
  avgPledge: number;
  dailyChange: number;
}

interface FundingDataPoint {
  date: string;
  amount: number;
  cumulative: number;
}

interface Backer {
  id: string;
  status: string;
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  amount: number;
  reward: string;
  time: string;
}

interface RewardStat {
  id: string;
  title: string;
  amount: number;
  backers: number;
  total: number;
  remaining: number | null;
}

interface Referrer {
  source: string;
  visits: number;
  pledges: number;
  amount: number;
  percentage: number;
}

interface DashboardData {
  projects: Project[];
  selectedProject: SelectedProject | null;
  stats: Stats | null;
  fundingData: FundingDataPoint[];
  recentBackers: Backer[];
  rewardStats: RewardStat[];
  referrers: Referrer[];
}

export default function CreatorDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [timeRange, setTimeRange] = useState("30");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingPledge, setCancellingPledge] = useState<string | null>(null);
  const [refundingPledge, setRefundingPledge] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      params.set("days", timeRange);

      const res = await fetch(`/api/creator/dashboard?${params}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to fetch dashboard data");
      }

      const dashboardData = await res.json();
      setData(dashboardData);

      // Set selected project if not already set
      if (!selectedProjectId && dashboardData.selectedProject) {
        setSelectedProjectId(dashboardData.selectedProject.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, timeRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle project selection change
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // Cancel a pending pledge (creator)
  const handleCancelPledge = async (pledgeId: string) => {
    if (!confirm("Are you sure you want to cancel this pledge? This will remove the backer and amount from your campaign.")) return;

    setCancellingPledge(pledgeId);
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "cancel", reason: "Cancelled by creator" }),
      });

      if (response.ok) {
        // Refresh dashboard data after cancellation
        await fetchDashboardData();
        alert("Pledge cancelled successfully");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to cancel pledge");
      }
    } catch (error) {
      console.error("Failed to cancel pledge:", error);
      alert("Failed to cancel pledge");
    } finally {
      setCancellingPledge(null);
    }
  };

  // Refund a completed pledge (creator)
  const handleRefundPledge = async (pledgeId: string) => {
    if (!confirm("Are you sure you want to refund this pledge? This will process a refund via Stripe and remove the backer from your campaign.")) return;

    setRefundingPledge(pledgeId);
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "refund", reason: "Refunded by creator" }),
      });

      if (response.ok) {
        // Refresh dashboard data after refund
        await fetchDashboardData();
        alert("Pledge refunded successfully");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to refund pledge");
      }
    } catch (error) {
      console.error("Failed to refund pledge:", error);
      alert("Failed to refund pledge");
    } finally {
      setRefundingPledge(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-destructive">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // No projects state
  if (!data?.projects.length) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold text-primary">
                IndieCrowdfund
              </Link>
              <Badge variant="secondary">Creator Dashboard</Badge>
            </div>
            <div className="flex items-center gap-4">
              <NotificationsDropdown />
              <Link href="/dashboard/settings">
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        <div className="container py-20">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-10 w-10 text-primary" />
            </div>
            <h1 className="mb-2 text-2xl font-bold">Create Your First Project</h1>
            <p className="mb-6 text-muted-foreground">
              Start bringing your creative vision to life. Create a crowdfunding campaign
              and connect with backers who believe in your project.
            </p>
            <Link href="/projects/new">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Create Project
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const project = data.selectedProject;
  const stats = data.stats;
  const fundingPercent = project
    ? (project.currentAmount / project.goalAmount) * 100
    : 0;

  // Get the last 10 days of funding data for the chart
  const chartData = data.fundingData.slice(-10);
  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
            <Badge variant="secondary">Creator Dashboard</Badge>
          </div>
          <div className="flex items-center gap-4">
            <NotificationsDropdown />
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <div className="border-b bg-background">
        <div className="container flex flex-wrap items-center gap-2 py-3 md:h-12 md:py-0 md:gap-4">
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {data.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {project && (() => {
            const hasEnded = project.endDate ? new Date(project.endDate) < new Date() : false;
            const displayStatus = hasEnded && project.status === "LIVE" ? "ENDED" : project.status;
            return (
              <Badge
                variant={displayStatus === "LIVE" ? "default" : displayStatus === "ENDED" ? "destructive" : "secondary"}
              >
                {displayStatus}
              </Badge>
            );
          })()}
          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
            {project && (
              <>
                <Link href={project.projectUrl} className="flex-1 sm:flex-initial">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Eye className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">View</span>
                    <span className="xs:hidden">View</span>
                  </Button>
                </Link>
                <Link href={`${project.projectUrl}/edit`} className="flex-1 sm:flex-initial">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Settings className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">Edit</span>
                    <span className="xs:hidden">Edit</span>
                  </Button>
                </Link>
                <Button size="sm" className="flex-1 sm:flex-initial">
                  <Share2 className="mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">Share</span>
                  <span className="xs:hidden">Share</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container py-6">
        {project && stats ? (
          <>
            {/* Stats Overview */}
            <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Pledged
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${project.currentAmount.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fundingPercent.toFixed(0)}% of ${project.goalAmount.toLocaleString()} goal
                  </p>
                  <Progress value={Math.min(fundingPercent, 100)} className="mt-2 h-1" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Backers
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{project.backerCount}</div>
                  {stats.todayBackers > 0 ? (
                    <p className="flex items-center text-xs text-green-600">
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                      +{stats.todayBackers} today
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No new backers today</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Page Views
                  </CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.todayViews.toLocaleString()}</div>
                  {stats.weeklyGrowth !== 0 ? (
                    <p className={`flex items-center text-xs ${stats.weeklyGrowth > 0 ? "text-green-600" : "text-red-600"}`}>
                      {stats.weeklyGrowth > 0 ? (
                        <ArrowUpRight className="mr-1 h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="mr-1 h-3 w-3" />
                      )}
                      {stats.weeklyGrowth > 0 ? "+" : ""}{stats.weeklyGrowth}% this week
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No change this week</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Days Remaining
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{project.daysRemaining}</div>
                  <p className="text-xs text-muted-foreground">
                    {project.endDate
                      ? `Campaign ends ${new Date(project.endDate).toLocaleDateString()}`
                      : "No end date set"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Tabs defaultValue="overview" className="space-y-6">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="inline-flex w-max md:w-auto">
                  <TabsTrigger value="overview">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="backers">
                    <Users className="mr-2 h-4 w-4" />
                    Backers
                  </TabsTrigger>
                  <TabsTrigger value="rewards">
                    <Package className="mr-2 h-4 w-4" />
                    Rewards
                  </TabsTrigger>
                  <TabsTrigger value="messages">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Messages
                  </TabsTrigger>
                  <Link href="/dashboard/email">
                    <TabsTrigger value="email" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-foreground">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Email
                      </div>
                    </TabsTrigger>
                  </Link>
                  <Link href="/dashboard/email-marketing">
                    <TabsTrigger value="email-marketing" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-foreground">
                        <DollarSign className="mr-2 h-4 w-4" />
                        Marketing
                      </div>
                    </TabsTrigger>
                  </Link>
                  <TabsTrigger value="fulfillment">
                    <Truck className="mr-2 h-4 w-4" />
                    Fulfillment
                  </TabsTrigger>
                  <Link href="/dashboard/social">
                    <TabsTrigger value="social" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-foreground">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Social Hub
                      </div>
                    </TabsTrigger>
                  </Link>
                  <Link href="/dashboard/indiekit">
                    <TabsTrigger value="indiekit" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-foreground">
                        <Package className="mr-2 h-4 w-4" />
                        IndieKit
                      </div>
                    </TabsTrigger>
                  </Link>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Funding Chart */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle>Funding Progress</CardTitle>
                      <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="14">Last 14 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="90">All time</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardHeader>
                    <CardContent>
                      {chartData.length > 0 ? (
                        <div className="h-[300px]">
                          <div className="flex h-full items-end gap-2">
                            {chartData.map((day, i) => (
                              <div
                                key={i}
                                className="group relative flex-1"
                              >
                                <div
                                  className="w-full rounded-t bg-primary transition-all hover:bg-primary/80"
                                  style={{
                                    height: `${Math.max((day.amount / maxAmount) * 100, 2)}%`,
                                  }}
                                />
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md whitespace-nowrap">
                                  ${day.amount.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                            {chartData
                              .filter((_, i) => i % Math.ceil(chartData.length / 5) === 0)
                              .map((day, i) => (
                                <span key={i}>
                                  {new Date(day.date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                          No funding data yet
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Backers */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Backers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.recentBackers.length > 0 ? (
                        <div className="space-y-4">
                          {data.recentBackers.slice(0, 5).map((backer) => (
                            <div key={backer.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  {backer.image && <AvatarImage src={backer.image} />}
                                  <AvatarFallback className="text-xs">
                                    {backer.name[0]?.toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{backer.name}</p>
                                    <Badge
                                      variant={backer.status === "COMPLETED" ? "default" : "secondary"}
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      {backer.status}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {backer.reward}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">${backer.amount}</p>
                                <p className="text-xs text-muted-foreground">
                                  {backer.time}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-muted-foreground">
                          No backers yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Traffic Sources */}
                <Card>
                  <CardHeader>
                    <CardTitle>Traffic Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.referrers.length > 0 ? (
                      <div className="space-y-4">
                        {data.referrers.map((referrer, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className="w-24 text-sm font-medium truncate">
                              {referrer.source}
                            </div>
                            <div className="flex-1">
                              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="bg-primary"
                                  style={{ width: `${referrer.percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="w-16 text-right text-sm text-muted-foreground">
                              {referrer.visits.toLocaleString()}
                            </div>
                            <div className="w-16 text-right text-sm font-medium">
                              {referrer.pledges}
                            </div>
                            <div className="w-24 text-right text-sm font-medium text-primary">
                              ${referrer.amount.toLocaleString()}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
                          <div className="w-24" />
                          <div className="flex-1" />
                          <div className="w-16 text-right">Visits</div>
                          <div className="w-16 text-right">Pledges</div>
                          <div className="w-24 text-right">Amount</div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        No traffic data yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Conversion Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                      <p className="text-xs text-muted-foreground">
                        Visitors who pledge
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Average Pledge
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${stats.avgPledge}</div>
                      <p className="text-xs text-muted-foreground">
                        Per backer
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Today&apos;s Pledges
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${stats.todayPledges.toLocaleString()}</div>
                      {stats.dailyChange !== 0 ? (
                        <p className={`flex items-center text-xs ${stats.dailyChange > 0 ? "text-green-600" : "text-red-600"}`}>
                          {stats.dailyChange > 0 ? (
                            <ArrowUpRight className="mr-1 h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="mr-1 h-3 w-3" />
                          )}
                          {stats.dailyChange > 0 ? "+" : ""}{stats.dailyChange}% vs yesterday
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Same as yesterday
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="rewards" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reward Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.rewardStats.length > 0 ? (
                      <div className="space-y-4">
                        {data.rewardStats.map((reward) => (
                          <div
                            key={reward.id}
                            className="flex items-center justify-between rounded-lg border p-4"
                          >
                            <div>
                              <p className="font-medium">{reward.title}</p>
                              <p className="text-sm text-muted-foreground">
                                ${reward.amount}
                              </p>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-center">
                                <p className="text-lg font-bold">{reward.backers}</p>
                                <p className="text-xs text-muted-foreground">Backers</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-primary">
                                  ${reward.total.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                              {reward.remaining !== null && (
                                <div className="text-center">
                                  <p className="text-lg font-bold">{reward.remaining}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Remaining
                                  </p>
                                </div>
                              )}
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        No rewards created yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="backers" className="space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>All Backers</CardTitle>
                    <Button variant="outline" size="sm">
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {data.recentBackers.length > 0 ? (
                      <div className="rounded-lg border overflow-x-auto">
                        <div className="grid grid-cols-6 gap-4 border-b bg-muted/50 p-3 text-sm font-medium min-w-[800px]">
                          <div>Backer</div>
                          <div>Reward</div>
                          <div>Amount</div>
                          <div>Status</div>
                          <div>Date</div>
                          <div>Actions</div>
                        </div>
                        {data.recentBackers.map((backer) => (
                          <div
                            key={backer.id}
                            className="grid grid-cols-6 gap-4 border-b p-3 text-sm last:border-0 min-w-[800px] items-center"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {backer.image && <AvatarImage src={backer.image} />}
                                <AvatarFallback className="text-xs">
                                  {backer.name[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{backer.name}</div>
                                {backer.email && (
                                  <div className="text-xs text-muted-foreground">{backer.email}</div>
                                )}
                              </div>
                            </div>
                            <div>{backer.reward}</div>
                            <div className="font-medium">${backer.amount}</div>
                            <div>
                              <Badge
                                variant={
                                  backer.status === "COMPLETED" ? "default" :
                                  backer.status === "PENDING" ? "secondary" :
                                  backer.status === "REFUNDED" ? "outline" :
                                  "destructive"
                                }
                              >
                                {backer.status}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground">{backer.time}</div>
                            <div className="flex gap-2">
                              {backer.status === "PENDING" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                  onClick={() => handleCancelPledge(backer.id)}
                                  disabled={cancellingPledge === backer.id}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {cancellingPledge === backer.id ? "..." : "Cancel"}
                                </Button>
                              )}
                              {backer.status === "COMPLETED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                  onClick={() => handleRefundPledge(backer.id)}
                                  disabled={refundingPledge === backer.id}
                                >
                                  <RefreshCw className={`h-3 w-3 mr-1 ${refundingPledge === backer.id ? "animate-spin" : ""}`} />
                                  {refundingPledge === backer.id ? "..." : "Refund"}
                                </Button>
                              )}
                              {(backer.status === "CANCELLED" || backer.status === "REFUNDED") && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        No backers yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="messages">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-6">
                      <MessageSquare className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="mb-2 font-semibold text-lg">Backer Messages</h3>
                    <p className="mb-6 text-sm text-muted-foreground text-center max-w-md">
                      Connect with your backers, answer questions, and keep them updated on your project&apos;s progress.
                    </p>
                    <Link href="/dashboard/messages">
                      <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Messages
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fulfillment">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Truck className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold">Fulfillment available after funding</h3>
                    <p className="mb-4 text-center text-sm text-muted-foreground">
                      Once your campaign ends successfully, you&apos;ll be able to manage<br />
                      backer surveys and reward fulfillment here
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Select a project to view dashboard
          </div>
        )}
      </div>
    </div>
  );
}
