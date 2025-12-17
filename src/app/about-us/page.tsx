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
    color: "bg-indigo-100 text-indigo-600",
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
      },
    ],
  },
  {
    category: "Payment Processing",
    icon: CreditCard,
    color: "bg-green-100 text-green-600",
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
    color: "bg-purple-100 text-purple-600",
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
    color: "bg-teal-100 text-teal-600",
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
    color: "bg-blue-100 text-blue-600",
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
    color: "bg-pink-100 text-pink-600",
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
    color: "bg-amber-100 text-amber-600",
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
    color: "bg-emerald-100 text-emerald-600",
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
    color: "bg-red-100 text-red-600",
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
    color: "bg-gray-100 text-gray-600",
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
  },
  {
    title: "Transparency",
    description:
      "Clear fees, honest policies, and open communication. No hidden surprises.",
    icon: Eye,
  },
  {
    title: "Innovation",
    description:
      "Constantly improving with AI, analytics, and cutting-edge technology.",
    icon: Lightbulb,
  },
  {
    title: "Community",
    description:
      "Connecting creators with passionate audiences who believe in their vision.",
    icon: Users,
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
      value: stats ? formatNumber(stats.projectsFunded + stats.projectsLive) : "...",
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
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="bg-white/20 text-white border-0 mb-6">
              About IndieCrowdfund
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Empowering Independent Creators Since 2024
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-10">
              We&apos;re building the most powerful and creator-friendly crowdfunding platform for comics, games, art, and creative projects.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/projects/new">
                <Button size="lg" className="bg-white text-indigo-600 hover:bg-white/90">
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
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {displayStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-3">
                  <stat.icon className="h-6 w-6 text-indigo-600" />
                </div>
                <p className="text-3xl font-bold text-zinc-900">{stat.value}</p>
                <p className="text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-16 bg-zinc-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-xl text-zinc-600 mb-8">
              We believe every creative idea deserves a chance to exist. Our mission is to provide creators with the tools, community, and support they need to bring their visions to life—while giving fans a direct way to support the projects they love.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {values.map((value) => (
                <Card key={value.title} className="text-center">
                  <CardContent className="pt-6">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4">
                      <value.icon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h3 className="font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-zinc-500">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4">Platform Features</Badge>
            <h2 className="text-3xl font-bold mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-zinc-600 max-w-2xl mx-auto">
              Discover the comprehensive suite of tools and features that make IndieCrowdfund the most powerful platform for independent creators.
            </p>
          </div>

          <div className="space-y-16">
            {platformFeatures.map((category) => (
              <div key={category.category}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`h-12 w-12 rounded-xl ${category.color} flex items-center justify-center`}>
                    <category.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold">{category.category}</h3>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.features.map((feature) => (
                    <Card key={feature.title} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div className={`h-10 w-10 rounded-lg ${category.color} flex items-center justify-center flex-shrink-0`}>
                            <feature.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-semibold mb-1">{feature.title}</h4>
                            <p className="text-sm text-zinc-500">{feature.description}</p>
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
      <section className="py-16 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Why Choose IndieCrowdfund?</h2>
              <p className="text-xl text-white/80">
                We&apos;re not just another crowdfunding platform. Here&apos;s what sets us apart.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-6">
                  <Award className="h-10 w-10 mb-4 text-yellow-300" />
                  <h3 className="text-xl font-semibold mb-2">Built for Creators</h3>
                  <p className="text-white/80">
                    Every feature is designed with creator success in mind. From AI-assisted content creation to detailed analytics, we give you the tools to run professional campaigns.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-6">
                  <Zap className="h-10 w-10 mb-4 text-yellow-300" />
                  <h3 className="text-xl font-semibold mb-2">Cutting-Edge Technology</h3>
                  <p className="text-white/80">
                    AI-powered recommendations, smart analytics, and automated marketing tools help you reach more backers and convert more pledges.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-6">
                  <Store className="h-10 w-10 mb-4 text-yellow-300" />
                  <h3 className="text-xl font-semibold mb-2">Retailer Network</h3>
                  <p className="text-white/80">
                    Our unique LCS program connects your project with certified retailers, helping you get your product into physical stores at wholesale pricing.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-6">
                  <Shield className="h-10 w-10 mb-4 text-yellow-300" />
                  <h3 className="text-xl font-semibold mb-2">Trust & Safety</h3>
                  <p className="text-white/80">
                    Every project is reviewed by our team. AI fraud detection and identity verification protect both creators and backers.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-zinc-600 mb-8">
              Join thousands of creators who have successfully funded their projects on IndieCrowdfund.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/projects/new">
                <Button size="lg" className="gap-2">
                  <Rocket className="h-5 w-5" />
                  Start a Project
                </Button>
              </Link>
              <Link href="/discover">
                <Button size="lg" variant="outline" className="gap-2">
                  <Search className="h-5 w-5" />
                  Discover Projects
                </Button>
              </Link>
              <Link href="/retailers">
                <Button size="lg" variant="outline" className="gap-2">
                  <Store className="h-5 w-5" />
                  Retailer Program
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 bg-zinc-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <Mail className="h-8 w-8 mx-auto mb-3 text-indigo-600" />
                  <h3 className="font-semibold mb-1">General Inquiries</h3>
                  <a href="mailto:hello@indiecrowdfund.com" className="text-indigo-600 hover:underline">
                    hello@indiecrowdfund.com
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3 text-indigo-600" />
                  <h3 className="font-semibold mb-1">Creator Support</h3>
                  <a href="mailto:creators@indiecrowdfund.com" className="text-indigo-600 hover:underline">
                    creators@indiecrowdfund.com
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <Megaphone className="h-8 w-8 mx-auto mb-3 text-indigo-600" />
                  <h3 className="font-semibold mb-1">Press & Media</h3>
                  <a href="mailto:press@indiecrowdfund.com" className="text-indigo-600 hover:underline">
                    press@indiecrowdfund.com
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
