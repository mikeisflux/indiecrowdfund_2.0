"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Package,
  Clock,
  DollarSign,
  ExternalLink,
  Settings,
  Bell,
  CheckCircle,
  Truck,
  Sparkles,
  Search,
  MessageSquare,
  ArrowUpRight,
  ArrowLeft,
  BarChart3,
  Zap,
  Target,
  Calendar,
  Gift,
  AlertCircle,
  Loader2,
  Download,
  ClipboardList,
  MapPin,
  PieChart,
  FolderHeart,
  BellRing,
  Users,
  Library,
  Shield,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { formatTimeRemaining } from "@/lib/utils";
import {
  GlowingStatCard,
  AnimatedBarChart,
  DigitalDownloadsTab,
  SurveyHubTab,
  AddressManagementTab,
  SpendingAnalyticsTab,
  CollectionsTab,
  NotificationPreferencesTab,
  FollowingTab,
  DigitalLibraryTab,
  MessagesTab,
} from "./components";

interface BackedProject {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  creatorId: string;
  creator: { name: string; avatar: string | null };
  status: string;
  goalAmount: number;
  currentAmount: number;
  daysRemaining: number;
  endDate: string | null;
  pledge: {
    id: string;
    amount: number;
    reward: string;
    pledgedAt: string;
    status: string;
    backerNumber: number | null;
  };
  estimatedDelivery: string | null;
  fulfillmentStatus: string;
  surveyCompleted: boolean;
  hasSurvey: boolean;
  updates: number;
  backerCount: number;
  projectUrl: string;
}

interface SavedProject {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  creator: { name: string };
  status: string;
  goalAmount: number;
  currentAmount: number;
  daysRemaining: number;
  endDate: string | null;
  category: string;
  projectUrl: string;
}

interface DashboardStats {
  totalBacked: number;
  totalPledged: number;
  projectsFunded: number;
  surveysCompleted: number;
  pendingSurveys: number;
  avgContribution: number;
  successRate: number;
}

interface DashboardAnalytics {
  totalInvested: number;
  projectsSucceeded: number;
  projectsInProgress: number;
  rewardsDelivered: number;
  rewardsPending: number;
  monthlySpending: { month: string; amount: number }[];
}

interface DashboardData {
  user: {
    name: string | null;
  };
  backedProjects: BackedProject[];
  savedProjects: SavedProject[];
  stats: DashboardStats;
  analytics: DashboardAnalytics;
}

export default function BackerDashboard() {
  const searchParams = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);
  const initialTab = searchParams?.get("tab") || "backed";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAddress, setHasAddress] = useState<boolean | null>(null);

  // Auto-scroll to tabs section on mobile when tab param is present
  // Also handle scrollTo parameter for deep linking to specific content
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    const scrollToParam = searchParams?.get("scrollTo");

    if (tabParam) {
      // Check if mobile (screen width < 1024px which is lg breakpoint)
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        // If scrollTo parameter is present, scroll to that specific element
        if (scrollToParam) {
          const delay = 100;
          setTimeout(() => {
            const targetElement = document.getElementById(scrollToParam);
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (tabsRef.current) {
              // Fallback to tabs section if element not found
              tabsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, delay);
        } else if (tabsRef.current) {
          // Default: scroll to tabs section
          setTimeout(() => {
            tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }
      }
    }
  }, [searchParams]);

  const [unsavingProjectId, setUnsavingProjectId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const handleUnsaveProject = async (projectId: string) => {
    setUnsavingProjectId(projectId);
    try {
      const response = await apiFetch(`/api/user/following?projectId=${projectId}`, {
        method: "DELETE",
        
      });
      if (response.ok) {
        // Remove from local state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            savedProjects: prev.savedProjects.filter((p) => p.id !== projectId),
          };
        });
      } else {
        toast.error("Failed to unsave project. Please try again.");
      }
    } catch (err) {
      console.error("Failed to unsave project:", err);
      toast.error("Failed to unsave project. Please try again.");
    } finally {
      setUnsavingProjectId(null);
    }
  };

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch("/api/backer/dashboard");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Poll for updated stats every 30 seconds (only while data has loaded)
  const hasData = !!data;
  useEffect(() => {
    if (!hasData) return;

    const pollStats = async () => {
      try {
        const response = await fetch("/api/backer/dashboard", { cache: "no-store" });
        if (response.ok) {
          const freshData = await response.json();
          setData(freshData);
        }
      } catch {
        // Silently fail
      }
    };

    const intervalId = setInterval(pollStats, 30000);

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
  }, [hasData]);

  // Fetch unread messages count
  useEffect(() => {
    async function fetchUnreadMessages() {
      try {
        const response = await fetch("/api/messages?view=inbox");
        if (response.ok) {
          const data = await response.json();
          setUnreadMessages(data.totalUnread || 0);
        }
      } catch (err) {
        console.error("Failed to fetch unread messages:", err);
      }
    }

    fetchUnreadMessages();
  }, []);

  // Check if user has a saved shipping address
  useEffect(() => {
    async function checkAddress() {
      try {
        const response = await fetch("/api/backer/addresses");
        if (response.ok) {
          const data = await response.json();
          setHasAddress((data.addresses || []).length > 0);
        }
      } catch {
        // Silently fail — don't block dashboard
      }
    }
    checkAddress();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return (
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 border-0">
            <Zap className="w-3 h-3 mr-1" />
            Live
          </Badge>
        );
      case "FUNDED":
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0">
            <CheckCircle className="w-3 h-3 mr-1" />
            Funded
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-gradient-to-r from-purple-500 to-violet-600 border-0">
            <Gift className="w-3 h-3 mr-1" />
            Delivered
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFulfillmentBadge = (status: string) => {
    switch (status) {
      case "NOT_STARTED":
        return (
          <Badge variant="outline" className="text-muted-foreground border-dashed">
            <Clock className="mr-1 h-3 w-3" />
            Awaiting fulfillment
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/50">
            <Package className="mr-1 h-3 w-3" />
            Processing
          </Badge>
        );
      case "SHIPPED":
        return (
          <Badge variant="outline" className="text-blue-500 border-blue-500/50">
            <Truck className="mr-1 h-3 w-3" />
            Shipped
          </Badge>
        );
      case "DELIVERED":
        return (
          <Badge variant="outline" className="text-green-500 border-green-500/50">
            <CheckCircle className="mr-1 h-3 w-3" />
            Delivered
          </Badge>
        );
      default:
        return null;
    }
  };

  // Loading skeleton
  if (loading) {
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
                Backer Dashboard
              </h1>
            </div>
          </div>
        </header>

        <div className="container relative py-8">
          <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Failed to load dashboard</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Initialize empty data if not available
  const backedProjects = data?.backedProjects || [];
  const savedProjects = data?.savedProjects || [];
  const stats = data?.stats || {
    totalBacked: 0,
    totalPledged: 0,
    projectsCompleted: 0,
    pendingSurveys: 0,
    totalSaved: 0,
    activeProjects: 0,
    projectsShipped: 0,
    divinityCoinBalance: 0,
    successRate: 0,
    avgContribution: 0,
    projectsFunded: 0,
  };
  const analytics = data?.analytics || {
    monthlyPledges: [],
    categoryBreakdown: [],
    fulfillmentTimeline: [],
    rewardsDelivered: 0,
    rewardsPending: 0,
    monthlySpending: [],
  };

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
              Backer Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/dashboard/backer?tab=notifications">
              <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {stats.pendingSurveys > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground font-bold">
                    {stats.pendingSurveys}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/dashboard/backer?tab=messages">
              <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/dashboard/settings" className="hidden sm:block">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container relative py-8">
        {/* Hero Section with Explore CTA */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border border-border/50 p-8">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Welcome back{data?.user?.name ? `, ${data.user.name}` : ""}!
              </h1>
              <p className="text-muted-foreground text-lg">
                Discover new projects and track your backed campaigns
              </p>
            </div>
            <Link href="/discover">
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white shadow-lg shadow-primary/25 group">
                <Search className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                Explore Projects
                <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Overview - Animated */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <GlowingStatCard
            title="Projects Backed"
            value={stats.totalBacked}
            icon={Target}
            color="primary"
            trend={{ value: stats.successRate, label: "success rate" }}
            delay={0}
          />
          <GlowingStatCard
            title="Total Invested"
            value={Number(stats.totalPledged)}
            prefix="$"
            icon={DollarSign}
            color="green"
            subtitle={`~$${stats.avgContribution.toFixed(0)} avg per project`}
            delay={100}
          />
          <GlowingStatCard
            title="Successfully Funded"
            value={stats.projectsFunded}
            icon={CheckCircle}
            color="blue"
            subtitle={`${analytics.rewardsDelivered} reward${analytics.rewardsDelivered !== 1 ? "s" : ""} delivered`}
            delay={200}
          />
          <GlowingStatCard
            title="Rewards Pending"
            value={analytics.rewardsPending}
            icon={Gift}
            color="purple"
            subtitle="Track delivery status below"
            delay={300}
            pulse={analytics.rewardsPending > 0}
          />
        </div>

        {/* Shipping address reminder */}
        {hasAddress === false && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/30 p-5">
            <div className="flex gap-4">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 h-fit">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  Set up your shipping address
                </h3>
                <p className="text-sm text-amber-800/80 dark:text-amber-200/80 mt-1">
                  Adding a shipping address ensures you&apos;re charged the correct shipping rate when backing projects. This is especially important for international backers. Your address is private and will never be shared with other users.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setActiveTab("addresses")}
                >
                  <MapPin className="h-3.5 w-3.5 mr-2" />
                  Add Shipping Address
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2" ref={tabsRef}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-card/50 backdrop-blur border border-border/50 p-1 flex-wrap h-auto gap-1">
                <TabsTrigger value="backed" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                  <Package className="mr-2 h-4 w-4" />
                  Backed ({backedProjects.length})
                </TabsTrigger>
                <TabsTrigger value="saved" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                  <Heart className="mr-2 h-4 w-4" />
                  Saved ({savedProjects.length})
                </TabsTrigger>
                <TabsTrigger value="messages" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white relative">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Messages
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="downloads" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
                  <Download className="mr-2 h-4 w-4" />
                  Downloads
                </TabsTrigger>
                <TabsTrigger value="surveys" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white relative">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Surveys
                  {stats.pendingSurveys > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                      {stats.pendingSurveys}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="addresses" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white">
                  <MapPin className="mr-2 h-4 w-4" />
                  Addresses
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white">
                  <PieChart className="mr-2 h-4 w-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="collections" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-500 data-[state=active]:text-white">
                  <FolderHeart className="mr-2 h-4 w-4" />
                  Collections
                </TabsTrigger>
                <TabsTrigger value="notifications" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                  <BellRing className="mr-2 h-4 w-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="following" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
                  <Users className="mr-2 h-4 w-4" />
                  Following
                </TabsTrigger>
                <TabsTrigger value="digital-library" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
                  <Library className="mr-2 h-4 w-4" />
                  Digital Library
                </TabsTrigger>
              </TabsList>

              <TabsContent value="backed" className="space-y-4">
                {backedProjects.length === 0 ? (
                  <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="py-12 text-center">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No backed projects yet</p>
                      <Link href="/discover" className="inline-block mt-4">
                        <Button variant="outline">Explore Projects</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  backedProjects.map((project) => {
                    const fundingPercent = (Number(project.currentAmount) / Number(project.goalAmount)) * 100;

                    return (
                      <Card key={project.id} className="overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
                        <div className="flex flex-col md:flex-row">
                          {/* Project Image - 16:9 aspect ratio */}
                          <div className="relative w-full md:w-64 md:shrink-0 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                            <div className="aspect-video relative">
                              {project.imageUrl ? (
                                <Image
                                  src={project.imageUrl}
                                  alt={project.title}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                  <Package className="h-12 w-12 opacity-50" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex gap-1">
                                  <Badge variant="secondary" className="text-[10px] bg-black/50 backdrop-blur">
                                    {project.updates} updates
                                  </Badge>
                                  <Badge variant="secondary" className="text-[10px] bg-black/50 backdrop-blur">
                                    {project.backerCount} backers
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Project Info */}
                          <div className="flex flex-1 flex-col p-5">
                            <div className="mb-4 flex items-start justify-between">
                              <div>
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  {getStatusBadge(project.status)}
                                  {getFulfillmentBadge(project.fulfillmentStatus)}
                                </div>
                                <Link
                                  href={project.projectUrl}
                                  className="text-lg font-semibold hover:text-primary transition-colors"
                                >
                                  {project.title}
                                </Link>
                                <p className="text-sm text-muted-foreground mt-1">
                                  by {project.creator.name}
                                </p>
                              </div>
                              <Link href={project.projectUrl}>
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>

                            {/* Pledge Details */}
                            <div className="mb-4 rounded-xl bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/10 p-4">
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                {project.pledge.backerNumber && (
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-primary" />
                                    <span className="text-muted-foreground">Backer:</span>
                                    <span className="font-semibold">#{project.pledge.backerNumber}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-green-500" />
                                  <span className="text-muted-foreground">Your pledge:</span>
                                  <span className="font-semibold">${Number(project.pledge.amount).toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Gift className="h-4 w-4 text-purple-500" />
                                  <span className="text-muted-foreground">Reward:</span>
                                  <span className="font-semibold">{project.pledge.reward}</span>
                                </div>
                                {project.estimatedDelivery && (
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                    <span className="text-muted-foreground">Est. delivery:</span>
                                    <span className="font-semibold">
                                      {new Date(project.estimatedDelivery).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Funding Progress */}
                            <div className="mt-auto">
                              <div className="mb-2 flex items-center justify-between text-sm">
                                <span>
                                  <span className="font-semibold text-primary">
                                    ${Number(project.currentAmount).toLocaleString()}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {" "}of ${Number(project.goalAmount).toLocaleString()}
                                  </span>
                                </span>
                                <span className="text-muted-foreground">
                                  {project.endDate
                                    ? formatTimeRemaining(new Date(project.endDate))
                                    : project.daysRemaining > 0
                                    ? `${project.daysRemaining} days left`
                                    : "Campaign ended"}
                                </span>
                              </div>
                              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 mt-4">
                              <Link href={project.projectUrl}>
                                <Button variant="outline" size="sm" className="hover:border-primary/50">
                                  <ExternalLink className="mr-2 h-3 w-3" />
                                  View Project
                                </Button>
                              </Link>
                              <Link href={`/dashboard/pledges/${project.pledge.id}`}>
                                <Button variant="outline" size="sm" className="hover:border-primary/50">
                                  <Settings className="mr-2 h-3 w-3" />
                                  Manage Pledge
                                </Button>
                              </Link>
                              <Link href={`/dashboard/messages?projectId=${project.id}&recipientId=${project.creatorId}`} className="hidden sm:block">
                                <Button variant="outline" size="sm" className="hover:border-primary/50">
                                  <MessageSquare className="mr-2 h-3 w-3" />
                                  Message Creator
                                </Button>
                              </Link>
                              {!project.surveyCompleted && project.hasSurvey && (project.status === "FUNDED" || project.currentAmount >= project.goalAmount) && (
                                <Link href={`/dashboard/pledges/${project.pledge.id}/survey`}>
                                  <Button size="sm" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                                    Complete Survey
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="saved" className="space-y-4">
                {savedProjects.length === 0 ? (
                  <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="py-12 text-center">
                      <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No saved projects yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Save projects you&apos;re interested in backing later
                      </p>
                      <Link href="/discover" className="inline-block mt-4">
                        <Button variant="outline">Explore Projects</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {savedProjects.map((project) => {
                      const fundingPercent = (Number(project.currentAmount) / Number(project.goalAmount)) * 100;

                      return (
                        <Card key={project.id} className="overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
                          <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50">
                            {project.imageUrl ? (
                              <Image
                                src={project.imageUrl}
                                alt={project.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                <Package className="h-12 w-12 opacity-50" />
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2 bg-background/80 hover:bg-background backdrop-blur"
                              onClick={() => handleUnsaveProject(project.id)}
                              disabled={unsavingProjectId === project.id}
                            >
                              {unsavingProjectId === project.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                              )}
                            </Button>
                            <Badge className="absolute left-2 top-2 bg-gradient-to-r from-primary/80 to-purple-500/80 backdrop-blur">
                              {project.category}
                            </Badge>
                          </div>
                          <CardContent className="p-4">
                            <Link
                              href={project.projectUrl}
                              className="mb-1 block font-semibold hover:text-primary transition-colors"
                            >
                              {project.title}
                            </Link>
                            <p className="mb-4 text-sm text-muted-foreground">
                              by {project.creator.name}
                            </p>

                            <div className="relative h-2 overflow-hidden rounded-full bg-muted mb-2">
                              <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 rounded-full"
                                style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-primary">
                                {fundingPercent.toFixed(0)}% funded
                              </span>
                              <span className="text-muted-foreground">
                                {project.endDate
                                  ? formatTimeRemaining(new Date(project.endDate))
                                  : project.daysRemaining > 0
                                  ? `${project.daysRemaining} days left`
                                  : "Ended"}
                              </span>
                            </div>

                            <Link href={`${project.projectUrl}/pledge`}>
                              <Button className="mt-4 w-full bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90" size="sm">
                                Back this project
                              </Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="space-y-4">
                <MessagesTab />
              </TabsContent>

              {/* Downloads Tab */}
              <TabsContent value="downloads" className="space-y-4">
                <DigitalDownloadsTab />
              </TabsContent>

              {/* Surveys Tab */}
              <TabsContent value="surveys" className="space-y-4">
                <SurveyHubTab />
              </TabsContent>

              {/* Address Management Tab */}
              <TabsContent value="addresses" className="space-y-4">
                <AddressManagementTab />
              </TabsContent>

              {/* Spending Analytics Tab */}
              <TabsContent value="analytics" className="space-y-4">
                <SpendingAnalyticsTab />
              </TabsContent>

              {/* Collections Tab */}
              <TabsContent value="collections" className="space-y-4">
                <CollectionsTab />
              </TabsContent>

              {/* Notification Preferences Tab */}
              <TabsContent value="notifications" className="space-y-4">
                <NotificationPreferencesTab />
              </TabsContent>

              {/* Following Tab */}
              <TabsContent value="following" className="space-y-4">
                <FollowingTab />
              </TabsContent>

              {/* Digital Library Tab */}
              <TabsContent value="digital-library" className="space-y-4">
                <DigitalLibraryTab />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Analytics */}
          <div className="space-y-6">
            {/* Spending Analytics - Animated */}
            <Card className="glass-card glass-card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-primary/20">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  Backing Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatedBarChart
                  data={analytics.monthlySpending.map((item) => ({
                    label: item.month,
                    value: item.amount,
                  }))}
                  height={128}
                  showGlow
                  color="primary"
                />
                <div className="text-sm text-muted-foreground text-center mt-2">
                  Last 6 months spending
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Deliveries - Animated */}
            <Card className="glass-card glass-card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-purple-500/20">
                    <Calendar className="h-4 w-4 text-purple-500" />
                  </div>
                  Upcoming Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {backedProjects.filter((p) => p.fulfillmentStatus !== "DELIVERED").length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All rewards delivered!
                    </p>
                  </div>
                ) : (
                  backedProjects
                    .filter((p) => p.fulfillmentStatus !== "DELIVERED")
                    .slice(0, 5)
                    .map((project, index) => (
                      <div
                        key={project.id}
                        className="group flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-all duration-300 animate-in fade-in slide-in-from-left"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
                          {project.imageUrl ? (
                            <Image
                              src={project.imageUrl}
                              alt={project.title}
                              width={40}
                              height={40}
                              className="object-cover group-hover:scale-110 transition-transform"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                          {project.fulfillmentStatus === "SHIPPED" && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full live-indicator" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{project.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.estimatedDelivery
                              ? `Est. ${new Date(project.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                              : "Delivery TBD"}
                          </p>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card className="glass-card bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Recommended for You
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {backedProjects.length > 0
                    ? `Based on your backed projects`
                    : "Discover projects you might like"}
                </p>
                <Link href="/discover">
                  <Button variant="outline" className="w-full hover:border-primary/50 hover:bg-primary/5">
                    <Search className="mr-2 h-4 w-4" />
                    Discover Similar Projects
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
}
