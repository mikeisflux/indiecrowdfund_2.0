"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Shield,
  Users,
  CreditCard,
  Sparkles,
  BarChart3,
  Globe,
  Store,
  Gift,
  Mail,
  Palette,
  FileText,
  Search,
  Bot,
  Layers,
  Clock,
  Target,
  TrendingUp,
  CheckCircle,
  Star,
  Zap,
  Heart,
  Award,
  Image as ImageIcon,
  MessageSquare,
  Settings,
  PieChart,
  Lock,
  Eye,
  DollarSign,
  Package,
  Truck,
  Calendar,
  UserCheck,
  ShieldCheck,
  Megaphone,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  Download,
  ShoppingCart,
  FileDown,
  Box,
} from "lucide-react";
import { Footer } from "@/components/footer";

const platformFeatures = [
  {
    category: "Project Creation",
    icon: Rocket,
    color: "from-indigo-500 to-purple-500",
    features: [
      {
        title: "6-Step Project Builder",
        description:
          "Intuitive wizard guides you through creating the perfect campaign with step-by-step validation and real-time previews.",
        icon: Layers,
      },
      {
        title: "AI-Powered Content Assistance",
        description:
          "Get help writing compelling descriptions, FAQs, and marketing copy with our AI assistant trained on successful campaigns.",
        icon: Bot,
      },
      {
        title: "Flexible Reward Tiers",
        description:
          "Create unlimited reward tiers and add-ons with custom pricing, quantities, shipping options, and delivery estimates.",
        icon: Gift,
      },
      {
        title: "Smart Funding Calculator",
        description:
          "AI analyzes your project type and costs to recommend optimal funding goals and pricing strategies.",
        icon: Target,
        comingSoon: true,
      },
      {
        title: "Pre-Launch Pages",
        description:
          "Build anticipation with customizable pre-launch landing pages, email collection, and countdown timers.",
        icon: Clock,
      },
      {
        title: "Project Templates",
        description:
          "Start faster with category-specific templates for comics, games, art books, and other creative projects.",
        icon: FileText,
        comingSoon: true,
      },
    ],
  },
  {
    category: "Payment Processing",
    icon: CreditCard,
    color: "from-emerald-500 to-teal-500",
    features: [
      {
        title: "Secure Payment Processing",
        description:
          "All payments processed securely through Stripe with industry-leading fraud protection and chargeback prevention.",
        icon: CreditCard,
      },
      {
        title: "Global Payment Support",
        description:
          "Accept payments in multiple currencies with automatic conversion. Support for Apple Pay, Google Pay, and local payment methods.",
        icon: Globe,
      },
      {
        title: "All-or-Nothing Funding",
        description:
          "Backers are only charged if you reach your goal—creating trust and reducing risk for everyone.",
        icon: Target,
      },
      {
        title: "Secure Transactions",
        description:
          "PCI-compliant payment processing with encrypted data transmission and storage. Your financial data is always protected.",
        icon: Lock,
      },
      {
        title: "Transparent Fee Structure",
        description:
          "Clear 3% platform fee plus payment processing. No hidden charges. See exactly what you'll receive with our fee calculator.",
        icon: DollarSign,
      },
      {
        title: "Flexible Payout Options",
        description:
          "Fast payouts via bank transfer or payment cards. Automated disbursement after successful campaign completion.",
        icon: TrendingUp,
      },
      {
        title: "All-or-Nothing Protection",
        description:
          "Backers are only charged when campaigns reach their goal. Failed payment retries happen automatically up to 3 times over 9 days.",
        icon: Shield,
      },
    ],
  },
  {
    category: "Creator Tools",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    features: [
      {
        title: "Creator Dashboard",
        description:
          "Command center for your campaigns with real-time funding updates, backer management, and action items.",
        icon: BarChart3,
      },
      {
        title: "Backer Communication",
        description:
          "Send project updates, polls, and direct messages. Automated notifications keep backers engaged and informed.",
        icon: MessageSquare,
      },
      {
        title: "Stretch Goal Manager",
        description:
          "Create and manage stretch goals with visual progress indicators. Automatically unlock rewards when goals are reached.",
        icon: Target,
        comingSoon: true,
      },
      {
        title: "Collaborator System",
        description:
          "Add team members with customizable permissions for editing, community management, and fulfillment coordination.",
        icon: Users,
      },
      {
        title: "Media Library",
        description:
          "Centralized storage for all your project images, videos, and files with automatic optimization and CDN delivery.",
        icon: ImageIcon,
      },
      {
        title: "Export & Reports",
        description:
          "Download backer data, financial reports, and fulfillment spreadsheets. CSV and Excel formats supported.",
        icon: FileText,
      },
    ],
  },
  {
    category: "IndieKit",
    icon: Box,
    color: "from-teal-500 to-cyan-500",
    features: [
      {
        title: "Backer Management",
        description:
          "View, search, and filter all backers with detailed profiles including order history, survey responses, notes, and communication history.",
        icon: Users,
      },
      {
        title: "Survey System",
        description:
          "Collect shipping addresses, size preferences, and custom responses from backers with automated reminders and validation.",
        icon: ClipboardList,
      },
      {
        title: "Fulfillment Workflow",
        description:
          "Step-by-step guided workflow from surveys to shipping with progress tracking, action items, and status updates for each stage.",
        icon: CheckCircle,
      },
      {
        title: "Package Groups",
        description:
          "Organize backers into shipping groups by region, pledge level, or custom criteria for efficient batch fulfillment and label generation.",
        icon: Package,
      },
      {
        title: "Digital Distribution",
        description:
          "Upload and distribute digital rewards like PDFs, ebooks, and downloads to eligible backers automatically with download tracking.",
        icon: Download,
      },
      {
        title: "Email Campaigns",
        description:
          "Send targeted emails to backers, segments, or groups with customizable templates, scheduling, and open/click tracking.",
        icon: Mail,
      },
      {
        title: "Shipping Integration",
        description:
          "Connect with ShipStation and other shipping services to generate labels, calculate rates, and track packages in real-time.",
        icon: Truck,
      },
      {
        title: "Backer Segments",
        description:
          "Create dynamic segments based on pledge level, survey status, shipping region, or custom rules for targeted communications and actions.",
        icon: Layers,
      },
      {
        title: "Export Tools",
        description:
          "Export backer data, addresses, and order information in CSV or PDF formats compatible with fulfillment services and spreadsheets.",
        icon: FileDown,
      },
      {
        title: "Pre-Order Store",
        description:
          "Continue selling products after your campaign ends with a built-in pre-order store that integrates with your fulfillment workflow.",
        icon: ShoppingCart,
      },
      {
        title: "Activity Timeline",
        description:
          "Track all fulfillment actions with a comprehensive timeline showing surveys, payments, shipments, refunds, and backer interactions.",
        icon: Clock,
      },
      {
        title: "Product Management",
        description:
          "Manage SKUs, weights, dimensions, and customs information for all physical products with inventory tracking and variant support.",
        icon: Box,
      },
    ],
  },
  {
    category: "Analytics & Insights",
    icon: BarChart3,
    color: "from-blue-500 to-indigo-500",
    features: [
      {
        title: "Real-Time Analytics",
        description:
          "Track funding progress, traffic sources, conversion rates, and backer demographics with live-updating dashboards.",
        icon: PieChart,
      },
      {
        title: "Referral Tracking",
        description:
          "Unique tracking links and UTM support to measure ROI from every marketing channel—social, email, ads, influencers.",
        icon: TrendingUp,
      },
      {
        title: "Geographic Insights",
        description:
          "See where your backers come from with country and city-level breakdowns. Optimize shipping and marketing accordingly.",
        icon: Globe,
      },
      {
        title: "Reward Popularity",
        description:
          "Analyze which reward tiers convert best. Identify pricing sweet spots and optimize your offering.",
        icon: Star,
      },
      {
        title: "Third-Party Integration",
        description:
          "Connect Google Analytics 4 and Meta Pixel for advanced tracking, remarketing, and conversion optimization.",
        icon: Settings,
      },
      {
        title: "Behavioral Analytics",
        description:
          "AI-powered insights into backer behavior, engagement patterns, and predictive funding forecasts.",
        icon: Eye,
      },
    ],
  },
  {
    category: "AI Marketing Suite",
    icon: Bot,
    color: "from-pink-500 to-rose-500",
    features: [
      {
        title: "AI Content Generator",
        description:
          "Generate social media posts, email campaigns, and ad copy optimized for engagement and conversions.",
        icon: Sparkles,
      },
      {
        title: "Optimal Posting Times",
        description:
          "AI analyzes your audience to recommend the best times to post on each platform for maximum reach.",
        icon: Clock,
      },
      {
        title: "Hashtag Optimization",
        description:
          "Get AI-suggested hashtags based on your project category, trending topics, and competitive analysis.",
        icon: Search,
      },
      {
        title: "Email Campaign Builder",
        description:
          "Create automated email sequences for pre-launch, launch day, mid-campaign, and final push communications.",
        icon: Mail,
      },
      {
        title: "A/B Testing",
        description:
          "Test different headlines, images, and messaging to find what resonates best with your audience.",
        icon: Layers,
      },
      {
        title: "Campaign Calendar",
        description:
          "AI-generated marketing calendar with scheduled content, milestones, and engagement prompts.",
        icon: Calendar,
      },
    ],
  },
  {
    category: "Backer Experience",
    icon: Users,
    color: "from-amber-500 to-orange-500",
    features: [
      {
        title: "Personalized Dashboard",
        description:
          "Backers get a central hub to manage pledges, track rewards, receive updates, and communicate with creators.",
        icon: BarChart3,
      },
      {
        title: "AI Recommendations",
        description:
          "Smart project suggestions based on backing history, browsing behavior, and similar backer preferences.",
        icon: Sparkles,
      },
      {
        title: "Pledge Management",
        description:
          "Easy modification and cancellation of pledges before campaign end. Add-on purchases and upgrades anytime.",
        icon: Settings,
      },
      {
        title: "Fulfillment Tracking",
        description:
          "Real-time status updates from production to delivery. Tracking numbers and estimated arrival dates.",
        icon: Truck,
      },
      {
        title: "Address Management",
        description:
          "Update shipping addresses across all pledges. Automatic validation and formatting for international addresses.",
        icon: Package,
      },
      {
        title: "Social Features",
        description:
          "Follow favorite creators, share projects, comment on updates, and participate in backer communities.",
        icon: Heart,
      },
    ],
  },
  {
    category: "Retailer Program (LCS)",
    icon: Store,
    color: "from-emerald-500 to-green-500",
    features: [
      {
        title: "Wholesale Portal",
        description:
          "Certified retailers access a dedicated portal with wholesale pricing, bulk ordering, and easy invoicing.",
        icon: Store,
      },
      {
        title: "50% Discount",
        description:
          "Industry-standard wholesale pricing lets comic shops and bookstores stock crowdfunded products profitably.",
        icon: DollarSign,
      },
      {
        title: "Retailer Verification",
        description:
          "Business verification process ensures only legitimate retailers access wholesale pricing and terms.",
        icon: UserCheck,
      },
      {
        title: "Bulk Order Management",
        description:
          "Minimum order quantities, purchase order support, and streamlined invoicing for business customers.",
        icon: Package,
      },
      {
        title: "Creator Opt-In",
        description:
          "Creators choose whether to enable retailer access and set their own discount levels and order limits.",
        icon: CheckCircle,
      },
      {
        title: "B2B Dashboard",
        description:
          "Retailers track orders, manage invoices, and browse retailer-eligible projects from a single dashboard.",
        icon: BarChart3,
      },
    ],
  },
  {
    category: "Trust & Safety",
    icon: Shield,
    color: "from-red-500 to-rose-500",
    features: [
      {
        title: "Project Review Process",
        description:
          "Every project is reviewed by our team before launch. AI-assisted flagging ensures quality and compliance.",
        icon: Eye,
      },
      {
        title: "AI Fraud Detection",
        description:
          "Machine learning algorithms identify suspicious patterns, protecting backers from potential scams.",
        icon: ShieldCheck,
      },
      {
        title: "Identity Verification",
        description:
          "Creator identity verification builds trust. Verified badges show backers they're supporting legitimate projects.",
        icon: UserCheck,
      },
      {
        title: "Dispute Resolution",
        description:
          "Structured process for handling backer complaints, with mediation support and clear escalation paths.",
        icon: MessageSquare,
      },
      {
        title: "Content Moderation",
        description:
          "Automated and manual moderation keeps the platform free from prohibited content and policy violations.",
        icon: Shield,
      },
      {
        title: "Secure Data Handling",
        description:
          "GDPR-compliant data practices. Encrypted storage, minimal data collection, and user data export options.",
        icon: Lock,
      },
    ],
  },
  {
    category: "Admin Tools",
    icon: Settings,
    color: "from-gray-500 to-slate-500",
    features: [
      {
        title: "Project Review Center",
        description:
          "Streamlined queue for reviewing submissions with AI risk scores, creator history, and one-click actions.",
        icon: CheckCircle,
      },
      {
        title: "User Management",
        description:
          "Comprehensive tools for managing users, handling reports, and maintaining community standards.",
        icon: Users,
      },
      {
        title: "Theme Customization",
        description:
          "Visual theme builder to customize colors, typography, and branding without touching code.",
        icon: Palette,
      },
      {
        title: "Page Builder",
        description:
          "Drag-and-drop builder for creating landing pages, promotional content, and custom site pages.",
        icon: Layers,
      },
      {
        title: "Email Campaigns",
        description:
          "Send platform-wide announcements, promotional emails, and automated transactional messages.",
        icon: Mail,
      },
      {
        title: "Site Analytics",
        description:
          "Platform-wide metrics including active projects, funding totals, user growth, and revenue analytics.",
        icon: BarChart3,
      },
    ],
  },
];

interface PlatformStats {
  projectsFunded: number;
  projectsLive: number;
  projectsTotal: number;
  totalRaised: number;
  totalPledges: number;
  totalCreators: number;
  totalUsers: number;
}

const values = [
  {
    title: "Creator First",
    description:
      "We build every feature with creators in mind. Your success is our success.",
    icon: Heart,
    color: "from-pink-500 to-rose-500",
  },
  {
    title: "Transparency",
    description:
      "Clear fees, honest policies, and open communication. No hidden surprises.",
    icon: Eye,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Innovation",
    description:
      "Constantly improving with AI, analytics, and cutting-edge technology.",
    icon: Lightbulb,
    color: "from-amber-500 to-orange-500",
  },
  {
    title: "Community",
    description:
      "Connecting creators with passionate audiences who believe in their vision.",
    icon: Users,
    color: "from-purple-500 to-indigo-500",
  },
];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M+`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K+`;
  }
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M+`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K+`;
  }
  return `$${amount.toLocaleString()}`;
}

export default function AboutUsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/platform-stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
      }
    }
    fetchStats();
  }, []);

  const displayStats = [
    {
      label: "Projects Funded",
      value: stats ? formatNumber(stats.projectsFunded) : "...",
      icon: Rocket
    },
    {
      label: "Total Raised",
      value: stats ? formatCurrency(stats.totalRaised) : "...",
      icon: DollarSign
    },
    {
      label: "Backer Pool",
      value: stats ? formatNumber(stats.totalUsers) : "...",
      icon: Users
    },
    {
      label: "Creators",
      value: stats ? formatNumber(stats.totalCreators) : "...",
      icon: Globe
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
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
        <div className="floating-orb absolute -top-40 -right-40 w-[600px] h-[600px] bg-indigo-500/15" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[500px] h-[500px] bg-purple-500/10" style={{ animationDelay: '-7s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-pink-500/10" style={{ animationDelay: '-14s' }} />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-purple-600/90 to-pink-600/90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative container mx-auto px-4 py-12 z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="bg-white/20 text-white border-0 mb-4 animate-in fade-in zoom-in duration-500">
              About IndieCrowdfund
            </Badge>
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold mb-4 text-white animate-in fade-in slide-in-from-bottom-4 duration-700">
              Empowering Independent Creators Since 2024
            </h1>
            <p
              className="text-base sm:text-xl md:text-2xl text-white/80 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: '100ms' }}
            >
              We&apos;re building the most powerful and creator-friendly crowdfunding platform for comics, games, art, and creative projects.
            </p>
            <div
              className="flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: '200ms' }}
            >
              <Link href="/projects/new">
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-white/90 shadow-xl">
                  Start Your Project
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/discover">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Explore Projects
                </Button>
              </Link>
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

      {/* Stats Section */}
      <section className="relative py-12 border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {displayStats.map((stat, index) => (
              <div
                key={stat.label}
                className="glass-card rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg mb-3">
                  <stat.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{stat.value}</p>
                <p className="text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="relative py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-3xl font-bold mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">Our Mission</h2>
            <p
              className="text-xl text-muted-foreground mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: '100ms' }}
            >
              We believe every creative idea deserves a chance to exist. Our mission is to provide creators with the tools, community, and support they need to bring their visions to life—while giving fans a direct way to support the projects they love.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <Card
                  key={value.title}
                  className="glass-card border shadow-lg text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50 + 200}ms`, animationFillMode: 'backwards' }}
                >
                  <CardContent className="pt-6">
                    <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br ${value.color} shadow-lg mb-4`}>
                      <value.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="relative py-8">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative container mx-auto px-4">
          <div className="text-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Badge className="mb-4 bg-primary/10 text-primary border-0">
              <Sparkles className="mr-1 h-3 w-3" />
              Platform Features
            </Badge>
            <h2 className="text-xl sm:text-3xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover the comprehensive suite of tools and features that make IndieCrowdfund the most powerful platform for independent creators.
            </p>
          </div>

          <div className="space-y-16">
            {platformFeatures.map((category, categoryIndex) => (
              <div
                key={category.category}
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${categoryIndex * 100}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center shadow-lg`}>
                    <category.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{category.category}</h3>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.features.map((feature, featureIndex) => (
                    <Card
                      key={feature.title}
                      className="glass-card border shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                      style={{ animationDelay: `${featureIndex * 25}ms` }}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                            <feature.icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{feature.title}</h4>
                              {feature.comingSoon && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Coming Soon</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="relative py-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl sm:text-3xl font-bold mb-4 text-white">Why Choose IndieCrowdfund?</h2>
              <p className="text-xl text-white/80">
                We&apos;re not just another crowdfunding platform. Here&apos;s what sets us apart.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  icon: Award,
                  title: "Built for Creators",
                  description: "Every feature is designed with creator success in mind. From AI-assisted content creation to detailed analytics, we give you the tools to run professional campaigns."
                },
                {
                  icon: Zap,
                  title: "Cutting-Edge Technology",
                  description: "AI-powered recommendations, smart analytics, and automated marketing tools help you reach more backers and convert more pledges."
                },
                {
                  icon: Store,
                  title: "Retailer Network",
                  description: "Our unique LCS program connects your project with certified retailers, helping you get your product into physical stores at wholesale pricing."
                },
                {
                  icon: Shield,
                  title: "Trust & Safety",
                  description: "Every project is reviewed by our team. AI fraud detection and identity verification protect both creators and backers."
                },
              ].map((item, index) => (
                <Card
                  key={item.title}
                  className="bg-white/10 border-white/20 backdrop-blur-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                >
                  <CardContent className="p-6">
                    <item.icon className="h-10 w-10 mb-4 text-yellow-300" />
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-white/80">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of creators who have successfully funded their projects on IndieCrowdfund.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/projects/new">
                <Button size="lg" className="gap-2 btn-glow shadow-lg">
                  <Rocket className="h-5 w-5" />
                  Start a Project
                </Button>
              </Link>
              <Link href="/discover">
                <Button size="lg" variant="outline" className="gap-2 group">
                  <Search className="h-5 w-5" />
                  Discover Projects
                </Button>
              </Link>
              <Link href="/retailers">
                <Button size="lg" variant="outline" className="gap-2 group">
                  <Store className="h-5 w-5" />
                  Retailer Program
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Mail, title: "General Inquiries", email: "hello@indiecrowdfund.com" },
                { icon: MessageSquare, title: "Creator Support", email: "creators@indiecrowdfund.com" },
                { icon: Megaphone, title: "Press & Media", email: "press@indiecrowdfund.com" },
              ].map((contact, index) => (
                <Card
                  key={contact.title}
                  className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                >
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg mb-3">
                      <contact.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">{contact.title}</h3>
                    <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                      {contact.email}
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
