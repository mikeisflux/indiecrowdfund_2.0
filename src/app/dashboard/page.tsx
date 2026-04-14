"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  XCircle,
  Settings,
  Sparkles,
  Plus,
  BarChart3,
  Users,
  MessageSquare,

  Truck,
  FileText,
  ShoppingCart,
  ArrowLeft,
  Handshake,
  Mail,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";

// Import types
import type { DashboardData } from "./types";

// Import components
import { ProjectSelector } from "./components/ProjectSelector";
import { StatsCards } from "./components/StatsCards";
import { FundingChart } from "./components/FundingChart";
import { RecentBackersCard } from "./components/RecentBackersCard";
import { TrafficSources } from "./components/TrafficSources";
import { QuickStats } from "./components/QuickStats";
import { RewardStats } from "./components/RewardStats";
import { BackersList } from "./components/BackersList";
import { ProductionOrderView } from "./components/ProductionOrderView";
import { CollaborationsTab } from "./components/CollaborationsTab";
import { PostUpdatesTab } from "./components/PostUpdatesTab";
import { SocialHubTab } from "./components/SocialHubTab";
import { IndieKitV2Tab } from "./components/IndieKitV2Tab";
import { MarketplaceTab } from "./components/MarketplaceTab";
import { EmailTab } from "./components/EmailTab";

const SELECTED_PROJECT_KEY = "indiecrowdfund_selected_project";

export default function CreatorDashboard() {
  const searchParams = useSearchParams();
  // Initialize from URL param or localStorage so the first fetch uses the correct project
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return searchParams?.get("project") || localStorage.getItem(SELECTED_PROJECT_KEY) || "";
  });
  const [timeRange, setTimeRange] = useState("30");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);

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
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const dashboardData = await res.json();
      setData(dashboardData);

      if (!selectedProjectId && dashboardData.selectedProject) {
        setSelectedProjectId(dashboardData.selectedProject.id);
        localStorage.setItem(SELECTED_PROJECT_KEY, dashboardData.selectedProject.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      const isNetworkError = message.includes("Failed to fetch") || message.includes("NetworkError");
      setError(isNetworkError ? "Network error - check your connection" : message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, timeRange]);

  // Handle URL param changes (e.g. navigating to /dashboard?project=xyz)
  useEffect(() => {
    const urlProject = searchParams?.get("project");
    if (urlProject && urlProject !== selectedProjectId) {
      setSelectedProjectId(urlProject);
      localStorage.setItem(SELECTED_PROJECT_KEY, urlProject);
    }
  }, [searchParams, selectedProjectId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Poll for updated stats every 15 seconds (lightweight re-fetch)
  useEffect(() => {
    if (!data?.selectedProject) return;

    const pollStats = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedProjectId) params.set("projectId", selectedProjectId);
        params.set("days", timeRange);

        const res = await fetch(`/api/creator/dashboard?${params}`, { cache: "no-store" });
        if (res.ok) {
          const freshData = await res.json();
          setData(freshData);
        }
      } catch {
        // Silently fail - don't interrupt user experience for polling errors
      }
    };

    const intervalId = setInterval(pollStats, 15000);

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
  }, [data?.selectedProject, selectedProjectId, timeRange]);

  // Fetch unread email count and poll every 30 seconds
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await fetch("/api/creator/email/threads?filter=unread");
        if (res.ok) {
          const data = await res.json();
          setUnreadEmailCount(data.threads?.length || 0);
        }
      } catch {
        // Silently fail
      }
    };

    fetchUnreadCount();
    const intervalId = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
            </div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchDashboardData} className="bg-gradient-to-r from-primary to-purple-500">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.projects.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                Creator Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2">
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

        <div className="container relative py-20">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center animate-pulse">
              <Plus className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mb-2 text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Create Your First Project
            </h1>
            <p className="mb-8 text-muted-foreground">
              Start bringing your creative vision to life. Create a crowdfunding campaign
              and connect with backers who believe in your project.
            </p>
            <Link href="/projects/new">
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                <Plus className="mr-2 h-5 w-5" />
                Create Project
              </Button>
            </Link>
          </div>

          {/* Show collaborations even when user has no own projects */}
          <div className="mt-16 max-w-3xl mx-auto">
            <CollaborationsTab />
          </div>
        </div>
      </div>
    );
  }

  const project = data.selectedProject;
  const stats = data.stats;
  const fundingPercent = project && Number(project.goalAmount) > 0
    ? (Number(project.currentAmount) / Number(project.goalAmount)) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Creator Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <Link href="/dashboard/settings" className="hidden sm:block">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Project Selector */}
      <ProjectSelector
        projects={data.projects}
        selectedProjectId={selectedProjectId}
        selectedProject={project}
        onProjectChange={handleProjectChange}
      />

      <div className="container relative py-6">
        {project && stats ? (
          <>
            {/* Stats Overview */}
            <StatsCards project={project} stats={stats} />

            {/* Funding Progress Bar */}
            <Card className="mb-6 bg-card/50 backdrop-blur border-border/50 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Campaign Progress</span>
                  <span className="text-sm text-muted-foreground">
                    <span className="font-bold text-primary">${Number(project.currentAmount).toLocaleString()}</span>
                    {" "}of ${Number(project.goalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                  />
                  {fundingPercent >= 100 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent animate-pulse" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Main Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="inline-flex w-max md:w-auto bg-card/50 backdrop-blur border border-border/50 p-1">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="backers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Users className="mr-2 h-4 w-4" />
                    Backers
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Performance
                  </TabsTrigger>
                  <TabsTrigger value="email" className="relative data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                    {unreadEmailCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg animate-pulse">
                        {unreadEmailCount > 99 ? "99+" : unreadEmailCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Messages
                  </TabsTrigger>
                  <TabsTrigger value="production-order" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Truck className="mr-2 h-4 w-4" />
                    Production Order
                  </TabsTrigger>
                  <TabsTrigger value="updates" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <FileText className="mr-2 h-4 w-4" />
                    Post Updates
                  </TabsTrigger>
                  <TabsTrigger value="social" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Social Hub
                  </TabsTrigger>
                  <TabsTrigger value="indiekit-v2" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Sparkles className="mr-2 h-4 w-4 text-teal-500" />
                    IndieKit 2.0
                  </TabsTrigger>
                  <TabsTrigger value="marketplace" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Marketplace
                  </TabsTrigger>
                  <TabsTrigger value="collaborations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Handshake className="mr-2 h-4 w-4" />
                    Collaborations
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                  <FundingChart
                    fundingData={data.fundingData}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                  />
                  <RecentBackersCard backers={data.recentBackers} />
                </div>
                <TrafficSources referrers={data.referrers} />
                <QuickStats stats={stats} />
              </TabsContent>

              <TabsContent value="performance" className="space-y-6">
                <RewardStats
                  rewardStats={data.rewardStats}
                  addonStats={data.addonStats}
                  projectUrl={project.projectUrl}
                />
              </TabsContent>

              <TabsContent value="backers" className="space-y-6">
                <BackersList
                  backers={data.recentBackers}
                  allRewards={data.allRewards}
                  allAddons={data.allAddons}
                  projectId={project.id}
                  projectSlug={project.slug}
                  onRefresh={fetchDashboardData}
                />
              </TabsContent>

              <TabsContent value="email" className="space-y-6">
                <EmailTab projectId={selectedProjectId} onRefresh={fetchDashboardData} />
              </TabsContent>

              <TabsContent value="messages">
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6 animate-pulse">
                      <MessageSquare className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="mb-2 font-semibold text-lg">Backer Messages</h3>
                    <p className="mb-6 text-sm text-muted-foreground text-center max-w-md">
                      Connect with your backers, answer questions, and keep them updated on your project&apos;s progress.
                    </p>
                    <Link href="/dashboard/messages">
                      <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Messages
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="production-order" className="space-y-6">
                <ProductionOrderView productionOrderStats={data.productionOrderStats} projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="updates" className="space-y-6">
                <PostUpdatesTab projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="social" className="space-y-6">
                <SocialHubTab />
              </TabsContent>

              <TabsContent value="indiekit-v2" className="space-y-6">
                <IndieKitV2Tab projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="marketplace" className="space-y-6">
                <MarketplaceTab projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="collaborations" className="space-y-6">
                <CollaborationsTab />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6 mx-auto">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Select a project to view dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}
