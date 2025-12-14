"use client";


import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Heart,
  Sparkles,
  AlertCircle,
  Search,
  ExternalLink,
  UserMinus,
  FolderHeart,
  TrendingUp,
  Calendar,
  Target,
  Clock,
  Rocket,
  ArrowLeft,
} from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";

interface FollowedProject {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  status: string;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  launchDate: string | null;
  endDate: string | null;
  category: string;
  creator: {
    id: string;
    name: string | null;
    image: string | null;
  };
  followedAt: string;
  isPrelaunch: boolean;
}

interface FollowedCreator {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  projectCount: number;
  recentProjects: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    status: string;
  }[];
}

interface FollowingData {
  followedProjects: FollowedProject[];
  followedCreators: FollowedCreator[];
}

export default function FollowingPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<FollowingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("projects");
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/user/following");
        if (!res.ok) throw new Error("Failed to fetch following data");
        const followingData = await res.json();
        setData(followingData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchData();
    }
  }, [session]);

  const handleUnfollowProject = async (projectId: string) => {
    setUnfollowingId(projectId);
    try {
      const res = await fetch(`/api/user/following?projectId=${projectId}`, {
        method: "DELETE",
      });
      if (res.ok && data) {
        setData({
          ...data,
          followedProjects: data.followedProjects.filter((p) => p.id !== projectId),
        });
      }
    } catch (err) {
      console.error("Failed to unfollow:", err);
    } finally {
      setUnfollowingId(null);
    }
  };

  const handleUnfollowCreator = async (creatorId: string) => {
    setUnfollowingId(creatorId);
    try {
      const res = await fetch(`/api/user/following?creatorId=${creatorId}`, {
        method: "DELETE",
      });
      if (res.ok && data) {
        setData({
          ...data,
          followedCreators: data.followedCreators.filter((c) => c.id !== creatorId),
        });
      }
    } catch (err) {
      console.error("Failed to unfollow:", err);
    } finally {
      setUnfollowingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return (
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 border-0">
            <Rocket className="w-3 h-3 mr-1" />
            Live
          </Badge>
        );
      case "FUNDED":
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0">
            <Target className="w-3 h-3 mr-1" />
            Funded
          </Badge>
        );
      case "DRAFT":
      case "SUBMITTED":
        return (
          <Badge variant="outline" className="border-amber-500/50 text-amber-500">
            <Clock className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
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
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="ml-4 border-primary/30 text-primary">
              <Users className="w-3 h-3 mr-1" />
              Following
            </Badge>
          </div>
        </header>

        <div className="container py-8 max-w-5xl">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-24 w-32 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-2 w-full" />
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
            <h2 className="text-lg font-semibold mb-2">Failed to load following</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { followedProjects, followedCreators } = data;

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
            <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Following
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="hidden sm:block">
              <Button variant="ghost" size="sm">Back to Dashboard</Button>
            </Link>
            <Link href="/dashboard" className="sm:hidden">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/discover">
              <Button size="sm" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                <Search className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Discover</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-5xl relative">
        {/* Stats Header */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <FolderHeart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{followedProjects.length}</p>
                  <p className="text-sm text-muted-foreground">Projects Following</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{followedCreators.length}</p>
                  <p className="text-sm text-muted-foreground">Creators Following</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card/50 backdrop-blur border border-border/50 p-1">
            <TabsTrigger
              value="projects"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <FolderHeart className="mr-2 h-4 w-4" />
              Projects ({followedProjects.length})
            </TabsTrigger>
            <TabsTrigger
              value="creators"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Users className="mr-2 h-4 w-4" />
              Creators ({followedCreators.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            {followedProjects.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="py-16 text-center">
                  <Heart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No followed projects yet</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Follow projects to get notified about updates, funding milestones, and when they launch.
                  </p>
                  <Link href="/discover">
                    <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                      <Search className="mr-2 h-4 w-4" />
                      Discover Projects
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              followedProjects.map((project) => {
                const fundingPercent = (project.currentAmount / project.goalAmount) * 100;
                const daysRemaining = getDaysRemaining(project.endDate);

                return (
                  <Card
                    key={project.id}
                    className="overflow-hidden bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex flex-col md:flex-row">
                      <div className="relative aspect-video md:aspect-auto md:w-48 md:h-auto bg-muted overflow-hidden">
                        {project.imageUrl ? (
                          <Image
                            src={project.imageUrl}
                            alt={project.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FolderHeart className="h-12 w-12 text-muted-foreground opacity-50" />
                          </div>
                        )}
                        {project.isPrelaunch && (
                          <div className="absolute top-2 left-2">
                            <Badge className="bg-amber-500 border-0">Pre-launch</Badge>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusBadge(project.status)}
                              <Badge variant="outline" className="text-xs">
                                {project.category}
                              </Badge>
                            </div>
                            <Link
                              href={`/projects/${project.slug}`}
                              className="text-lg font-semibold hover:text-primary transition-colors"
                            >
                              {project.title}
                            </Link>
                            <p className="text-sm text-muted-foreground mt-1">
                              by {project.creator.name || "Unknown"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link href={`/projects/${project.slug}`}>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleUnfollowProject(project.id)}
                              disabled={unfollowingId === project.id}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {project.status === "LIVE" && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span>
                                <span className="font-semibold text-primary">
                                  ${project.currentAmount.toLocaleString()}
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}of ${project.goalAmount.toLocaleString()}
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                {daysRemaining !== null ? `${daysRemaining} days left` : ""}
                              </span>
                            </div>
                            <Progress value={Math.min(fundingPercent, 100)} className="h-2" />
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {fundingPercent.toFixed(0)}% funded
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {project.backerCount} backers
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Following since {new Date(project.followedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="creators" className="space-y-4">
            {followedCreators.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardContent className="py-16 text-center">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No followed creators yet</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Follow creators to get notified when they launch new projects.
                  </p>
                  <Link href="/discover">
                    <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                      <Search className="mr-2 h-4 w-4" />
                      Discover Creators
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {followedCreators.map((creator) => (
                  <Card
                    key={creator.id}
                    className="bg-card/50 backdrop-blur border-border/50 hover:border-primary/30 transition-all"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                          <AvatarImage src={creator.image || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white text-lg">
                            {creator.name?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold truncate">{creator.name || "Unknown Creator"}</h3>
                              <p className="text-sm text-muted-foreground">
                                {creator.projectCount} project{creator.projectCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive -mr-2"
                              onClick={() => handleUnfollowCreator(creator.id)}
                              disabled={unfollowingId === creator.id}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>

                          {creator.bio && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {creator.bio}
                            </p>
                          )}

                          {creator.recentProjects.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs text-muted-foreground mb-2">Recent projects:</p>
                              <div className="flex gap-2">
                                {creator.recentProjects.map((project) => (
                                  <Link
                                    key={project.id}
                                    href={`/projects/${project.slug}`}
                                    className="block"
                                  >
                                    <div className="w-12 h-12 rounded bg-muted overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all">
                                      {project.imageUrl ? (
                                        <Image
                                          src={project.imageUrl}
                                          alt={project.title}
                                          width={48}
                                          height={48}
                                          className="object-cover w-full h-full"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <FolderHeart className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                      )}
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
