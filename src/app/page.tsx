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

/*
 * #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE#
 */

// Mock data for featured projects
const featuredProjects = [
  {
    id: "1",
    title: "Revolutionary Solar-Powered Backpack",
    subtitle: "Charge your devices while you explore",
    category: "Technology",
    imageUrl: "/placeholder-1.jpg",
    creator: "Green Tech Labs",
    goalAmount: 50000,
    currentAmount: 42500,
    backerCount: 847,
    daysRemaining: 12,
  },
  {
    id: "2",
    title: "The Art of Mindful Living",
    subtitle: "A beautifully illustrated guide to meditation",
    category: "Publishing",
    imageUrl: "/placeholder-2.jpg",
    creator: "Sarah Chen",
    goalAmount: 15000,
    currentAmount: 18720,
    backerCount: 456,
    daysRemaining: 5,
  },
  {
    id: "3",
    title: "Indie Game: Lost Horizons",
    subtitle: "An epic adventure RPG",
    category: "Games",
    imageUrl: "/placeholder-3.jpg",
    creator: "Pixel Dreams Studio",
    goalAmount: 100000,
    currentAmount: 67800,
    backerCount: 1243,
    daysRemaining: 28,
  },
];

const categories = [
  { name: "Art", count: 234 },
  { name: "Comics", count: 156 },
  { name: "Design", count: 312 },
  { name: "Film", count: 189 },
  { name: "Games", count: 445 },
  { name: "Music", count: 278 },
  { name: "Publishing", count: 321 },
  { name: "Technology", count: 412 },
];

export default function HomePage() {
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
              <p className="text-3xl font-bold text-primary">$2.5B+</p>
              <p className="text-sm text-muted-foreground">Pledged to projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">245K+</p>
              <p className="text-sm text-muted-foreground">Projects funded</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">21M+</p>
              <p className="text-sm text-muted-foreground">Backers worldwide</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-primary">89%</p>
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
