import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ArrowRight,
  Play,
  Users,
  Clock,
  Search,
  Rocket,
  Heart,
  Zap,
  Menu,
  Eye,
  Sparkles,
  Archive,
  CheckCircle,
  TrendingUp,
  Award,
  Target,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { MobileProfileLinks } from "@/components/mobile-profile-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { getPlatformStats } from "@/lib/stats/actions";
import { formatCurrency, formatNumber } from "@/lib/stats/utils";
import { db } from "@/lib/db";
import { formatTimeRemaining } from "@/lib/utils";

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

// Fetch category counts from database
async function getCategoryCounts() {
  try {
    const categoryCounts = await db.project.groupBy({
      by: ["category"],
      where: {
        status: "LIVE",
      },
      _count: true,
    });

    const categoryMap = new Map(categoryCounts.map(c => [c.category.toLowerCase(), c._count]));

    const categories = [
      { name: "Art", count: categoryMap.get("art") || 0 },
      { name: "Comics", count: categoryMap.get("comics") || 0 },
      { name: "Design", count: categoryMap.get("design") || 0 },
      { name: "Film", count: categoryMap.get("film") || 0 },
      { name: "Games", count: categoryMap.get("games") || 0 },
      { name: "Music", count: categoryMap.get("music") || 0 },
      { name: "Publishing", count: categoryMap.get("publishing") || 0 },
      { name: "Technology", count: categoryMap.get("technology") || 0 },
    ];

    return categories;
  } catch (error) {
    console.error("Error fetching category counts:", error);
    return [
      { name: "Art", count: 0 },
      { name: "Comics", count: 0 },
      { name: "Design", count: 0 },
      { name: "Film", count: 0 },
      { name: "Games", count: 0 },
      { name: "Music", count: 0 },
      { name: "Publishing", count: 0 },
      { name: "Technology", count: 0 },
    ];
  }
}

// Fetch projects in prelaunch from database
async function getPrelaunchProjects() {
  try {
    const projects = await db.project.findMany({
      where: {
        prelaunchActive: true,
        status: {
          not: "LIVE", // Exclude projects that are already live
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
      orderBy: {
        createdAt: "desc",
      },
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
        status: "LIVE",
        // Only include projects that have ended
        endDate: { lte: now },
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

export default async function HomePage() {
  const [stats, featuredProjects, categories, prelaunchProjects, pastCampaigns] = await Promise.all([
    getPlatformStats(),
    getFeaturedProjects(),
    getCategoryCounts(),
    getPrelaunchProjects(),
    getPastCampaigns(),
  ]);

  return (
    <div className="min-h-screen relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/20" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/15" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[450px] h-[450px] bg-cyan-500/15" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold gradient-text-brand flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center glow-pulse">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="hidden sm:inline">IndieCrowdfund</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/discover" className="text-sm font-medium hover:text-primary transition-colors relative group">
                Discover
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </Link>
              <Link href="/projects/new" className="text-sm font-medium hover:text-primary transition-colors relative group">
                Start a Project
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </Link>
              <Link href="/retailers" className="text-sm font-medium hover:text-primary transition-colors relative group">
                Retailers
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </Link>
              <Link href="/about-us" className="text-sm font-medium hover:text-primary transition-colors relative group">
                About Us
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </Link>
              <Link href="/faq" className="text-sm font-medium hover:text-primary transition-colors relative group">
                FAQ
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </Link>
              <Link href="/bug-report" className="text-sm font-medium hover:text-primary transition-colors relative group">
                Bug Report
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search projects..."
                className="w-64 pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
              />
            </div>
            <ThemeToggle />
            <div className="hidden sm:block">
              <UserProfileDropdown />
            </div>
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <Link href="/discover" className="text-sm font-medium hover:text-primary py-2">
                    Discover
                  </Link>
                  <Link href="/projects/new" className="text-sm font-medium hover:text-primary py-2">
                    Start a Project
                  </Link>
                  <Link href="/retailers" className="text-sm font-medium hover:text-primary py-2">
                    Retailers
                  </Link>
                  <Link href="/about-us" className="text-sm font-medium hover:text-primary py-2">
                    About Us
                  </Link>
                  <Link href="/faq" className="text-sm font-medium hover:text-primary py-2">
                    FAQ
                  </Link>
                  <Link href="/bug-report" className="text-sm font-medium hover:text-primary py-2">
                    Bug Report
                  </Link>
                  <div className="border-t pt-4 mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Theme</span>
                    <ThemeToggle />
                  </div>
                  <div className="border-t pt-4 mt-2">
                    <MobileProfileLinks />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden hero-gradient py-20 md:py-32">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6 px-4 py-1.5 bg-gradient-to-r from-primary/20 to-cyan-500/20 border-primary/30 text-primary animate-fade-in-up">
              <Sparkles className="w-3 h-3 mr-1.5" />
              Free speech advocates
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <span className="gradient-text">Support</span> Who You{" "}
              <span className="relative">
                Love
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 10C50 4 150 4 198 10" stroke="url(#underline-gradient)" strokeWidth="3" strokeLinecap="round" className="animate-line" />
                  <defs>
                    <linearGradient id="underline-gradient" x1="0" y1="0" x2="200" y2="0">
                      <stop stopColor="#10b981" />
                      <stop offset="0.5" stopColor="#06b6d4" />
                      <stop offset="1" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="mb-10 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              IndieCrowdfund is the future home to thousands of creative projects in art, design,
              film, games, music, and more. Back a project or start your own today.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link href="/discover">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/25 group btn-glow">
                  Discover Projects
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/projects/new">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-border/50 hover:border-primary/50 hover:bg-primary/5 group glass-card">
                  Start a Project
                  <Rocket className="ml-2 h-4 w-4 group-hover:translate-y-[-2px] transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative border-y border-border/50 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-cyan-500/5 to-purple-500/5" />
        <div className="container relative">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
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
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="py-16 md:py-24 relative">
        <div className="container">
          <div className="mb-10 flex items-center justify-between">
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={project.imageUrl}
                        alt={project.title}
                        className="project-card-image absolute inset-0 w-full h-full object-cover"
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
                    <h3 className="mb-1 font-semibold line-clamp-1 group-hover:text-primary transition-colors">{project.title}</h3>
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
        <section className="relative border-t border-border/50 py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
          <div className="container relative">
            <div className="mb-10 flex items-center justify-between">
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={project.imageUrl}
                          alt={project.title}
                          className="project-card-image absolute inset-0 w-full h-full object-cover"
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
                      <h3 className="mb-1 font-semibold line-clamp-1">{project.title}</h3>
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

      {/* Categories */}
      <section className="relative border-t border-border/50 py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent" />
        <div className="container relative">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl mb-2">Browse by Category</h2>
            <p className="text-muted-foreground">
              Find projects in your favorite creative space
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((category, index) => (
              <Link
                key={category.name}
                href={`/discover?category=${category.name.toLowerCase()}`}
                className="category-card group flex items-center justify-between rounded-xl glass-card p-5 border-border/50 animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <span className="font-medium group-hover:text-primary transition-colors">
                  {category.name}
                </span>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  {category.count}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 hero-gradient opacity-50" />
        <div className="container relative">
          <div className="mb-12 text-center">
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

      {/* Past Campaigns */}
      {pastCampaigns.length > 0 && (
        <section className="relative border-t border-border/50 py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-transparent" />
          <div className="container relative">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-zinc-500/20 to-slate-500/20">
                    <Archive className="h-5 w-5 text-zinc-500" />
                  </div>
                  <h2 className="text-2xl font-bold md:text-3xl">Past Campaigns</h2>
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={project.imageUrl}
                          alt={project.title}
                          className="project-card-image absolute inset-0 w-full h-full object-cover grayscale-[20%]"
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

      {/* CTA Section */}
      <section className="relative py-20 md:py-28 overflow-hidden">
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

          <p className="mb-10 text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
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
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-8">
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

      {/* Footer */}
      <footer className="relative border-t border-border/50 py-16 bg-gradient-to-b from-transparent to-muted/30 dark:to-muted/10">
        <div className="container">
          <div className="grid gap-10 md:grid-cols-5">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h4 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-emerald-600">IndieCrowdfund</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Empowering creators to bring their ideas to life through community funding. Join our global community of innovators.
              </p>
              {/* Social links */}
              <div className="flex gap-3">
                {['Twitter', 'Discord', 'GitHub'].map((platform) => (
                  <a
                    key={platform}
                    href="#"
                    className="h-9 w-9 rounded-lg glass-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
                  >
                    <span className="text-xs font-medium">{platform.charAt(0)}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Discover</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/discover" className="text-muted-foreground hover:text-primary transition-colors">All Projects</Link></li>
                <li><Link href="/discover?category=games" className="text-muted-foreground hover:text-primary transition-colors">Games</Link></li>
                <li><Link href="/discover?category=technology" className="text-muted-foreground hover:text-primary transition-colors">Technology</Link></li>
                <li><Link href="/discover?category=art" className="text-muted-foreground hover:text-primary transition-colors">Art</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">For Creators</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/projects/new" className="text-muted-foreground hover:text-primary transition-colors">Start a Project</Link></li>
                <li><Link href="/creator-handbook" className="text-muted-foreground hover:text-primary transition-colors">Creator Handbook</Link></li>
                <li><Link href="/fees" className="text-muted-foreground hover:text-primary transition-colors">Fees & Pricing</Link></li>
                <li><Link href="/success-stories" className="text-muted-foreground hover:text-primary transition-colors">Success Stories</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Support</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/help" className="text-muted-foreground hover:text-primary transition-colors">Help Center</Link></li>
                <li><Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} IndieCrowdfund. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/cookies" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
