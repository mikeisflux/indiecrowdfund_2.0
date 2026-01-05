"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ShieldCheck,
  Eye,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  MessageSquare,
  Lock,
  Scale,
  HelpCircle,
  ArrowRight,
  AlertCircle,
  Clock,
  RefreshCw,
  Ban,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { Footer } from "@/components/footer";

const trustPillars = [
  {
    icon: Eye,
    title: "Project Review",
    description:
      "Every project is reviewed by our team before going live. We verify that projects meet our guidelines and that creators have a realistic plan for delivery.",
  },
  {
    icon: UserCheck,
    title: "Creator Verification",
    description:
      "Creators must verify their identity through our secure process. Verified creators display a badge, giving backers confidence in who they're supporting.",
  },
  {
    icon: ShieldCheck,
    title: "Fraud Detection",
    description:
      "Our AI-powered systems monitor for suspicious activity, protecting backers from potential scams and bad actors.",
  },
  {
    icon: Scale,
    title: "Clear Guidelines",
    description:
      "Our comprehensive terms of service and creator guidelines establish clear expectations for all parties.",
  },
];

const backerProtections = [
  {
    icon: CheckCircle,
    title: "All-or-Nothing Funding",
    description:
      "You're only charged if the project reaches its funding goal. If it doesn't succeed, your payment method is never charged.",
  },
  {
    icon: Clock,
    title: "Pledge Management",
    description:
      "You can modify or cancel your pledge at any time before the campaign ends. After funding, you can update your reward selection and shipping address.",
  },
  {
    icon: MessageSquare,
    title: "Direct Communication",
    description:
      "Stay connected with creators through project updates, comments, and direct messaging. Transparency is key to a successful campaign.",
  },
  {
    icon: RefreshCw,
    title: "Project Updates",
    description:
      "Creators are required to post regular updates on their progress. You'll always know where your backed project stands.",
  },
];

const creatorResponsibilities = [
  {
    title: "Honest Representation",
    description:
      "Creators must accurately represent their projects, including realistic timelines, budgets, and delivery expectations.",
  },
  {
    title: "Regular Communication",
    description:
      "Creators commit to keeping backers informed with regular updates, especially if there are delays or changes to the project.",
  },
  {
    title: "Fulfillment Commitment",
    description:
      "Creators are obligated to make a good faith effort to deliver rewards as promised. If they can't, they must explain why and work toward resolution.",
  },
  {
    title: "Transparent Use of Funds",
    description:
      "Funds raised must be used for the project as described. Creators should be prepared to account for how funds are spent.",
  },
];

const disputeSteps = [
  {
    step: 1,
    title: "Contact the Creator",
    description:
      "Start by reaching out to the creator directly through the project page or messaging system. Most issues can be resolved through direct communication.",
  },
  {
    step: 2,
    title: "Allow Time for Response",
    description:
      "Give the creator reasonable time to respond (7-14 days). Remember that creators are often working on fulfillment and may not respond immediately.",
  },
  {
    step: 3,
    title: "Submit a Report",
    description:
      "If you can't resolve the issue directly, submit a formal report through our support system. Include all relevant details and documentation.",
  },
  {
    step: 4,
    title: "Platform Investigation",
    description:
      "Our trust and safety team will review your report, contact the creator, and work toward a resolution.",
  },
];

export default function TrustSafetyPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
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
      <div className="floating-orb w-96 h-96 bg-green-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-primary/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-slate-500/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 mb-6">
              Trust & Safety
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Supporting Creators, Protecting Backers
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Crowdfunding is about bringing creative ideas to life together. We work hard to create a safe, transparent environment where creators and backers can connect with confidence.
            </p>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="py-8 bg-amber-50 border-b border-amber-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                Understanding Crowdfunding Risk
              </h3>
              <p className="text-amber-800 text-sm">
                When you back a project, you&apos;re supporting a creative vision that hasn&apos;t been fully realized yet. While we work to verify creators and projects, crowdfunding involves inherent risk. Projects may face delays, changes, or in rare cases, may not deliver as planned. IndieCrowdfund is not responsible for reward fulfillment or refunds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Pillars */}
      <section className="py-12 bg-background/50 backdrop-blur-sm relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">How We Build Trust</h2>
              <p className="text-lg text-muted-foreground">
                Our multi-layered approach helps ensure a safe and positive experience for everyone.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {trustPillars.map((pillar) => (
                <Card key={pillar.title} className="border-2 hover:border-primary/20 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <pillar.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{pillar.title}</h3>
                        <p className="text-muted-foreground">{pillar.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Backer Protections */}
      <section className="py-12 bg-muted/30 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Backer Protections</h2>
              <p className="text-lg text-muted-foreground">
                We&apos;ve built safeguards to help protect your interests as a backer.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {backerProtections.map((protection) => (
                <Card key={protection.title}>
                  <CardContent className="p-6">
                    <protection.icon className="h-8 w-8 text-green-600 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">{protection.title}</h3>
                    <p className="text-muted-foreground">{protection.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Creator Responsibilities */}
      <section className="py-12 bg-background/50 backdrop-blur-sm relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Creator Responsibilities</h2>
              <p className="text-lg text-muted-foreground">
                Creators who launch on IndieCrowdfund agree to these commitments.
              </p>
            </div>

            <div className="space-y-4">
              {creatorResponsibilities.map((responsibility, idx) => (
                <Card key={responsibility.title}>
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{responsibility.title}</h3>
                      <p className="text-muted-foreground">{responsibility.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dispute Resolution */}
      <section className="py-12 bg-muted/30 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Scale className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Dispute Resolution</h2>
              <p className="text-lg text-muted-foreground">
                If you have concerns about a project, here&apos;s how to seek resolution.
              </p>
            </div>

            <div className="space-y-4">
              {disputeSteps.map((step) => (
                <Card key={step.step}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                        {step.step}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-8 border-red-200 bg-red-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-2">Important Limitations</h3>
                    <p className="text-red-800 text-sm">
                      IndieCrowdfund is a platform that connects creators with backers. We are not a store and do not guarantee fulfillment. While we can investigate reports and take action against creators who violate our terms, we cannot force refunds or guarantee delivery. Backing a project is supporting a creative endeavor, not purchasing a guaranteed product.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Prohibited Content */}
      <section className="py-12 bg-background/50 backdrop-blur-sm relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Ban className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Prohibited Content</h2>
              <p className="text-lg text-muted-foreground">
                We do not allow projects that include:
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                "Illegal products or activities",
                "Weapons or harmful items",
                "Hate speech or discriminatory content",
                "Misleading or deceptive claims",
                "Adult content without proper labeling",
                "Reselling or dropshipping",
                "Financial products or schemes",
                "Projects with no creative element",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                  <Ban className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 bg-muted/30 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <HelpCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">Common Questions</h2>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">What happens if a project doesn&apos;t deliver?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Creators are legally obligated to make a good faith effort to deliver rewards. If they can&apos;t, they must communicate with backers and either offer alternatives or explain how funds were spent. While we investigate reports and can suspend creators who violate terms, IndieCrowdfund cannot guarantee refunds or delivery.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Can I get a refund?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Before a campaign ends, you can cancel your pledge at any time and won&apos;t be charged. After the campaign funds successfully, refunds are at the discretion of the creator. Some creators offer refunds; others don&apos;t. Check the project&apos;s FAQ or contact the creator directly.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How do you verify creators?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Creators must connect a valid payment account (which requires identity verification), provide contact information, and pass our project review process. We also check for patterns that might indicate fraud. Verified creators display a badge on their profile.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">What if I suspect fraud?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Report the project immediately using the report button on the project page, or contact our trust and safety team at{" "}
                    <a href="mailto:trust@indiecrowdfund.com" className="text-primary hover:underline">
                      trust@indiecrowdfund.com
                    </a>
                    . Include specific concerns and any evidence you have. We investigate all reports promptly.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 bg-background/50 backdrop-blur-sm relative">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Need Help?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our trust and safety team is here to help with any concerns.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/contact">
                <Button size="lg" className="gap-2">
                  Contact Support
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/faq">
                <Button size="lg" variant="outline" className="gap-2">
                  <HelpCircle className="h-5 w-5" />
                  View FAQ
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related Links */}
      <section className="py-12 bg-muted/50 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-4">
              <Link href="/terms" className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-semibold mb-1">Terms of Service</h3>
                    <p className="text-sm text-muted-foreground">
                      Read our full terms
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/privacy" className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="p-6 text-center">
                    <Lock className="h-8 w-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-semibold mb-1">Privacy Policy</h3>
                    <p className="text-sm text-muted-foreground">
                      How we protect your data
                    </p>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/creator-handbook" className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-3 text-primary" />
                    <h3 className="font-semibold mb-1">Creator Handbook</h3>
                    <p className="text-sm text-muted-foreground">
                      Guide for project creators
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
