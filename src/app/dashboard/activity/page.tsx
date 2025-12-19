"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Sparkles,
  AlertCircle,
  DollarSign,
  FileText,
  MessageSquare,
  Trophy,
  Rocket,
  ExternalLink,
  Bell,
  Heart,
  Users,
  Package,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";

interface ActivityItem {
  id: string;
  type: "pledge" | "update" | "comment" | "message" | "project_funded" | "project_launched";
  title: string;
  description: string;
  projectId?: string;
  projectTitle?: string;
  projectSlug?: string;
  projectUrl?: string;
  projectImage?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ActivityStats {
  totalBacked: number;
  totalFollowing: number;
  unreadMessages: number;
  recentActivity: number;
}

interface ActivityData {
  activities: ActivityItem[];
  stats: ActivityStats;
}

export default function ActivityPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch("/api/user/activity");
      if (!res.ok) throw new Error("Failed to fetch activity");
      const activityData = await res.json();
      setData(activityData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "pledge":
        return <DollarSign className="h-5 w-5 text-green-500" />;
      case "update":
        return <FileText className="h-5 w-5 text-blue-500" />;
      case "comment":
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      case "message":
        return <MessageSquare className="h-5 w-5 text-amber-500" />;
      case "project_funded":
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case "project_launched":
        return <Rocket className="h-5 w-5 text-primary" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case "pledge":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
            Backed
          </Badge>
        );
      case "update":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            Update
          </Badge>
        );
      case "message":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            Message
          </Badge>
        );
      case "project_funded":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
            Funded
          </Badge>
        );
      case "project_launched":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/30">
            Launched
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const groupActivitiesByDate = (activities: ActivityItem[]) => {
    const groups: { [key: string]: ActivityItem[] } = {};

    activities.forEach((activity) => {
      const date = new Date(activity.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = "Yesterday";
      } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
        key = "This Week";
      } else if (date > new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) {
        key = "This Month";
      } else {
        key = "Earlier";
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(activity);
    });

    return groups;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center">
            <Link href="/" className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="ml-4 border-primary/30 text-primary hidden sm:flex">
              <Activity className="w-3 h-3 mr-1" />
              Activity
            </Badge>
          </div>
        </header>

        <div className="container py-8 max-w-3xl">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Failed to load activity</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchData()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { activities, stats } = data;
  const groupedActivities = groupActivitiesByDate(activities);
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Earlier"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Activity
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Link href="/dashboard" className="hidden sm:block">
              <Button variant="ghost" size="sm">Back to Dashboard</Button>
            </Link>
            <Link href="/dashboard" className="sm:hidden">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-3xl relative">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 text-center">
              <Package className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.totalBacked}</p>
              <p className="text-xs text-muted-foreground">Backed</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 text-center">
              <Heart className="h-6 w-6 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{stats.totalFollowing}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 text-center">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold">{stats.unreadMessages}</p>
              <p className="text-xs text-muted-foreground">Unread</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 text-center">
              <Activity className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{stats.recentActivity}</p>
              <p className="text-xs text-muted-foreground">Activities</p>
            </CardContent>
          </Card>
        </div>

        {activities.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Your activity feed will show updates from projects you back and follow.
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/discover">
                  <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                    Discover Projects
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupOrder.map((groupName) => {
              const groupActivities = groupedActivities[groupName];
              if (!groupActivities || groupActivities.length === 0) return null;

              return (
                <div key={groupName}>
                  <h2 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                    <span className="h-px flex-1 bg-border" />
                    {groupName}
                    <span className="h-px flex-1 bg-border" />
                  </h2>

                  <div className="space-y-3">
                    {groupActivities.map((activity) => (
                      <Card
                        key={activity.id}
                        className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all group"
                      >
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            {/* Icon */}
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                {getActivityIcon(activity.type)}
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    {getActivityBadge(activity.type)}
                                    <span className="text-xs text-muted-foreground">
                                      {formatTimeAgo(activity.timestamp)}
                                    </span>
                                  </div>
                                  <p className="font-medium text-sm">{activity.title}</p>
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {activity.description}
                                  </p>
                                </div>

                                {/* Project thumbnail */}
                                {(activity.projectUrl || activity.projectSlug) && (
                                  <Link
                                    href={activity.projectUrl || `/projects/${activity.projectSlug}`}
                                    className="flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                                  >
                                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden relative">
                                      {activity.projectImage ? (
                                        <Image
                                          src={activity.projectImage}
                                          alt={activity.projectTitle || ""}
                                          fill
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Package className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                  </Link>
                                )}
                              </div>

                              {/* Action button */}
                              {(activity.projectUrl || activity.projectSlug) && (
                                <div className="mt-3">
                                  <Link href={activity.projectUrl || `/projects/${activity.projectSlug}`}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View Project
                                    </Button>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        <Card className="mt-8 bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link href="/dashboard/backer">
              <Button variant="outline" size="sm">
                <Package className="mr-2 h-4 w-4" />
                View Backed Projects
              </Button>
            </Link>
            <Link href="/dashboard/following">
              <Button variant="outline" size="sm">
                <Heart className="mr-2 h-4 w-4" />
                View Following
              </Button>
            </Link>
            <Link href="/dashboard/messages">
              <Button variant="outline" size="sm">
                <MessageSquare className="mr-2 h-4 w-4" />
                Messages
                {stats.unreadMessages > 0 && (
                  <Badge className="ml-2 h-5 px-1.5 bg-amber-500 border-0">
                    {stats.unreadMessages}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link href="/discover">
              <Button variant="outline" size="sm">
                <Users className="mr-2 h-4 w-4" />
                Discover More
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
