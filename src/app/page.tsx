import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { getPlatformStats } from "@/lib/stats/actions";
import { formatCurrency, formatNumber } from "@/lib/stats/utils";
import { db } from "@/lib/db";

// Force dynamic rendering to ensure database is available
export const dynamic = "force-dynamic";

/*
 * #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE#
 */

// Fetch featured/live projects from database
async function getFeaturedProjects() {
  const projects = await db.project.findMany({
    where: {
      status: "LIVE",
    },
    include: {
      creator: {
        select: {
          name: true,
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
    };
  });
}

// Fetch category counts from database
async function getCategoryCounts() {
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
}

export default async function HomePage() {
  const [stats, featuredProjects, categories] = await Promise.all([
    getPlatformStats(),
    getFeaturedProjects(),
    getCategoryCounts(),
  ]);

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/discover" className="text-sm font-medium hover:text-primary">
                Discover
              </Link>
              <Link href="/projects/new" className="text-sm font-medium hover:text-primary">
                Start a Project
              </Link>
              <Link href="/retailers" className="text-sm font-medium hover:text-primary">
                Retailers
              </Link>
              <Link href="/about-us" className="text-sm font-medium hover:text-primary">
                About Us
              </Link>
              <Link href="/faq" className="text-sm font-medium hover:text-primary">
                FAQ
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="w-64 pl-10"
              />
            </div>
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

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4" variant="secondary">
              Fund what matters to you
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Bring Creative Projects to Life
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              IndieCrowdfund is home to thousands of creative projects in art, design,
              film, games, music, and more. Back a project or start your own today.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/discover">
                <Button size="lg" className="w-full sm:w-auto">
                  Discover Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/projects/new">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Start a Project
                  <Rocket className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30 py-12">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {stats.totalPledged > 0 ? `${formatCurrency(stats.totalPledged)}+` : "$0"}
              </p>
              <p className="text-sm text-muted-foreground">Pledged to projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {stats.projectsFunded > 0 ? formatNumber(stats.projectsFunded) : "0"}
              </p>
              <p className="text-sm text-muted-foreground">Projects funded</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {stats.totalBackers > 0 ? formatNumber(stats.totalBackers) : "0"}
              </p>
              <p className="text-sm text-muted-foreground">Backers worldwide</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">
                {stats.successRate > 0 ? `${stats.successRate}%` : "0%"}
              </p>
              <p className="text-sm text-muted-foreground">Success rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Featured Projects</h2>
              <p className="text-muted-foreground">Handpicked projects we love</p>
            </div>
            <Link href="/discover">
              <Button variant="ghost">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredProjects.map((project) => (
              <Card key={project.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <Badge className="absolute left-3 top-3">{project.category}</Badge>
                </div>
                <CardContent className="pt-4">
                  <h3 className="mb-1 font-semibold line-clamp-1">{project.title}</h3>
                  <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                    {project.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground">by {project.creator}</p>
                </CardContent>
                <CardFooter className="flex-col items-start gap-3 border-t pt-4">
                  <Progress
                    value={(project.currentAmount / project.goalAmount) * 100}
                    className="h-2"
                  />
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
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-t bg-muted/30 py-16 md:py-24">
        <div className="container">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Browse by Category</h2>
            <p className="text-muted-foreground">
              Find projects in your favorite creative space
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={`/discover?category=${category.name.toLowerCase()}`}
                className="group flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary"
              >
                <span className="font-medium group-hover:text-primary">
                  {category.name}
                </span>
                <Badge variant="secondary">{category.count}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">How It Works</h2>
            <p className="text-muted-foreground">
              Three simple steps to fund your creative vision
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">1. Create Your Project</h3>
              <p className="text-sm text-muted-foreground">
                Set up your campaign with a compelling story, reward tiers, and funding goal.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">2. Share & Get Backed</h3>
              <p className="text-sm text-muted-foreground">
                Share your project with the world and build a community of backers.
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">3. Make It Real</h3>
              <p className="text-sm text-muted-foreground">
                Receive your funds and bring your creative project to life.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/projects/new">
              <Button size="lg">
                Start Your Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-primary py-16 text-primary-foreground md:py-24">
        <div className="container text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            Ready to bring your idea to life?
          </h2>
          <p className="mb-8 text-primary-foreground/80">
            Join thousands of creators who have funded their dreams on IndieCrowdfund.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h4 className="mb-4 font-semibold">IndieCrowdfund</h4>
              <p className="text-sm text-muted-foreground">
                Empowering creators to bring their ideas to life through community funding.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Discover</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/discover" className="hover:text-foreground">All Projects</Link></li>
                <li><Link href="/discover?category=games" className="hover:text-foreground">Games</Link></li>
                <li><Link href="/discover?category=technology" className="hover:text-foreground">Technology</Link></li>
                <li><Link href="/discover?category=art" className="hover:text-foreground">Art</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">For Creators</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/projects/new" className="hover:text-foreground">Start a Project</Link></li>
                <li><Link href="/creator-handbook" className="hover:text-foreground">Creator Handbook</Link></li>
                <li><Link href="/fees" className="hover:text-foreground">Fees & Pricing</Link></li>
                <li><Link href="/success-stories" className="hover:text-foreground">Success Stories</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/help" className="hover:text-foreground">Help Center</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/contact" className="hover:text-foreground">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} IndieCrowdfund. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
