import type { Metadata } from "next";
import { Suspense, cache } from "react";
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
  Bookmark,
  Loader2,
} from "lucide-react";
import { Footer } from "@/components/footer";
import { HeroSlider } from "@/components/hero-slider";
import { JsonLd } from "@/components/json-ld";
import { HomeStatsPoller } from "@/components/home-stats-poller";
import { getPlatformStats, getRetailerStats } from "@/lib/stats/actions";
import { getBatchProjectStats } from "@/lib/stats";
import { db } from "@/lib/db";
import { formatTimeRemaining } from "@/lib/utils";
import { auth } from "@/lib/auth";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";

// Dynamic metadata that uses the most recent live project's image for social sharing
export async function generateMetadata(): Promise<Metadata> {
  let ogImageUrl = `${SITE_URL}/api/og`;
  let ogImageAlt = "IndieCrowdfund - Crowdfunding for Independent Creators";

  try {
    // Get the most recently launched LIVE project's image.
    // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields
    // at runtime — use `NOT: { field: null }` wrapper syntax instead.
    const latestLiveProject = await db.project.findFirst({
      where: {
        status: "LIVE",
        deletedAt: null,
        NOT: { imageUrl: null },
      },
      orderBy: { launchedAt: "desc" },
      select: { imageUrl: true, title: true },
    });

    if (latestLiveProject?.imageUrl) {
      ogImageUrl = latestLiveProject.imageUrl;
      ogImageAlt = `${latestLiveProject.title} - Live now on IndieCrowdfund`;
    }
  } catch (error) {
    console.error("Failed to fetch latest live project for OG image:", error);
  }

  return {
    title: "IndieCrowdfund - The #1 Kickstarter Alternative | Crowdfunding for Creators",
    description:
      "IndieCrowdfund is the best Kickstarter alternative for crowdfunding creative projects. Lower fees, better tools, and a passionate backer community. Launch your campaign today and bring your idea to life.",
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      title: "IndieCrowdfund - The #1 Kickstarter Alternative | Crowdfunding for Creators",
      description:
        "The crowdfunding platform built for independent creators. Lower fees, better tools, and a passionate backer community. Launch your campaign today.",
      url: SITE_URL,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "IndieCrowdfund - The #1 Kickstarter Alternative",
      description:
        "The crowdfunding platform built for independent creators. Lower fees, better tools, and a passionate backer community.",
      images: [
        {
          url: ogImageUrl,
          alt: ogImageAlt,
        },
      ],
    },
  };
}

// Revalidate homepage every 60 seconds.
// Note: auth() uses cookies() which opts into dynamic rendering at request time.
// DB queries are NOT wrapped in unstable_cache because it caches stale empty
// results after deployments, breaking the homepage.
export const revalidate = 60;

/*
 * #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE#
 */

// Fetch featured/live projects from database (excludes closed campaigns)
// Not wrapped in unstable_cache — it caches stale empty results after deploys.
// The page is already dynamic due to auth(), so direct queries are fine.
const getFeaturedProjects = cache(async () => {
  try {
    const now = new Date();
    const projects = await db.project.findMany({
      where: {
        status: "LIVE",
        deletedAt: null,
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

    const statsMap = await getBatchProjectStats(
      projects.map((p) => ({ id: p.id, status: p.status, goalAmount: p.goalAmount }))
    );

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

      const liveStats = statsMap.get(project.id) ?? { currentAmount: 0, backerCount: 0 };

      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        subtitle: project.subtitle || "",
        category: project.category,
        imageUrl: project.imageUrl || "",
        creator: project.creator.name || "Creator",
        goalAmount: project.goalAmount,
        currentAmount: liveStats.currentAmount,
        backerCount: liveStats.backerCount,
        daysRemaining,
        endDate: project.endDate?.toISOString() || null,
        projectUrl,
      };
    });
  } catch (error) {
    console.error("Error fetching featured projects:", error);
    return [];
  }
});

// Fetch projects in prelaunch from database
// Note: Not wrapped in unstable_cache because Date serialization in the cache
// can cause stale empty results. The page is already dynamic due to auth().
const getPrelaunchProjects = cache(async () => {
  try {
    const projects = await db.project.findMany({
      where: {
        prelaunchActive: true,
        deletedAt: null,
        // Show anything the creator has opted into public prelaunch for, as long
        // as it hasn't already finished its lifecycle. The vanity API route
        // (src/app/api/projects/vanity/[vanityname]/[slug]/route.ts) honors
        // prelaunchActive as a public-visibility bypass for DRAFT/SUBMITTED, so
        // cards for those statuses no longer dead-end on "Project not found".
        // LIVE/FUNDED moved past prelaunch. FAILED/CANCELLED shouldn't be
        // advertised even if someone forgot to flip the flag off.
        status: { notIn: ["LIVE", "FUNDED", "FAILED", "CANCELLED"] },
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
});

// Fetch past/closed campaigns from database
// Not wrapped in unstable_cache — it caches stale empty results after deploys.
const getPastCampaigns = cache(async () => {
  try {
    const now = new Date();
    const projects = await db.project.findMany({
      where: {
        deletedAt: null,
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

    const statsMap = await getBatchProjectStats(
      projects.map((p) => ({ id: p.id, status: p.status, goalAmount: p.goalAmount }))
    );

    return projects.map((project) => {
      const liveStats = statsMap.get(project.id) ?? { currentAmount: 0, backerCount: 0 };

      const fundingPercentage = Number(project.goalAmount) > 0
        ? Math.round((liveStats.currentAmount / Number(project.goalAmount)) * 100)
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
        currentAmount: liveStats.currentAmount,
        backerCount: liveStats.backerCount,
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
});

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
// Not wrapped in unstable_cache — it caches stale empty results after deploys.
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

// Skeleton loader for project sections
function ProjectSectionSkeleton() {
  return (
    <div className="py-8 md:py-12 relative">
      <div className="container">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-2xl overflow-hidden">
              <div className="aspect-video bg-muted animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsSectionSkeleton() {
  return (
    <section className="relative border-y border-border/50 py-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-cyan-500/5 to-purple-500/5" />
      <div className="container relative flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </section>
  );
}

// Async server component for stats section
async function StatsSection() {
  const [stats, retailerStats] = await Promise.all([
    getPlatformStats(),
    getRetailerStats(),
  ]);

  return (
    <section className="relative border-y border-border/50 py-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-cyan-500/5 to-purple-500/5" />
      <div className="container relative">
        <HomeStatsPoller initialStats={{
          totalPledged: stats.totalPledged,
          projectsFunded: stats.projectsFunded,
          successRate: stats.successRate,
          backerPool: stats.backerPool,
          certifiedRetailers: retailerStats.certifiedRetailers,
        }} />
      </div>
    </section>
  );
}

// Async server component for featured projects
async function FeaturedProjectsSection({ userId }: { userId: string | undefined }) {
  const [featuredProjects, followedProjectIds] = await Promise.all([
    getFeaturedProjects(),
    getUserFollowedProjectIds(userId),
  ]);

  if (featuredProjects.length === 0) return null;

  return (
    <section className="py-8 md:py-12 relative">
      <div className="container">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/20 glow-pulse">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold md:text-3xl">Featured Projects</h2>
            </div>
            <p className="text-muted-foreground">Handpicked projects we love</p>
          </div>
          <Link href="/crowdfunds">
            <Button variant="ghost" className="group hover:bg-primary/10">
              View all
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      priority={index < 3}
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
                  <div className="progress-glow-bar relative w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-emerald-500 rounded-full"
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
  );
}

// Async server component for prelaunch projects
async function PrelaunchProjectsSection({ userId }: { userId: string | undefined }) {
  const [prelaunchProjects, followedProjectIds] = await Promise.all([
    getPrelaunchProjects(),
    getUserFollowedProjectIds(userId),
  ]);

  if (prelaunchProjects.length === 0) return null;

  return (
    <section className="relative border-t border-border/50 py-8 md:py-12 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
      <div className="container relative">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 glow-pulse">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold md:text-3xl">Projects in Prelaunch</h2>
            </div>
            <p className="text-muted-foreground">Coming soon - follow to get notified when they launch</p>
          </div>
          <Link href="/crowdfunds?prelaunch=true">
            <Button variant="ghost" className="group hover:bg-amber-500/10">
              View all
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}

// Async server component for past campaigns
async function PastCampaignsSection() {
  const pastCampaigns = await getPastCampaigns();

  if (pastCampaigns.length === 0) return null;

  return (
    <section className="relative border-t border-border/50 py-8 md:py-12 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-transparent" />
      <div className="container relative">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-zinc-500/20 to-slate-500/20">
                <Archive className="h-5 w-5 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold md:text-3xl">Past Projects</h2>
            </div>
            <p className="text-muted-foreground">Recently completed campaigns</p>
          </div>
          <Link href="/crowdfunds?status=past">
            <Button variant="ghost" className="group">
              View all
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      <Archive className="h-12 w-12 text-muted-foreground/50" />
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
  );
}

// Shown only when every project section is empty so the page never looks broken.
async function ProjectsEmptyState() {
  const [featured, prelaunch, past] = await Promise.all([
    getFeaturedProjects(),
    getPrelaunchProjects(),
    getPastCampaigns(),
  ]);

  if (featured.length > 0 || prelaunch.length > 0 || past.length > 0) {
    return null;
  }

  return (
    <section className="py-10 md:py-16">
      <div className="container">
        <div className="glass-card rounded-2xl border border-border/50 p-10 md:p-14 text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold md:text-3xl mb-3">No live projects yet</h2>
          <p className="text-muted-foreground mb-6">
            Be the first to launch a campaign on IndieCrowdfund — your creative
            project could be the one that gets this community started.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/projects/new">
              <Button size="lg" className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 group">
                Start a Project
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/crowdfunds">
              <Button size="lg" variant="outline">
                Browse Crowdfunds
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Only fetch hero slides synchronously (above the fold)
  const heroSlides = await getHeroSlides();

  return (
    <main className="min-h-screen relative">
      <h1 className="sr-only">IndieCrowdfund - The Best Kickstarter Alternative for Crowdfunding Creative Projects</h1>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "IndieCrowdfund",
          url: SITE_URL,
          logo: `${SITE_URL}/favicon.ico`,
          description:
            "IndieCrowdfund is the best Kickstarter alternative — a crowdfunding platform built for independent creators with lower fees and better tools.",
          sameAs: [],
          foundingDate: "2024",
          knowsAbout: [
            "Crowdfunding",
            "Creative Projects",
            "Independent Creators",
            "Comic Book Funding",
            "Kickstarter Alternative",
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "IndieCrowdfund",
          url: SITE_URL,
          description:
            "The best Kickstarter alternative for crowdfunding creative projects. Launch campaigns, fund ideas, and join a community of independent creators.",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}/discover?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />

      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/20" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/15" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[450px] h-[450px] bg-cyan-500/15" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Hero Section */}
      <HeroSlider initialSlides={heroSlides} />

      {/* Stats Section - streams in */}
      <Suspense fallback={<StatsSectionSkeleton />}>
        <StatsSection />
      </Suspense>

      {/* Featured Projects - streams in */}
      <Suspense fallback={<ProjectSectionSkeleton />}>
        <FeaturedProjectsSection userId={userId} />
      </Suspense>

      {/* Prelaunch Projects - streams in */}
      <Suspense fallback={<ProjectSectionSkeleton />}>
        <PrelaunchProjectsSection userId={userId} />
      </Suspense>

      {/* Past Campaigns - streams in */}
      <Suspense fallback={<ProjectSectionSkeleton />}>
        <PastCampaignsSection />
      </Suspense>

      {/* Empty state - only renders when every project section is empty */}
      <Suspense fallback={null}>
        <ProjectsEmptyState />
      </Suspense>

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

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-6 md:p-8 text-center group animate-fade-in-up" style={{ animationDelay: '0s' }}>
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
            <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-6 md:p-8 text-center group animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
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
            <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-6 md:p-8 text-center group animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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

          <h2 className="mb-6 text-2xl sm:text-3xl md:text-5xl font-bold leading-tight">
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
            <Link href="/crowdfunds">
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
    </main>
  );
}
