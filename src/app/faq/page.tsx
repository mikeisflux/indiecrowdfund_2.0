"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  HelpCircle,
  Rocket,
  DollarSign,
  Users,
  Shield,
  CreditCard,
  Gift,
  Store,
  BarChart3,
  Globe,
  Sparkles,
  FileText,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

const faqCategories = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    description: "New to crowdfunding? Start here",
    faqs: [
      {
        question: "What is IndieCrowdfund?",
        answer:
          "IndieCrowdfund is a modern crowdfunding platform designed specifically for creative projects like comics, art books, games, and merchandise. We provide creators with powerful tools to fund their projects while offering backers a safe and rewarding way to support independent creators.",
      },
      {
        question: "How does crowdfunding work?",
        answer:
          "Crowdfunding allows creators to raise funds directly from their audience. Creators set a funding goal and deadline, then offer rewards to backers who pledge money. If the project reaches its goal by the deadline, funds are collected and the creator fulfills the rewards. If the goal isn't met, no money changes hands (all-or-nothing model).",
      },
      {
        question: "Who can create a project?",
        answer:
          "Anyone 18 years or older with a valid bank account can create a project. You'll need to verify your identity and provide tax information before launching. We welcome creators from around the world, though some payment processors have country restrictions.",
      },
      {
        question: "What types of projects can I fund?",
        answer:
          "We specialize in creative projects including comics, graphic novels, art books, games (board games, card games, RPGs), merchandise, collectibles, music, film, and other creative endeavors. Projects must be legal, comply with our terms of service, and not involve prohibited content like illegal activities, hate speech, or fraud.",
      },
      {
        question: "Is there a minimum funding goal?",
        answer:
          "Yes, the minimum funding goal is $100. We recommend setting a realistic goal that covers your production costs, fulfillment expenses, and platform fees. Our AI-powered funding calculator can help you determine an appropriate goal based on your project type and reward structure.",
      },
    ],
  },
  {
    id: "for-creators",
    title: "For Creators",
    icon: Sparkles,
    description: "Project creation and management",
    faqs: [
      {
        question: "How do I create a project?",
        answer:
          "Creating a project is simple: 1) Sign up for a creator account, 2) Use our 6-step project builder to add your project details, rewards, story, and payment information, 3) Submit for review. Our team reviews all projects within 1-3 business days to ensure quality and compliance.",
      },
      {
        question: "What is the project review process?",
        answer:
          "Every project goes through a review process before launch. Our team checks for compliance with guidelines, quality of presentation, and legitimacy. We use AI-powered analysis to flag potential issues, and human reviewers make final decisions. You'll receive feedback if changes are needed.",
      },
      {
        question: "How long should my campaign run?",
        answer:
          "Most successful campaigns run 30-45 days. Shorter campaigns (15-21 days) create urgency but may not reach as many people. Longer campaigns (60+ days) can lose momentum. We recommend 30 days for most projects. You can choose a fixed duration or set a specific end date.",
      },
      {
        question: "What are stretch goals and how do they work?",
        answer:
          "Stretch goals are additional funding milestones beyond your initial goal. When backers help you exceed your goal, you can unlock stretch goals to add more content, improve quality, or include bonuses. They keep momentum going and encourage additional pledges.",
      },
      {
        question: "Can I edit my project after launching?",
        answer:
          "Yes, you can edit most project details after launch, including the story, FAQ, and images. However, you cannot reduce reward tiers or remove reward benefits after launch. Major changes require approval from our team to protect backer interests.",
      },
      {
        question: "What is the AI Marketing Suite?",
        answer:
          "Our AI Marketing Suite helps creators promote their projects with AI-generated social media posts, email campaigns, and promotional content. It analyzes your project and audience to suggest optimal posting times, hashtags, and messaging strategies to maximize reach and engagement.",
      },
      {
        question: "How does the project builder's AI assistance work?",
        answer:
          "Our AI can help you write compelling project descriptions, generate FAQ answers, suggest reward tier pricing, and optimize your campaign page for conversions. It's trained on successful campaigns and provides data-driven suggestions while you maintain full creative control.",
      },
    ],
  },
  {
    id: "for-backers",
    title: "For Backers",
    icon: Users,
    description: "Pledging and supporting projects",
    faqs: [
      {
        question: "How do I back a project?",
        answer:
          "Find a project you want to support, select a reward tier that interests you, and complete your pledge with your payment information. You can add multiple rewards and add-ons. Your card will only be charged if the project reaches its funding goal.",
      },
      {
        question: "When am I charged?",
        answer:
          "Your payment method is authorized when you pledge, but you're only charged after the campaign ends successfully. If a project doesn't reach its goal, your payment is never processed. For successfully funded projects, charges occur within 14 days of the campaign ending.",
      },
      {
        question: "Can I change or cancel my pledge?",
        answer:
          "Yes, you can modify or cancel your pledge anytime before the campaign ends. Go to your backer dashboard, find the project, and use the 'Manage Pledge' option. After the campaign ends and you've been charged, changes must be coordinated with the creator.",
      },
      {
        question: "What happens if a project doesn't deliver?",
        answer:
          "Creators are legally obligated to fulfill their rewards or issue refunds. If a creator fails to communicate or deliver, you can report the issue through our platform. We have a dispute resolution process and can assist with mediation, though crowdfunding inherently carries risks.",
      },
      {
        question: "How does the recommendation engine work?",
        answer:
          "Our AI-powered recommendation engine analyzes your backing history, browsing behavior, and preferences to suggest projects you might enjoy. It considers factors like categories, creators you've supported, and what similar backers have backed.",
      },
      {
        question: "What is the Backer Dashboard?",
        answer:
          "Your Backer Dashboard is your central hub for managing all your pledges, tracking project updates, viewing fulfillment status, and discovering new projects. It shows your complete backing history, estimated delivery dates, and lets you communicate with creators.",
      },
    ],
  },
  {
    id: "payments-fees",
    title: "Payments & Fees",
    icon: CreditCard,
    description: "Payment processing and platform fees",
    faqs: [
      {
        question: "What are the platform fees?",
        answer:
          "IndieCrowdfund charges a 5% platform fee on successfully funded projects. Payment processing fees are separate and vary by processor: Stripe charges 2.9% + $0.30 per transaction, while CCBill charges around 10.5% (required for adult or high-risk content).",
      },
      {
        question: "Which payment methods are accepted?",
        answer:
          "We accept all major credit and debit cards (Visa, Mastercard, American Express, Discover) through Stripe. Some regions support additional methods like Apple Pay, Google Pay, and local payment options. CCBill projects accept major credit cards only.",
      },
      {
        question: "What is Stripe vs CCBill?",
        answer:
          "Stripe is our default payment processor with lower fees and faster payouts. CCBill is required for projects with adult content or high-risk categories—it has higher fees but specializes in these content types with better chargeback protection.",
      },
      {
        question: "Is the platform NSFW-friendly?",
        answer:
          "Yes! IndieCrowdfund uses NSFW-friendly billing and hosting providers, ensuring seamless payment processing for adult content creators. Unlike other platforms that may reject or shut down adult projects, we've partnered with processors experienced in handling mature content. You'll never face unexpected payment processing issues or account terminations due to content type. CCBill handles all adult content transactions with industry-leading reliability and discretion.",
      },
      {
        question: "When do creators receive their funds?",
        answer:
          "After a campaign ends successfully, funds are processed within 14 days. Stripe payouts typically arrive within 2-7 business days after processing. CCBill payouts may take longer. First-time creators may have extended hold periods for fraud prevention.",
      },
      {
        question: "Are pledges tax-deductible?",
        answer:
          "Generally, no. Pledges are payments for goods (rewards), not donations. However, some nonprofit projects may qualify for tax-deductible contributions. Consult a tax professional for specific guidance on your situation.",
      },
      {
        question: "What currency is used?",
        answer:
          "All project goals and pledges are in USD. International backers can pledge in their local currency, with conversion happening at checkout. Currency conversion fees may apply depending on your card issuer.",
      },
    ],
  },
  {
    id: "retailers",
    title: "Retailer Program (LCS)",
    icon: Store,
    description: "Wholesale ordering for certified retailers",
    faqs: [
      {
        question: "What is the LCS Retailer Program?",
        answer:
          "Our Local Comic Shop (LCS) Retailer Program allows certified retailers—comic shops, bookstores, game stores, and other brick-and-mortar retailers—to purchase crowdfunded products at wholesale pricing (typically 50% off retail). This helps creators get their products into physical stores.",
      },
      {
        question: "How do I become a certified retailer?",
        answer:
          "Apply through our retailer portal with your business information, tax ID, and resale certificate. We verify your business legitimacy before approval. Once approved, you'll receive login credentials and an access code to place wholesale orders.",
      },
      {
        question: "What discount do retailers receive?",
        answer:
          "Certified retailers receive 50% off the retail price (industry standard wholesale discount). Some creators may offer different discount levels (40-60%). Minimum order quantities apply—typically 5-10 units per order.",
      },
      {
        question: "Do all projects offer retailer ordering?",
        answer:
          "No, retailer ordering is opt-in for creators. Only projects where the creator has enabled 'Retailer Access' in their campaign settings will appear in the retailer portal. Creators choose their wholesale discount and minimum order quantities.",
      },
      {
        question: "What are the payment terms for retailers?",
        answer:
          "We offer Net-30 payment terms for established retailers. New retailers may be required to pay upfront for their first few orders. Invoices are generated after order placement with clear payment due dates.",
      },
      {
        question: "How does retailer fulfillment work?",
        answer:
          "Retailer orders are fulfilled alongside backer rewards. Creators ship wholesale orders directly to retailers or through their distribution network. Tracking information is provided through the retailer dashboard.",
      },
    ],
  },
  {
    id: "rewards-fulfillment",
    title: "Rewards & Fulfillment",
    icon: Gift,
    description: "Reward tiers and delivery",
    faqs: [
      {
        question: "What types of rewards can creators offer?",
        answer:
          "Creators can offer physical products, digital downloads, experiences, limited editions, early access, and more. Rewards are organized into tiers with increasing value. Add-ons allow backers to customize their pledge with additional items.",
      },
      {
        question: "What are add-ons?",
        answer:
          "Add-ons are optional extras that backers can add to their pledge beyond the main reward tier. They let backers customize their order—like adding extra copies, variants, or complementary products without creating complex tier structures.",
      },
      {
        question: "How do estimated delivery dates work?",
        answer:
          "Creators provide estimated delivery dates for each reward. These are estimates, not guarantees—production and shipping can encounter delays. Creators should communicate any changes through project updates. Our system tracks and displays delivery estimates in your dashboard.",
      },
      {
        question: "What about international shipping?",
        answer:
          "Creators can choose to ship worldwide, to selected countries, or domestically only. Shipping costs vary by destination and are calculated at checkout. Some rewards may have shipping restrictions due to customs regulations or hazardous materials.",
      },
      {
        question: "How is fulfillment tracking managed?",
        answer:
          "Our platform includes built-in fulfillment tracking. Creators can update fulfillment status (not started, in progress, shipped, delivered), add tracking numbers, and manage backer addresses. Backers see real-time status updates in their dashboard.",
      },
      {
        question: "What if my address changes?",
        answer:
          "You can update your shipping address in your backer dashboard before the creator locks addresses for fulfillment. If addresses are already locked, contact the creator directly to request changes. Some creators charge fees for address changes after a deadline.",
      },
    ],
  },
  {
    id: "analytics-tools",
    title: "Analytics & Tools",
    icon: BarChart3,
    description: "Campaign insights and management tools",
    faqs: [
      {
        question: "What analytics are available to creators?",
        answer:
          "Our analytics dashboard shows real-time funding progress, traffic sources, conversion rates, geographic distribution, referral tracking, reward popularity, backer demographics, and more. Track which marketing efforts drive the most pledges.",
      },
      {
        question: "How does referral tracking work?",
        answer:
          "Every project has unique referral links for tracking traffic sources. Add custom UTM parameters for campaigns. See exactly how many views, clicks, and conversions come from each source—social media, email, ads, or influencer partnerships.",
      },
      {
        question: "What is the pre-launch page?",
        answer:
          "Before launching, creators can set up a pre-launch page to collect email subscribers. Build your audience ahead of launch, then notify subscribers when you go live. Pre-launch pages include countdown timers and 'notify me' buttons.",
      },
      {
        question: "Can I integrate Google Analytics or Meta Pixel?",
        answer:
          "Yes! Connect your Google Analytics (GA4) and Meta Pixel (Facebook) accounts for advanced tracking. Monitor your campaign traffic, set up conversion events, and optimize your ad campaigns with real-time data.",
      },
      {
        question: "What is the Creator Dashboard?",
        answer:
          "Your Creator Dashboard is command central for managing your campaign. View funding progress, communicate with backers, send updates, manage rewards and fulfillment, download backer data, and access analytics—all from one place.",
      },
      {
        question: "How do I communicate with backers?",
        answer:
          "Send project updates visible to all backers or backer-only private updates. Direct message individual backers. Create polls to gather feedback. Our system handles email notifications so backers stay informed about your progress.",
      },
    ],
  },
  {
    id: "security-trust",
    title: "Security & Trust",
    icon: Shield,
    description: "Safety, verification, and dispute resolution",
    faqs: [
      {
        question: "How does project verification work?",
        answer:
          "All projects undergo review before launch. We verify creator identity, check for policy compliance, and use AI-powered analysis to flag potential issues. Our trust & safety team manually reviews flagged projects and maintains quality standards.",
      },
      {
        question: "What happens to fraudulent projects?",
        answer:
          "We actively monitor for fraud and suspicious activity. Fraudulent projects are removed immediately, and creators may face legal action. If you spot a suspicious project, report it through our platform. We investigate all reports.",
      },
      {
        question: "How is my payment information protected?",
        answer:
          "We never store your full payment details. All transactions are processed through PCI-compliant payment processors (Stripe or CCBill). Data is encrypted in transit and at rest. We use industry-standard security practices.",
      },
      {
        question: "What if there's a dispute with a creator?",
        answer:
          "First, try contacting the creator directly. If unsuccessful, file a dispute through your backer dashboard. Our support team mediates disputes and can help facilitate refunds when warranted. For unresolved issues, you may have chargeback rights with your card issuer.",
      },
      {
        question: "How do I report a policy violation?",
        answer:
          "Click the 'Report' button on any project or use our contact form. Describe the violation and provide evidence. Our trust & safety team reviews all reports within 24-48 hours and takes appropriate action.",
      },
      {
        question: "What content is prohibited?",
        answer:
          "Prohibited content includes: illegal items, weapons, hate speech, harassment, fraud, scams, dangerous products, and content violating intellectual property rights. Adult content is allowed but requires special payment processing and age verification.",
      },
    ],
  },
  {
    id: "admin-features",
    title: "Platform Administration",
    icon: FileText,
    description: "Admin tools and site management",
    faqs: [
      {
        question: "What admin tools are available?",
        answer:
          "Our admin panel includes: project review center, user management, content moderation, site-wide analytics, email campaign tools, theme customization, page builder, media library management, retailer application review, and AI marketing configuration.",
      },
      {
        question: "How does the project review center work?",
        answer:
          "Admins see all submitted projects in a queue with AI-generated risk scores and flags. Review project details, creator history, and compliance checklist. Approve, reject, or request changes with templated responses. Track review metrics and turnaround times.",
      },
      {
        question: "What is the AI Marketing Admin tool?",
        answer:
          "Configure site-wide AI marketing settings, customize prompt templates, manage social media integrations, and monitor AI-generated content performance. Ensure brand consistency across AI-assisted creator content.",
      },
      {
        question: "How does the theme builder work?",
        answer:
          "Customize the platform's appearance without code. Adjust colors, typography, spacing, and component styles. Preview changes in real-time. Create multiple themes for different purposes (default, seasonal, promotional).",
      },
      {
        question: "What is the page builder?",
        answer:
          "Create custom static pages with drag-and-drop components. Build landing pages, promotional content, help articles, and more. No coding required. Components include hero sections, feature grids, testimonials, CTAs, and custom HTML.",
      },
    ],
  },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = faqCategories
    .map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.faqs.length > 0 || searchQuery === "");

  const totalFaqs = faqCategories.reduce((sum, cat) => sum + cat.faqs.length, 0);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white py-20">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 mb-6">
            <HelpCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Help Center</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-white/80 mb-8">
            Everything you need to know about IndieCrowdfund. Can&apos;t find an answer?{" "}
            <Link href="/contact" className="underline hover:text-white">
              Contact our support team
            </Link>
            .
          </p>

          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search FAQs..."
              className="pl-12 h-14 text-lg bg-white text-zinc-900 border-0 shadow-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <p className="text-sm text-white/60 mt-4">
            {totalFaqs} answers across {faqCategories.length} categories
          </p>
        </div>
      </section>

      {/* Category Navigation */}
      <section className="py-8 bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Categories
            </Button>
            {faqCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="whitespace-nowrap"
              >
                <category.icon className="h-4 w-4 mr-2" />
                {category.title}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-12">
        <div className="container max-w-4xl mx-auto px-4">
          {searchQuery && (
            <p className="text-sm text-zinc-500 mb-6">
              Found{" "}
              {filteredCategories.reduce((sum, cat) => sum + cat.faqs.length, 0)}{" "}
              results for &quot;{searchQuery}&quot;
            </p>
          )}

          <div className="space-y-8">
            {filteredCategories
              .filter(
                (category) =>
                  selectedCategory === null || selectedCategory === category.id
              )
              .map((category) => (
                <div key={category.id}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <category.icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{category.title}</h2>
                      <p className="text-sm text-zinc-500">{category.description}</p>
                    </div>
                  </div>

                  <Card>
                    <CardContent className="p-0">
                      <Accordion type="single" collapsible className="w-full">
                        {category.faqs.map((faq, index) => (
                          <AccordionItem
                            key={index}
                            value={`${category.id}-${index}`}
                            className="border-b last:border-0"
                          >
                            <AccordionTrigger className="px-6 hover:no-underline hover:bg-zinc-50">
                              <span className="text-left font-medium">
                                {faq.question}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-4 text-zinc-600">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Still Have Questions */}
      <section className="py-16 bg-white border-t">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
          <p className="text-zinc-600 mb-8">
            Our support team is here to help you with anything you need.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact">
              <Button size="lg" className="gap-2">
                <MessageSquare className="h-5 w-5" />
                Contact Support
              </Button>
            </Link>
            <Link href="/guides">
              <Button variant="outline" size="lg" className="gap-2">
                <FileText className="h-5 w-5" />
                Read Our Guides
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-12 bg-zinc-100">
        <div className="container mx-auto px-4">
          <h3 className="text-lg font-semibold mb-6 text-center">Popular Topics</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <Link href="/start">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <Rocket className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Start a Project</span>
                  <ChevronRight className="h-4 w-4 ml-auto text-zinc-400" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/retailers">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <Store className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium">Retailer Program</span>
                  <ChevronRight className="h-4 w-4 ml-auto text-zinc-400" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/discover">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <Globe className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Discover Projects</span>
                  <ChevronRight className="h-4 w-4 ml-auto text-zinc-400" />
                </CardContent>
              </Card>
            </Link>
            <Link href="/pricing">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Pricing & Fees</span>
                  <ChevronRight className="h-4 w-4 ml-auto text-zinc-400" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
