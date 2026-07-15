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
  Sparkles,
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
    { question: "What happens if a project doesn't reach its goal?", answer: "This depends on the campaign type. For 'All or Nothing' campaigns, if the project doesn't reach its funding goal by the deadline, no money changes hands — this model protects both backers and creators. For 'Keep It All' campaigns, the creator keeps all pledges regardless of whether the goal is reached, and backers are charged immediately when pledging." },
    { question: "Can I change my reward tier after pledging?", answer: "Yes, you can modify your pledge and change reward tiers anytime before the campaign ends. Simply go to the project page and click 'Manage Pledge' to make changes." },
    { question: "A creator asked me to lock my order — what happens?", answer: "Some creators use Order Lock to confirm orders early so they can print and ship sooner. You'll get a 'Confirm & lock your order' notification and email that opens an approval page where you review your reward, add-ons, and total, and confirm your shipping address. Choose 'Lock my order' to finalize, or 'I need to make changes first' to decline for now. Once you lock, your reward, add-ons, and shipping address are final and can no longer be changed, and you won't also get the fulfillment survey. Depending on your payment method you may be charged when you lock — so double-check everything first." },
  ],
  payments: [
    { question: "What are the platform fees?", answer: "We charge a 3% platform fee on all successfully funded projects, plus payment processing fees. With PayPal, total fees are ~6.5% (3% platform + 3.49% + $0.49/txn). With Divinity Payments, total fees are ~6.5% (3% partner + $0.30/txn + 3% platform). With Whop, fees are ~6.5% (3% platform + 3.5% + $0.37/txn Whop fee on US cards; international adds ~1% currency conversion). Creators choose their payment processor when setting up a project." },
    { question: "Which payment methods are accepted?", answer: "We accept all major credit cards and debit cards via PayPal. Creators can also choose Divinity Payments or Whop as their payment processor — both accept Visa, Mastercard, Amex, and Discover. All options allow you to pay with your credit or debit card at checkout." },
    { question: "What is Divinity Payments?", answer: "Divinity Payments is an alternative payment sub-processor that some creators use on IndieCrowdfund. When you back a project that uses Divinity Payments, you simply enter your credit or debit card at checkout — just like any other online purchase. It is NOT a cryptocurrency, wallet, or token system. Divinity Payments supports all content types including NSFW/adult projects." },
    { question: "What is Whop?", answer: "Whop is an additional payment processor available to creators on IndieCrowdfund. Like Divinity Payments, you simply enter your credit or debit card at checkout when backing a project that uses Whop. It is a standard card payment processor, not a wallet or token system." },
    { question: "When is my card charged?", answer: "It depends on the campaign type. For 'All or Nothing' campaigns still working toward their goal, your card is only charged if the project reaches its funding goal. For 'Keep It All' campaigns, your card is charged immediately when you pledge — the creator keeps all funds regardless of the goal. Campaigns that have already reached their goal also charge immediately. This applies across all payment processors (PayPal, Divinity Payments, and Whop)." },
    { question: "What if my payment fails?", answer: "If your payment fails when the campaign funds, we automatically retry up to 3 times over 9 days (once every 3 days) before marking the pledge as failed. You'll receive email notifications with instructions to update your payment method." },
    { question: "When do creators receive their funds?", answer: "For Stripe payments, we use Stripe Connect so payouts start as soon as the campaign is funded, though it can take up to 14 days depending on if you have a new account with Stripe. For Divinity Payments payments, a settlement will be applied to the creator's bank account within 14 business days after the campaign ends." },
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
    { question: "Can I get a refund after the campaign ends?", answer: "Refund policies are set by individual creators. For closed campaigns, backers can submit a refund request through the platform — the creator must approve it. You can also contact the creator directly to discuss refund requests. We recommend reviewing the creator's refund policy before pledging." },
    { question: "What does it mean to lock my order?", answer: "Some creators use Order Lock to ask you to confirm your order early — sometimes while the campaign is still live — so they can print and ship sooner. You'll get a 'Confirm & lock your order' notification and email that opens an approval page where you review your reward, add-ons, and total, confirm your shipping address, and choose 'Lock my order' or 'I need to make changes first'. Once you lock, your reward, add-ons, and shipping address are final and can't be changed, and you won't also receive the fulfillment survey. Depending on your payment method you may be charged when you lock: already-paid backers just lock, saved-card (Divinity Payments) backers are charged on lock, and PayPal/Whop backers are charged on the campaign's normal schedule." },
    { question: "As a creator, how do I use Order Lock to freeze orders early?", answer: "Open IndieKit → Order Lock and send a lock request (in-app notification + email) to your backers. A status board tracks each backer as Not sent, Requested, Locked, or Declined, with a 'Remind' action for anyone still pending. When a backer locks, their reward, add-ons, and shipping address become final, they skip the fulfillment survey, and — where supported — payment is collected so you can start production and shipping right away. It lets you freeze orders early and avoid last-minute changes without waiting for the campaign to end." },
    { question: "As a creator, how do I get my books printed?", answer: "IndieKit includes a built-in Printing Comics tab where you can order a bulk print run through the Printing Comics print partner. Pick the product (Comic Book or Graphic Novel) and trim size, set the quantity and page count, and configure options like cover type / paper stock, embellishments (lamination, UV, foil), interior paper, and interior color. A live price quote and shipping options update as you configure, and you upload your print-ready cover and interior PDFs. Cartons ship to your own receiving address — it's a bulk run separate from per-backer fulfillment, so you ship to backers yourself. Payment for the print run is handled directly with Printing Comics via a payment link; the platform just tracks the order status. Pair it with the Production Order tab's 'Still to Produce' column so you don't over-order." },
  ],
  analytics: [
    { question: "What analytics are available?", answer: "Creators can track visitors, page views, conversion rates, referrer sources, pledge amounts over time, and geographic distribution of backers through the creator dashboard." },
    { question: "Can I integrate with Google Analytics?", answer: "Yes, you can connect your Google Analytics (GA4) account by entering your Measurement ID in the project's Promotion settings. This provides detailed insights into traffic sources and user behavior." },
    { question: "How does Meta Pixel integration work?", answer: "Add your Meta Pixel ID in the Promotion settings to track Facebook and Instagram ad effectiveness. We also support the Meta Conversions API for more reliable server-side tracking." },
    { question: "Can I create custom referral links?", answer: "Yes, use the Custom Referral Tags feature to create trackable URLs for different marketing channels. For example, create ?ref=instagram or ?ref=newsletter to track which channels drive the most pledges." },
  ],
  security: [
    { question: "How is my payment information protected?", answer: "All payments are processed through PCI-compliant processors. PayPal (Level 1 PCI Service Provider) handles standard card payments via tokenized forms. Divinity Payments and Whop also use PCI-compliant processing — card data is tokenized in your browser before it ever leaves your device. CSRF protection is enforced on all payment initiations, and all communication is HTTPS-only. We never store full credit card details." },
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
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 right-1/4 w-[500px] h-[500px] bg-primary/15" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-7s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[350px] h-[350px] bg-cyan-500/10" style={{ animationDelay: '-14s' }} />
      </div>

      {/* Header */}
      <div className="relative border-b bg-gradient-to-b from-primary/5 to-background/80 backdrop-blur-sm">
        <div className="container py-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 animate-in fade-in slide-in-from-left-4 duration-300"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
              <HelpCircle className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Frequently Asked Questions
              </h1>
              <p className="text-muted-foreground">Find answers to common questions about IndieCrowdfund</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container relative py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Vertical Tab Sidebar */}
          <div
            className="w-full lg:w-72 flex-shrink-0 animate-in fade-in slide-in-from-left-4 duration-500"
            style={{ animationDelay: '100ms' }}
          >
            <Card className="glass-card border shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <nav className="space-y-1">
                  {categories.map((category, index) => {
                    const Icon = category.icon;
                    const isActive = activeCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                          isActive
                            ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
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
          <div
            className="flex-1 animate-in fade-in slide-in-from-right-4 duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <Card className="glass-card border shadow-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner">
                    <ActiveIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{activeCategoryInfo?.label}</CardTitle>
                    <CardDescription>{activeCategoryInfo?.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {activeData.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <AccordionTrigger className="text-left hover:text-primary transition-colors py-4">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4">
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
