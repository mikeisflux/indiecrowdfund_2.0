"use client";

/*
 * #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE#
 */

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
  Menu,
  Loader2,
} from "lucide-react";
import { PROJECT_CATEGORIES } from "@/types";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";

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
  daysRemaining: number;
  isStaffPick: boolean;
}

const SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "Newest" },
  { value: "most-funded", label: "Most Funded" },
  { value: "ending-soon", label: "Ending Soon" },
  { value: "most-backed", label: "Most Backed" },
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
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-primary">IndieCrowdfund</span>
          </div>
        </div>
      </header>
      <section className="border-b bg-muted/30 py-12">
        <div className="container">
          <h1 className="mb-2 text-3xl font-bold">Discover Projects</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </section>
    </div>
  );
}

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "trending");
  const [showStaffPicks, setShowStaffPicks] = useState(
    searchParams.get("staffPicks") === "true"
  );
  const [showFunded, setShowFunded] = useState(
    searchParams.get("funded") !== "false"
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
            const percent = (p.currentAmount / p.goalAmount) * 100;
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
  }, [search, category, sort, showStaffPicks, showFunded, offset]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchProjects(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, sort, showStaffPicks, showFunded]);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      fetchProjects(false);
    }
  };

  // Use fetched projects
  const filteredProjects = projects;

  // Update URL when filters change
  const updateFilters = (updates: Record<string, string | boolean | null>) => {
    const params = new URLSearchParams(searchParams.toString());

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
    setShowStaffPicks(false);
    setShowFunded(true);
    router.push("/discover");
  };

  const activeFilterCount =
    (search ? 1 : 0) +
    (category ? 1 : 0) +
    (showStaffPicks ? 1 : 0) +
    (!showFunded ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/discover"
                className="text-sm font-medium text-primary"
              >
                Discover
              </Link>
              <Link
                href="/projects/new"
                className="text-sm font-medium hover:text-primary"
              >
                Start a Project
              </Link>
              <Link
                href="/retailers"
                className="text-sm font-medium hover:text-primary"
              >
                Retailers
              </Link>
              <Link
                href="/about-us"
                className="text-sm font-medium hover:text-primary"
              >
                About Us
              </Link>
              <Link
                href="/faq"
                className="text-sm font-medium hover:text-primary"
              >
                FAQ
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
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
                  <div className="border-t pt-4 mt-2">
                    <UserProfileDropdown />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-muted/30 py-12">
        <div className="container">
          <h1 className="mb-2 text-3xl font-bold">Discover Projects</h1>
          <p className="text-muted-foreground">
            Find and support creative projects from around the world
          </p>
        </div>
      </section>

      {/* Filters Bar */}
      <section className="sticky top-16 z-40 border-b bg-background">
        <div className="container py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-10"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  updateFilters({ q: e.target.value || null });
                }}
              />
            </div>

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
      <section className="container py-8">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading && filteredProjects.length === 0 ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects...
              </span>
            ) : (
              `${totalProjects} projects found`
            )}
          </p>
        </div>

        {filteredProjects.length === 0 && !isLoading ? (
          <div className="py-12 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-semibold">No projects found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Try adjusting your filters or search terms
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : filteredProjects.length === 0 && isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground animate-spin" />
            <h3 className="mb-2 font-semibold">Loading projects...</h3>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((project) => (
              <ProjectListItem key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Load More */}
        {filteredProjects.length > 0 && hasMore && (
          <div className="mt-12 text-center">
            <Button variant="outline" disabled={isLoading} onClick={loadMore}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more projects"
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

  return (
    <Link href={`/projects/${project.slug}`}>
      <Card className="h-full overflow-hidden transition-all hover:shadow-lg">
        <div className="aspect-video bg-muted relative">
          {project.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.imageUrl}
              alt={project.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          <Badge className="absolute left-3 top-3">
            {PROJECT_CATEGORIES.find((c) => c.value === project.category)?.label ||
              project.category}
          </Badge>
          {project.isStaffPick && (
            <Badge className="absolute right-3 top-3" variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" />
              Staff Pick
            </Badge>
          )}
        </div>
        <CardContent className="pt-4">
          <h3 className="mb-1 font-semibold line-clamp-1">{project.title}</h3>
          <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
            {project.subtitle}
          </p>
          <p className="text-xs text-muted-foreground">
            by {project.creator.name}
          </p>
        </CardContent>
        <CardFooter className="flex-col items-start gap-3 border-t pt-4">
          <Progress value={Math.min(fundingPercent, 100)} className="h-2" />
          <div className="flex w-full items-center justify-between text-sm">
            <div>
              <span className="font-semibold text-primary">
                ${project.currentAmount.toLocaleString()}
              </span>
              <span className="text-muted-foreground">
                {" "}
                / ${project.goalAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {project.backerCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {project.daysRemaining}d
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

function ProjectListItem({ project }: { project: Project }) {
  const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

  return (
    <Link href={`/projects/${project.slug}`}>
      <Card className="overflow-hidden transition-all hover:shadow-lg">
        <div className="flex">
          <div className="aspect-video w-48 flex-shrink-0 bg-muted relative">
            {project.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.imageUrl}
                alt={project.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {PROJECT_CATEGORIES.find((c) => c.value === project.category)
                      ?.label || project.category}
                  </Badge>
                  {project.isStaffPick && (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Staff Pick
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold">{project.title}</h3>
                <p className="text-sm text-muted-foreground">{project.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">
                  ${project.currentAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  of ${project.goalAmount.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                by {project.creator.name}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {Math.round(fundingPercent)}% funded
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {project.backerCount}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {project.daysRemaining} days left
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
