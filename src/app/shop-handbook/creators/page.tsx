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
    title: 'What is the Digital Shop?',
    description: 'A store on IndieCrowdfund where you sell finished digital books straight to readers. No funding goal. No campaign timer. You upload a finished file and people can buy it right now.',
    tip: 'Best for: completed books, sequels, one-shots, art collections — anything you would not run a Kickstarter for.',
  },
  {
    title: 'Why sell here?',
    description: 'The Digital Shop is extra income on top of your crowdfunding work. Sell your old books while you make new ones. Sell digital versions of campaigns you already shipped. Your existing IndieCrowdfund audience already knows and trusts the site.',
    example: 'Crowdfund Vol. 2 while Vol. 1 sits on the Digital Shop bringing in steady sales.',
  },
  {
    title: 'What can you sell?',
    description: 'Right now: digital books as PDF files. That covers graphic novels, comics, art books, illustrated novels, guides — anything you can deliver as a single PDF. The work has to be yours; you must own the rights to sell it.',
    tip: 'A high-quality PDF is everything. Make sure pages display sharp on a phone AND look good on a tablet.',
  },
  {
    title: 'How you get paid',
    description: 'When someone buys your book, the processor you picked (Divinity Payments, PayPal, or Whop) handles the card. The platform takes a 3% fee. The processor takes their fee (~3% + a small flat amount). What\'s left lands in your creator balance and pays out to your bank on the standard schedule for that processor.',
    example: 'Reader pays $9.99 → processor takes ~$0.60 → Platform takes ~$0.30 → You get ~$9.09.',
  },
];

const setupSteps: Step[] = [
  {
    title: 'Open your creator dashboard',
    description: 'Sign in and go to Dashboard → Shop. If you have run a crowdfunding campaign before, you already have creator access. If you are new, you will need to apply through the creator signup flow first.',
    tip: 'The Shop tab only shows up once you have creator access turned on.',
  },
  {
    title: 'Add your bank account',
    description: 'Before you can sell, you need a way to get paid. In the Shop dashboard, open Payment Settings, pick your processor (Divinity Payments, PayPal, or Whop), and add your bank routing and account numbers. The processor deposits your sales there on its standard schedule.',
    example: 'Dashboard → Shop → Payment Settings → choose processor → enter bank details → save.',
  },
  {
    title: 'Fill out your creator profile',
    description: 'Your profile shows up on every book page. Add a profile picture, a short bio, and links to your social or website. A complete profile makes readers trust you and click Buy.',
    tip: 'Add a link to where readers can buy printed copies if you sell them anywhere — that link will show up on each of your book pages.',
  },
  {
    title: 'Know what to expect from review',
    description: 'Every new book goes through a quick review before it goes live. We check it follows the rules, the file works, and the listing is complete. Most reviews finish in 24-48 hours.',
    example: 'Submit Monday → reviewed Tuesday → live Wednesday.',
  },
];

const creatingSteps: Step[] = [
  {
    title: 'Click "Add New Book"',
    description: 'In your Shop dashboard, click "Add New Book". A short form walks you step by step: details, files, price.',
    tip: 'Have your PDF and cover image ready before you start. The form is much faster when you can just upload.',
  },
  {
    title: 'Type the basic info',
    description: 'Title, description, category. The description is what convinces a reader to buy — write it like a back-cover blurb. Pick the most accurate category so the right readers find your book.',
    example: 'Title: "Dragon\'s Legacy Vol. 1". Category: Fantasy. Description: "When ancient magic wakes up in modern New York, one girl..."',
  },
  {
    title: 'Upload your PDF',
    description: 'Upload your book file. Must be PDF, must be under 100MB. This is the file your customers download.',
    tip: 'Test your PDF on a phone, a tablet, AND a laptop before you upload. Check that the pages look right and the art is crisp.',
  },
  {
    title: 'Upload a cover image',
    description: 'Upload a portrait-orientation cover image. We recommend 2:3 ratio — like 600×900 px or 800×1200 px. The cover is what people see first in the catalog. A great cover sells the book.',
    example: 'A graphic novel cover with the main character front and center, the title big and clear at the top.',
  },
  {
    title: 'Add a video (optional)',
    description: 'You can attach a YouTube or Vimeo trailer, page flip-through, or behind-the-scenes video to your listing. Not required, but listings with video sell better, especially for visual books.',
    tip: 'Even a 30-second phone video flipping through your art pages helps.',
  },
  {
    title: 'Mark mature or NSFW content',
    description: 'If your book has mature themes or NSFW content, tick the right flag. The flag adds an age check on the listing. Divinity Payments and Whop accept all content types including NSFW; PayPal does not, so NSFW listings should pick Divinity Payments or Whop as their processor.',
    example: 'A horror comic with graphic violence → flag NSFW + pick Divinity Payments or Whop → readers see the age check → payment flows normally.',
  },
  {
    title: 'Add tags',
    description: 'Tags help readers find your book in search. Add genre tags, theme tags, descriptive words.',
    example: 'Tags: fantasy, dragons, magic, adventure, illustrated, full-color, complete-story.',
  },
  {
    title: 'Review and submit',
    description: 'Click "Preview" to see how your listing will look. Read every line one more time. Then click Submit for review. Not ready? Save as draft and finish later.',
    tip: 'Triple-check the price and the PDF file before you submit. Those are the two things creators get wrong most.',
  },
];

const pricingSteps: Step[] = [
  {
    title: 'Pick a price',
    description: 'Set a price that matches the value of your book. Look at page count, art quality, and what similar books charge. Most digital books fall between $2.99 and $19.99. Premium or longer books can go higher.',
    example: 'A 100-page full-color graphic novel might be $9.99. A 24-page short comic might be $2.99.',
  },
  {
    title: 'Platform fee: 3%',
    description: 'IndieCrowdfund takes 3% of every sale. That is much lower than the 30% that big platforms charge. The rest goes to you (after card processing).',
    example: '$9.99 book → 3% to the platform ($0.30) + processor fee (~$0.60) → you keep ~$9.09.',
  },
  {
    title: 'Card processing',
    description: 'Digital Shop sales go through Divinity Payments, PayPal, or Whop — whichever processor you set up. Each has a fee of about 3% + $0.30 per sale. Divinity Payments and Whop accept every content type (including NSFW); PayPal does not allow NSFW.',
    tip: 'When you set the price, use the fee calculator on the book form to see exactly what hits your bank.',
  },
  {
    title: 'Currency',
    description: 'You can price in USD, EUR, or GBP. The Digital Shop shows readers prices in your chosen currency. Some readers see converted amounts based on where they live.',
    tip: 'USD reaches the most readers. Pick that unless you have a specific reason to use EUR or GBP.',
  },
  {
    title: 'When you get paid',
    description: 'Sales add up in your creator balance. Payouts go to your bank on the schedule you pick (weekly, every two weeks, or monthly). Your dashboard shows what is pending and what has paid out.',
    example: 'Monthly payouts → January\'s sales hit your bank in early February.',
  },
];

const managingSteps: Step[] = [
  {
    title: 'The Books tab',
    description: 'Open Dashboard → Shop → Books. You see every book you have ever uploaded with its current status: Draft, Under Review, Live, or Rejected. Quick way to see what needs your attention.',
    tip: 'Check this tab a few times a week — review status updates and sales counts show up here.',
  },
  {
    title: 'What each status means',
    description: 'Draft = you are still working on it, not submitted yet. Submitted = our team is reviewing it. Live = it is in the Digital Shop, customers can buy it. Rejected = something needs to change before we can list it.',
    example: 'Rejected? You\'ll see notes from review explaining what to fix — usually a clearer description or a higher-resolution cover.',
  },
  {
    title: 'Edit a published book',
    description: 'You can update the description, tags, and cover image of a Live book any time. Price changes take effect right away. To replace the PDF itself, upload a new version on the book\'s edit page.',
    tip: 'Found a typo or a print error in your PDF? Upload a fixed version. Existing customers can re-download the new file.',
  },
  {
    title: 'See your sales',
    description: 'Open the Analytics section to see daily, weekly, and monthly sales for each book. Total revenue. Best-sellers. Which days had spikes (and what marketing you ran on those days).',
    example: 'Analytics might show your fantasy books outsell your sci-fi books 3 to 1. Useful when planning your next release.',
  },
  {
    title: 'Read and reply to reviews',
    description: 'Readers can leave star ratings and written reviews. Respond to them — politely thank good reviews, address concerns in critical ones. How you handle reviews shapes your reputation.',
    tip: 'Ask happy customers to leave a review. A note inside your PDF or a social post is enough to remind them.',
  },
  {
    title: 'Unpublish or archive a book',
    description: 'Unpublish = take it off the Digital Shop but keep its data. Archive = put it away long-term. Both let existing customers keep what they bought; only new customers can no longer buy it.',
    example: 'Unpublish your old edition when you launch a revised or expanded version.',
  },
];

const promotionSteps: Step[] = [
  {
    title: 'Make a discount code',
    description: 'Open the Discount Codes tab in your Shop dashboard. Create a code: pick the percentage off (or 100% for free), how long the code is valid, how many people can use it, and how many times each person can use it.',
    example: 'Code "LAUNCH50" → 50% off → first week → max 100 uses → 1 per customer.',
  },
  {
    title: 'Free copies for promotion',
    description: 'Free codes are great for getting eyes on your work. Send free copies to reviewers, newsletter subscribers, or as part of giveaways.',
    tip: 'Make Volume 1 free for a week. Readers who finish it often pay full price for Volume 2.',
  },
  {
    title: 'Share on social media',
    description: 'Every book has its own URL. Post it on Twitter/X, Bluesky, Instagram, Facebook. Pair the link with cover art, a sample page, or a short clip. Visual posts get way more clicks than text-only posts.',
    example: '"New comic out now. First 50 readers get 25% off with code EARLY25: [link]"',
  },
  {
    title: 'Cross-promote with your campaigns',
    description: 'Already running a crowdfunding campaign? Mention your Digital Shop books inside campaign updates and the project page. Offer Digital Shop buyers a discount code for your next campaign.',
    tip: 'Backers who loved your campaign want to buy your other books too. Make it easy for them.',
  },
  {
    title: 'Email your followers',
    description: 'You have followers on IndieCrowdfund and maybe an email list elsewhere. When you launch a new Digital Shop book, email them. Existing fans are the most likely buyers.',
    example: '"New book is live. As a thank-you for following, here\'s 20% off this week with code FOLLOWER."',
  },
  {
    title: 'Use reviews as marketing',
    description: 'Good reviews are free advertising. Quote them on social media and in your book\'s description. Address critical reviews professionally — it shows you care.',
    tip: 'Stick the best one-line review at the top of your book\'s description: "\'A masterpiece of indie comics!\' — Reader Review."',
  },
  {
    title: 'Build a catalog',
    description: 'More books = more ways readers find you. When someone enjoys one of your books, they often buy more. Add to your Digital Shop shelf over time.',
    example: 'One-time buyers turn into loyal fans who buy everything you release.',
  },
];

const faqs: FAQ[] = [
  {
    question: 'How long does review take?',
    answer: 'Most books are reviewed in 24-48 hours. If we are extra busy or your book needs a deeper look, it might take longer. You will get an email when it is approved or if we need changes.',
  },
  {
    question: 'My book got rejected. What now?',
    answer: 'You will get specific feedback explaining why. Most common reasons: a thin description, a low-quality cover, or a PDF that does not display correctly. Fix the issue and resubmit.',
  },
  {
    question: 'Can I sell printed copies on the Digital Shop?',
    answer: 'Not yet — the Digital Shop is digital-only PDFs. But you can add a link on your creator profile to wherever you sell printed copies (your own store, Amazon, print-on-demand). That link shows up on every book page.',
  },
  {
    question: 'What file types can I upload?',
    answer: 'PDF only, for now. PDFs work everywhere — phones, tablets, laptops, e-readers — and they keep your art, fonts, and layout exactly the way you made them.',
  },
  {
    question: 'Is there a minimum or maximum price?',
    answer: 'Minimum is $0.99 (or use a free discount code for giveaways). No maximum, but a very high price needs to be backed up by very high quality and a lot of pages.',
  },
  {
    question: 'Can I update my book after it is live?',
    answer: 'Yes. You can replace the PDF file any time on the book\'s edit page. Existing customers can re-download to get the updated version.',
  },
  {
    question: 'Can readers refund a digital book?',
    answer: 'Digital buys are usually non-refundable because once a file is downloaded it cannot really be returned. If a reader had a real technical issue or bought the same book twice by accident, they can email support within 48 hours and we look at it case by case.',
  },
  {
    question: 'Can I see exactly who bought my book?',
    answer: 'You see total sales numbers and reviews, but not each buyer\'s personal info. Buyer privacy is protected — you won\'t have access to their email addresses or names.',
  },
  {
    question: 'What content is not allowed?',
    answer: 'Anything illegal. Anything stolen or plagiarized. Listings that lie about what the book is. NSFW content is fine if it is properly flagged with the age gate — just pick Divinity Payments or Whop as your processor, since PayPal does not allow NSFW.',
  },
  {
    question: 'Can I sell books from my old crowdfunding campaigns?',
    answer: 'Yes, and many creators do. Once a campaign is fulfilled, the digital version is a great fit for the Digital Shop. It keeps the project earning money long after the campaign closes.',
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
          <h1 className="text-2xl sm:text-4xl font-bold">Digital Shop Handbook</h1>
          <p className="mt-2 text-primary-foreground/80 text-lg">
            For Creators & Authors
          </p>
          <p className="mt-4 max-w-2xl mx-auto text-primary-foreground/70">
            Your complete guide to listing, selling, and promoting your digital books on the IndieCrowdfund Digital Shop
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
                    title="Welcome to the Digital Shop"
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
                            Pick a processor (Divinity Payments, PayPal, or Whop) and add your bank details so your earnings deposit from each sale.
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
                        <p className="text-sm text-muted-foreground">Processor (~3% + $0.30)</p>
                        <p className="text-2xl font-bold text-destructive">-$0.60</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground">Platform Fee (3%)</p>
                        <p className="text-2xl font-bold text-destructive">-$0.30</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                        <p className="text-sm text-primary">You Receive</p>
                        <p className="text-2xl font-bold text-primary">$9.09</p>
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
                          Create promo codes in the Discount Codes tab of your Shop dashboard. Offer free copies, percentage off, or fixed discounts to drive sales and reward loyal readers.
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
                description="Common questions about selling on the Digital Shop."
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
                  href="/dashboard/shop"
                  className="inline-flex items-center gap-2 rounded-lg bg-background px-6 py-3 font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <BookOpen className="h-5 w-5" />
                  Go to Shop Dashboard
                </Link>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground px-6 py-3 font-medium text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <Star className="h-5 w-5" />
                  View Digital Shop
                </Link>
              </div>
            </div>

            {/* Related Links */}
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <Link
                href="/shop-handbook/backers"
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
