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
  Sparkles,
  Award,
  BarChart3,
  Globe,
  HeadphonesIcon,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Percent,
    title: "50% Wholesale Discount",
    description: "Access all retailer-enabled projects at a standard 50% discount off the backer price.",
  },
  {
    icon: Package,
    title: "Bulk Ordering",
    description: "Order multiple units of any reward tier to stock your shelves with the hottest new products.",
  },
  {
    icon: Clock,
    title: "Early Access",
    description: "Get first look at new campaigns before they launch to the public.",
  },
  {
    icon: FileText,
    title: "Simple Invoicing",
    description: "Easy-to-manage invoicing and payment processing for all your wholesale orders.",
  },
  {
    icon: Truck,
    title: "Consolidated Shipping",
    description: "Save on shipping with consolidated orders and dedicated retailer fulfillment.",
  },
  {
    icon: BarChart3,
    title: "Sales Analytics",
    description: "Track your orders, view trending products, and access detailed sales reports.",
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

const stats = [
  { value: "500+", label: "Certified Retailers" },
  { value: "$2.4M", label: "Retailer Orders" },
  { value: "1,200+", label: "Products Available" },
  { value: "98%", label: "Satisfaction Rate" },
];

export default function RetailersPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
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
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/retailers/apply">
                <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
                  Apply Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/retailers/login">
                <Button size="lg" className="bg-white/10 text-white border-2 border-white hover:bg-white/20">
                  Retailer Login
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
                <p className="text-3xl font-bold text-emerald-600 lg:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              <Sparkles className="mr-1 h-3 w-3" />
              Platform Features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Everything You Need to Succeed
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Our retailer platform is built to help you discover, order, and sell the most innovative products.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-emerald-200 transition-colors">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                    <feature.icon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-zinc-600 dark:text-zinc-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Get started in just a few simple steps
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {[
              { step: "1", title: "Apply", description: "Submit your retailer application with your business details and tax ID." },
              { step: "2", title: "Get Verified", description: "Our team reviews your application within 2-3 business days." },
              { step: "3", title: "Access Portal", description: "Once approved, log in to browse retailer-eligible projects." },
              { step: "4", title: "Order & Sell", description: "Place wholesale orders and bring products to your customers." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                <Award className="mr-1 h-3 w-3" />
                Partner Benefits
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                Why Retailers Choose Us
              </h2>
              <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
                Join hundreds of retailers who are growing their business with exclusive crowdfunded products.
              </p>

              <div className="mt-8 space-y-6">
                {benefits.map((benefit) => (
                  <div key={benefit.title} className="flex gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <benefit.icon className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white">{benefit.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white">
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
              <Link href="/retailers/apply">
                <Button className="mt-8 w-full bg-white text-emerald-700 hover:bg-emerald-50">
                  Start Your Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Trusted by Retailers Everywhere
            </h2>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.author}>
                <CardContent className="pt-6">
                  <div className="flex gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-4 text-zinc-600 dark:text-zinc-400">&quot;{testimonial.quote}&quot;</p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-700">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">{testimonial.author}</p>
                      <p className="text-sm text-zinc-500">{testimonial.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 md:p-12 dark:bg-zinc-800">
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
                <Link href="/retailers/apply">
                  <Button size="lg" className="w-full md:w-auto">
                    Apply for Retailer Access
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
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
      <section className="py-20 border-t">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Have Questions?</h2>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Check out our retailer FAQ or contact our support team for more information about the program.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/retailers/faq">
              <Button variant="outline">View FAQ</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline">Contact Support</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
