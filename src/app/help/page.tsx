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
  Shield,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Headphones,
  Clock,
  CheckCircle,
  Store,
} from "lucide-react";
import { Footer } from "@/components/footer";

const categories = [
  {
    title: "Getting Started",
    description: "New to IndieCrowdfund? Start here.",
    icon: Rocket,
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
    articles: [
      "How fees are calculated",
      "When funds are released",
      "Accepted payment methods",
      "Refunds and cancellations",
    ],
    href: "/fees",
  },
  {
    title: "For Backers",
    description: "Information for supporters.",
    icon: Users,
    articles: [
      "How to back a project",
      "Managing your pledges",
      "Tracking rewards delivery",
      "Requesting a refund",
    ],
    href: "/faq#backers",
  },
  {
    title: "Shipping & Fulfillment",
    description: "Delivering rewards to backers.",
    icon: Package,
    articles: [
      "Setting shipping options",
      "International shipping",
      "Fulfillment best practices",
      "Tracking deliveries",
    ],
    href: "/faq#shipping",
  },
  {
    title: "Retailer Program",
    description: "For retail partners.",
    icon: Store,
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
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              <HelpCircle className="mr-1 h-3 w-3" />
              Help Center
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              How Can We Help?
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-blue-100">
              Find answers to common questions or get in touch with our support team.
            </p>

            {/* Search Bar */}
            <div className="mx-auto mt-10 max-w-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="search"
                  placeholder="Search for help articles..."
                  className="h-14 pl-12 pr-4 text-lg bg-white dark:bg-zinc-800 border-0 shadow-lg"
                />
              </div>
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

      {/* Quick Stats */}
      <section className="py-12 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <Clock className="h-5 w-5" />
                <span className="text-2xl font-bold">&lt;2 hrs</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Average response time</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-2xl font-bold">98%</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Issues resolved</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <Headphones className="h-5 w-5" />
                <span className="text-2xl font-bold">24/7</span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">Email support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Help Categories */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Browse by Topic
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Find answers organized by category
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Card key={category.title} className="hover:shadow-lg transition-shadow group">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 transition-colors">
                      <category.icon className="h-6 w-6 text-blue-600" />
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
                          className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <ChevronRight className="h-4 w-4" />
                          {article}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href={category.href}>
                    <Button variant="ghost" className="mt-4 w-full group-hover:bg-blue-50">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <BookOpen className="mx-auto h-10 w-10 text-blue-600" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Popular Articles
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              The most frequently viewed help articles
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {popularArticles.map((article, index) => (
              <Link key={article.title} href={article.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                        {index + 1}
                      </span>
                      <span className="font-medium text-zinc-900 dark:text-white">{article.title}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-zinc-500">{article.views} views</span>
                      <ExternalLink className="h-4 w-4 text-zinc-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/faq">
              <Button variant="outline">
                View All FAQs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Still Need Help?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Our support team is here to assist you
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {contactOptions.map((option) => (
              <Card key={option.title} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-8 pb-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <option.icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-white">
                    {option.title}
                  </h3>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">{option.description}</p>
                  <Link href={option.href}>
                    <Button className="mt-6" variant="outline">
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
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-white/80 mb-6" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Creator Resources
          </h2>
          <p className="mt-4 text-xl text-blue-100">
            Access guides, templates, and tools to make your campaign a success.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/faq">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
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
