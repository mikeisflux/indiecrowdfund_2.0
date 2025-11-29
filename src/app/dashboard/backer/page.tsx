"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";

// Mock data
const mockBackedProjects = [
  {
    id: "1",
    title: "Revolutionary Solar-Powered Backpack",
    slug: "solar-powered-backpack",
    imageUrl: "/placeholder-1.jpg",
    creator: { name: "Green Tech Labs", avatar: null },
    status: "LIVE",
    goalAmount: 50000,
    currentAmount: 42500,
    daysRemaining: 12,
    pledge: {
      amount: 199,
      reward: "Deluxe Bundle",
      pledgedAt: new Date("2024-01-18"),
      status: "COMPLETED",
    },
    estimatedDelivery: new Date("2024-08-01"),
    fulfillmentStatus: "NOT_STARTED",
    updates: 5,
    backerCount: 847,
  },
  {
    id: "2",
    title: "The Art of Mindful Living",
    slug: "art-of-mindful-living",
    imageUrl: "/placeholder-2.jpg",
    creator: { name: "Sarah Chen", avatar: null },
    status: "FUNDED",
    goalAmount: 15000,
    currentAmount: 18720,
    daysRemaining: 0,
    pledge: {
      amount: 45,
      reward: "Hardcover Book",
      pledgedAt: new Date("2023-11-05"),
      status: "COMPLETED",
    },
    estimatedDelivery: new Date("2024-03-01"),
    fulfillmentStatus: "IN_PROGRESS",
    surveyCompleted: true,
    updates: 12,
    backerCount: 423,
  },
  {
    id: "3",
    title: "Indie Game: Lost Horizons",
    slug: "lost-horizons-game",
    imageUrl: "/placeholder-3.jpg",
    creator: { name: "Pixel Dreams Studio", avatar: null },
    status: "LIVE",
    goalAmount: 100000,
    currentAmount: 67800,
    daysRemaining: 28,
    pledge: {
      amount: 60,
      reward: "Digital Deluxe Edition",
      pledgedAt: new Date("2024-01-10"),
      status: "COMPLETED",
    },
    estimatedDelivery: new Date("2024-12-01"),
    fulfillmentStatus: "NOT_STARTED",
    updates: 3,
    backerCount: 1256,
  },
];

const mockSavedProjects = [
  {
    id: "4",
    title: "Smart Home Music System",
    slug: "smart-music-system",
    imageUrl: "/placeholder-4.jpg",
    creator: { name: "AudioTech Labs" },
    status: "LIVE",
    goalAmount: 200000,
    currentAmount: 156000,
    daysRemaining: 18,
    category: "Technology",
  },
  {
    id: "5",
    title: "Documentary: Ocean Guardians",
    slug: "ocean-guardians-doc",
    imageUrl: "/placeholder-5.jpg",
    creator: { name: "Blue Planet Films" },
    status: "LIVE",
    goalAmount: 75000,
    currentAmount: 45000,
    daysRemaining: 35,
    category: "Film",
  },
];

const mockStats = {
  totalBacked: 3,
  totalPledged: 304,
  projectsFunded: 2,
  surveysCompleted: 1,
  pendingSurveys: 0,
  avgContribution: 101.33,
  successRate: 66.7,
};

// Analytics data for backed campaigns
const mockAnalytics = {
  totalInvested: 304,
  projectsSucceeded: 2,
  projectsInProgress: 1,
  rewardsDelivered: 1,
  rewardsPending: 2,
  monthlySpending: [
    { month: "Aug", amount: 0 },
    { month: "Sep", amount: 45 },
    { month: "Oct", amount: 0 },
    { month: "Nov", amount: 0 },
    { month: "Dec", amount: 60 },
    { month: "Jan", amount: 199 },
  ],
};

export default function BackerDashboard() {
  const [activeTab, setActiveTab] = useState("backed");

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
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground font-bold">
                3
              </span>
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
              <AvatarImage src="/avatar.jpg" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">JD</AvatarFallback>
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
                Welcome back! <span className="inline-block animate-bounce">👋</span>
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
              <div className="text-3xl font-bold">{mockStats.totalBacked}</div>
              <p className="flex items-center text-xs text-green-500 mt-1">
                <TrendingUp className="mr-1 h-3 w-3" />
                {mockStats.successRate}% success rate
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
              <div className="text-3xl font-bold">${mockStats.totalPledged}</div>
              <p className="text-xs text-muted-foreground mt-1">
                ~${mockStats.avgContribution.toFixed(0)} avg per project
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
              <div className="text-3xl font-bold">{mockStats.projectsFunded}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {mockAnalytics.rewardsDelivered} reward delivered
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
              <div className="text-3xl font-bold">{mockAnalytics.rewardsPending}</div>
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
                  Backed ({mockBackedProjects.length})
                </TabsTrigger>
                <TabsTrigger value="saved" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                  <Heart className="mr-2 h-4 w-4" />
                  Saved ({mockSavedProjects.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="backed" className="space-y-4">
                {mockBackedProjects.map((project) => {
                  const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

                  return (
                    <Card key={project.id} className="overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
                      <div className="flex flex-col md:flex-row">
                        {/* Project Image */}
                        <div className="relative aspect-video w-full bg-gradient-to-br from-muted to-muted/50 md:aspect-auto md:h-auto md:w-52 overflow-hidden">
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            <Package className="h-12 w-12 opacity-50" />
                          </div>
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
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                <span className="text-muted-foreground">Est. delivery:</span>
                                <span className="font-semibold">
                                  {project.estimatedDelivery.toLocaleDateString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
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
                })}
              </TabsContent>

              <TabsContent value="saved" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {mockSavedProjects.map((project) => {
                    const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

                    return (
                      <Card key={project.id} className="overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
                        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/50">
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            <Package className="h-12 w-12 opacity-50" />
                          </div>
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
                              {project.daysRemaining} days left
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
                  {mockAnalytics.monthlySpending.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-gradient-to-t from-primary to-purple-500 rounded-t transition-all hover:opacity-80"
                        style={{ height: `${item.amount > 0 ? Math.max((item.amount / 200) * 100, 10) : 4}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{item.month}</span>
                    </div>
                  ))}
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
                {mockBackedProjects
                  .filter((p) => p.fulfillmentStatus !== "DELIVERED")
                  .map((project) => (
                    <div key={project.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{project.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Est. {project.estimatedDelivery.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  ))}
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
                  Based on your backed projects in Technology and Games
                </p>
                <Link href="/discover?category=technology">
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
