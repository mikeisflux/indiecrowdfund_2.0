import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  TrendingUp,
  Users,
  DollarSign,
  ArrowRight,
  Quote,
  Star,
  Play,
  Sparkles,
} from "lucide-react";

const featuredStories = [
  {
    id: 1,
    title: "NeoBoard: The Smart Skateboard",
    creator: "Alex Chen",
    category: "Technology",
    raised: 847000,
    goal: 50000,
    backers: 4521,
    image: "/placeholder-project-1.jpg",
    quote: "IndieCrowdfund gave us the platform to turn our garage prototype into a product shipping to 40+ countries. The community support was incredible.",
    highlight: "1,694% funded",
    launchDate: "2023",
  },
  {
    id: 2,
    title: "Echoes of Avalon",
    creator: "Mythic Games Studio",
    category: "Games",
    raised: 1250000,
    goal: 100000,
    backers: 12847,
    image: "/placeholder-project-2.jpg",
    quote: "We went from a small indie team to shipping a AAA-quality board game. The retailer program alone brought in 200+ stores worldwide.",
    highlight: "12,500+ backers",
    launchDate: "2023",
  },
  {
    id: 3,
    title: "Solar Bloom: Smart Garden",
    creator: "GreenTech Innovations",
    category: "Design",
    raised: 523000,
    goal: 75000,
    backers: 3892,
    image: "/placeholder-project-3.jpg",
    quote: "The AI marketing tools helped us reach audiences we never knew existed. Our campaign went viral in the sustainability community.",
    highlight: "Featured in Forbes",
    launchDate: "2024",
  },
];

const stats = [
  { value: "$47M+", label: "Total Raised", icon: DollarSign },
  { value: "892", label: "Funded Projects", icon: Trophy },
  { value: "156K+", label: "Happy Backers", icon: Users },
  { value: "87%", label: "Success Rate", icon: TrendingUp },
];

const categories = [
  { name: "Technology", projects: 234, funded: "$12.4M" },
  { name: "Games", projects: 189, funded: "$15.2M" },
  { name: "Design", projects: 156, funded: "$8.7M" },
  { name: "Film & Video", projects: 98, funded: "$4.1M" },
  { name: "Music", projects: 87, funded: "$2.3M" },
  { name: "Publishing", projects: 128, funded: "$4.3M" },
];

const testimonials = [
  {
    quote: "The team at IndieCrowdfund went above and beyond. When we hit a shipping snag, they connected us with fulfillment partners that saved our campaign.",
    author: "Sarah Mitchell",
    project: "AquaPure Water Bottle",
    avatar: "S",
    raised: "$234,000",
  },
  {
    quote: "As a first-time creator, I was nervous. The creator tools and community support made it feel like I had a whole team behind me.",
    author: "Marcus Thompson",
    project: "Urban Beats Headphones",
    avatar: "M",
    raised: "$89,000",
  },
  {
    quote: "We've launched on multiple platforms. IndieCrowdfund's backer engagement tools are simply the best in the industry.",
    author: "Jennifer Walsh",
    project: "Pocket Drone Pro",
    avatar: "J",
    raised: "$567,000",
  },
];

export default function SuccessStoriesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
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
      <section className="py-16 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <stat.icon className="h-6 w-6 text-orange-600" />
                </div>
                <p className="text-3xl font-bold text-zinc-900 dark:text-white lg:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Stories */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              <Star className="mr-1 h-3 w-3" />
              Featured Campaigns
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Campaigns That Made History
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              These creators took a leap of faith and their communities showed up in a big way.
            </p>
          </div>

          <div className="mt-16 space-y-16">
            {featuredStories.map((story, index) => (
              <div
                key={story.id}
                className={`grid gap-8 lg:grid-cols-2 lg:items-center ${
                  index % 2 === 1 ? "lg:grid-flow-dense" : ""
                }`}
              >
                <div className={index % 2 === 1 ? "lg:col-start-2" : ""}>
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Play className="mx-auto h-16 w-16 text-zinc-400" />
                        <p className="mt-2 text-sm text-zinc-500">Campaign Video</p>
                      </div>
                    </div>
                    <Badge className="absolute top-4 left-4 bg-orange-500">
                      {story.highlight}
                    </Badge>
                  </div>
                </div>

                <div className={index % 2 === 1 ? "lg:col-start-1" : ""}>
                  <Badge variant="outline" className="mb-2">{story.category}</Badge>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white lg:text-3xl">
                    {story.title}
                  </h3>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">by {story.creator}</p>

                  <div className="mt-6 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">
                        ${(story.raised / 1000).toFixed(0)}K
                      </p>
                      <p className="text-sm text-zinc-500">Raised</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {story.backers.toLocaleString()}
                      </p>
                      <p className="text-sm text-zinc-500">Backers</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                        {Math.round((story.raised / story.goal) * 100)}%
                      </p>
                      <p className="text-sm text-zinc-500">Funded</p>
                    </div>
                  </div>

                  <blockquote className="mt-6 border-l-4 border-orange-500 pl-4">
                    <Quote className="h-6 w-6 text-orange-500 mb-2" />
                    <p className="text-zinc-600 dark:text-zinc-400 italic">
                      &ldquo;{story.quote}&rdquo;
                    </p>
                    <footer className="mt-2 text-sm font-medium text-zinc-900 dark:text-white">
                      — {story.creator}
                    </footer>
                  </blockquote>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Breakdown */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Success Across Categories
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              From tech gadgets to tabletop games, creators are finding success in every category.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card key={category.name} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white">{category.name}</h3>
                      <p className="text-sm text-zinc-500">{category.projects} funded projects</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">{category.funded}</p>
                      <p className="text-xs text-zinc-500">total raised</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Creator Testimonials
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.author} className="relative">
                <CardContent className="pt-8 pb-6">
                  <Quote className="absolute top-4 left-4 h-8 w-8 text-orange-200" />
                  <p className="text-zinc-600 dark:text-zinc-400 relative z-10">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t pt-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-semibold text-orange-700">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{testimonial.author}</p>
                      <p className="text-sm text-zinc-500">{testimonial.project}</p>
                    </div>
                    <Badge className="ml-auto bg-emerald-100 text-emerald-700">
                      {testimonial.raised}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-rose-500">
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
