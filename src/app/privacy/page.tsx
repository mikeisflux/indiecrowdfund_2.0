"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Lock,
  Eye,
  Database,
  Globe,
  Cookie,
  Mail,
  Users,
  FileText,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";

const sections = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    icon: Database,
    content: [
      {
        subtitle: "Information You Provide",
        items: [
          "Account information: name, email address, password, profile picture",
          "Payment information: processed securely through Stripe, Chain2Pay, or DivinityCoin (we never store card numbers)",
          "Project information: descriptions, images, videos, rewards, and updates you create",
          "Communication data: messages, comments, and support requests",
          "Shipping addresses for reward fulfillment",
          "Identity verification documents (for creators)",
        ],
      },
      {
        subtitle: "Information We Collect Automatically",
        items: [
          "Device information: browser type, operating system, device identifiers",
          "Usage data: pages visited, features used, time spent on site",
          "IP address and approximate location",
          "Referral sources and campaign tracking data",
          "Cookies and similar tracking technologies",
        ],
      },
    ],
  },
  {
    id: "how-we-use-information",
    title: "How We Use Your Information",
    icon: Eye,
    content: [
      {
        subtitle: "To Provide Our Services",
        items: [
          "Process pledges and payments",
          "Enable communication between creators and backers",
          "Deliver project updates and notifications",
          "Facilitate reward fulfillment and shipping",
          "Provide customer support",
        ],
      },
      {
        subtitle: "To Improve and Protect",
        items: [
          "Analyze usage patterns to improve our platform",
          "Detect and prevent fraud, abuse, and security threats",
          "Personalize your experience and recommendations",
          "Conduct research and analytics",
          "Comply with legal obligations",
        ],
      },
      {
        subtitle: "To Communicate",
        items: [
          "Send transactional emails (pledge confirmations, updates)",
          "Notify you about projects you've backed",
          "Share platform news and feature updates (with your consent)",
          "Respond to your inquiries and support requests",
        ],
      },
    ],
  },
  {
    id: "information-sharing",
    title: "Information Sharing",
    icon: Users,
    content: [
      {
        subtitle: "With Creators",
        items: [
          "When you back a project, we share necessary information with the creator for fulfillment",
          "This includes your name, email, shipping address, and selected rewards",
          "Creators are required to protect your information and use it only for fulfillment",
        ],
      },
      {
        subtitle: "With Service Providers",
        items: [
          "Payment processors (Stripe, Chain2Pay, DivinityCoin) for secure transaction handling",
          "Cloud hosting and infrastructure providers",
          "Analytics services to help us understand usage",
          "Email service providers for communications",
          "Identity verification services",
        ],
      },
      {
        subtitle: "Other Circumstances",
        items: [
          "When required by law or legal process",
          "To protect rights, privacy, safety, or property",
          "In connection with a merger, acquisition, or sale of assets",
          "With your consent or at your direction",
        ],
      },
    ],
  },
  {
    id: "data-security",
    title: "Data Security",
    icon: Lock,
    content: [
      {
        subtitle: "How We Protect Your Data",
        items: [
          "All data transmitted using TLS/SSL encryption",
          "Payment information processed through PCI-DSS compliant systems (Stripe Level 1, Chain2Pay SAQ A)",
          "Regular security audits and vulnerability assessments",
          "Access controls and authentication requirements",
          "Secure data centers with physical security measures",
          "Employee security training and access restrictions",
        ],
      },
    ],
  },
  {
    id: "your-rights",
    title: "Your Rights and Choices",
    icon: Shield,
    content: [
      {
        subtitle: "You Have the Right To",
        items: [
          "Access your personal data and request a copy",
          "Correct inaccurate or incomplete information",
          "Delete your account and associated data",
          "Object to certain processing activities",
          "Withdraw consent for marketing communications",
          "Data portability - receive your data in a structured format",
          "Lodge a complaint with a data protection authority",
        ],
      },
      {
        subtitle: "How to Exercise Your Rights",
        items: [
          "Update account settings in your dashboard",
          "Contact us at privacy@indiecrowdfund.com",
          "Unsubscribe from emails using the link in each message",
          "Request data export or deletion through support",
        ],
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies and Tracking",
    icon: Cookie,
    content: [
      {
        subtitle: "Types of Cookies We Use",
        items: [
          "Essential cookies: Required for site functionality (login, security)",
          "Analytics cookies: Help us understand how you use our site",
          "Preference cookies: Remember your settings and choices",
          "Marketing cookies: Used to show relevant ads (with consent)",
        ],
      },
      {
        subtitle: "Managing Cookies",
        items: [
          "Most browsers allow you to control cookies through settings",
          "You can delete cookies already stored on your device",
          "Disabling cookies may affect site functionality",
          "We respect Do Not Track browser signals",
        ],
      },
    ],
  },
  {
    id: "international",
    title: "International Data Transfers",
    icon: Globe,
    content: [
      {
        subtitle: "Data Location",
        items: [
          "Our servers are primarily located in the United States",
          "Data may be transferred to and processed in other countries",
          "We use appropriate safeguards for international transfers",
          "This includes standard contractual clauses and data processing agreements",
        ],
      },
    ],
  },
  {
    id: "retention",
    title: "Data Retention",
    icon: Database,
    content: [
      {
        subtitle: "How Long We Keep Data",
        items: [
          "Account data: Until you delete your account, plus a reasonable period for backup purposes",
          "Transaction records: As required for legal, tax, and accounting purposes (typically 7 years)",
          "Communication logs: For customer support and legal compliance",
          "Analytics data: Aggregated and anonymized data may be kept indefinitely",
        ],
      },
    ],
  },
  {
    id: "children",
    title: "Children's Privacy",
    icon: AlertCircle,
    content: [
      {
        subtitle: "Age Requirements",
        items: [
          "Our services are not intended for users under 18 years of age",
          "We do not knowingly collect personal information from children",
          "If we learn we have collected data from a child, we will delete it",
          "Parents can contact us at privacy@indiecrowdfund.com with concerns",
        ],
      },
    ],
  },
];

export default function PrivacyPage() {
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
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-500/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-primary/8" style={{ animationDelay: '-7s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[350px] h-[350px] bg-purple-500/8" style={{ animationDelay: '-14s' }} />
      </div>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-6">
              Privacy Policy
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Your Privacy Matters
            </h1>
            <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto">
              We&apos;re committed to protecting your personal information and being transparent about how we collect, use, and share it.
            </p>
            <p className="text-sm text-slate-400">
              Last updated: December 2024
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="relative py-8 bg-muted/50 border-b backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold text-muted-foreground mb-4">
              Jump to Section
            </h2>
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="px-3 py-1.5 bg-white border rounded-full text-sm hover:bg-primary hover:text-white hover:border-primary transition-colors"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Summary Card */}
      <section className="relative py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="glass-card border-blue-200/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Shield className="h-5 w-5" />
                  Privacy at a Glance
                </CardTitle>
              </CardHeader>
              <CardContent className="text-blue-800">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>We use industry-standard encryption to protect your data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Eye className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>We only collect information necessary to provide our services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>We share data with creators only for reward fulfillment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>You have rights to access, correct, and delete your data</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {sections.map((section, idx) => (
              <div key={section.id} id={section.id} className="scroll-mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                    <section.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold">{section.title}</h2>
                </div>

                <Card className="glass-card border shadow-lg">
                  <CardContent className="p-6 space-y-6">
                    {section.content.map((subsection, idx) => (
                      <div key={idx}>
                        <h3 className="font-semibold text-lg mb-3">
                          {subsection.subtitle}
                        </h3>
                        <ul className="space-y-2">
                          {subsection.items.map((item, itemIdx) => (
                            <li
                              key={itemIdx}
                              className="flex items-start gap-2 text-muted-foreground"
                            >
                              <span className="text-primary mt-1.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Questions About Privacy?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              If you have any questions or concerns about our privacy practices, we&apos;re here to help.
            </p>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Email us at:{" "}
                <a
                  href="mailto:privacy@indiecrowdfund.com"
                  className="text-primary hover:underline font-medium"
                >
                  privacy@indiecrowdfund.com
                </a>
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/contact">
                  <Button size="lg" className="gap-2 btn-glow">
                    Contact Support
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/terms">
                  <Button size="lg" variant="outline" className="gap-2">
                    <FileText className="h-5 w-5" />
                    Terms of Service
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Links */}
      <section className="relative py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-4">
              <Link href="/terms" className="group">
                <Card className="glass-card h-full transition-all group-hover:shadow-lg group-hover:-translate-y-1">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-semibold mb-1">Terms of Service</h3>
                    <p className="text-sm text-muted-foreground">
                      Read our full terms
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/trust-safety" className="group">
                <Card className="glass-card h-full transition-all group-hover:shadow-lg group-hover:-translate-y-1">
                  <CardContent className="p-6 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-semibold mb-1">Trust & Safety</h3>
                    <p className="text-sm text-muted-foreground">
                      How we protect you
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/faq" className="group">
                <Card className="glass-card h-full transition-all group-hover:shadow-lg group-hover:-translate-y-1">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-semibold mb-1">FAQ</h3>
                    <p className="text-sm text-muted-foreground">
                      Common questions
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
