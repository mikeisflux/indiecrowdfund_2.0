import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Percent,
  Package,
  TrendingUp,
  Clock,
  CheckCircle,
  Star,
  Users,
  Truck,
  FileText,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Award,
  BarChart3,
  Globe,
  HeadphonesIcon,
  Zap,
} from "lucide-react";
import { getRetailerStats } from "@/lib/stats/actions";
import { formatCurrency, formatNumber } from "@/lib/stats/utils";
import { Footer } from "@/components/footer";

const features = [
  {
    icon: Percent,
    title: "50% Wholesale Discount",
    description: "Access all retailer-enabled projects at a standard 50% discount off the backer price.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Package,
    title: "Bulk Ordering",
    description: "Order multiple units of any reward tier to stock your shelves with the hottest new products.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Clock,
    title: "Early Access",
    description: "Get first look at new campaigns before they launch to the public.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: FileText,
    title: "Simple Invoicing",
    description: "Easy-to-manage invoicing and payment processing for all your wholesale orders.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Truck,
    title: "Consolidated Shipping",
    description: "Save on shipping with consolidated orders and dedicated retailer fulfillment.",
    color: "from-indigo-500 to-purple-500",
  },
  {
    icon: BarChart3,
    title: "Sales Analytics",
    description: "Track your orders, view trending products, and access detailed sales reports.",
    color: "from-rose-500 to-pink-500",
  },
];

const benefits = [
  {
    icon: TrendingUp,
    title: "Exclusive Products",
    description: "Access crowdfunded products that aren't available through traditional distribution channels.",
  },
  {
    icon: Star,
    title: "Direct Creator Relationships",
    description: "Connect directly with creators for exclusive deals, variants, and signing events.",
  },
  {
    icon: Users,
    title: "Community Building",
    description: "Bring your customers the latest innovative products they're excited about.",
  },
  {
    icon: Award,
    title: "Certified Partner Status",
    description: "Display your certified retailer badge to build customer trust.",
  },
];

const requirements = [
  "Valid business license or DBA",
  "Tax ID (EIN) or Resale Certificate",
  "Physical retail location or established online store",
  "Minimum 6 months in business",
  "Good standing with distributors (if applicable)",
];

/* Testimonials data - commented out for now
const testimonials = [
  {
    quote: "The retailer program has been a game-changer for our comic shop. We've been able to offer our customers exclusive products they can't find anywhere else.",
    author: "Mike's Comics",
    location: "Portland, OR",
    avatar: "M",
  },
  {
    quote: "The 50% discount means healthy margins, and the early access lets us plan our inventory perfectly. Best decision we made this year.",
    author: "Galactic Games & Hobbies",
    location: "Austin, TX",
    avatar: "G",
  },
  {
    quote: "Our customers love being able to pre-order crowdfunded games through us. It's brought so much new foot traffic to our store.",
    author: "Quest Gaming Emporium",
    location: "Seattle, WA",
    avatar: "Q",
  },
];
*/

export default async function RetailersPage() {
  const retailerStats = await getRetailerStats();

  const stats = [
    {
      value: retailerStats.certifiedRetailers > 0
        ? formatNumber(retailerStats.certifiedRetailers)
        : "0",
      label: "Certified Retailers",
      icon: Store,
    },
    {
      value: retailerStats.retailerOrdersTotal > 0
        ? formatCurrency(retailerStats.retailerOrdersTotal)
        : "$0",
      label: "Retailer Orders",
      icon: TrendingUp,
    },
    {
      value: retailerStats.productsAvailable > 0
        ? formatNumber(retailerStats.productsAvailable)
        : "0",
      label: "Products Available",
      icon: Package,
    },
    {
      value: retailerStats.satisfactionRate > 0
        ? `${retailerStats.satisfactionRate}%`
        : "--",
      label: "Satisfaction Rate",
      icon: Star,
    },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[600px] h-[600px] bg-emerald-500/15" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[500px] h-[500px] bg-teal-500/10" style={{ animationDelay: '-8s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-cyan-500/10" style={{ animationDelay: '-15s' }} />
      </div>

      {/* Header with Back Button */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 hidden sm:flex">
              <Store className="w-3 h-3 mr-1" />
              Retailers
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/retailers/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/retailers/apply">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">Apply Now</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/90 via-teal-600/90 to-cyan-700/90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-20 lg:py-24 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30 border-0">
              <Store className="mr-1 h-3 w-3" />
              Retailer Partner Program
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Bring Crowdfunded Products<br />to Your Customers
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-emerald-100">
              Join our certified retailer network and get exclusive access to innovative products
              at wholesale pricing. Stock your store with the next big thing.
            </p>
            <div
              className="mt-10 pb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: '200ms' }}
            >
              <Button asChild size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-xl">
                <Link href="/retailers/apply">
                  Apply Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-white/10 text-white border-2 border-white hover:bg-white/20">
                <Link href="/retailers/login">
                  Retailer Login
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-background"/>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-12 border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="glass-card rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg mb-3">
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent lg:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Badge className="mb-4 bg-primary/10 text-primary border-0">
              <Sparkles className="mr-1 h-3 w-3" />
              Platform Features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need to Succeed
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Our retailer platform is built to help you discover, order, and sell the most innovative products.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                className="glass-card border shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <CardHeader>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} shadow-lg`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-10">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Get started in just a few simple steps
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {[
              { step: "1", title: "Apply", description: "Submit your retailer application with your business details and tax ID." },
              { step: "2", title: "Get Verified", description: "Our team reviews your application within 2-3 business days." },
              { step: "3", title: "Access Portal", description: "Once approved, log in to browse retailer-eligible projects." },
              { step: "4", title: "Order & Sell", description: "Place wholesale orders and bring products to your customers." },
            ].map((item, index) => (
              <div
                key={item.step}
                className="text-center animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-2xl font-bold text-white shadow-lg">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <Badge className="mb-4 bg-primary/10 text-primary border-0">
                <Award className="mr-1 h-3 w-3" />
                Partner Benefits
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Why Retailers Choose Us
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Get in on the ground floor and be among the first retailers who will grow their business with exclusive crowdfunded products.
              </p>

              <div className="mt-8 space-y-6">
                {benefits.map((benefit, index) => (
                  <div
                    key={benefit.title}
                    className="flex gap-4 animate-in fade-in slide-in-from-left-4"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                      <benefit.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{benefit.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-8 text-white shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500"
              style={{ animationDelay: '200ms' }}
            >
              <h3 className="text-2xl font-bold">Retailer Requirements</h3>
              <p className="mt-2 text-emerald-100">
                To qualify for our retailer program, you&apos;ll need:
              </p>
              <ul className="mt-6 space-y-3">
                {requirements.map((req) => (
                  <li key={req} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-200" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg">
                <Link href="/retailers/apply">
                  Start Your Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative py-10">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by Retailers Everywhere
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {/* Demo placeholder cards - testimonials coming soon */}
            {[0, 1, 2].map((index) => (
              <Card
                key={index}
                className="glass-card border shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[200px]">
                  <p className="text-lg font-semibold text-muted-foreground">Demo Content</p>
                  <p className="text-sm text-muted-foreground">Coming Soon</p>
                </CardContent>
              </Card>
            ))}
            {/* Original testimonials - commented out for now
            {testimonials.map((testimonial, index) => (
              <Card
                key={testimonial.author}
                className="glass-card border shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="pt-6">
                  <div className="flex gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-muted-foreground">&quot;{testimonial.quote}&quot;</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 font-semibold text-white shadow-md">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            */}
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="relative py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 p-8 md:p-12 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="text-3xl font-bold text-white">Dedicated Retailer Support</h2>
                <p className="mt-4 text-zinc-400">
                  Our retailer success team is here to help you every step of the way.
                  From onboarding to ongoing support, we&apos;re committed to your success.
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <HeadphonesIcon className="h-5 w-5 text-emerald-400" />
                    <span>Priority Support</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Globe className="h-5 w-5 text-emerald-400" />
                    <span>Dedicated Account Manager</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Zap className="h-5 w-5 text-emerald-400" />
                    <span>Fast Response Times</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4 md:items-end">
                <Button asChild size="lg" className="w-full md:w-auto btn-glow shadow-lg">
                  <Link href="/retailers/apply">
                    Apply for Retailer Access
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <p className="text-sm text-zinc-500">
                  Questions? Email us at{" "}
                  <a href="mailto:retailers@indiecrowdfund.com" className="text-emerald-400 hover:underline">
                    retailers@indiecrowdfund.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="relative py-10 border-t">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-bold">Have Questions?</h2>
          <p className="mt-4 text-muted-foreground">
            Check out our retailer FAQ or contact our support team for more information about the program.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="group">
              <Link href="/retailers/faq">View FAQ</Link>
            </Button>
            <Button asChild variant="outline" className="group">
              <Link href="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
