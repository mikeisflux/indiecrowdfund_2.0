import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Quote,
  Star,
  Sparkles,
  Rocket,
} from "lucide-react";
import { getPlatformStats } from "@/lib/stats/actions";
import { formatCurrency, formatNumber } from "@/lib/stats/utils";
import { getBatchProjectStats } from "@/lib/stats";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Success Stories - Funded Crowdfunding Campaigns",
  description:
    "See real success stories from creators who funded their projects on IndieCrowdfund. Discover how independent creators brought their ideas to life with crowdfunding. Better results than Kickstarter.",
  openGraph: {
    title: "IndieCrowdfund Success Stories",
    description:
      "Real creators, real projects, real funding success. See why IndieCrowdfund is the best Kickstarter alternative for independent creators.",
  },
};

// Force dynamic rendering to ensure database is available
export const dynamic = "force-dynamic";

// Fetch successful projects from database
async function getSuccessfulProjects() {
  try {
    const projects = await db.project.findMany({
      where: {
        status: "FUNDED",
        deletedAt: null,
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
      take: 3,
    });

    const statsMap = await getBatchProjectStats(
      projects.map((p) => ({ id: p.id, status: p.status, goalAmount: p.goalAmount }))
    );

    return projects.map((project) => {
      const liveStats = statsMap.get(project.id) ?? { currentAmount: 0, backerCount: 0 };
      return {
        id: project.id,
        title: project.title,
        creator: project.creator.name || "Creator",
        category: project.category,
        raised: liveStats.currentAmount,
        goal: Number(project.goalAmount),
        backers: liveStats.backerCount,
        image: project.imageUrl || "",
        highlight: `${Number(project.goalAmount) > 0 ? Math.round((liveStats.currentAmount / Number(project.goalAmount)) * 100) : 0}% funded`,
      };
    });
  } catch (error) {
    console.error("Error fetching successful projects:", error);
    return [];
  }
}

// Fetch category stats from database
async function getCategoryStats() {
  try {
    const categoryStats = await db.project.groupBy({
      by: ["category"],
      where: {
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
      },
      _sum: {
        currentAmount: true,
      },
      _count: true,
    });

    return categoryStats.map((cat) => ({
      name: cat.category,
      projects: cat._count,
      funded: formatCurrency(cat._sum.currentAmount || 0),
    }));
  } catch (error) {
    console.error("Error fetching category stats:", error);
    return [];
  }
}

export default async function SuccessStoriesPage() {
  const [platformStats, successfulProjects, categoryStats] = await Promise.all([
    getPlatformStats(),
    getSuccessfulProjects(),
    getCategoryStats(),
  ]);

  const stats = [
    { value: platformStats.totalPledged > 0 ? formatCurrency(platformStats.totalPledged) : "$0", label: "Total Raised", icon: DollarSign },
    { value: formatNumber(platformStats.projectsFunded), label: "Funded Projects", icon: Trophy },
    { value: formatNumber(platformStats.backerPool), label: "Backer Pool", icon: Users },
    { value: `${platformStats.successRate}%`, label: "Success Rate", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background dark:bg-zinc-950 relative overflow-hidden">
      {/* Back Link */}
      <div className="container mx-auto px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>

      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-orange-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-rose-500/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-amber-500/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              <Trophy className="mr-1 h-3 w-3" />
              Success Stories
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Dreams Funded,<br />Products Shipped
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-orange-100">
              Discover how creators like you turned their ideas into reality with the
              support of our amazing backer community.
            </p>
            <div className="mt-10">
              <Link href="/projects/new">
                <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50">
                  Start Your Campaign
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" className="dark:fill-zinc-950"/>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <stat.icon className="h-6 w-6 text-orange-600" />
                </div>
                <p className="text-3xl font-bold text-foreground lg:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Stories */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              <Star className="mr-1 h-3 w-3" />
              Featured Campaigns
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Campaigns That Made History
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              These creators took a leap of faith and their communities showed up in a big way.
            </p>
          </div>

          {successfulProjects.length === 0 ? (
            <div className="mt-16 flex flex-col items-center justify-center py-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Rocket className="h-10 w-10 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Be the First Success Story!
              </h3>
              <p className="mx-auto max-w-md text-muted-foreground mb-6">
                No projects have reached their funding goals yet. Your project could be the first success story featured here!
              </p>
              <Link href="/projects/new">
                <Button className="bg-orange-500 hover:bg-orange-600">
                  Start Your Campaign
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-16 space-y-16">
              {successfulProjects.map((story, index) => (
                <div
                  key={story.id}
                  className={`grid gap-8 md:grid-cols-2 md:items-center ${
                    index % 2 === 1 ? "md:grid-flow-dense" : ""
                  }`}
                >
                  <div className={index % 2 === 1 ? "md:col-start-2" : ""}>
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-muted">
                      {story.image ? (
                        <Image src={story.image} alt={story.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Trophy className="mx-auto h-16 w-16 text-orange-400" />
                            <p className="mt-2 text-sm text-muted-foreground">Funded Campaign</p>
                          </div>
                        </div>
                      )}
                      <Badge className="absolute top-4 left-4 bg-orange-500">
                        {story.highlight}
                      </Badge>
                    </div>
                  </div>

                  <div className={index % 2 === 1 ? "md:col-start-1" : ""}>
                    <Badge variant="outline" className="mb-2">{story.category}</Badge>
                    <h3 className="text-2xl font-bold text-foreground lg:text-3xl">
                      {story.title}
                    </h3>
                    <p className="mt-2 text-muted-foreground">by {story.creator}</p>

                    <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(story.raised)}
                        </p>
                        <p className="text-sm text-muted-foreground">Raised</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {story.backers.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">Backers</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {Math.round((story.raised / story.goal) * 100)}%
                        </p>
                        <p className="text-sm text-muted-foreground">Funded</p>
                      </div>
                    </div>

                    <div className="mt-6 border-l-4 border-orange-500 pl-4">
                      <Quote className="h-6 w-6 text-orange-500 mb-2" />
                      <p className="text-muted-foreground italic">
                        A successfully funded project on IndieCrowdfund!
                      </p>
                      <footer className="mt-2 text-sm font-medium text-foreground">
                        — {story.creator}
                      </footer>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Category Breakdown */}
      <section className="py-12 bg-muted/30 dark:bg-card relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Success Across Categories
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              From tech gadgets to tabletop games, creators are finding success in every category.
            </p>
          </div>

          {categoryStats.length === 0 ? (
            <div className="mt-12 text-center py-8">
              <p className="text-muted-foreground">No category data available yet. Be the first to launch a project!</p>
            </div>
          ) : (
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoryStats.map((category) => (
                <Card key={category.name} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">{category.projects} project{category.projects !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">{category.funded}</p>
                        <p className="text-xs text-muted-foreground">total raised</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Community Section - replaces hardcoded testimonials */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Join Our Creator Community
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Thousands of creators trust IndieCrowdfund to bring their ideas to life.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Card className="relative">
              <CardContent className="pt-8 pb-6">
                <Quote className="absolute top-4 left-4 h-8 w-8 text-orange-200" />
                <p className="text-muted-foreground relative z-10">
                  Start your journey today and join our growing community of successful creators and passionate backers.
                </p>
                <div className="mt-6 pt-4 border-t">
                  <Link href="/projects/new">
                    <Button className="w-full bg-orange-500 hover:bg-orange-600">
                      Start a Project
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card className="relative">
              <CardContent className="pt-8 pb-6">
                <Quote className="absolute top-4 left-4 h-8 w-8 text-orange-200" />
                <p className="text-muted-foreground relative z-10">
                  Discover innovative projects from creators around the world and be part of bringing new ideas to life.
                </p>
                <div className="mt-6 pt-4 border-t">
                  <Link href="/discover">
                    <Button variant="outline" className="w-full">
                      Discover Projects
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            <Card className="relative">
              <CardContent className="pt-8 pb-6">
                <Quote className="absolute top-4 left-4 h-8 w-8 text-orange-200" />
                <p className="text-muted-foreground relative z-10">
                  Need help getting started? Our creator resources and guides will help you launch a successful campaign.
                </p>
                <div className="mt-6 pt-4 border-t">
                  <Link href="/creator-handbook">
                    <Button variant="outline" className="w-full">
                      Creator Resources
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-gradient-to-r from-orange-500 to-rose-500">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-white/80 mb-6" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Write Your Success Story?
          </h2>
          <p className="mt-4 text-xl text-orange-100">
            Join thousands of creators who have brought their ideas to life with IndieCrowdfund.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/projects/new">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50">
                Launch Your Campaign
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/discover">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Explore Projects
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
