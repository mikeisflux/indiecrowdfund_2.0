'use client';

import { useState } from 'react';
import {
  Search,
  Heart,
  CreditCard,
  Coins,
  Gift,
  Package,
  Info,
  ArrowLeft,
  Shield,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

const tabs = [
  { id: 'discover', label: 'Finding Projects', icon: Search },
  { id: 'backing', label: 'Making a Pledge', icon: Heart },
  { id: 'stripe', label: 'Paying with Card', icon: CreditCard },
  { id: 'divinitycoin', label: 'DivinityCoin', icon: Coins },
  { id: 'rewards', label: 'Rewards & Add-ons', icon: Gift },
  { id: 'after', label: 'After You Pledge', icon: Package },
  { id: 'marketplace', label: 'Marketplace', icon: BookOpen },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

interface Step {
  title: string;
  description: string;
  tip?: string;
}

const tabContent: Record<string, { title: string; description: string; alert?: { icon: typeof Shield; title: string; text: string; color: string }; steps: Step[] }> = {
  'discover': {
    title: 'Finding the Perfect Project',
    description: 'Learn how to discover campaigns that match your interests.',
    steps: [
      { title: 'Browse the Discover Page', description: 'Explore live campaigns. Filter by category and sort by popularity, newest, or ending soon.', tip: 'Projects ending soon often have the most momentum.' },
      { title: 'Use Search', description: 'Find projects by name, creator, or keywords. Results include live and past projects.', tip: 'Search for creators you\'ve backed before!' },
      { title: 'Read the Project Page', description: 'See full details, rewards, video, and learn about the creator.', tip: 'Check "Risks & Challenges" - honest creators explain obstacles upfront.' },
      { title: 'Check FAQ & Updates', description: 'Look for FAQ answers and check Updates to see how the creator communicates.', tip: 'Active creators who post regular updates are more likely to deliver.' },
      { title: 'Follow Before Backing', description: 'Not ready? Click the heart to follow. Get notifications without committing.', tip: 'Following pre-launch projects gets you notified at launch with early-bird pricing!' },
    ]
  },
  'backing': {
    title: 'Making Your Pledge',
    description: 'Step-by-step walkthrough of the pledge process.',
    steps: [
      { title: 'Choose Your Reward Tier', description: 'Browse tiers on the right side. Each shows what you receive, amount, delivery date, and shipping.', tip: 'Limited quantity rewards go fast!' },
      { title: 'Click "Back this project"', description: 'Start with the button or click directly on a tier. You can also pledge without a reward.', tip: 'You can change your pledge anytime before the campaign ends.' },
      { title: 'Add Optional Add-ons', description: 'After selecting your reward, add extras like additional copies or accessories.', tip: 'Add-ons often include exclusive items not available elsewhere.' },
      { title: 'Add Bonus Support', description: 'Want to give extra? Add a bonus amount. It doesn\'t change your reward.', tip: 'Every dollar helps projects reach stretch goals faster!' },
      { title: 'Enter Shipping Information', description: 'For physical items, provide your address. Shipping costs vary by location.', tip: 'Double-check your address! Easiest to get it right the first time.' },
      { title: 'Review Your Pledge', description: 'See the complete breakdown before payment. Make sure everything looks correct.', tip: 'Take a screenshot for your records.' },
    ]
  },
  'stripe': {
    title: 'Paying with Card (Stripe)',
    description: 'Everything about card payments, including when you\'re charged.',
    alert: { icon: Shield, title: 'Secure Payment Processing', text: 'All card payments are processed by Stripe. Your card details are encrypted and never stored on our servers.', color: 'emerald' },
    steps: [
      { title: 'Select Card Payment', description: 'Card payment is the default option, powered by Stripe - trusted by millions worldwide.', tip: 'Look for the lock icon and "Powered by Stripe".' },
      { title: 'Enter Card Details', description: 'Fill in card number, expiration, CVV, and billing zip. Data is encrypted.', tip: 'Make sure your card won\'t expire before the campaign ends.' },
      { title: 'Understand When You\'re Charged', description: 'You\'re NOT charged immediately. Card is saved and only charged if project reaches its goal.', tip: 'All-or-nothing: if goal isn\'t reached, you\'re never charged.' },
      { title: 'Confirm Your Pledge', description: 'Click "Pledge" to submit. You\'ll see confirmation and receive an email.', tip: 'Save your confirmation email.' },
      { title: 'What Happens at Campaign End', description: 'If successful, card is charged automatically. If not, nothing happens.', tip: 'Ensure sufficient funds when campaign ends.' },
      { title: 'Already-Funded Campaigns', description: 'If a campaign already reached its goal, your card is charged immediately.', tip: 'Immediate charges are clearly indicated before you confirm.' },
    ]
  },
  'divinitycoin': {
    title: 'Paying with DivinityCoin',
    description: 'DivinityCoin is an alternative payment processor - pay with your credit or debit card, processed through DivinityCoin\'s secure system.',
    alert: { icon: Coins, title: 'Seamless Card Payment (Not Cryptocurrency)', text: 'DivinityCoin is a payment sub-processor, not a cryptocurrency. Enter your card details at checkout and payment is handled securely through DivinityCoin\'s certified payment system. Supports all content types including NSFW/adult projects.', color: 'amber' },
    steps: [
      { title: 'What is DivinityCoin?', description: 'DivinityCoin is an alternative payment sub-processor used by some creators on IndieCrowdfund. It is NOT a cryptocurrency or wallet system. When a creator uses DivinityCoin, you simply pay with your credit or debit card at checkout.', tip: 'Learn more at our "What is DivinityCoin?" page.' },
      { title: 'How It Works', description: 'At checkout, you\'ll see a secure card payment form. Enter your card details (Visa, Mastercard, Amex, Discover) and complete your pledge. DivinityCoin handles the payment processing behind the scenes.', tip: 'You\'ll see card brand logos (Visa, Mastercard, etc.) confirming accepted card types.' },
      { title: 'Check if Project Uses DivinityCoin', description: 'Some creators choose DivinityCoin as their payment processor. You\'ll see the DivinityCoin indicator on the project page and at checkout.', tip: 'Creators choose their processor based on their needs - some content types require DivinityCoin.' },
      { title: 'Secure Payment', description: 'Your card details are entered directly into a PCI-compliant payment form. IndieCrowdfund never sees or stores your card information. The payment is encrypted end-to-end.', tip: 'Look for the lock icon and "Secure Payment" header with card brand logos.' },
      { title: 'Immediate Charge for Funded Projects', description: 'For campaigns that have already reached their goal, your card is charged immediately through DivinityCoin. For campaigns still in progress, charges may be held until the campaign funds.', tip: 'You\'ll see clear messaging about when you\'ll be charged before confirming.' },
      { title: 'Refunds', description: 'If a campaign fails or your pledge is refunded, the refund is processed back to your original payment method through DivinityCoin.', tip: 'Refund processing times depend on your card issuer, typically 5-10 business days.' },
    ]
  },
  'rewards': {
    title: 'Understanding Rewards & Add-ons',
    description: 'How reward tiers and add-ons work.',
    steps: [
      { title: 'Reward Tiers', description: 'Packages at different price points. Higher tiers include more or exclusive items.', tip: 'Compare tiers - paying a bit more often gets significantly more value.' },
      { title: 'Limited vs Unlimited', description: 'Some rewards limited to specific number of backers. Once gone, they\'re gone.', tip: 'Early-bird tiers offer the best pricing - grab them fast!' },
      { title: 'Estimated Delivery', description: 'Creator\'s best estimate. Crowdfunding often faces delays.', tip: 'Add a few months in your mind for realistic expectations.' },
      { title: 'Shipping Costs', description: 'Usually charged separately. Varies by location and item size/weight.', tip: 'International backers: factor in shipping before pledging.' },
      { title: 'Add-ons Explained', description: 'Extra items you can add to your pledge - extra copies, accessories, etc.', tip: 'Add-ons often include exclusive items not in any tier!' },
      { title: 'Changing Your Pledge', description: 'Modify your pledge anytime before campaign ends in your backer dashboard.', tip: 'Set a reminder a day before the campaign ends to review.' },
    ]
  },
  'after': {
    title: 'After You Pledge',
    description: 'What happens from confirmation to receiving your rewards.',
    steps: [
      { title: 'Confirmation Email', description: 'You\'ll receive email with complete pledge breakdown. Save it for records.', tip: 'Check spam folder if you don\'t see it in a few minutes.' },
      { title: 'Your Backer Dashboard', description: 'See all pledges, update addresses, and track status. Your home base.', tip: 'Bookmark your dashboard for easy access.' },
      { title: 'Following Updates', description: 'Creators post updates throughout. You\'ll get email notifications.', tip: 'Read updates carefully - they often contain surveys or decisions.' },
      { title: 'Completing Surveys', description: 'After campaign ends, creators may send surveys for address, preferences, etc.', tip: 'Complete surveys promptly! Creators can\'t fulfill without the info.' },
      { title: 'Tracking Fulfillment', description: 'See status in your dashboard: Not Started, In Progress, Shipped, Delivered.', tip: 'If "Shipped" but no tracking, check updates or contact creator.' },
      { title: 'Receiving Rewards', description: 'When rewards arrive, celebrate! Consider sharing photos or reviews.', tip: 'Having issues? Contact creator before leaving negative feedback.' },
    ]
  },
  'marketplace': {
    title: 'Digital Marketplace',
    description: 'Buying digital content for immediate download.',
    steps: [
      { title: 'What is the Marketplace?', description: 'A storefront for completed digital works. Immediate purchase and instant download.', tip: 'Perfect for supporting creators and getting content right away.' },
      { title: 'Browsing', description: 'Explore Featured titles, Staff Picks, or all works. Use search for specific titles.', tip: 'Check out Staff Picks for hand-curated recommendations.' },
      { title: 'Understanding Pricing', description: 'Fixed prices in USD set by creators. You\'re directly supporting them.', tip: 'Digital often costs less than physical - no printing or shipping.' },
      { title: 'Making a Purchase', description: 'Click "Purchase" to checkout. Pay with card via Stripe or DivinityCoin depending on the creator\'s chosen processor. Charged immediately.', tip: 'Unlike pledges, marketplace purchases are instant.' },
      { title: 'Your Digital Library', description: 'Purchases added to your Digital Library in your dashboard. Access anytime.', tip: 'Bookmark your Digital Library for quick access.' },
      { title: 'Reading and Downloads', description: 'Read in browser or download as PDF for offline reading.', tip: 'Downloaded files are yours to keep. Back them up!' },
    ]
  },
  'faq': {
    title: 'Frequently Asked Questions',
    description: 'Common questions about backing projects.',
    steps: [
      { title: 'What if project doesn\'t reach its goal?', description: 'No money changes hands. Your card is never charged, regardless of whether the project uses Stripe or DivinityCoin.', tip: 'All-or-nothing funding protects you.' },
      { title: 'Can I get a refund after pledging?', description: 'Before campaign ends, cancel anytime in your dashboard. After, contact the creator directly.', tip: 'Refund policies are set by each creator.' },
      { title: 'Is my payment information secure?', description: 'Yes! Stripe processes all payments with PCI-DSS Level 1 certification. We never store full card numbers.', tip: 'Look for the Stripe badge for security.' },
      { title: 'What if my card is declined?', description: 'We retry automatically 3 times over 9 days. You\'ll get emails to update your card details.', tip: 'Keep card info updated to avoid failed payments.' },
      { title: 'How do I contact a creator?', description: 'Use "Contact" or "Ask a question" on the project page. Backers often have priority response.', tip: 'Always mention your backer email for pledge-specific issues.' },
      { title: 'What if a creator never delivers?', description: 'Crowdfunding carries risk. Creators are legally obligated to fulfill or refund. Report concerns to our support team.', tip: 'Our verification process helps, but due diligence is important.' },
      { title: 'Can I back anonymously?', description: 'Your pledge is visible to the creator, but you can hide from public backer lists. Payment info is always private.', tip: 'Check your privacy settings in your account.' },
      { title: 'How do stretch goals work?', description: 'Bonus features added if campaign exceeds its goal. If unlocked while you\'re a backer, you get them free!', tip: 'Stretch goals make backing early more exciting!' },
    ]
  },
};

function StepCard({ step, number }: { step: Step; number: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
          {number}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h4>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
          {step.tip && (
            <div className="mt-2 flex gap-2 rounded bg-blue-50 dark:bg-blue-950/30 p-2">
              <Info className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300">{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BackerHandbookPage() {
  const [activeTab, setActiveTab] = useState('discover');
  const currentTab = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 py-8 text-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-3xl font-bold">Backer Handbook</h1>
          <p className="mt-1 text-blue-100">Your complete guide to backing projects from start to finish</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="sticky top-8 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
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
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{currentTab.description}</p>
                </div>

                {currentTab.alert && (
                  <div className={`mb-6 rounded-lg border p-4 ${currentTab.alert.color === 'emerald' ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/30'}`}>
                    <div className="flex gap-3">
                      <currentTab.alert.icon className={`h-5 w-5 flex-shrink-0 ${currentTab.alert.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <div>
                        <h4 className={`font-medium ${currentTab.alert.color === 'emerald' ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>{currentTab.alert.title}</h4>
                        <p className={`mt-1 text-sm ${currentTab.alert.color === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{currentTab.alert.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {currentTab.steps.map((step, index) => (
                    <StepCard key={step.title} step={step} number={index + 1} />
                  ))}
                </div>
              </>
            )}

            {/* Quick Links */}
            <div className="mt-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Ready to Discover Projects?</h3>
              <p className="text-blue-100 mb-4">Find amazing campaigns to support today.</p>
              <div className="flex gap-3">
                <Link href="/discover" className="inline-flex items-center gap-2 rounded-lg bg-white text-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-50">
                  <Search className="h-4 w-4" /> Browse Projects
                </Link>
                <Link href="/creator-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10">
                  <BookOpen className="h-4 w-4" /> Creator Handbook
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
