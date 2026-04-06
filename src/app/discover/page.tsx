"use client";

/*
 * #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE#
 */

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Play,
  Users,
  Clock,
  TrendingUp,
  Sparkles,
  ArrowUpDown,
  X,
  Loader2,
  Bell,
  CalendarClock,
  ArrowLeft,
} from "lucide-react";
import { PROJECT_CATEGORIES } from "@/types";
import { formatTimeRemaining } from "@/lib/utils";

// Project type from API
interface Project {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  imageUrl: string;
  creator: { id: string; name: string; image: string | null };
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  followerCount?: number;
  daysRemaining: number;
  endDate: string | null;
  launchDate?: string | null;
  isStaffPick: boolean;
  isPrelaunch?: boolean;
  projectUrl: string;
}

const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "most-funded", label: "Most Funded" },
  { value: "ending-soon", label: "Ending Soon" },
  { value: "most-backed", label: "Most Backed" },
];

const PROJECT_TYPE_OPTIONS = [
  { value: "all", label: "All Projects" },
  { value: "live", label: "Live Projects" },
  { value: "past", label: "Past Projects" },
  { value: "upcoming", label: "Upcoming Projects" },
];

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverPageSkeleton />}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-cyan-500/10" style={{ animationDelay: '-10s' }} />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/50 glass-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">IndieCrowdfund</Link>
          </div>
        </div>
      </header>
      <section className="relative border-b border-border/50 py-8 hero-gradient">
        <div className="container">
          <div className="h-8 w-48 bg-muted/50 rounded-lg animate-pulse mb-4" />
          <div className="h-4 w-72 bg-muted/30 rounded animate-pulse" />
        </div>
      </section>
    </div>
  );
}

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState(searchParams?.get("q") || "");
  const [category, setCategory] = useState(searchParams?.get("category") || "");
  const [sort, setSort] = useState(searchParams?.get("sort") || "trending");
  const [projectType, setProjectType] = useState(
    searchParams?.get("scope") === "all" ? "all" :
    searchParams?.get("status") === "past" || searchParams?.get("status") === "closed" ? "past" :
    searchParams?.get("prelaunch") === "true" ? "upcoming" : "live"
  );
  const [showStaffPicks, setShowStaffPicks] = useState(
    searchParams?.get("staffPicks") === "true"
  );
  const [showFunded, setShowFunded] = useState(
    searchParams?.get("funded") !== "false"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Fetch projects from API
  const fetchProjects = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      if (sort) params.set("sort", sort);
      if (projectType === "all") params.set("scope", "all");
      else if (projectType === "past") params.set("status", "past");
      else if (projectType === "upcoming") params.set("prelaunch", "true");
      if (showStaffPicks) params.set("staffPicks", "true");
      params.set("limit", "12");
      params.set("offset", reset ? "0" : String(offset));

      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        // Filter out fully funded if showFunded is false
        let filteredData = data.projects;
        if (!showFunded) {
          filteredData = data.projects.filter((p: Project) => {
            const percent = (Number(p.currentAmount) / Number(p.goalAmount)) * 100;
            return percent < 100;
          });
        }

        if (reset) {
          setProjects(filteredData);
          setOffset(12);
        } else {
          setProjects((prev) => [...prev, ...filteredData]);
          setOffset((prev) => prev + 12);
        }
        setTotalProjects(data.pagination.total);
        setHasMore(data.pagination.hasMore);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [search, category, sort, projectType, showStaffPicks, showFunded, offset]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchProjects(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, sort, projectType, showStaffPicks, showFunded]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchProjects(false);
    }
  };

  // Use fetched projects
  const filteredProjects = projects;

  // Update URL when filters change
  const updateFilters = (updates: Record<string, string | boolean | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === false) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    router.push(`/discover?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setSort("trending");
    setProjectType("live");
    setShowStaffPicks(false);
    setShowFunded(true);
    router.push("/discover");
  };

  const activeFilterCount =
    (search ? 1 : 0) +
    (category ? 1 : 0) +
    (projectType !== "live" ? 1 : 0) +
    (showStaffPicks ? 1 : 0) +
    (!showFunded ? 1 : 0);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-cyan-500/10" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Hero */}
      <section className="relative border-b border-border/50 py-8 hero-gradient overflow-hidden">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />

        <div className="container relative">
          {/* Back Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card border border-primary/20 mb-4">
            <Search className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium text-primary">Explore & Discover</span>
          </div>
          <h1 className="mb-3 text-4xl md:text-5xl font-bold">
            Discover{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-emerald-500 to-cyan-500">
              Amazing Projects
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Find and support creative projects from innovators around the world. Every contribution helps bring ideas to life.
          </p>
        </div>
      </section>

      {/* Filters Bar */}
      <section className="sticky top-16 z-40 border-b border-border/50 glass-card">
        <div className="container py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 md:max-w-xs group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search projects..."
                className="pl-10 glass-card border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  updateFilters({ q: e.target.value || null });
                }}
              />
            </div>

            {/* Project Type Select (Live vs Upcoming) */}
            <Select
              value={projectType}
              onValueChange={(value) => {
                setProjectType(value);
                updateFilters({
                  prelaunch: value === "upcoming" ? "true" : null,
                  scope: value === "all" ? "all" : null,
                });
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category Select */}
            <Select
              value={category || "all"}
              onValueChange={(value) => {
                const newValue = value === "all" ? "" : value;
                setCategory(newValue);
                updateFilters({ category: newValue || null });
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {PROJECT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value);
                updateFilters({ sort: value });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* More Filters - Mobile */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="staffPicks-mobile"
                      checked={showStaffPicks}
                      onCheckedChange={(checked) => {
                        setShowStaffPicks(checked === true);
                        updateFilters({ staffPicks: checked === true || null });
                      }}
                    />
                    <Label htmlFor="staffPicks-mobile">Staff picks only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showFunded-mobile"
                      checked={showFunded}
                      onCheckedChange={(checked) => {
                        setShowFunded(checked === true);
                        updateFilters({ funded: checked === true ? null : "false" });
                      }}
                    />
                    <Label htmlFor="showFunded-mobile">Include funded projects</Label>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop Filters */}
            <div className="hidden items-center gap-4 md:flex">
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="staffPicks"
                  checked={showStaffPicks}
                  onCheckedChange={(checked) => {
                    setShowStaffPicks(checked === true);
                    updateFilters({ staffPicks: checked === true || null });
                  }}
                />
                <Label htmlFor="staffPicks" className="text-sm">
                  Staff picks
                </Label>
              </div>
            </div>

            {/* View Toggle */}
            <div className="ml-auto hidden items-center gap-1 md:flex">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Active filters:
              </span>
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Search: {search}
                  <button
                    onClick={() => {
                      setSearch("");
                      updateFilters({ q: null });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {category && (
                <Badge variant="secondary" className="gap-1">
                  {PROJECT_CATEGORIES.find((c) => c.value === category)?.label}
                  <button
                    onClick={() => {
                      setCategory("");
                      updateFilters({ category: null });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {projectType === "upcoming" && (
                <Badge variant="secondary" className="gap-1">
                  Upcoming projects
                  <button
                    onClick={() => {
                      setProjectType("live");
                      updateFilters({ prelaunch: null });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {projectType === "all" && (
                <Badge variant="secondary" className="gap-1">
                  All projects
                  <button
                    onClick={() => {
                      setProjectType("live");
                      updateFilters({ scope: null });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {showStaffPicks && (
                <Badge variant="secondary" className="gap-1">
                  Staff picks
                  <button
                    onClick={() => {
                      setShowStaffPicks(false);
                      updateFilters({ staffPicks: null });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="container py-8 relative">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading && filteredProjects.length === 0 ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading projects...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{totalProjects}</span>
                projects found
              </span>
            )}
          </p>
        </div>

        {filteredProjects.length === 0 && !isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card mb-6">
              <Sparkles className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">No projects found</h3>
            <p className="mb-6 text-muted-foreground max-w-md mx-auto">
              Try adjusting your filters or search terms to discover more amazing projects
            </p>
            <Button onClick={clearFilters} className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/20">
              Clear all filters
            </Button>
          </div>
        ) : filteredProjects.length === 0 && isLoading ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card mb-6 relative">
              <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Loading projects...</h3>
            <p className="text-muted-foreground">Discovering amazing projects for you</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project, index) => (
              <div
                key={project.id}
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((project, index) => (
              <div
                key={project.id}
                className="animate-in fade-in slide-in-from-left-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <ProjectListItem project={project} />
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {filteredProjects.length > 0 && hasMore && (
          <div className="mt-12 text-center">
            <Button
              variant="outline"
              disabled={isLoading}
              onClick={loadMore}
              className="glass-card border-border/50 hover:border-primary/50 hover:bg-primary/5 px-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load more projects
                  <TrendingUp className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const fundingPercent = (Number(project.currentAmount) / Number(project.goalAmount)) * 100;
  const isPrelaunch = project.isPrelaunch;

  // Format launch date for prelaunch projects
  const formatLaunchDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Coming soon";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Link href={project.projectUrl}>
      <Card className={`project-card h-full overflow-hidden glass-card glass-card-hover rounded-2xl border-border/50 ${isPrelaunch ? "border-amber-300/50 dark:border-amber-700/50" : ""}`}>
        <div className="aspect-video bg-muted relative overflow-hidden group">
          {project.imageUrl ? (
            <Image
              src={project.imageUrl}
              alt={project.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <Play className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <Badge className={`absolute left-3 top-3 shadow-lg ${isPrelaunch ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0" : "bg-gradient-to-r from-primary to-emerald-600 text-white border-0"}`}>
            {isPrelaunch ? "Coming Soon" : (PROJECT_CATEGORIES.find((c) => c.value === project.category)?.label || project.category)}
          </Badge>
          {project.isStaffPick && (
            <Badge className="absolute right-3 top-3 bg-white/90 dark:bg-black/70 backdrop-blur-sm text-foreground shadow-lg" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
              Staff Pick
            </Badge>
          )}

          {/* Funding percentage badge for live projects */}
          {!isPrelaunch && fundingPercent >= 100 && (
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-primary/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg">
              Funded!
            </div>
          )}
        </div>
        <CardContent className="pt-4">
          <h3 className="mb-1 font-semibold line-clamp-1 group-hover:text-primary transition-colors">{project.title}</h3>
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {project.subtitle}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted">
              {project.creator.image ? (
                <Image src={project.creator.image} alt="" width={20} height={20} className="rounded-full object-cover" />
              ) : (
                <span className="text-[10px] font-medium">{project.creator.name?.charAt(0)}</span>
              )}
            </span>
            by <span className="font-medium text-foreground/80">{project.creator.name}</span>
          </p>
        </CardContent>
        <CardFooter className="flex-col items-start gap-3 border-t border-border/50 pt-4">
          {isPrelaunch ? (
            <>
              {/* Prelaunch - show follower count and launch date */}
              <div className="flex w-full items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-semibold">{project.followerCount || 0} followers</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <span>{formatLaunchDate(project.launchDate)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Live project - show funding progress */}
              <div className="w-full progress-glow-bar">
                <Progress value={Math.min(fundingPercent, 100)} className="h-2" />
              </div>
              <div className="flex w-full items-center justify-between text-sm">
                <div>
                  <span className="font-bold text-primary">
                    ${Number(project.currentAmount).toLocaleString()}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {" "}/ ${Number(project.goalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-xs">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50">
                    <Users className="h-3 w-3" />
                    {project.backerCount}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50">
                    <Clock className="h-3 w-3" />
                    {project.endDate ? formatTimeRemaining(new Date(project.endDate)) : `${project.daysRemaining}d`}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}

function ProjectListItem({ project }: { project: Project }) {
  const fundingPercent = (Number(project.currentAmount) / Number(project.goalAmount)) * 100;
  const isPrelaunch = project.isPrelaunch;

  // Format launch date for prelaunch projects
  const formatLaunchDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Coming soon";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Link href={project.projectUrl}>
      <Card className={`overflow-hidden glass-card glass-card-hover rounded-2xl border-border/50 transition-all ${isPrelaunch ? "border-amber-300/50 dark:border-amber-700/50" : ""}`}>
        <div className="flex flex-col sm:flex-row group">
          <div className="aspect-video w-full sm:w-56 flex-shrink-0 bg-muted relative overflow-hidden">
            {project.imageUrl ? (
              <Image
                src={project.imageUrl}
                alt={project.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, 224px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <Play className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity sm:block hidden" />

            {fundingPercent >= 100 && !isPrelaunch && (
              <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-primary/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg">
                Funded!
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {isPrelaunch ? (
                    <Badge className="text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm">Coming Soon</Badge>
                  ) : (
                    <Badge className="text-xs bg-gradient-to-r from-primary to-emerald-600 text-white border-0 shadow-sm">
                      {PROJECT_CATEGORIES.find((c) => c.value === project.category)
                        ?.label || project.category}
                    </Badge>
                  )}
                  {project.isStaffPick && (
                    <Badge variant="secondary" className="text-xs bg-muted/80 backdrop-blur-sm">
                      <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
                      Staff Pick
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{project.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{project.subtitle}</p>
              </div>
              {isPrelaunch ? (
                <div className="text-right flex-shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                    <Bell className="h-4 w-4" />
                    <span className="font-semibold">{project.followerCount || 0}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 justify-end">
                    <CalendarClock className="h-3 w-3" />
                    Launches {formatLaunchDate(project.launchDate)}
                  </p>
                </div>
              ) : (
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-lg text-primary">
                    ${project.currentAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of ${project.goalAmount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted">
                  {project.creator.image ? (
                    <Image src={project.creator.image} alt="" width={20} height={20} className="rounded-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-medium">{project.creator.name?.charAt(0)}</span>
                  )}
                </span>
                by <span className="font-medium text-foreground/80">{project.creator.name}</span>
              </p>
              {isPrelaunch ? (
                <Button variant="ghost" size="sm" className="text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                  <Bell className="mr-1.5 h-3.5 w-3.5" />
                  Follow to get notified
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {Math.round(fundingPercent)}%
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {project.backerCount}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {project.endDate ? formatTimeRemaining(new Date(project.endDate)) : `${project.daysRemaining}d`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
