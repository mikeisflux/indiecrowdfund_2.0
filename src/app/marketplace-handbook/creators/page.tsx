'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Upload,
  DollarSign,
  Star,
  Users,
  Settings,
  FileText,
  CheckCircle,
  Clock,
  BarChart3,
  Gift,
  Tag,
  Info,
  ArrowRight,
  ArrowLeft,
  Shield,
  TrendingUp,
  CreditCard,
  Mail,
} from 'lucide-react';
import { Footer } from "@/components/footer";

interface Step {
  title: string;
  description: string;
  tip?: string;
  example?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'setup', label: 'Getting Started', icon: Settings },
  { id: 'creating', label: 'Creating Books', icon: Upload },
  { id: 'pricing', label: 'Pricing & Fees', icon: DollarSign },
  { id: 'managing', label: 'Managing Books', icon: BarChart3 },
  { id: 'promotion', label: 'Promotion', icon: TrendingUp },
];

const overviewSteps: Step[] = [
  {
    title: 'What is the Digital Marketplace?',
    description: 'The Digital Marketplace is IndieCrowdfund\'s storefront for selling completed digital content directly to readers. Unlike crowdfunding where you\'re raising funds for a future project, the marketplace lets you sell finished works immediately with instant delivery to buyers.',
    tip: 'Perfect for completed books, sequels, one-shots, art collections, and any digital content that\'s ready for purchase.',
  },
  {
    title: 'Why Sell on the Marketplace?',
    description: 'The marketplace provides an additional revenue stream alongside crowdfunding. You can sell backlist titles, release new works between campaigns, or offer digital versions of crowdfunded projects. Your existing IndieCrowdfund audience already trusts the platform.',
    example: 'A creator might crowdfund Vol. 1, then sell it on the marketplace while running a campaign for Vol. 2.',
  },
  {
    title: 'What Can You Sell?',
    description: 'Currently, the marketplace supports digital books in PDF format. This includes graphic novels, comics, art books, illustrated novels, guidebooks, and more. All content must be original work that you have the rights to sell.',
    tip: 'High-quality PDFs work best. Ensure your files are optimized for both screen viewing and potential printing by readers.',
  },
  {
    title: 'How Payments Work',
    description: 'When a customer purchases your book, they pay immediately through Stripe. After the platform fee is deducted, your earnings are available in your creator dashboard. Payouts are processed according to your payout schedule settings.',
    example: 'Customer pays $9.99 → Stripe takes 2.9% + $0.30 ($0.59) → Platform takes 3% ($0.30) → You receive $9.10',
  },
];

const setupSteps: Step[] = [
  {
    title: 'Access the Creator Dashboard',
    description: 'Log into your IndieCrowdfund account and navigate to Dashboard → Marketplace. If you\'ve run crowdfunding campaigns before, you\'ll already have creator access. New creators can apply through the creator registration process.',
    tip: 'The Marketplace tab appears in your dashboard once you have creator access enabled.',
  },
  {
    title: 'Set Up Payment Settings',
    description: 'Before you can sell, configure your payment settings in the Marketplace dashboard. Connect your Stripe account or set up DivinityCoin receiving preferences. This is where your earnings will be deposited.',
    example: 'Navigate to Dashboard → Marketplace → Payment Settings to connect your payout method.',
  },
  {
    title: 'Complete Your Creator Profile',
    description: 'Your creator profile appears on book pages and helps readers learn about you. Include a bio, profile picture, and links to your social media or website. A complete profile builds trust with potential buyers.',
    tip: 'Include a link to where readers can find physical editions of your books if available.',
  },
  {
    title: 'Understand the Review Process',
    description: 'All books go through a review process before going live. We check that content meets our guidelines, files work correctly, and listings are complete. This typically takes 24-48 hours.',
    example: 'Submit Monday → Under review Tuesday → Approved/Live by Wednesday',
  },
];

const creatingSteps: Step[] = [
  {
    title: 'Start a New Book',
    description: 'Click "Add New Book" in your Marketplace dashboard to begin. You\'ll be guided through a multi-step form to enter your book\'s details, upload files, and set pricing.',
    tip: 'Have your PDF file and cover image ready before starting. This makes the process much smoother.',
  },
  {
    title: 'Enter Basic Information',
    description: 'Provide your book\'s title, description, and category. The description should be compelling and informative - it\'s what convinces readers to purchase. Choose the most accurate category to help readers find your work.',
    example: 'Title: "Dragon\'s Legacy Vol. 1" | Category: Fantasy | Description: "When ancient magic awakens in the modern world..."',
  },
  {
    title: 'Upload Your PDF',
    description: 'Upload your book as a PDF file. Ensure the file is high-quality, properly formatted, and under the size limit (100MB). This is the file customers will receive after purchase.',
    tip: 'Test your PDF on multiple devices before uploading. Check that pages display correctly and images are crisp.',
  },
  {
    title: 'Add Cover Image',
    description: 'Upload a cover image in portrait orientation (2:3 ratio recommended, such as 600×900px or 800×1200px). This appears in marketplace listings and is crucial for attracting readers. Use a high-resolution, eye-catching design.',
    example: 'A graphic novel cover showing the main character in an action pose with the title prominently displayed.',
  },
  {
    title: 'Optional: Add Promo Video',
    description: 'You can optionally add a promotional video to showcase your book. This could be a trailer, flip-through, or behind-the-scenes look at your creative process.',
    tip: 'Videos aren\'t required but can significantly increase interest, especially for visually rich content like comics.',
  },
  {
    title: 'Set Content Flags',
    description: 'If your content contains mature themes or NSFW content, mark it appropriately. This ensures proper age verification and enables the correct payment processor. NSFW content uses DivinityCoin payments.',
    example: 'A horror comic with graphic violence would be flagged as NSFW and processed through DivinityCoin.',
  },
  {
    title: 'Add Tags',
    description: 'Add relevant tags to help readers find your book. Include genre tags, theme keywords, and descriptive terms. Tags improve discoverability in search results.',
    example: 'Tags: fantasy, dragons, magic, adventure, illustrated, full-color, complete-story',
  },
  {
    title: 'Review and Submit',
    description: 'Before submitting, review all your book details. Check the preview to see how your listing will appear to buyers. Once satisfied, submit for review. You can save as draft if you\'re not ready to submit.',
    tip: 'Double-check your price and PDF file. These are the most common areas where creators make mistakes.',
  },
];

const pricingSteps: Step[] = [
  {
    title: 'Setting Your Price',
    description: 'Choose a price that reflects your content\'s value. Consider the page count, production quality, and what similar works charge. Digital books typically range from $2.99 to $19.99, with longer or premium content going higher.',
    example: 'A 100-page full-color graphic novel might price at $9.99, while a 24-page comic might be $2.99.',
  },
  {
    title: 'Understanding Platform Fees',
    description: 'IndieCrowdfund charges a 3% platform fee on marketplace sales. This is significantly lower than many other platforms and helps keep more money in creators\' pockets.',
    example: '$9.99 book → 3% platform fee ($0.30) + Stripe processing ($0.59) → You receive $9.10',
  },
  {
    title: 'Payment Processing',
    description: 'Standard content uses Stripe for payment processing, which charges 2.9% + $0.30 per transaction. NSFW content uses DivinityCoin, which has different fee structures. Your net earnings appear in your dashboard.',
    tip: 'Factor in all fees when setting your price. Use the fee calculator in the book creation form to see your exact earnings.',
  },
  {
    title: 'Currency Options',
    description: 'Set your price in USD, EUR, or GBP. Prices are displayed in your chosen currency. Customers may see converted amounts based on their location.',
    tip: 'USD is the most universal choice if you want to reach the broadest audience.',
  },
  {
    title: 'When You Get Paid',
    description: 'Earnings accumulate in your creator balance. Payouts are processed according to your payout schedule (weekly, bi-weekly, or monthly). You can view pending and completed payouts in your dashboard.',
    example: 'Set to monthly payouts → January sales paid out in early February',
  },
];

const managingSteps: Step[] = [
  {
    title: 'Your Books Dashboard',
    description: 'The Books tab in your Marketplace dashboard shows all your books with their status: Draft, Under Review, Live, or Rejected. You can quickly see which books need attention and their current sales.',
    tip: 'Check your dashboard regularly for review status updates and sales notifications.',
  },
  {
    title: 'Understanding Book Status',
    description: 'Books go through several stages: Draft (work in progress), Submitted (under review), Live (available for purchase), or Rejected (needs changes). Only Live books appear in the marketplace.',
    example: 'A rejected book might need a better description or higher-quality cover image before resubmission.',
  },
  {
    title: 'Editing Published Books',
    description: 'You can update your book\'s description, tags, and cover image after publishing. Price changes take effect immediately. To update the PDF itself, you\'ll need to upload a new version.',
    tip: 'If you find an error in your PDF, update it promptly. Existing customers can re-download the updated version.',
  },
  {
    title: 'Viewing Sales & Analytics',
    description: 'The Analytics section shows your sales over time, total revenue, and which books perform best. Use this data to understand what resonates with readers and inform future releases.',
    example: 'Analytics might show that your fantasy titles outsell your sci-fi titles, guiding future content decisions.',
  },
  {
    title: 'Managing Reviews',
    description: 'Readers can leave reviews on your books. Respond professionally to feedback - both positive and constructive. Good reviews help sell more books; addressing concerns shows you care about readers.',
    tip: 'Encourage happy customers to leave reviews. A polite note in your book or social media can help.',
  },
  {
    title: 'Unpublishing or Archiving',
    description: 'You can temporarily unpublish a book (removes from marketplace but retains data) or archive it permanently. Existing customers retain access to books they\'ve purchased even if unpublished.',
    example: 'Unpublish an older edition when releasing an updated or expanded version.',
  },
];

const promotionSteps: Step[] = [
  {
    title: 'Creating Discount Codes',
    description: 'Create discount codes to promote your books. Set codes for free books (100% off), percentage discounts, or fixed amount off. Control validity periods and maximum uses per code and per customer.',
    example: 'Create code "LAUNCH50" for 50% off during your first week, limited to 100 uses.',
  },
  {
    title: 'Free Book Promotions',
    description: 'Offering your book for free temporarily or permanently can build your audience. Use free codes to give copies to reviewers, newsletter subscribers, or as part of promotional events.',
    tip: 'A free first volume can drive sales of subsequent volumes in a series.',
  },
  {
    title: 'Sharing on Social Media',
    description: 'Each book has a shareable link. Post it on Twitter/X, Facebook, Instagram, and other platforms. Share cover previews, sample pages, and behind-the-scenes content to generate interest.',
    example: 'Tweet: "My new graphic novel is now available! First 50 readers get 25% off with code EARLY25: [link]"',
  },
  {
    title: 'Cross-Promotion with Campaigns',
    description: 'If you run crowdfunding campaigns, mention your marketplace books. Include links in campaign updates, and offer marketplace buyers exclusive discount codes for your campaigns.',
    tip: 'Backers who loved your crowdfunded book may want to buy your other works immediately.',
  },
  {
    title: 'Email Your Followers',
    description: 'If you have followers on IndieCrowdfund or an email newsletter, notify them of new releases. Your existing audience is your most likely buyers.',
    example: 'Send a launch email: "My new book is live! As a thank you for your support, here\'s 20% off this week."',
  },
  {
    title: 'Leveraging Reviews',
    description: 'Good reviews are social proof. Share positive reviews on social media. If you receive constructive criticism, address it - updating your book or responding professionally shows you value readers.',
    tip: 'Quote reviews in your book description: "\'A masterpiece of indie comics!\' - Reader Review"',
  },
  {
    title: 'Building Your Catalog',
    description: 'The more books you have, the more chances for readers to discover you. When someone enjoys one book, they often buy more from the same creator. Build a catalog over time.',
    example: 'One-time buyers become loyal fans who purchase everything you release.',
  },
];

const faqs: FAQ[] = [
  {
    question: 'How long does the review process take?',
    answer: 'Most books are reviewed within 24-48 hours. Complex cases or books submitted during busy periods may take slightly longer. You\'ll receive email notification when your book is approved or if changes are needed.',
  },
  {
    question: 'What if my book is rejected?',
    answer: 'If rejected, you\'ll receive specific feedback about what needs to change. Common issues include incomplete descriptions, low-quality images, or technical problems with the PDF. Make the requested changes and resubmit.',
  },
  {
    question: 'Can I sell physical copies through the marketplace?',
    answer: 'The marketplace is currently digital-only (PDF files). However, you can include a link on your creator profile to where readers can purchase physical editions from your own store or print-on-demand service.',
  },
  {
    question: 'What file formats are supported?',
    answer: 'Currently, we support PDF files only. PDFs provide the most consistent reading experience across devices and are widely compatible with e-readers, tablets, and computers.',
  },
  {
    question: 'Is there a minimum or maximum price?',
    answer: 'Books must be priced at $0.99 or higher (or use a free discount code for promotional giveaways). There\'s no maximum price, but very high prices should reflect exceptional content and value.',
  },
  {
    question: 'Can I update my book after publishing?',
    answer: 'Yes! You can update the PDF file at any time. Existing customers will have access to the updated version. Just upload the new file in your book\'s edit page.',
  },
  {
    question: 'How do refunds work?',
    answer: 'Digital purchases are generally non-refundable due to the nature of instant digital delivery. In cases of technical issues or duplicate purchases, customers can contact support within 48 hours.',
  },
  {
    question: 'Can I see who purchased my book?',
    answer: 'You can see aggregate sales data and review information, but individual customer details are kept private for privacy reasons. You won\'t have direct access to buyer email addresses.',
  },
  {
    question: 'What content isn\'t allowed?',
    answer: 'Content must not violate our community guidelines. This includes illegal content, stolen/plagiarized work, or misleading listings. NSFW content is allowed but must be properly flagged and uses DivinityCoin payments.',
  },
  {
    question: 'Can I sell books from my crowdfunding campaigns?',
    answer: 'Absolutely! Many creators sell completed campaign rewards on the marketplace. This is a great way to continue earning from a project after the campaign ends.',
  },
];

function StepCard({ step, number }: { step: Step; number: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {number}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">{step.title}</h4>
          <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          {step.example && (
            <div className="mt-3 flex gap-2 rounded-lg bg-muted p-3">
              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground italic">{step.example}</p>
            </div>
          )}
          {step.tip && (
            <div className="mt-3 flex gap-2 rounded-lg bg-primary/10 p-3">
              <Info className="h-4 w-4 flex-shrink-0 text-primary" />
              <p className="text-sm text-primary">{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FAQItem({ faq }: { faq: FAQ }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium text-foreground">{faq.question}</span>
        <ArrowRight className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-3 bg-muted/50">
          <p className="text-sm text-muted-foreground">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-2xl font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

export default function MarketplaceCreatorHandbookPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-primary/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-primary/5 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-primary/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 py-12 text-center text-primary-foreground relative overflow-hidden">
        <div className="relative z-10 px-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="h-10 w-10" />
            <Star className="h-10 w-10" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold">Digital Marketplace Handbook</h1>
          <p className="mt-2 text-primary-foreground/80 text-lg">
            For Creators & Authors
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-primary-foreground/70">
            Your complete guide to listing, selling, and promoting your digital books on the IndieCrowdfund Marketplace
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/creator-handbook" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Creator Handbook
        </Link>
      </div>

      {/* Content with Sidebar */}
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Vertical Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-4">
              <nav className="flex flex-col gap-1 rounded-xl bg-card/80 backdrop-blur-sm p-3 shadow-sm border border-border">
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sections</h3>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="space-y-8">
              {activeTab === 'overview' && (
                <>
                  <SectionHeader
                    title="Welcome to the Digital Marketplace"
                    description="Turn your completed works into ongoing revenue with direct digital sales."
                  />
                  <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex gap-3">
                      <Shield className="h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <h4 className="font-medium text-foreground">Sell Your Way</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Keep 97% of every sale with our industry-low 3% platform fee. Your books, your pricing, your audience.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {overviewSteps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'setup' && (
                <>
                  <SectionHeader
                    title="Getting Started"
                    description="Set up your account and prepare to start selling."
                  />
                  <div className="mb-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card/80 p-4">
                      <div className="flex gap-3">
                        <CreditCard className="h-5 w-5 flex-shrink-0 text-primary" />
                        <div>
                          <h4 className="font-medium text-foreground">Payment Setup</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Connect Stripe or DivinityCoin to receive earnings from sales.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-card/80 p-4">
                      <div className="flex gap-3">
                        <Users className="h-5 w-5 flex-shrink-0 text-primary" />
                        <div>
                          <h4 className="font-medium text-foreground">Creator Profile</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Build trust with a complete bio and professional presence.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {setupSteps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'creating' && (
                <>
                  <SectionHeader
                    title="Creating Your Book Listing"
                    description="Step-by-step guide to listing your digital book for sale."
                  />
                  <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex gap-3">
                      <Upload className="h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <h4 className="font-medium text-foreground">Before You Start</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Have these ready: A finalized PDF file (under 100MB), cover image (600×900px or larger, portrait orientation), and a compelling description of your book.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {creatingSteps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'pricing' && (
                <>
                  <SectionHeader
                    title="Pricing & Fees"
                    description="Understand how pricing works and maximize your earnings."
                  />
                  <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex gap-3">
                      <DollarSign className="h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <h4 className="font-medium text-foreground">Industry-Low Fees</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          We take only 3% so you keep more of your earnings. Compare that to 30%+ on other platforms!
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {pricingSteps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>

                  {/* Fee Calculator Example */}
                  <div className="mt-8 p-6 rounded-xl bg-card border border-border">
                    <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Example Earnings Calculator
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Your Price</p>
                        <p className="text-2xl font-bold text-foreground">$9.99</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Stripe (2.9% + $0.30)</p>
                        <p className="text-2xl font-bold text-destructive">-$0.59</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Platform Fee (3%)</p>
                        <p className="text-2xl font-bold text-destructive">-$0.30</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                        <p className="text-sm text-primary">You Receive</p>
                        <p className="text-2xl font-bold text-primary">$9.10</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'managing' && (
                <>
                  <SectionHeader
                    title="Managing Your Books"
                    description="Monitor sales, update listings, and track your success."
                  />
                  <div className="mb-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-card/80 p-4 text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-foreground">Under Review</h4>
                      <p className="text-sm text-muted-foreground">24-48 hours typical</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/80 p-4 text-center">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-foreground">Live</h4>
                      <p className="text-sm text-muted-foreground">Available for purchase</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/80 p-4 text-center">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h4 className="font-medium text-foreground">Analytics</h4>
                      <p className="text-sm text-muted-foreground">Track your sales</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {managingSteps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'promotion' && (
                <>
                  <SectionHeader
                    title="Promoting Your Books"
                    description="Drive sales with discount codes, social sharing, and marketing strategies."
                  />
                  <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex gap-3">
                      <Tag className="h-5 w-5 flex-shrink-0 text-primary" />
                      <div>
                        <h4 className="font-medium text-foreground">Discount Codes</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Create promo codes in the Discount Codes tab of your Marketplace dashboard. Offer free copies, percentage off, or fixed discounts to drive sales and reward loyal readers.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {promotionSteps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>

                  {/* Promo Code Examples */}
                  <div className="mt-8 p-6 rounded-xl bg-card border border-border">
                    <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Gift className="h-5 w-5 text-primary" />
                      Example Discount Code Strategies
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="font-medium text-foreground">Launch Discount</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: LAUNCH25 | 25% off | 100 uses | First week only
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="font-medium text-foreground">Review Copies</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: REVIEWER | Free book | 20 uses | 1 per customer
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="font-medium text-foreground">Newsletter Bonus</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: SUBSCRIBER | Free book | Unlimited uses | Subscribers only
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="font-medium text-foreground">Holiday Sale</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: HOLIDAY50 | 50% off | Unlimited | Dec 20-26 only
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* FAQ Section */}
            <div className="mt-16">
              <SectionHeader
                title="Frequently Asked Questions"
                description="Common questions about selling on the Digital Marketplace."
              />
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <FAQItem key={faq.question} faq={faq} />
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="mt-16 rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-8 text-center text-primary-foreground">
              <h3 className="text-2xl font-bold">Ready to Start Selling?</h3>
              <p className="mt-2 text-primary-foreground/80">Your digital books are waiting for an audience.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link
                  href="/dashboard/marketplace"
                  className="inline-flex items-center gap-2 rounded-lg bg-background px-6 py-3 font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <BookOpen className="h-5 w-5" />
                  Go to Marketplace Dashboard
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground px-6 py-3 font-medium text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <Star className="h-5 w-5" />
                  View Marketplace
                </Link>
              </div>
            </div>

            {/* Related Links */}
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <Link
                href="/marketplace-handbook/backers"
                className="rounded-lg border border-border bg-card/80 p-4 hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Backer Handbook</h4>
                    <p className="text-sm text-muted-foreground">See the buyer&apos;s perspective</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
              <Link
                href="/creator-handbook"
                className="rounded-lg border border-border bg-card/80 p-4 hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Creator Handbook</h4>
                    <p className="text-sm text-muted-foreground">Learn about crowdfunding campaigns</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
