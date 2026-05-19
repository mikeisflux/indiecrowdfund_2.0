"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Users,
  UserPlus,
  UserMinus,
  ExternalLink,
  Package,
  AlertCircle,
  Loader2,
  Sparkles,
  Activity,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

interface Creator {
  id: string;
  name: string;
  image?: string;
  vanityUrl?: string;
  bio?: string;
  projectCount: number;
  totalBackers: number;
  followedAt: string;
  notifyNewProjects: boolean;
  notifyUpdates: boolean;
  recentProjects: Array<{
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
    status: string;
  }>;
}

interface ActivityItem {
  id: string;
  type: "new_project" | "update" | "funded" | "launched";
  creatorName: string;
  creatorImage?: string;
  projectTitle: string;
  projectUrl: string;
  timestamp: string;
}

interface FollowingData {
  creators: Creator[];
  activity: ActivityItem[];
  stats: {
    totalFollowing: number;
    totalProjects: number;
    recentUpdates: number;
  };
}

export function FollowingTab() {
  const [data, setData] = useState<FollowingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchFollowing();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchFollowing = async () => {
    try {
      const response = await fetch("/api/backer/following", {
        
      });
      if (!response.ok) throw new Error("Failed to fetch following");
      const followingData = await response.json();
      setData(followingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (creatorId: string) => {
    setUnfollowing(creatorId);
    try {
      const response = await apiFetch(`/api/backer/following/${creatorId}`, {
        method: "DELETE",
        
      });

      if (!response.ok) throw new Error("Failed to unfollow");
      toast.success("Unfollowed creator");
      fetchFollowing();
    } catch {
      toast.error("Failed to unfollow");
    } finally {
      setUnfollowing(null);
    }
  };

  const updateNotificationPref = async (
    creatorId: string,
    key: "notifyNewProjects" | "notifyUpdates",
    value: boolean
  ) => {
    if (!data) return;

    setUpdating(creatorId);
    try {
      const response = await apiFetch(`/api/backer/following/${creatorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) throw new Error("Failed to update preference");

      setData({
        ...data,
        creators: data.creators.map((c) =>
          c.id === creatorId ? { ...c, [key]: value } : c
        ),
      });
      toast.success("Preference updated");
    } catch {
      toast.error("Failed to update preference");
    } finally {
      setUpdating(null);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "new_project":
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      case "update":
        return <Activity className="h-4 w-4 text-blue-400" />;
      case "funded":
        return <TrendingUp className="h-4 w-4 text-emerald-400" />;
      case "launched":
        return <Package className="h-4 w-4 text-amber-400" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load following</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchFollowing}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          Following Creators
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Stay updated on your favorite creators&apos; projects
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card className="glass-card glass-card-hover">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats?.totalFollowing ?? 0}</p>
                <p className="text-sm text-muted-foreground">Creators Following</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Package className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats?.totalProjects ?? 0}</p>
                <p className="text-sm text-muted-foreground">Their Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Activity className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats?.recentUpdates ?? 0}</p>
                <p className="text-sm text-muted-foreground">Recent Updates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="creators" className="space-y-4">
        <TabsList className="bg-card/50 backdrop-blur border border-border/50">
          <TabsTrigger value="creators">
            <Users className="h-4 w-4 mr-2" />
            Creators ({data.creators.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Activity Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="creators" className="space-y-4">
          {data.creators.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 glow-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UserPlus className="h-10 w-10 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Not following anyone yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Follow creators to get notified when they launch new projects or post updates.
                </p>
                <Link href="/crowdfunds">
                  <Button className="bg-gradient-to-r from-primary to-purple-500">
                    Discover Creators
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.creators.map((creator, index) => (
                <Card
                  key={creator.id}
                  className={cn(
                    "glass-card glass-card-hover overflow-hidden",
                    "animate-in fade-in slide-in-from-bottom"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                        {creator.image && <AvatarImage src={creator.image} />}
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-lg">
                          {creator.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={creator.vanityUrl ? `/${creator.vanityUrl}` : `/creators/${creator.id}`}
                            className="font-semibold hover:text-primary transition-colors"
                          >
                            {creator.name}
                          </Link>
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <Link href={creator.vanityUrl ? `/${creator.vanityUrl}` : `/creators/${creator.id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                        {creator.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {creator.bio}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {creator.projectCount} projects
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {creator.totalBackers.toLocaleString()} backers
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnfollow(creator.id)}
                        disabled={unfollowing === creator.id}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        {unfollowing === creator.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserMinus className="h-4 w-4 mr-1" />
                            Unfollow
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Notification Preferences */}
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Notification preferences</p>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`new-projects-${creator.id}`}
                            checked={creator.notifyNewProjects}
                            onCheckedChange={(checked) =>
                              updateNotificationPref(creator.id, "notifyNewProjects", checked)
                            }
                            disabled={updating === creator.id}
                            className="scale-75"
                          />
                          <label
                            htmlFor={`new-projects-${creator.id}`}
                            className="text-xs cursor-pointer"
                          >
                            New projects
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`updates-${creator.id}`}
                            checked={creator.notifyUpdates}
                            onCheckedChange={(checked) =>
                              updateNotificationPref(creator.id, "notifyUpdates", checked)
                            }
                            disabled={updating === creator.id}
                            className="scale-75"
                          />
                          <label
                            htmlFor={`updates-${creator.id}`}
                            className="text-xs cursor-pointer"
                          >
                            Project updates
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Recent Projects */}
                    {creator.recentProjects.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Recent projects</p>
                        <div className="flex gap-2">
                          {creator.recentProjects.slice(0, 3).map((project) => (
                            <Link
                              key={project.id}
                              href={`/projects/${project.slug}`}
                              className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted group"
                            >
                              {project.imageUrl ? (
                                <Image
                                  src={project.imageUrl}
                                  alt={project.title}
                                  fill
                                  className="object-cover group-hover:scale-110 transition-transform"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Package className="h-6 w-6 text-muted-foreground/30" />
                                </div>
                              )}
                              <Badge
                                className={cn(
                                  "absolute bottom-1 right-1 text-[8px] px-1",
                                  project.status === "LIVE" && "bg-emerald-500",
                                  project.status === "FUNDED" && "bg-blue-500"
                                )}
                              >
                                {project.status}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          {data.activity.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No recent activity</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {data.activity.map((item, index) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border border-border/50",
                        "bg-gradient-to-r from-muted/20 to-transparent",
                        "hover:border-primary/30 transition-all",
                        "animate-in fade-in slide-in-from-left"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <Avatar className="h-10 w-10">
                        {item.creatorImage && <AvatarImage src={item.creatorImage} />}
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20">
                          {item.creatorName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{item.creatorName}</span>
                          {" "}
                          {item.type === "new_project" && "launched a new project"}
                          {item.type === "update" && "posted an update on"}
                          {item.type === "funded" && "successfully funded"}
                          {item.type === "launched" && "went live with"}
                        </p>
                        <Link
                          href={item.projectUrl}
                          className="text-sm text-primary hover:underline truncate block"
                        >
                          {item.projectTitle}
                        </Link>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.timestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="p-2 rounded-lg bg-muted/30">
                        {getActivityIcon(item.type)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
