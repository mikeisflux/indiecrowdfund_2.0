import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  HelpCircle,
  Search,
  BookOpen,
  MessageCircle,
  Mail,
  FileText,
  Users,
  Rocket,
  CreditCard,
  Package,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Headphones,
  Clock,
  CheckCircle,
  Store,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Help Center - Support for Creators & Backers",
  description:
    "Get help with IndieCrowdfund. Find answers about crowdfunding campaigns, backing projects, payments, rewards, and more. 24/7 creator and backer support.",
  openGraph: {
    title: "IndieCrowdfund Help Center",
    description:
      "Find answers and get support for your crowdfunding experience on IndieCrowdfund.",
  },
};

const categories = [
  {
    title: "Getting Started",
    description: "New to IndieCrowdfund? Start here.",
    icon: Rocket,
    color: "from-indigo-500 to-purple-500",
    articles: [
      "How to create your first campaign",
      "Setting up your creator profile",
      "Understanding campaign goals",
      "Tips for a successful launch",
    ],
    href: "/faq#getting-started",
  },
  {
    title: "Campaign Management",
    description: "Running and managing your campaign.",
    icon: FileText,
    color: "from-blue-500 to-cyan-500",
    articles: [
      "Updating your campaign page",
      "Communicating with backers",
      "Managing reward tiers",
      "Handling stretch goals",
    ],
    href: "/faq#campaigns",
  },
  {
    title: "Payments & Fees",
    description: "Understanding payments and pricing.",
    icon: CreditCard,
    color: "from-emerald-500 to-teal-500",
    articles: [
      "How fees are calculated",
      "PayPal, Divinity Payments, and Whop payments",
      "When funds are released",
      "Accepted payment methods (Card, PayPal, Divinity Payments, Whop)",
    ],
    href: "/fees",
  },
  {
    title: "For Backers",
    description: "Information for supporters.",
    icon: Users,
    color: "from-pink-500 to-rose-500",
    articles: [
      "How to back a project",
      "Managing your pledges",
      "Tracking rewards delivery",
      "Requesting a refund",
      "Locking your order",
    ],
    href: "/faq#backers",
  },
  {
    title: "Shipping & Fulfillment",
    description: "Delivering rewards to backers.",
    icon: Package,
    color: "from-amber-500 to-orange-500",
    articles: [
      "Setting shipping options",
      "International shipping",
      "Fulfillment best practices",
      "Tracking deliveries",
      "Locking orders early with Order Lock",
      "Printing your books with Printing Comics",
    ],
    href: "/faq#shipping",
  },
  {
    title: "Retailer Program",
    description: "For retail partners.",
    icon: Store,
    color: "from-violet-500 to-purple-500",
    articles: [
      "How to apply",
      "Wholesale pricing",
      "Retailer dashboard guide",
      "Bulk ordering",
    ],
    href: "/retailers",
  },
];

const popularArticles = [
  { title: "How do I start a campaign?", views: "12.4k", href: "/faq" },
  { title: "What are the platform fees?", views: "9.8k", href: "/fees" },
  { title: "How do I back a project?", views: "8.2k", href: "/faq" },
  { title: "When will I receive my reward?", views: "7.5k", href: "/faq" },
  { title: "Can I cancel my pledge?", views: "6.1k", href: "/faq" },
  { title: "How do refunds work?", views: "5.4k", href: "/faq" },
];

const contactOptions = [
  {
    title: "Email Support",
    description: "Get help via email within 24 hours",
    icon: Mail,
    action: "support@indiecrowdfund.com",
    href: "mailto:support@indiecrowdfund.com",
  },
  {
    title: "Live Chat",
    description: "Chat with our team (9am-6pm EST)",
    icon: MessageCircle,
    action: "Start Chat",
    href: "/contact",
  },
  {
    title: "Community Forum",
    description: "Connect with other creators",
    icon: Users,
    action: "Visit Forum",
    href: "/community",
  },
];

export default function HelpPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
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

      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[600px] h-[600px] bg-blue-500/15" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[500px] h-[500px] bg-purple-500/10" style={{ animationDelay: '-8s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-cyan-500/10" style={{ animationDelay: '-16s' }} />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 via-indigo-600/90 to-purple-700/90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30 border-0">
              <HelpCircle className="mr-1 h-3 w-3" />
              Help Center
            </Badge>
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              How Can We Help?
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-blue-100">
              Find answers to common questions or get in touch with our support team.
            </p>

            {/* Search Bar */}
            <div
              className="mx-auto mt-10 max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: '200ms' }}
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="search"
                  placeholder="Search for help articles..."
                  className="h-14 pl-12 pr-4 text-lg bg-white/95 dark:bg-zinc-800/95 backdrop-blur-sm border-0 shadow-2xl rounded-2xl focus:ring-2 focus:ring-white/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-background"/>
          </svg>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="relative py-12 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 text-center">
            {[
              { icon: Clock, value: "<2 hrs", label: "Average response time" },
              { icon: CheckCircle, value: "98%", label: "Issues resolved" },
              { icon: Headphones, value: "24/7", label: "Email support" },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="glass-card rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center justify-center gap-2 text-primary">
                  <stat.icon className="h-5 w-5" />
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="relative py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Browse by Topic
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Find answers organized by category
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => (
              <Card
                key={category.title}
                className="glass-card border shadow-lg hover:shadow-xl transition-all duration-300 group hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${category.color} shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                      <category.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>{category.title}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.articles.map((article) => (
                      <li key={article}>
                        <Link
                          href={category.href}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                          {article}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={category.href}>
                    <Button variant="ghost" className="mt-4 w-full group-hover:bg-primary/10">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="relative py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50 backdrop-blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg mb-4">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Popular Articles
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              The most frequently viewed help articles
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {popularArticles.map((article, index) => (
              <Link
                key={article.title}
                href={article.href}
                className="block animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <Card className="glass-card border shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-semibold text-primary-foreground shadow-md">
                        {index + 1}
                      </span>
                      <span className="font-medium">{article.title}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{article.views} views</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/faq">
              <Button variant="outline" className="group">
                View All FAQs
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="relative py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Still Need Help?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Our support team is here to assist you
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
            {contactOptions.map((option, index) => (
              <Card
                key={option.title}
                className="glass-card border shadow-lg text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="pt-8 pb-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner">
                    <option.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">
                    {option.title}
                  </h3>
                  <p className="mt-2 text-muted-foreground">{option.description}</p>
                  <Link href={option.href}>
                    <Button className="mt-6 btn-glow" variant="outline">
                      {option.action}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Creator Resources */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 animate-in fade-in zoom-in duration-500">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white sm:text-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            Creator Resources
          </h2>
          <p className="mt-4 text-xl text-blue-100 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            Access guides, templates, and tools to make your campaign a success.
          </p>
          <div
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <Link href="/faq">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-xl">
                Creator Handbook
                <BookOpen className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Contact Support
                <Mail className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
