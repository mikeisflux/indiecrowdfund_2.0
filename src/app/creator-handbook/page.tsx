'use client';

import { useState } from 'react';
import {
  Lightbulb,
  Gift,
  BookOpen,
  Users,
  CreditCard,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Info,
  ShoppingBag,
  Upload,
  DollarSign,
  Building2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

const tabs = [
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

const basicsFields: FieldInfo[] = [
  {
    name: 'Project Title',
    required: true,
    description: 'The main name of your project that appears everywhere. Keep it clear, memorable, and descriptive of what you\'re creating.',
    tips: 'Aim for 5-10 words. Avoid generic titles. Include keywords backers might search for.',
  },
  {
    name: 'Subtitle/Tagline',
    required: false,
    description: 'A short phrase that expands on your title. This appears below your title on the project page and in search results.',
    tips: 'Use this to highlight what makes your project unique or to clarify the type of project.',
  },
  {
    name: 'Category',
    required: true,
    description: 'Select the category that best fits your project. This helps backers discover your project when browsing.',
    tips: 'Choose the most specific category available. Projects in the right category get better visibility.',
  },
  {
    name: 'Location',
    required: true,
    description: 'Where you (the creator) are based. This helps local backers find projects and is used for tax purposes.',
    tips: 'Be accurate - this affects shipping calculations and backer expectations.',
  },
  {
    name: 'Project Image',
    required: true,
    description: 'The main image representing your project. This is the first thing backers see in search results and on your project page.',
    tips: 'Use a high-quality image (1024x576px minimum). Show your product/creation clearly. Avoid text-heavy images.',
  },
  {
    name: 'Project Video',
    required: false,
    description: 'An embedded video (YouTube/Vimeo) introducing your project. Videos significantly increase funding success rates.',
    tips: 'Keep it under 3 minutes. Show yourself, your passion, and your product. Explain why backers should support you.',
  },
  {
    name: 'Funding Goal',
    required: true,
    description: 'The minimum amount you need to bring your project to life. If you don\'t reach this goal, no money changes hands.',
    tips: 'Calculate actual costs (production, shipping, fees, taxes). Don\'t aim too high or too low. Be realistic.',
  },
  {
    name: 'Campaign Duration',
    required: true,
    description: 'Choose either a fixed number of days (1-60) or set a specific end date and time for your campaign.',
    tips: '30 days is the sweet spot for most projects. Shorter campaigns create urgency but need a strong launch.',
  },
  {
    name: 'Target Launch Date',
    required: false,
    description: 'When you plan to launch your project. Setting this helps you prepare and can be used for pre-launch marketing.',
    tips: 'Give yourself enough time to build an audience before launch. Tuesdays and Wednesdays tend to perform best.',
  },
];

const rewardsFields: FieldInfo[] = [
  {
    name: 'Reward Title',
    required: true,
    description: 'A clear name for this reward tier. Make it descriptive of what backers receive.',
    tips: 'Use names like "Early Bird Special", "Collector\'s Edition", or descriptive names of what\'s included.',
  },
  {
    name: 'Description',
    required: true,
    description: 'Detailed explanation of everything included in this reward tier. Use the rich text editor to format clearly.',
    tips: 'List every item included. Be specific about colors, sizes, and variations. Mention any exclusives.',
  },
  {
    name: 'Pledge Amount',
    required: true,
    description: 'The minimum amount a backer must pledge to receive this reward.',
    tips: 'Price to cover costs plus a margin. Consider shipping costs. Look at similar successful projects for guidance.',
  },
  {
    name: 'Reward Image',
    required: false,
    description: 'A visual representation of what backers will receive. Highly recommended for physical products.',
    tips: 'Show mockups or prototypes. Multiple items? Create a composite image showing everything included.',
  },
  {
    name: 'Estimated Delivery',
    required: true,
    description: 'The month and year when you expect to deliver this reward to backers.',
    tips: 'Add buffer time for unexpected delays. It\'s better to deliver early than late. Be realistic.',
  },
  {
    name: 'Shipping Options',
    required: true,
    description: 'Define where and how you\'ll ship this reward: worldwide, specific countries, local pickup, or digital delivery.',
    tips: 'Calculate international shipping costs carefully. Consider offering a digital-only tier if applicable.',
  },
  {
    name: 'Quantity Limits',
    required: false,
    description: 'Set whether this reward is unlimited or limited to a specific number of backers.',
    tips: 'Limited rewards create urgency and exclusivity. Use for early-bird pricing or exclusive items.',
  },
  {
    name: 'Availability',
    required: false,
    description: 'Choose whether the reward is visible to all backers or is a secret reward only accessible via direct link.',
    tips: 'Secret rewards work great for exclusive tiers, testing pricing, or special community offers.',
  },
  {
    name: 'Time Limits',
    required: false,
    description: 'Optionally limit when this reward is available - set start and end dates within your campaign.',
    tips: 'Use time limits for flash sales, early-bird pricing, or special weekend offers.',
  },
];

const addonsFields: FieldInfo[] = [
  {
    name: 'What are Add-ons?',
    required: false,
    description: 'Add-ons are optional extras that backers can add to their pledge on top of their main reward. They allow backers to customize their pledge.',
    tips: 'Great for extra copies, accessories, upgrades, or complementary products.',
  },
  {
    name: 'Copy Reward to Add-ons',
    required: false,
    description: 'One-click button to duplicate any reward as an add-on. All fields are copied and can be edited afterward.',
    tips: 'Perfect for offering extra copies of your main product as add-ons.',
  },
  {
    name: 'Creating Add-ons',
    required: false,
    description: 'Add-ons use the same structure as rewards (title, description, price, image, delivery, shipping) but are marked as optional extras.',
    tips: 'Price add-ons slightly higher than reward equivalents since they\'re extras.',
  },
];

const itemsFields: FieldInfo[] = [
  {
    name: 'Item Title',
    required: true,
    description: 'The name of an individual item that can be included in rewards. Items help track what\'s included in each tier.',
    tips: 'Be specific: "Hardcover Book" not just "Book". Include variations if applicable.',
  },
  {
    name: 'Item Image',
    required: false,
    description: 'A visual of this specific item. Helps backers understand exactly what they\'re getting.',
    tips: 'Show the item clearly on a neutral background. Multiple angles help for physical products.',
  },
  {
    name: 'Item Description',
    required: false,
    description: 'Details about this specific item including specifications, materials, dimensions, etc.',
    tips: 'Include everything a backer would want to know: size, weight, materials, features.',
  },
  {
    name: 'Link to Rewards',
    required: true,
    description: 'Connect items to the reward tiers that include them. One item can be linked to multiple rewards.',
    tips: 'This helps with fulfillment tracking and gives backers clarity on what each tier includes.',
  },
];

const storyFields: FieldInfo[] = [
  {
    name: 'Project Description',
    required: true,
    description: 'Your main pitch to backers. Use the rich text editor to create a compelling narrative with text, images, and videos.',
    tips: 'Start with the hook. Show the product. Explain your story. Detail specifications. Address concerns. End with a call to action.',
  },
  {
    name: 'Risks & Challenges',
    required: true,
    description: 'Be honest about potential obstacles and how you plan to overcome them. This builds trust with backers.',
    tips: 'Address manufacturing risks, timeline concerns, and potential obstacles. Showing awareness of risks builds credibility.',
  },
  {
    name: 'AI Usage Disclosure',
    required: true,
    description: 'Disclose whether your project involves AI technology or uses AI-generated content in any way.',
    tips: 'Be transparent. This includes AI art, AI-assisted writing, AI tools in development, etc.',
  },
  {
    name: 'FAQs',
    required: false,
    description: 'Add frequently asked questions and answers to address common backer concerns proactively.',
    tips: 'Cover shipping, returns, customization options, and anything backers ask in comments on similar projects.',
  },
];

const peopleFields: FieldInfo[] = [
  {
    name: 'Creator Name',
    required: true,
    description: 'Your name or the name of your organization. This is locked after your first project launches.',
    tips: 'Use your real name or established brand name. This builds trust and accountability.',
  },
  {
    name: 'Avatar',
    required: true,
    description: 'Your profile picture that appears on your project and creator profile.',
    tips: 'Use a professional, friendly photo. Faces perform better than logos for individual creators.',
  },
  {
    name: 'Biography',
    required: true,
    description: 'A short bio (300 characters max) introducing yourself to potential backers.',
    tips: 'Highlight relevant experience and past projects. Show why you\'re the right person to deliver this.',
  },
  {
    name: 'Location & Timezone',
    required: true,
    description: 'Where you\'re based. Helps backers understand shipping origins and when you\'re available.',
    tips: 'Accurate location helps with backer expectations for communication and shipping.',
  },
  {
    name: 'Vanity URL',
    required: false,
    description: 'Customize your profile URL to something memorable (e.g., /profile/yourname).',
    tips: 'Keep it short, memorable, and consistent with your brand on other platforms.',
  },
  {
    name: 'Websites',
    required: false,
    description: 'Link to your personal website, portfolio, or other online presence.',
    tips: 'Include your most professional links. Social media profiles can help build credibility.',
  },
  {
    name: 'Collaborators',
    required: false,
    description: 'Invite team members by email and set their permissions for project editing, community management, fulfillment, and pledge manager.',
    tips: 'Add collaborators early so they can help with campaign management and community engagement.',
  },
  {
    name: 'Demographics',
    required: false,
    description: 'Optional questionnaire about creator identity. Protected information used only for anti-discrimination research.',
    tips: 'This information is never shared with backers and helps us ensure fair treatment of all creators.',
  },
];

const paymentFields: FieldInfo[] = [
  {
    name: 'How Payments Work',
    required: false,
    description: 'Backers are NOT charged when they pledge. Their payment is only processed when your campaign successfully reaches its funding goal. If your campaign doesn\'t fund, backers are never charged.',
    tips: 'All-or-nothing funding protects both you and your backers. You only receive funds if you hit your goal.',
  },
  {
    name: 'Post-Funding Pledges',
    required: false,
    description: 'Once your campaign has already reached its goal, any new pledges are charged immediately since the campaign is guaranteed to fund.',
    tips: 'This allows you to keep accepting backers after hitting your goal without waiting for campaign end.',
  },
  {
    name: 'Payment Retries',
    required: false,
    description: 'If a backer\'s payment fails when the campaign funds, we automatically retry up to 3 times over 9 days (once every 3 days) before marking the pledge as failed.',
    tips: 'Most payment failures are due to expired cards or insufficient funds. The retry system recovers many of these pledges.',
  },
  {
    name: 'Contact Email',
    required: true,
    description: 'Your verified email address for important communications about your project and payments.',
    tips: 'Use an email you check regularly. This is how we\'ll contact you about funds and important updates.',
  },
  {
    name: 'Project Type',
    required: true,
    description: 'Specify whether you\'re raising funds as an individual or on behalf of a business/nonprofit.',
    tips: 'This affects tax reporting and verification requirements. Choose accurately.',
  },
  {
    name: 'Content Type Declaration',
    required: false,
    description: 'Optionally declare if your project contains adult or controversial/violent content that is used to further the narrative of the story and not in an explicit way.',
    tips: 'These are optional checkboxes. Projects with such content may require additional review before launch.',
  },
  {
    name: 'Promotional Content Agreement',
    required: true,
    description: 'You must agree that no NSFW content will be used in your project\'s promotional video, image, or project title.',
    tips: 'This is mandatory for all projects. It allows your project to be displayed publicly on the platform.',
  },
  {
    name: 'Stripe Connect',
    required: true,
    description: 'Complete identity verification through Stripe, link your bank account, set payout schedule, and provide tax information. All payments are securely processed through Stripe.',
    tips: 'Platform fee is 3% + Stripe fees (2.9% + $0.30 per transaction). Payouts typically arrive within 14 business days after campaign ends.',
  },
  {
    name: 'Bank Account',
    required: true,
    description: 'US-based checking account where funds will be deposited. Must be in your name or your business name.',
    tips: 'Double-check all numbers. This cannot be changed after submission. Use a dedicated business account if possible.',
  },
  {
    name: 'Project Verification',
    required: false,
    description: 'Required for business/nonprofit projects. Verify your entity through our verification service.',
    tips: 'Have your business documents ready. Verification can take a few days.',
  },
];

const promotionFields: FieldInfo[] = [
  {
    name: 'Project URL',
    required: true,
    description: 'Your unique project URL, auto-generated from your title. Format: platform.com/projects/[creator]/[project]',
    tips: 'Edit it to be shorter and memorable. Cannot be changed after launch!',
  },
  {
    name: 'Pre-launch Page',
    required: false,
    description: 'Activate a pre-launch page to build followers before your campaign goes live. Shows title, image, and custom description.',
    tips: 'Start building your audience 2-4 weeks before launch. Email followers when you go live.',
  },
  {
    name: 'Custom Referral Tags',
    required: false,
    description: 'Create trackable URLs for different marketing channels (e.g., ?ref=newsletter, ?ref=instagram-story).',
    tips: 'Create unique tags for each marketing channel to track which performs best.',
  },
  {
    name: 'Google Analytics',
    required: false,
    description: 'Connect your Google Analytics account (G-XXXXXXXXXX format) to track visitors, conversion rates, and referrer sources.',
    tips: 'Set this up before launch to capture all campaign data from day one.',
  },
  {
    name: 'Meta Pixel',
    required: false,
    description: 'Add your Meta Pixel ID (15-16 digits) to track Facebook and Instagram ad effectiveness.',
    tips: 'Essential if you plan to run Facebook/Instagram ads for your campaign.',
  },
  {
    name: 'Meta Conversions API',
    required: false,
    description: 'Add your access token for enhanced event tracking with Meta. More reliable than pixel-only tracking.',
    tips: 'Recommended for serious advertisers. Provides more accurate conversion data.',
  },
];

const marketplaceFields: FieldInfo[] = [
  {
    name: 'What is the Digital Marketplace?',
    required: false,
    description: 'The Digital Marketplace is a dedicated storefront where you can sell completed digital works directly to customers. Unlike crowdfunding campaigns, there\'s no funding goal - customers can purchase and download instantly.',
    tips: 'Perfect for selling completed works, backlist titles, or digital-only content that doesn\'t need crowdfunding.',
  },
  {
    name: 'Company Profile Setup',
    required: true,
    description: 'Before listing products, create your Company Profile in the Creator Dashboard. This includes your company name, logo, banner, description, and links. Your profile is your storefront in the marketplace.',
    tips: 'A professional profile builds trust. Include your website, social links, and a compelling about section.',
  },
  {
    name: 'Physical Media Link',
    required: false,
    description: 'Add a link to where customers can order physical copies of your books. This appears on your company profile and helps customers who prefer print editions.',
    tips: 'If you sell physical books through your own store, Amazon, or a print-on-demand service, add that link here.',
  },
  {
    name: 'Uploading Your Digital Book',
    required: true,
    description: 'Upload your digital book as a PDF file. You\'ll also add a cover image, title, description, category, and price. The upload process guides you through each step.',
    tips: 'Use high-quality PDF files optimized for digital reading. Cover images should be eye-catching at thumbnail size.',
  },
  {
    name: 'Setting Your Price',
    required: true,
    description: 'Set your own price in USD. Consider your costs, market rates for similar content, and the value you\'re providing. You can adjust pricing anytime.',
    tips: 'Research similar products in the marketplace. Lower prices can drive volume, but don\'t undervalue your work.',
  },
  {
    name: 'Platform Fee: 3%',
    required: false,
    description: 'IndieCrowdfund charges a 3% platform fee on each sale. This is separate from Stripe\'s payment processing fees (approximately 2.9% + $0.30 per transaction). Your payout is the sale price minus these fees.',
    tips: 'Example: On a $10 sale, platform fee is $0.30, Stripe fee is approximately $0.59, so you receive about $9.11.',
  },
  {
    name: 'Stripe Payment Setup',
    required: true,
    description: 'Connect your Stripe account to receive payouts. The same Stripe Connect setup used for crowdfunding works for marketplace sales. Payouts are processed on a regular schedule.',
    tips: 'If you\'ve already connected Stripe for crowdfunding, you\'re all set for marketplace sales too!',
  },
  {
    name: 'Review Process',
    required: false,
    description: 'After submission, your book goes through a brief review to ensure it meets our content guidelines. Once approved, it goes live on the marketplace.',
    tips: 'Review typically takes 1-2 business days. Ensure your content follows our guidelines to avoid delays.',
  },
  {
    name: 'Managing Your Listings',
    required: false,
    description: 'From your Creator Dashboard, you can edit listings, update prices, view sales analytics, and manage your catalog. Pause or unpublish listings at any time.',
    tips: 'Keep your listings updated. Fresh cover images and updated descriptions can revive interest in older titles.',
  },
  {
    name: 'Sales & Analytics',
    required: false,
    description: 'Track your marketplace performance with sales analytics. See purchase history, revenue over time, and which products perform best.',
    tips: 'Use analytics to inform pricing decisions and identify which types of content resonate with your audience.',
  },
  {
    name: 'Customer Support',
    required: false,
    description: 'You\'re responsible for customer support related to your content. Respond to customer questions promptly. We handle payment-related issues.',
    tips: 'Good customer service leads to positive reviews and repeat customers. Be responsive and helpful.',
  },
];

function FieldCard({ field }: { field: FieldInfo }) {
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-zinc-900">{field.name}</h4>
        {field.required ? (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3 w-3" />
            Required
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            Optional
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-600">{field.description}</p>
      {field.tips && (
        <div className="mt-3 flex gap-2 rounded-lg bg-purple-50 p-3">
          <Info className="h-4 w-4 flex-shrink-0 text-purple-600" />
          <p className="text-sm text-purple-800">{field.tips}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-2xl font-bold text-zinc-900">{title}</h3>
      <p className="mt-2 text-zinc-600">{description}</p>
    </div>
  );
}

export default function CreatorHandbookPage() {
  const [activeTab, setActiveTab] = useState('basics');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-500/5 relative overflow-hidden">
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
      <div className="floating-orb w-96 h-96 bg-purple-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-pink-500/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-primary/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 py-12 text-center text-white relative overflow-hidden">
        <h1 className="text-4xl font-bold">Creator Handbook</h1>
        <p className="mt-2 text-purple-100">
          Everything you need to know about creating a successful project
        </p>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-8 flex flex-wrap gap-2 rounded-xl bg-card/80 backdrop-blur-sm p-2 shadow-sm border border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'basics' && (
            <>
              <SectionHeader
                title="Step 1: Basics"
                description="Set up the foundation of your project. This information appears prominently on your project page and in search results."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {basicsFields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'rewards' && (
            <>
              <SectionHeader
                title="Step 2: Rewards & Add-ons"
                description="Create compelling reward tiers that give backers a reason to support your project. Well-designed rewards are key to funding success."
              />

              <div className="mb-8">
                <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Reward Tiers
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {rewardsFields.map((field) => (
                    <FieldCard key={field.name} field={field} />
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Add-ons
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {addonsFields.map((field) => (
                    <FieldCard key={field.name} field={field} />
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Items
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {itemsFields.map((field) => (
                    <FieldCard key={field.name} field={field} />
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'story' && (
            <>
              <SectionHeader
                title="Step 3: Story"
                description="Tell backers why your project matters. A compelling story creates emotional connection and drives pledges."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {storyFields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'people' && (
            <>
              <SectionHeader
                title="Step 4: People"
                description="Introduce yourself and your team. Backers want to know who they're supporting and why you're qualified to deliver."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {peopleFields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'payment' && (
            <>
              <SectionHeader
                title="Step 5: Payment"
                description="Set up how you'll receive funds. Complete this section carefully - some settings cannot be changed after launch."
              />
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <h4 className="font-medium text-amber-800">Important Notice</h4>
                    <p className="mt-1 text-sm text-amber-700">
                      Bank account details cannot be changed after submission. Double-check all information before proceeding.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {paymentFields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'promotion' && (
            <>
              <SectionHeader
                title="Step 6: Promotion"
                description="Prepare your marketing tools and analytics. Set these up before launch to track your campaign's performance from day one."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {promotionFields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'marketplace' && (
            <>
              <SectionHeader
                title="Digital Marketplace"
                description="Sell your completed digital works directly to customers. No funding goal needed - instant purchase, instant delivery."
              />
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex gap-3">
                  <DollarSign className="h-5 w-5 flex-shrink-0 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-800">Low Platform Fee: Just 3%</h4>
                    <p className="mt-1 text-sm text-green-700">
                      IndieCrowdfund charges only a 3% platform fee on marketplace sales, plus standard Stripe processing fees (approximately 2.9% + $0.30). You keep the vast majority of every sale!
                    </p>
                  </div>
                </div>
              </div>
              <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex gap-3">
                  <Building2 className="h-5 w-5 flex-shrink-0 text-purple-600" />
                  <div>
                    <h4 className="font-medium text-purple-800">Your Company Profile</h4>
                    <p className="mt-1 text-sm text-purple-700">
                      Create a professional storefront with your company profile. Add your logo, banner, description, and links - including a link to your physical media store for customers who prefer print editions.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {marketplaceFields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
              <div className="mt-8 flex justify-center">
                <a
                  href="/dashboard/marketplace"
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700 transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  Go to Marketplace Dashboard
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
