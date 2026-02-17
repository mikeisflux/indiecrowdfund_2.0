import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Play,
  Users,
  Clock,
  Rocket,
  Heart,
  Zap,
  Eye,
  Sparkles,
  Archive,
  CheckCircle,
  TrendingUp,
  Award,
  Target,
  Bookmark,
  Store,
} from "lucide-react";
import { Footer } from "@/components/footer";
import { HeroSlider } from "@/components/hero-slider";
import { getPlatformStats, getRetailerStats } from "@/lib/stats/actions";
import { formatCurrency, formatNumber } from "@/lib/stats/utils";
import { db } from "@/lib/db";
import { formatTimeRemaining } from "@/lib/utils";
import { auth } from "@/lib/auth";

// Force dynamic rendering to ensure database is available
export const dynamic = "force-dynamic";

/*
 * #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE#
 */

// Fetch featured/live projects from database (excludes closed campaigns)
async function getFeaturedProjects() {
  try {
    const now = new Date();
    const projects = await db.project.findMany({
      where: {
        status: "LIVE",
        // Only include projects that haven't ended yet
        OR: [
          { endDate: null },
          { endDate: { gt: now } },
        ],
        // Hide test projects from home page
        NOT: {
          title: { contains: "test", mode: "insensitive" },
        },
      },
      include: {
        creator: {
          select: {
            name: true,
            vanityUrl: true,
          },
        },
      },
      orderBy: {
        currentAmount: "desc",
      },
      take: 6,
    });

    return projects.map((project) => {
      // Calculate days remaining
      let daysRemaining = 0;
      if (project.endDate) {
        const now = new Date();
        const end = new Date(project.endDate);
        daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Build project URL - use vanity URL if creator has one
      const projectUrl = project.creator.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}`
        : `/projects/${project.slug}`;

      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        subtitle: project.subtitle || "",
        category: project.category,
        imageUrl: project.imageUrl || "",
        creator: project.creator.name || "Creator",
        goalAmount: project.goalAmount,
        currentAmount: project.currentAmount,
        backerCount: project.backerCount,
        daysRemaining,
        endDate: project.endDate?.toISOString() || null,
        projectUrl,
      };
    });
  } catch (error) {
    console.error("Error fetching featured projects:", error);
    return [];
  }
}

// Fetch projects in prelaunch from database
async function getPrelaunchProjects() {
  try {
    const projects = await db.project.findMany({
      where: {
        prelaunchActive: true,
        status: {
          notIn: ["LIVE", "FUNDED"], // Exclude projects that are already live or funded
        },
        // Hide test projects from home page
        NOT: {
          title: { contains: "test", mode: "insensitive" },
        },
      },
      include: {
        creator: {
          select: {
            name: true,
            vanityUrl: true,
          },
        },
        _count: {
          select: {
            followers: true,
          },
        },
      },
      orderBy: [
        { launchDate: "asc" }, // Soonest launch date first
        { createdAt: "desc" }, // Fallback for projects without launch date
      ],
      take: 6,
    });

    return projects.map((project) => {
      // Build project URL - use vanity URL if creator has one
      const projectUrl = project.creator.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}/prelaunch`
        : `/projects/${project.slug}/prelaunch`;

      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        subtitle: project.subtitle || "",
        category: project.category,
        imageUrl: project.imageUrl || "",
        creator: project.creator.name || "Creator",
        followerCount: project._count.followers,
        launchDate: project.launchDate,
        projectUrl,
      };
    });
  } catch (error) {
    console.error("Error fetching prelaunch projects:", error);
    return [];
  }
}

// Fetch past/closed campaigns from database
async function getPastCampaigns() {
  try {
    const now = new Date();
    const projects = await db.project.findMany({
      where: {
        OR: [
          {
            // Live projects that have ended
            status: "LIVE",
            endDate: { lte: now },
          },
          {
            // Funded projects
            status: "FUNDED",
          },
        ],
        // Hide test projects from home page
        NOT: {
          title: { contains: "test", mode: "insensitive" },
        },
      },
      include: {
        creator: {
          select: {
            name: true,
            vanityUrl: true,
          },
        },
      },
      orderBy: {
        endDate: "desc",
      },
      take: 6,
    });

    return projects.map((project) => {
      // Calculate funding percentage
      const fundingPercentage = Number(project.goalAmount) > 0
        ? Math.round((Number(project.currentAmount) / Number(project.goalAmount)) * 100)
        : 0;
      const wasSuccessful = fundingPercentage >= 100;

      // Build project URL - use vanity URL if creator has one
      const projectUrl = project.creator.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}`
        : `/projects/${project.slug}`;

      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        subtitle: project.subtitle || "",
        category: project.category,
        imageUrl: project.imageUrl || "",
        creator: project.creator.name || "Creator",
        goalAmount: project.goalAmount,
        currentAmount: project.currentAmount,
        backerCount: project.backerCount,
        fundingPercentage,
        wasSuccessful,
        endDate: project.endDate?.toISOString() || null,
        projectUrl,
      };
    });
  } catch (error) {
    console.error("Error fetching past campaigns:", error);
    return [];
  }
}

// Get user's followed project IDs
async function getUserFollowedProjectIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const follows = await db.projectFollower.findMany({
      where: { userId },
      select: { projectId: true },
    });
    return new Set(follows.map((f: { projectId: string }) => f.projectId));
  } catch (error) {
    console.error("Error fetching user follows:", error);
    return new Set();
  }
}

// Fetch active hero slides
async function getHeroSlides() {
  try {
    const slides = await db.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        buttonText: true,
        buttonLink: true,
        showPrimaryButton: true,
        secondaryButtonText: true,
        secondaryButtonLink: true,
        showSecondaryButton: true,
        mediaType: true,
        imageUrl: true,
        videoUrl: true,
        videoThumbnail: true,
        videoAutoplay: true,
        videoMuted: true,
        videoLoop: true,
        textAlignment: true,
        overlayOpacity: true,
        textColor: true,
        showSubtitle: true,
        showDescription: true,
      },
    });
    return slides;
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    return [];
  }
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [stats, retailerStats, featuredProjects, prelaunchProjects, pastCampaigns, followedProjectIds, heroSlides] = await Promise.all([
    getPlatformStats(),
    getRetailerStats(),
    getFeaturedProjects(),
    getPrelaunchProjects(),
    getPastCampaigns(),
    getUserFollowedProjectIds(userId),
    getHeroSlides(),
  ]);

  return (
    <div className="min-h-screen relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/20" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/15" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[450px] h-[450px] bg-cyan-500/15" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Hero Section */}
      <HeroSlider initialSlides={heroSlides} />

      {/* Stats Section */}
      <section className="relative border-y border-border/50 py-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-cyan-500/5 to-purple-500/5" />
        <div className="container relative">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/20 mb-3 group-hover:glow-pulse transition-all">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <p className="text-3xl font-bold stat-value mb-1">
                {stats.totalPledged > 0 ? `${formatCurrency(stats.totalPledged)}+` : "$0"}
              </p>
              <p className="text-sm text-muted-foreground">Pledged to projects</p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-3 group-hover:glow-pulse-cyan transition-all">
                <Target className="w-6 h-6 text-cyan-500" />
              </div>
              <p className="text-3xl font-bold stat-value mb-1">
                {stats.projectsFunded > 0 ? formatNumber(stats.projectsFunded) : "0"}
              </p>
              <p className="text-sm text-muted-foreground">Projects funded</p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-3 group-hover:glow-pulse-purple transition-all">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <p className="text-3xl font-bold stat-value mb-1">
                {stats.backerPool > 0 ? formatNumber(stats.backerPool) : "0"}
              </p>
              <p className="text-sm text-muted-foreground">Backer pool</p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 mb-3 group-hover:glow-pulse transition-all">
                <Award className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-3xl font-bold stat-value mb-1">
                {stats.successRate > 0 ? `${stats.successRate}%` : "0%"}
              </p>
              <p className="text-sm text-muted-foreground">Success rate</p>
            </div>
            <Link href="/retailers" className="glass-card glass-card-hover rounded-2xl p-6 text-center group">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-3 group-hover:glow-pulse transition-all">
                <Store className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold stat-value mb-1">
                {retailerStats.certifiedRetailers > 0 ? formatNumber(retailerStats.certifiedRetailers) : "0"}
              </p>
              <p className="text-sm text-muted-foreground">Certified Retailers</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="py-8 md:py-12 relative">
        <div className="container">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/20 glow-pulse">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold md:text-3xl">Featured Projects</h2>
              </div>
              <p className="text-muted-foreground">Handpicked projects we love</p>
            </div>
            <Link href="/discover">
              <Button variant="ghost" className="group hover:bg-primary/10">
                View all
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project, index) => (
              <Link key={project.id} href={project.projectUrl} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <Card className="project-card overflow-hidden h-full glass-card glass-card-hover rounded-2xl border-border/50">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {project.imageUrl ? (
                      <Image
                        src={project.imageUrl}
                        alt={project.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="project-card-image object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-cyan-500/10">
                        <Play className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Badge className="absolute left-3 top-3 bg-gradient-to-r from-primary to-emerald-600 border-0 shadow-lg">
                      {project.category}
                    </Badge>
                    <div className="absolute right-3 top-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
                      Live
                    </div>
                  </div>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors flex-1">{project.title}</h3>
                      {followedProjectIds.has(project.id) && (
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 text-xs shrink-0">
                          <Bookmark className="w-3 h-3 mr-1 fill-current" />
                          Following
                        </Badge>
                      )}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                      {project.subtitle}
                    </p>
                    <p className="text-xs text-muted-foreground">by <span className="text-foreground/70">{project.creator}</span></p>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3 border-t border-border/50 pt-4">
                    <div className="relative w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-emerald-500 rounded-full progress-glow-bar"
                        style={{ width: `${Math.min((Number(project.currentAmount) / Number(project.goalAmount)) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex w-full items-center justify-between text-sm">
                      <div>
                        <span className="font-semibold text-primary">
                          ${Number(project.currentAmount).toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          / ${Number(project.goalAmount).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {project.backerCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {project.endDate ? formatTimeRemaining(new Date(project.endDate)) : `${project.daysRemaining}d`}
                        </span>
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Projects in Prelaunch */}
      {prelaunchProjects.length > 0 && (
        <section className="relative border-t border-border/50 py-8 md:py-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
          <div className="container relative">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 glow-pulse">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                  </div>
                  <h2 className="text-2xl font-bold md:text-3xl">Projects in Prelaunch</h2>
                </div>
                <p className="text-muted-foreground">Coming soon - follow to get notified when they launch</p>
              </div>
              <Link href="/discover?prelaunch=true">
                <Button variant="ghost" className="group hover:bg-amber-500/10">
                  View all
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {prelaunchProjects.map((project, index) => (
                <Link key={project.id} href={project.projectUrl} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <Card className="project-card overflow-hidden h-full glass-card glass-card-hover rounded-2xl border-amber-500/20">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {project.imageUrl ? (
                        <Image
                          src={project.imageUrl}
                          alt={project.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="project-card-image object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                          <Sparkles className="h-12 w-12 text-amber-400/50" />
                        </div>
                      )}
                      <Badge className="absolute left-3 top-3 bg-gradient-to-r from-amber-500 to-orange-500 border-0 shadow-lg">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Coming Soon
                      </Badge>
                      <Badge className="absolute right-3 top-3 bg-background/80 backdrop-blur-sm" variant="secondary">
                        {project.category}
                      </Badge>
                    </div>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold line-clamp-1 flex-1">{project.title}</h3>
                        {followedProjectIds.has(project.id) && (
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 text-xs shrink-0">
                            <Bookmark className="w-3 h-3 mr-1 fill-current" />
                            Following
                          </Badge>
                        )}
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                        {project.subtitle}
                      </p>
                      <p className="text-xs text-muted-foreground">by <span className="text-foreground/70">{project.creator}</span></p>
                    </CardContent>
                    <CardFooter className="border-t border-border/50 pt-4">
                      <div className="flex w-full items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          <span>{project.followerCount} {project.followerCount === 1 ? 'follower' : 'followers'}</span>
                        </div>
                        {project.launchDate && (
                          <span className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent font-medium">
                            Launching {new Date(project.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Past Projects */}
      {pastCampaigns.length > 0 && (
        <section className="relative border-t border-border/50 py-8 md:py-12 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-transparent" />
          <div className="container relative">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-zinc-500/20 to-slate-500/20">
                    <Archive className="h-5 w-5 text-zinc-500" />
                  </div>
                  <h2 className="text-2xl font-bold md:text-3xl">Past Projects</h2>
                </div>
                <p className="text-muted-foreground">Recently completed campaigns</p>
              </div>
              <Link href="/discover?status=closed">
                <Button variant="ghost" className="group">
                  View all
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastCampaigns.map((project, index) => (
                <Link key={project.id} href={project.projectUrl} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                  <Card className="project-card overflow-hidden h-full glass-card glass-card-hover rounded-2xl border-border/50">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {project.imageUrl ? (
                        <Image
                          src={project.imageUrl}
                          alt={project.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="project-card-image object-cover grayscale-[20%]"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-500/10 to-slate-500/10">
                          <Archive className="h-12 w-12 text-zinc-400/50" />
                        </div>
                      )}
                      <Badge className={`absolute left-3 top-3 shadow-lg ${project.wasSuccessful ? 'bg-gradient-to-r from-emerald-500 to-green-600 border-0' : 'bg-zinc-500/80 backdrop-blur-sm'}`}>
                        {project.wasSuccessful ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Funded</>
                        ) : (
                          'Ended'
                        )}
                      </Badge>
                      <Badge className="absolute right-3 top-3 bg-background/80 backdrop-blur-sm" variant="secondary">
                        {project.category}
                      </Badge>
                    </div>
                    <CardContent className="pt-4">
                      <h3 className="mb-1 font-semibold line-clamp-1">{project.title}</h3>
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                        {project.subtitle}
                      </p>
                      <p className="text-xs text-muted-foreground">by <span className="text-foreground/70">{project.creator}</span></p>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-3 border-t border-border/50 pt-4">
                      <div className="relative w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${project.wasSuccessful ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-zinc-400'}`}
                          style={{ width: `${Math.min(project.fundingPercentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex w-full items-center justify-between text-sm">
                        <div>
                          <span className={`font-semibold ${project.wasSuccessful ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                            {project.fundingPercentage}% funded
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project.backerCount}
                          </span>
                          {project.endDate && (
                            <span className="text-xs">
                              Ended {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="relative py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 hero-gradient opacity-50" />
        <div className="container relative">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold md:text-3xl mb-2">How It Works</h2>
            <p className="text-muted-foreground">
              Three simple steps to fund your creative vision
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="glass-card glass-card-hover rounded-2xl p-8 text-center group animate-fade-in-up" style={{ animationDelay: '0s' }}>
              <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 group-hover:glow-pulse transition-all">
                <Rocket className="h-10 w-10 text-primary" />
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  1
                </div>
              </div>
              <h3 className="mb-3 text-lg font-semibold">Create Your Project</h3>
              <p className="text-sm text-muted-foreground">
                Set up your campaign with a compelling story, reward tiers, and funding goal.
              </p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-8 text-center group animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 group-hover:glow-pulse-cyan transition-all">
                <Heart className="h-10 w-10 text-cyan-500" />
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  2
                </div>
              </div>
              <h3 className="mb-3 text-lg font-semibold">Share & Get Backed</h3>
              <p className="text-sm text-muted-foreground">
                Share your project with the world and build a community of backers.
              </p>
            </div>
            <div className="glass-card glass-card-hover rounded-2xl p-8 text-center group animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 group-hover:glow-pulse-purple transition-all">
                <Zap className="h-10 w-10 text-purple-500" />
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  3
                </div>
              </div>
              <h3 className="mb-3 text-lg font-semibold">Make It Real</h3>
              <p className="text-sm text-muted-foreground">
                Receive your funds and bring your creative project to life.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/projects/new">
              <Button size="lg" className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/25 group btn-glow">
                Start Your Project
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-12 md:py-16 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-emerald-600 to-cyan-600 dark:from-primary dark:via-emerald-700 dark:to-cyan-700" />

        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>

        {/* Floating elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-cyan-300/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="container relative text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Start Your Journey Today</span>
          </div>

          <h2 className="mb-6 text-3xl md:text-5xl font-bold leading-tight">
            Ready to bring your
            <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-white">
              idea to life?
            </span>
          </h2>

          <p className="mb-6 text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            Join thousands of creators who have funded their dreams on IndieCrowdfund.
            Your next big project is just a click away.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg shadow-black/20 text-base px-8 group">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/discover">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg shadow-black/20 text-base px-8">
                Explore Projects
              </Button>
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-cyan-300" />
              <span>No platform fees until funded</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-cyan-300" />
              <span>24/7 Creator support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-cyan-300" />
              <span>Secure payments</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
