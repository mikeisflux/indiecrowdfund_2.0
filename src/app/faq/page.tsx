"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  CreditCard,
  Store,
  Gift,
  BarChart3,
  Shield,
  Settings,
  HelpCircle,
  ArrowLeft,
} from "lucide-react";
import { Footer } from "@/components/footer";

const categories = [
  { id: "backers", label: "For Backers", icon: Users, description: "Information for project backers" },
  { id: "payments", label: "Payments & Fees", icon: CreditCard, description: "Payment processing and platform fees" },
  { id: "retailer", label: "Retailer Program (LCS)", icon: Store, description: "Local comic shop retailer program" },
  { id: "rewards", label: "Rewards & Fulfillment", icon: Gift, description: "Reward tiers and delivery information" },
  { id: "analytics", label: "Analytics & Tools", icon: BarChart3, description: "Tracking and analytics features" },
  { id: "security", label: "Security & Trust", icon: Shield, description: "Security measures and trust policies" },
  { id: "admin", label: "Platform Administration", icon: Settings, description: "Platform management and support" },
];

const faqData: Record<string, { question: string; answer: string }[]> = {
  backers: [
    { question: "How do I back a project?", answer: "Select a reward tier and complete the checkout process with your payment method. You can browse projects on our Discover page and click on any project to view its details and available rewards." },
    { question: "Can I cancel my pledge?", answer: "Yes, you can cancel your pledge anytime before the campaign ends. Go to your dashboard, find the backed project, and click 'Cancel Pledge'. No charges are made until a campaign successfully ends." },
    { question: "How do I track my backed projects?", answer: "Visit your backer dashboard to see all projects you've backed and their current status. You'll receive email updates from creators and can also view project updates directly on the project page." },
    { question: "What happens if a project doesn't reach its goal?", answer: "If a project doesn't reach its funding goal by the deadline, no money changes hands. This is our all-or-nothing funding model that protects both backers and creators." },
    { question: "Can I change my reward tier after pledging?", answer: "Yes, you can modify your pledge and change reward tiers anytime before the campaign ends. Simply go to the project page and click 'Manage Pledge' to make changes." },
  ],
  payments: [
    { question: "What are the platform fees?", answer: "We charge a 3% platform fee on successfully funded projects, plus Stripe payment processing fees (2.9% + $0.30 per transaction). Total fees are approximately 6% of funds raised." },
    { question: "Which payment methods are accepted?", answer: "We accept all major credit cards, debit cards, Apple Pay, Google Pay, and select digital payment methods through Stripe." },
    { question: "When is my card charged?", answer: "Your card is only charged when a campaign successfully reaches its funding goal. If you pledge before the goal is met, your payment is held and processed once the campaign funds. If the campaign doesn't reach its goal, you're never charged. Pledges made after a campaign is already funded are charged immediately." },
    { question: "What if my payment fails?", answer: "If your payment fails when the campaign funds, we automatically retry up to 3 times over 9 days (once every 3 days) before marking the pledge as failed." },
    { question: "When do creators receive their funds?", answer: "Funds are transferred within 14 days after successful campaign completion via Stripe. The exact timing depends on bank processing times." },
    { question: "Are pledges tax-deductible?", answer: "No, pledges are not charitable donations and are not tax-deductible. They are considered pre-orders or purchases of rewards from creators." },
    { question: "What currency is used?", answer: "All transactions are processed in USD. International backers will see converted amounts based on current exchange rates, and their cards will be charged in USD." },
  ],
  retailer: [
    { question: "What is the Retailer Program?", answer: "The LCS (Local Comic Shop) program allows local retailers to participate in crowdfunding campaigns, place bulk orders, and receive special retailer pricing and exclusive variants." },
    { question: "How do I join as a retailer?", answer: "Apply through our retailer portal with your business credentials, tax ID, and proof of physical retail location. Applications are reviewed within 5 business days." },
    { question: "What benefits do retailers receive?", answer: "Approved retailers get access to wholesale pricing (typically 50% off MSRP), exclusive retailer variants, early access to campaigns, and dedicated support." },
    { question: "Can retailers participate in any campaign?", answer: "Retailers can participate in campaigns where creators have enabled retailer participation. Not all campaigns offer retailer tiers." },
  ],
  rewards: [
    { question: "How do rewards work?", answer: "Creators set reward tiers with specific pledge amounts and deliverables. Higher pledge amounts typically include more items or exclusive bonuses. Each reward tier clearly lists what backers will receive." },
    { question: "What are add-ons?", answer: "Add-ons are optional extras you can add to your pledge beyond the main reward. They allow you to customize your pledge with additional items, extra copies, or upgrades." },
    { question: "When will I receive my rewards?", answer: "Estimated delivery dates are set by creators and shown on each reward tier. After a campaign ends, creators provide updates on production and shipping progress. Delivery times vary by project complexity." },
    { question: "What if my reward is damaged or missing?", answer: "Contact the creator directly through the project's messaging system. Most creators are happy to resolve shipping issues. If you can't reach the creator, contact our support team." },
    { question: "Can I get a refund after the campaign ends?", answer: "Refund policies are set by individual creators. Contact the creator directly to discuss refund requests. We recommend reviewing the creator's refund policy before pledging." },
  ],
  analytics: [
    { question: "What analytics are available?", answer: "Creators can track visitors, page views, conversion rates, referrer sources, pledge amounts over time, and geographic distribution of backers through the creator dashboard." },
    { question: "Can I integrate with Google Analytics?", answer: "Yes, you can connect your Google Analytics (GA4) account by entering your Measurement ID in the project's Promotion settings. This provides detailed insights into traffic sources and user behavior." },
    { question: "How does Meta Pixel integration work?", answer: "Add your Meta Pixel ID in the Promotion settings to track Facebook and Instagram ad effectiveness. We also support the Meta Conversions API for more reliable server-side tracking." },
    { question: "Can I create custom referral links?", answer: "Yes, use the Custom Referral Tags feature to create trackable URLs for different marketing channels. For example, create ?ref=instagram or ?ref=newsletter to track which channels drive the most pledges." },
  ],
  security: [
    { question: "How is my payment information protected?", answer: "All payments are processed through PCI-compliant Stripe. We never store your full credit card details on our servers. All data transmission is encrypted using TLS." },
    { question: "What is your refund policy?", answer: "Refunds before campaign completion are automatic when you cancel a pledge. After a campaign ends, refunds are handled on a case-by-case basis by project creators." },
    { question: "How do you verify creator identities?", answer: "Creators must verify their identity through our integration with Shufti Pro before they can launch campaigns. This helps protect backers from fraud." },
    { question: "What happens if a creator doesn't deliver?", answer: "While we can't guarantee project completion, we have systems in place to address non-delivery. Creators who fail to deliver may be banned from the platform and we assist backers with dispute resolution." },
  ],
  admin: [
    { question: "How do I contact support?", answer: "Use the help button in your dashboard, visit our Help Center, or email support@indiecrowdfund.com. We typically respond within 24-48 hours during business days." },
    { question: "How do I report a project?", answer: "Click the 'Report' button on any project page to flag concerns. Our moderation team reviews all reports and takes appropriate action, which may include removing projects that violate our terms." },
    { question: "Can I delete my account?", answer: "Yes, you can request account deletion through your account settings. Note that this is permanent and you'll lose access to any backed projects or created campaigns." },
    { question: "How do I update my account information?", answer: "Go to your dashboard and click on Settings to update your profile, email, password, notification preferences, and connected social accounts." },
  ],
};

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState("backers");

  const activeData = faqData[activeCategory] || [];
  const activeCategoryInfo = categories.find((c) => c.id === activeCategory);
  const ActiveIcon = activeCategoryInfo?.icon || HelpCircle;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-gradient-to-b from-primary/5 to-background">
        <div className="container py-8">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Frequently Asked Questions</h1>
              <p className="text-muted-foreground">Find answers to common questions about IndieCrowdfund</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Vertical Tab Sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <nav className="space-y-1">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    const isActive = activeCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{category.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* FAQ Content */}
          <div className="flex-1">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ActiveIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{activeCategoryInfo?.label}</CardTitle>
                    <CardDescription>{activeCategoryInfo?.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {activeData.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
