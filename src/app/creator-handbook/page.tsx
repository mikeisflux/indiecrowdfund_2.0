'use client';

import { useState } from 'react';
import {
  Lightbulb,
  Gift,
  BookOpen,
  Users,
  CreditCard,
  Megaphone,
  ShoppingBag,
  ShieldCheck,
  Info,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

const tabs = [
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'basics', label: 'Basics', icon: Lightbulb },
  { id: 'rewards', label: 'Rewards & Add-ons', icon: Gift },
  { id: 'story', label: 'Story', icon: BookOpen },
  { id: 'people', label: 'People', icon: Users },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'promotion', label: 'Promotion', icon: Megaphone },
  { id: 'marketplace', label: 'Digital Marketplace', icon: ShoppingBag },
];

interface FieldInfo {
  name: string;
  required: boolean;
  description: string;
  tips?: string;
}

const tabContent: Record<string, { title: string; description: string; fields: FieldInfo[] }> = {
  'verification': {
    title: 'Creator Verification & Due Diligence',
    description: 'Before your campaign can go live, you must complete our verification process. This protects backers and maintains platform trust.',
    fields: [
      { name: 'Government-Issued Photo ID', required: true, description: 'New creators must submit a valid government-issued photo ID (driver\'s license, passport, or state ID). This is required for all first-time creators on the platform.', tips: 'Ensure your ID is not expired and the photo is clearly legible. Returning creators with previously verified accounts may be exempt.' },
      { name: 'Business Filing Documentation', required: true, description: 'New creators must provide a legitimate business filing from the Secretary of State office in the state where they reside (e.g., LLC articles of organization, business registration certificate, DBA filing).', tips: 'If you operate as a sole proprietor, a DBA (Doing Business As) filing is acceptable. Documents must be current and verifiable.' },
      { name: 'Social Media Verification', required: true, description: 'All social media accounts linked to your creator profile are logged and verified by our team. We check for consistency, authenticity, and active presence.', tips: 'Link your most active and professional accounts. Accounts with established history strengthen your application.' },
      { name: 'Cross-Platform Campaign Audit', required: true, description: 'Our team searches other crowdfunding platforms (Kickstarter, Indiegogo, GoFundMe, etc.) to review your previous campaign history. We examine backer reviews, comments, public feedback, and fulfillment track record.', tips: 'Be transparent about previous campaigns. Proactively disclose any past issues — honesty is valued during review.' },
      { name: 'Fulfillment History Validation', required: true, description: 'We validate your fulfillment history by reviewing backer feedback across all platforms. We contact creators directly when discrepancies or concerns are identified. All findings are documented internally.', tips: 'If you had fulfillment delays on past projects, be prepared to explain the circumstances and resolution.' },
      { name: 'Automatic Disqualification Rules', required: false, description: 'Creators are automatically disqualified if they have three or more unfulfilled campaigns on any platform, OR if any campaign is more than one year past its stated delivery date regardless of fulfillment status.', tips: 'These rules apply to campaigns across ALL crowdfunding platforms, not just IndieCrowdfund. There are no exceptions.' },
      { name: 'Payment Account Verification', required: true, description: 'Add your bank account for payouts (for standard PayPal campaigns) or complete DivinityCoin bank account setup (for NSFW/adult content campaigns). IndieCrowdfund collects all pledges and deposits your net earnings directly to your bank account — no PayPal account needed.', tips: 'For PayPal campaigns: go to Dashboard > Settings > Payments and add your bank account details. For DivinityCoin: have your US bank routing and account number ready.' },
      { name: 'Internal Review & Documentation', required: false, description: 'All verification findings, correspondence, and review decisions are documented internally and retained for compliance and audit purposes. Our admin team reviews all documentation before approving campaigns.', tips: 'The review process typically takes 2-5 business days. You\'ll be notified of the outcome via email.' },
    ]
  },
  'basics': {
    title: 'Step 1: Basics',
    description: 'Set up the foundation of your project. This information appears prominently on your project page and in search results.',
    fields: [
      { name: 'Project Title', required: true, description: 'The main name of your project that appears everywhere. Keep it clear, memorable, and descriptive.', tips: 'Aim for 5-10 words. Avoid generic titles. Include keywords backers might search for.' },
      { name: 'Subtitle/Tagline', required: false, description: 'A short phrase that expands on your title. Appears below your title on the project page.', tips: 'Highlight what makes your project unique or clarify the type of project.' },
      { name: 'Category', required: true, description: 'Select the category that best fits your project. Helps backers discover your project.', tips: 'Choose the most specific category available for better visibility.' },
      { name: 'Location', required: true, description: 'Where you (the creator) are based. Used for tax purposes and backer expectations.', tips: 'Be accurate - affects shipping calculations.' },
      { name: 'Project Image', required: true, description: 'The main image representing your project. First thing backers see.', tips: 'Use high-quality image (1024x576px minimum). Show your product clearly.' },
      { name: 'Project Video', required: false, description: 'An embedded video (YouTube/Vimeo) introducing your project. Significantly increases success.', tips: 'Keep under 3 minutes. Show yourself, your passion, and your product.' },
      { name: 'Funding Goal', required: true, description: 'Minimum amount needed to bring your project to life. All-or-nothing.', tips: 'Calculate actual costs (production, shipping, fees, taxes). Be realistic.' },
      { name: 'Campaign Duration', required: true, description: 'Choose fixed days (1-60) or specific end date for your campaign.', tips: '30 days is the sweet spot. Shorter campaigns create urgency.' },
      { name: 'Target Launch Date', required: false, description: 'When you plan to launch. Helps with pre-launch marketing.', tips: 'Give yourself time to build an audience. Tuesdays and Wednesdays perform best.' },
    ]
  },
  'rewards': {
    title: 'Step 2: Rewards & Add-ons',
    description: 'Create compelling reward tiers that give backers a reason to support your project.',
    fields: [
      { name: 'Reward Title', required: true, description: 'A clear name for this reward tier. Make it descriptive.', tips: 'Use names like "Early Bird Special", "Collector\'s Edition".' },
      { name: 'Description', required: true, description: 'Detailed explanation of everything included. Use rich text formatting.', tips: 'List every item. Be specific about colors, sizes, variations.' },
      { name: 'Pledge Amount', required: true, description: 'Minimum amount to receive this reward.', tips: 'Price to cover costs plus margin. Consider shipping costs.' },
      { name: 'Reward Image', required: false, description: 'Visual representation of what backers receive.', tips: 'Show mockups or prototypes. Multiple items? Create composite image.' },
      { name: 'Estimated Delivery', required: true, description: 'Month and year when you expect to deliver.', tips: 'Add buffer time for delays. Better to deliver early than late.' },
      { name: 'Shipping Options', required: true, description: 'Where and how you\'ll ship: worldwide, specific countries, local pickup, digital.', tips: 'Calculate international shipping carefully.' },
      { name: 'Quantity Limits', required: false, description: 'Unlimited or limited to specific number of backers.', tips: 'Limited rewards create urgency and exclusivity.' },
      { name: 'Add-ons', required: false, description: 'Optional extras backers can add to their pledge. Great for extra copies, accessories.', tips: 'Price add-ons slightly higher than reward equivalents.' },
    ]
  },
  'story': {
    title: 'Step 3: Story',
    description: 'Tell backers why your project matters. A compelling story creates emotional connection.',
    fields: [
      { name: 'Project Description', required: true, description: 'Your main pitch. Use rich text with images and videos.', tips: 'Start with hook. Show product. Explain story. Detail specs. Address concerns. End with CTA.' },
      { name: 'Risks & Challenges', required: true, description: 'Be honest about potential obstacles and how you\'ll overcome them.', tips: 'Address manufacturing, timeline, and potential obstacles. Builds credibility.' },
      { name: 'AI Usage Disclosure', required: true, description: 'Disclose whether your project involves AI or AI-generated content.', tips: 'Be transparent. Includes AI art, writing, tools in development.' },
      { name: 'FAQs', required: false, description: 'Frequently asked questions to address common concerns.', tips: 'Cover shipping, returns, customization. Check similar project comments.' },
    ]
  },
  'people': {
    title: 'Step 4: People',
    description: 'Introduce yourself and your team. Backers want to know who they\'re supporting.',
    fields: [
      { name: 'Creator Name', required: true, description: 'Your name or organization. Locked after first project launches.', tips: 'Use real name or established brand. Builds trust.' },
      { name: 'Avatar', required: true, description: 'Your profile picture on project and creator profile.', tips: 'Use professional, friendly photo. Faces perform better than logos.' },
      { name: 'Biography', required: true, description: 'Short bio (300 chars max) introducing yourself.', tips: 'Highlight relevant experience and past projects.' },
      { name: 'Location & Timezone', required: true, description: 'Where you\'re based. Helps with expectations.', tips: 'Accurate location helps with communication and shipping expectations.' },
      { name: 'Vanity URL', required: false, description: 'Customize your profile URL (e.g., /profile/yourname).', tips: 'Keep short, memorable, consistent with other platforms.' },
      { name: 'Websites', required: false, description: 'Links to your website, portfolio, or social media.', tips: 'Include most professional links.' },
      { name: 'Collaborators', required: false, description: 'Invite team members by email with specific permissions.', tips: 'Add early for campaign management help.' },
    ]
  },
  'payment': {
    title: 'Step 5: Payment',
    description: 'Set up how you\'ll receive funds. Some settings cannot be changed after launch.',
    fields: [
      { name: 'How Payments Work', required: false, description: 'All or Nothing campaigns: Backers are NOT charged when they pledge — only processed when the campaign reaches its goal. Keep It All campaigns: Backers are charged immediately when they back your project.', tips: 'Choose All or Nothing for maximum backer trust, or Keep It All to guarantee revenue from every pledge.' },
      { name: 'Post-Funding Pledges', required: false, description: 'After reaching goal, new pledges charged immediately.', tips: 'Allows accepting backers after hitting goal.' },
      { name: 'Payment Retries', required: false, description: 'Failed payments retry up to 3 times over 9 days.', tips: 'Most failures are expired cards or insufficient funds.' },
      { name: 'Contact Email', required: true, description: 'Verified email for important communications.', tips: 'Use email you check regularly.' },
      { name: 'Project Type', required: true, description: 'Individual or business/nonprofit.', tips: 'Affects tax reporting and verification.' },
      { name: 'Content Declarations', required: false, description: 'Declare adult or controversial content if applicable.', tips: 'May require additional review.' },
      { name: 'PaymentCloud (Primary Processor)', required: true, description: 'High-risk friendly merchant account on the NMI gateway. Backers enter their card directly on your campaign page — the card is securely tokenized in the browser via Collect.js (PAN never touches our servers) and only charged when the campaign hits its goal. Supports both All or Nothing and Keep It All. 100% guaranteed NSFW friendly — all content types accepted.', tips: '4% + $0.25/txn PaymentCloud + 3% platform fee ≈ 7.5% total. Funds settle to your bank account on PaymentCloud\'s standard merchant schedule.' },
      { name: 'Campaign Funding Model', required: true, description: 'All or Nothing: Your campaign only receives funds if it reaches its goal — otherwise no card is charged. Keep It All: You keep all pledges regardless of whether you hit your goal; backers are charged immediately at pledge time.', tips: 'PaymentCloud supports both styles. All or Nothing is recommended for most campaigns as it builds backer trust by guaranteeing no charge if the goal isn\'t hit.' },
      { name: 'Payout Account', required: true, description: 'Add your bank account details to receive payouts. All payout account details are AES-256 encrypted at rest.', tips: 'Funds settle to the bank account on file with PaymentCloud per their standard merchant schedule.' },
    ]
  },
  'promotion': {
    title: 'Step 6: Promotion',
    description: 'Prepare marketing tools and analytics. Set up before launch.',
    fields: [
      { name: 'Project URL', required: true, description: 'Unique project URL, auto-generated from title.', tips: 'Edit to be shorter and memorable. Cannot change after launch!' },
      { name: 'Pre-launch Page', required: false, description: 'Build followers before campaign goes live.', tips: 'Start 2-4 weeks before launch. Email followers when you go live.' },
      { name: 'Custom Referral Tags', required: false, description: 'Trackable URLs for different marketing channels.', tips: 'Create unique tags for each channel to track performance.' },
      { name: 'Google Analytics', required: false, description: 'Connect your GA account (G-XXXXXXXXXX format).', tips: 'Set up before launch to capture all data.' },
      { name: 'Meta Pixel', required: false, description: 'Track Facebook/Instagram ad effectiveness.', tips: 'Essential if running Facebook/Instagram ads.' },
      { name: 'Meta Conversions API', required: false, description: 'Enhanced event tracking with Meta.', tips: 'More accurate conversion data than pixel alone.' },
    ]
  },
  'marketplace': {
    title: 'Digital Marketplace',
    description: 'Sell completed digital works directly to customers. No funding goal - instant purchase and delivery.',
    fields: [
      { name: 'What is the Marketplace?', required: false, description: 'Dedicated storefront for selling completed digital works. No crowdfunding needed.', tips: 'Perfect for completed works, backlist titles, digital-only content.' },
      { name: 'Company Profile', required: true, description: 'Create your storefront with logo, banner, description, links.', tips: 'Professional profile builds trust.' },
      { name: 'Physical Media Link', required: false, description: 'Link to where customers can order physical copies.', tips: 'Add if selling through own store, Amazon, or print-on-demand.' },
      { name: 'Uploading Books', required: true, description: 'Upload PDF with cover image, title, description, category, price.', tips: 'High-quality PDF optimized for digital reading.' },
      { name: 'Setting Price', required: true, description: 'Set your own USD price. Adjust anytime.', tips: 'Research similar products. Don\'t undervalue your work.' },
      { name: 'Platform Fee', required: false, description: 'Marketplace uses PayPal: 3% platform fee + PayPal fees (3.49% + $0.49/txn). NSFW content uses DivinityCoin or Whop instead.', tips: 'Example: $10 sale → you receive ~$9.30. Add your bank account in Dashboard > Settings > Payments to receive payouts directly to your bank.' },
      { name: 'Review Process', required: false, description: 'Brief review ensures content guidelines compliance.', tips: 'Typically 1-2 business days.' },
      { name: 'Sales & Analytics', required: false, description: 'Track performance, purchase history, revenue over time.', tips: 'Use analytics to inform pricing decisions.' },
    ]
  },
};

function FieldCard({ field }: { field: FieldInfo }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{field.name}</h4>
        {field.required ? (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3 w-3" />
            Required
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-zinc-600">
            Optional
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-muted-foreground">{field.description}</p>
      {field.tips && (
        <div className="mt-2 flex gap-2 rounded bg-purple-50 dark:bg-purple-950/30 p-2">
          <Info className="h-4 w-4 flex-shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
          <p className="text-xs text-purple-800 dark:text-purple-300">{field.tips}</p>
        </div>
      )}
    </div>
  );
}

export default function CreatorHandbookPage() {
  const [activeTab, setActiveTab] = useState('verification');
  const currentTab = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 py-8 text-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-purple-100 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold">Creator Handbook</h1>
          <p className="mt-1 text-purple-100">Everything you need to know about creating a successful project</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 md:flex-shrink-0">
            <nav className="flex flex-wrap gap-1 md:sticky md:top-8 md:flex-col md:space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100'
                        : 'text-zinc-600 hover:bg-muted dark:text-muted-foreground dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0">
            {currentTab && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{currentTab.title}</h2>
                  <p className="mt-1 text-zinc-600 dark:text-muted-foreground">{currentTab.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {currentTab.fields.map((field) => (
                    <FieldCard key={field.name} field={field} />
                  ))}
                </div>
              </>
            )}

            {/* Quick Links */}
            <div className="mt-12 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Ready to Create Your Project?</h3>
              <p className="text-purple-100 mb-4">Start building your campaign today.</p>
              <div className="flex gap-3">
                <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-white text-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-50">
                  <Lightbulb className="h-4 w-4" /> Start a Project
                </Link>
                <Link href="/indiekit-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10">
                  <BookOpen className="h-4 w-4" /> IndieKit Handbook
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
