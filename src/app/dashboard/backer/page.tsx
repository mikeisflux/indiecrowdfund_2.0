"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  TrendingUp,
  Sparkles,
  Search,
  MessageSquare,
  ArrowUpRight,
  BarChart3,
  Zap,
  Target,
  Calendar,
  Gift,
  AlertCircle,
} from "lucide-react";

interface BackedProject {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  creator: { name: string; avatar: string | null };
  status: string;
  goalAmount: number;
  currentAmount: number;
  daysRemaining: number;
  pledge: {
    id: string;
    amount: number;
    reward: string;
    pledgedAt: string;
    status: string;
  };
  estimatedDelivery: string | null;
  fulfillmentStatus: string;
  surveyCompleted: boolean;
  updates: number;
  backerCount: number;
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
  category: string;
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
  backedProjects: BackedProject[];
  savedProjects: SavedProject[];
  stats: DashboardStats;
  analytics: DashboardAnalytics;
}

export default function BackerDashboard() {
  const [activeTab, setActiveTab] = useState("backed");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                IndieCrowdfund
              </Link>
              <Badge variant="outline" className="border-primary/30 text-primary">
                <Sparkles className="w-3 h-3 mr-1" />
                Backer Dashboard
              </Badge>
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

  // Empty state
  if (!data || (data.backedProjects.length === 0 && data.savedProjects.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                IndieCrowdfund
              </Link>
              <Badge variant="outline" className="border-primary/30 text-primary">
                <Sparkles className="w-3 h-3 mr-1" />
                Backer Dashboard
              </Badge>
            </div>
          </div>
        </header>

        <div className="container relative py-16">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Heart className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">No backed projects yet</h1>
            <p className="text-muted-foreground mb-8">
              Discover amazing projects and support creators bringing their ideas to life.
            </p>
            <Link href="/discover">
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                <Search className="mr-2 h-5 w-5" />
                Explore Projects
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { backedProjects, savedProjects, stats, analytics } = data;

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
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="border-primary/30 text-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              Backer Dashboard
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {stats.pendingSurveys > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground font-bold">
                  {stats.pendingSurveys}
                </span>
              )}
            </Button>
            <Link href="/dashboard/messages">
              <Button variant="ghost" size="icon">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar className="ring-2 ring-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">U</AvatarFallback>
            </Avatar>
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
                Welcome back!
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

        {/* Stats Overview */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projects Backed
              </CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalBacked}</div>
              <p className="flex items-center text-xs text-green-500 mt-1">
                <TrendingUp className="mr-1 h-3 w-3" />
                {stats.successRate}% success rate
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-green-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/20 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Invested
              </CardTitle>
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats.totalPledged.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ~${stats.avgContribution.toFixed(0)} avg per project
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-blue-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Successfully Funded
              </CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.projectsFunded}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.rewardsDelivered} reward{analytics.rewardsDelivered !== 1 ? "s" : ""} delivered
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-purple-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/20 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rewards Pending
              </CardTitle>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Gift className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{analytics.rewardsPending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Track delivery status below
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-card/50 backdrop-blur border border-border/50 p-1">
                <TabsTrigger value="backed" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                  <Package className="mr-2 h-4 w-4" />
                  Backed ({backedProjects.length})
                </TabsTrigger>
                <TabsTrigger value="saved" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                  <Heart className="mr-2 h-4 w-4" />
                  Saved ({savedProjects.length})
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
                    const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

                    return (
                      <Card key={project.id} className="overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
                        <div className="flex flex-col md:flex-row">
                          {/* Project Image */}
                          <div className="relative aspect-video w-full bg-gradient-to-br from-muted to-muted/50 md:aspect-auto md:h-auto md:w-52 overflow-hidden">
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

                          {/* Project Info */}
                          <div className="flex flex-1 flex-col p-5">
                            <div className="mb-4 flex items-start justify-between">
                              <div>
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  {getStatusBadge(project.status)}
                                  {getFulfillmentBadge(project.fulfillmentStatus)}
                                </div>
                                <Link
                                  href={`/projects/${project.slug}`}
                                  className="text-lg font-semibold hover:text-primary transition-colors"
                                >
                                  {project.title}
                                </Link>
                                <p className="text-sm text-muted-foreground mt-1">
                                  by {project.creator.name}
                                </p>
                              </div>
                              <Link href={`/projects/${project.slug}`}>
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>

                            {/* Pledge Details */}
                            <div className="mb-4 rounded-xl bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/10 p-4">
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-green-500" />
                                  <span className="text-muted-foreground">Your pledge:</span>
                                  <span className="font-semibold">${project.pledge.amount}</span>
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
                                    ${project.currentAmount.toLocaleString()}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {" "}of ${project.goalAmount.toLocaleString()}
                                  </span>
                                </span>
                                <span className="text-muted-foreground">
                                  {project.daysRemaining > 0
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
                            <div className="flex items-center gap-2 mt-4">
                              <Link href={`/projects/${project.slug}`}>
                                <Button variant="outline" size="sm" className="hover:border-primary/50">
                                  <ExternalLink className="mr-2 h-3 w-3" />
                                  View Project
                                </Button>
                              </Link>
                              <Link href="/dashboard/messages">
                                <Button variant="outline" size="sm" className="hover:border-primary/50">
                                  <MessageSquare className="mr-2 h-3 w-3" />
                                  Message Creator
                                </Button>
                              </Link>
                              {project.fulfillmentStatus === "IN_PROGRESS" && !project.surveyCompleted && (
                                <Button size="sm" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                                  Complete Survey
                                </Button>
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
                      const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

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
                            >
                              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                            </Button>
                            <Badge className="absolute left-2 top-2 bg-gradient-to-r from-primary/80 to-purple-500/80 backdrop-blur">
                              {project.category}
                            </Badge>
                          </div>
                          <CardContent className="p-4">
                            <Link
                              href={`/projects/${project.slug}`}
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
                                {project.daysRemaining > 0
                                  ? `${project.daysRemaining} days left`
                                  : "Ended"}
                              </span>
                            </div>

                            <Link href={`/projects/${project.slug}/pledge`}>
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
            </Tabs>
          </div>

          {/* Sidebar - Analytics */}
          <div className="space-y-6">
            {/* Spending Analytics */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Backing Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mini chart */}
                <div className="h-32 flex items-end gap-1 mb-4">
                  {analytics.monthlySpending.map((item, i) => {
                    const maxAmount = Math.max(...analytics.monthlySpending.map((s) => s.amount), 1);
                    const heightPercent = item.amount > 0 ? Math.max((item.amount / maxAmount) * 100, 10) : 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-purple-500 rounded-t transition-all hover:opacity-80"
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground">{item.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  Last 6 months spending
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Deliveries */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  Upcoming Deliveries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {backedProjects.filter((p) => p.fulfillmentStatus !== "DELIVERED").length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No pending deliveries
                  </p>
                ) : (
                  backedProjects
                    .filter((p) => p.fulfillmentStatus !== "DELIVERED")
                    .slice(0, 5)
                    .map((project) => (
                      <div key={project.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center overflow-hidden">
                          {project.imageUrl ? (
                            <Image
                              src={project.imageUrl}
                              alt={project.title}
                              width={40}
                              height={40}
                              className="object-cover"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{project.title}</p>
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
            <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
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
