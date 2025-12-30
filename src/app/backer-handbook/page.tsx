'use client';

import { useState } from 'react';
import {
  Search,
  Heart,
  CreditCard,
  Coins,
  Gift,
  Package,
  CheckCircle2,
  Info,
  ArrowRight,
  Shield,
} from 'lucide-react';
import { Footer } from "@/components/footer";

const tabs = [
  { id: 'discover', label: 'Finding Projects', icon: Search },
  { id: 'backing', label: 'Making a Pledge', icon: Heart },
  { id: 'stripe', label: 'Paying with Card', icon: CreditCard },
  { id: 'divinitycoin', label: 'Paying with DivinityCoin', icon: Coins },
  { id: 'rewards', label: 'Rewards & Add-ons', icon: Gift },
  { id: 'after', label: 'After You Pledge', icon: Package },
];

interface Step {
  title: string;
  description: string;
  tip?: string;
  image?: string;
}

interface FAQ {
  question: string;
  answer: string;
}

const discoverSteps: Step[] = [
  {
    title: 'Browse the Discover Page',
    description: 'Start at our Discover page to explore live crowdfunding campaigns. You can filter by category (Games, Technology, Art, etc.) and sort by popularity, newest, or ending soon.',
    tip: 'Projects ending soon often have the most momentum - creators are pushing hard and early supporters are sharing with friends.',
  },
  {
    title: 'Use Search',
    description: 'Looking for something specific? Use the search bar to find projects by name, creator, or keywords. Search results include both live campaigns and successful past projects.',
    tip: 'Search for creators you\'ve backed before - they often launch new projects!',
  },
  {
    title: 'Read the Project Page',
    description: 'Click on any project to see the full details. Read the story, check out the rewards, watch the video, and learn about the creator. The more you know, the better decision you can make.',
    tip: 'Scroll to the "Risks & Challenges" section - honest creators explain potential obstacles upfront.',
  },
  {
    title: 'Check the FAQ & Updates',
    description: 'Look for the FAQ section where creators answer common questions. If the campaign is live, check the Updates tab to see how the creator communicates with backers.',
    tip: 'Active creators who post regular updates are more likely to deliver on their promises.',
  },
  {
    title: 'Follow Before Backing',
    description: 'Not ready to pledge? Click the heart icon to follow the project. You\'ll get notifications about updates and funding milestones without committing yet.',
    tip: 'Following a pre-launch project gets you notified the moment it goes live - often with early-bird pricing!',
  },
];

const backingSteps: Step[] = [
  {
    title: 'Choose Your Reward Tier',
    description: 'Browse the available reward tiers on the right side of the project page. Each tier shows what you\'ll receive, the pledge amount, estimated delivery date, and shipping information.',
    tip: 'Limited quantity rewards go fast! If a tier says "X of Y remaining," act quickly if you want it.',
  },
  {
    title: 'Select "Back this project" or Choose a Tier',
    description: 'Click the green "Back this project" button to start, or click directly on a specific reward tier. You can also pledge without selecting a reward if you just want to support the creator.',
    tip: 'You can change your pledge or switch tiers at any time before the campaign ends.',
  },
  {
    title: 'Add Optional Add-ons',
    description: 'After selecting your main reward, you\'ll see any available add-ons. These are extras you can add to your pledge - like additional copies, accessories, or upgrades.',
    tip: 'Add-ons are optional but often include exclusive items not available elsewhere.',
  },
  {
    title: 'Add Bonus Support (Optional)',
    description: 'Want to give extra? Add a bonus amount on top of your pledge to show additional support for the creator. This doesn\'t change your reward - it\'s just extra love.',
    tip: 'Every dollar of bonus support helps projects reach stretch goals faster!',
  },
  {
    title: 'Enter Shipping Information',
    description: 'If your reward includes physical items, you\'ll need to provide your shipping address. Select your country first - shipping costs vary by location.',
    tip: 'Double-check your address! You can update it later through your backer dashboard, but it\'s easiest to get it right the first time.',
  },
  {
    title: 'Review Your Pledge',
    description: 'Before payment, you\'ll see a complete breakdown of your pledge: reward tier, add-ons, bonus support, and shipping costs. Make sure everything looks correct.',
    tip: 'Take a screenshot of your pledge summary for your records.',
  },
];

const stripeSteps: Step[] = [
  {
    title: 'Select Card Payment',
    description: 'At the payment step, you\'ll see card payment as the default option. This uses Stripe, a secure payment processor trusted by millions of businesses worldwide.',
    tip: 'Look for the lock icon and "Powered by Stripe" to confirm you\'re on a secure payment page.',
  },
  {
    title: 'Enter Your Card Details',
    description: 'Fill in your card number, expiration date, CVV, and billing zip code. Stripe encrypts all data - we never see or store your full card number.',
    tip: 'Make sure the card won\'t expire before the campaign ends, or the charge might fail.',
  },
  {
    title: 'Understand When You\'re Charged',
    description: 'Here\'s the key: You are NOT charged immediately when you pledge. Your card is saved securely, and you\'re only charged if and when the project reaches its funding goal.',
    tip: 'This is all-or-nothing funding. If the project doesn\'t reach its goal, your card is never charged.',
  },
  {
    title: 'Confirm Your Pledge',
    description: 'Click the "Pledge" button to submit. You\'ll see a confirmation screen with your full pledge breakdown, and receive a confirmation email.',
    tip: 'Save your confirmation email - it contains important details about your pledge.',
  },
  {
    title: 'What Happens at Campaign End',
    description: 'If the campaign succeeds, your card is automatically charged. If the campaign doesn\'t reach its goal, nothing happens - no charge, no pledge. You might still see a pending authorization, but it will be released.',
    tip: 'Make sure you have sufficient funds when the campaign ends to avoid payment failures.',
  },
  {
    title: 'Already-Funded Campaigns',
    description: 'If a campaign has already reached its funding goal, your card will be charged immediately. This is because the project is guaranteed to happen, so there\'s no risk of the campaign failing.',
    tip: 'Immediate charges are clearly indicated on the pledge page before you confirm.',
  },
];

const divinityCoinSteps: Step[] = [
  {
    title: 'What is DivinityCoin?',
    description: 'DivinityCoin is a gift card system - NOT a cryptocurrency. Think of it like a store gift card: 1 DivinityCoin = $1 USD, always. There\'s no blockchain, no crypto wallet, no volatility. It\'s simply platform credit you can use to back projects.',
    tip: 'Learn more at our "What is DivinityCoin?" page for a complete guide.',
  },
  {
    title: 'Getting DivinityCoin',
    description: 'You can get DivinityCoin in several ways: purchase gift cards directly from DivinityCoin.com, receive it as a reward from creators, get it during promotional events, or receive it as a refund when projects are cancelled.',
    tip: 'DivinityCoin purchased from divinitycoin.com can be redeemed on IndieCrowdfund by entering your card code.',
  },
  {
    title: 'Check if the Project Accepts DivinityCoin',
    description: 'On the project page, look for the "Accepts DivinityCoin" badge. Not all creators choose to accept it, so check before pledging if you want to use your balance.',
    tip: 'Most projects accept DivinityCoin, but it\'s the creator\'s choice to enable it.',
  },
  {
    title: 'Using DivinityCoin at Checkout',
    description: 'At the payment step, select "Pay with DivinityCoin." Your available balance is shown, and you can use all or part of it. If your pledge exceeds your balance, you can pay the remainder with a credit card.',
    tip: 'Your balance is stored in your IndieCrowdfund account - check it anytime in your dashboard.',
  },
  {
    title: 'Instant Balance Deduction',
    description: 'Unlike card payments that wait for campaign success, DivinityCoin is deducted from your balance immediately when you pledge. This is because it\'s already platform credit.',
    tip: 'Your pledge confirmation shows exactly how much DivinityCoin was used.',
  },
  {
    title: 'Refunds for Failed Projects',
    description: 'If a campaign doesn\'t reach its funding goal, your DivinityCoin is automatically returned to your IndieCrowdfund wallet. No action needed on your part.',
    tip: 'Check your transaction history in your dashboard to see refund credits.',
  },
  {
    title: 'Refunding Your DivinityCoin Purchase',
    description: 'If you purchased DivinityCoin directly from DivinityCoin.com and want a refund, you can request one within 30 days through their self-service dashboard at divinitycoin.com/dashboard. No need to contact support.',
    tip: 'DivinityCoin offers full refunds only (no partial). If already redeemed on IndieCrowdfund but not spent, they\'ll coordinate with us automatically.',
  },
];

const rewardsTips: Step[] = [
  {
    title: 'Understanding Reward Tiers',
    description: 'Reward tiers are packages the creator offers at different price points. Higher tiers typically include more items or exclusive bonuses. Each tier clearly lists what\'s included.',
    tip: 'Compare tiers carefully - sometimes paying a bit more gets you significantly more value.',
  },
  {
    title: 'Limited vs Unlimited Rewards',
    description: 'Some rewards are limited to a specific number of backers (e.g., "50 of 100 remaining"). Once they\'re gone, they\'re gone. Unlimited rewards stay available throughout the campaign.',
    tip: 'Early-bird limited tiers often offer the best pricing - grab them when you can!',
  },
  {
    title: 'Estimated Delivery Dates',
    description: 'Each reward shows an estimated delivery month and year. This is the creator\'s best estimate, but crowdfunding projects often face delays due to manufacturing or shipping.',
    tip: 'Expect delivery estimates to be optimistic. Add a few months in your mind for a realistic expectation.',
  },
  {
    title: 'Shipping Costs',
    description: 'Shipping is usually charged separately on top of your pledge. Costs vary by your location and the size/weight of items. Some rewards include free shipping.',
    tip: 'International backers: factor in shipping costs before pledging - they can sometimes add significantly to the total.',
  },
  {
    title: 'Add-ons Explained',
    description: 'Add-ons let you add extra items to your pledge. Want an extra copy for a friend? A special accessory? These are separate from your main reward tier.',
    tip: 'Add-ons often include items that aren\'t in any reward tier - they can be exclusive extras!',
  },
  {
    title: 'Changing Your Pledge',
    description: 'You can modify your pledge (change tiers, add/remove add-ons, update address) anytime before the campaign ends. Go to your backer dashboard to make changes.',
    tip: 'Set a calendar reminder a day before the campaign ends to review your pledge one last time.',
  },
];

const afterPledgeSteps: Step[] = [
  {
    title: 'Confirmation Email',
    description: 'Right after pledging, you\'ll receive an email confirmation with your complete pledge breakdown: reward tier, add-ons, shipping, and total amount. Save this email for your records.',
    tip: 'Check your spam folder if you don\'t see the email within a few minutes.',
  },
  {
    title: 'Your Backer Dashboard',
    description: 'Access your backer dashboard to see all your pledges, update shipping addresses, and track project status. It\'s your home base for managing all your backed projects.',
    tip: 'Bookmark your backer dashboard for easy access. You\'ll use it frequently as campaigns progress.',
  },
  {
    title: 'Following Campaign Updates',
    description: 'Creators post updates throughout the campaign and fulfillment process. You\'ll receive email notifications for new updates. These keep you informed about progress, milestones, and timelines.',
    tip: 'Read updates carefully - they often contain important surveys or decisions you need to make.',
  },
  {
    title: 'Completing Surveys',
    description: 'After the campaign ends, the creator may send you a survey to collect additional information: final shipping address, color/size preferences, personalization details, etc.',
    tip: 'Complete surveys promptly! Creators can\'t fulfill your reward without the information they need.',
  },
  {
    title: 'Tracking Fulfillment',
    description: 'In your backer dashboard, you can see the fulfillment status of each pledge: Not Started, In Progress, Shipped, or Delivered. You\'ll be notified when your rewards ship.',
    tip: 'If you see "Shipped" but haven\'t received tracking info, check the project updates or contact the creator.',
  },
  {
    title: 'Receiving Your Rewards',
    description: 'When your rewards arrive, celebrate! You helped make something real. Consider sharing your experience - posting photos or reviews helps the creator and future backers.',
    tip: 'Having issues with your reward? Contact the creator directly through the project page before leaving negative feedback.',
  },
];

const faqs: FAQ[] = [
  {
    question: 'What happens if a project doesn\'t reach its funding goal?',
    answer: 'If a project doesn\'t reach its funding goal by the campaign deadline, no money changes hands. Your card is never charged (or if you paid with DivinityCoin, you receive a refund). The project simply doesn\'t happen.',
  },
  {
    question: 'Can I get a refund after pledging?',
    answer: 'Before the campaign ends, you can cancel your pledge anytime through your backer dashboard. After the campaign ends and you\'ve been charged, refund policies are set by each creator. Contact the creator directly for refund requests.',
  },
  {
    question: 'Is my payment information secure?',
    answer: 'Yes! All card payments are processed through Stripe, a PCI-DSS Level 1 certified payment processor. We never see or store your full card number. Your financial data is encrypted and protected by industry-leading security.',
  },
  {
    question: 'What if my card is declined when the campaign ends?',
    answer: 'If your payment fails, we\'ll retry automatically up to 3 times over 9 days. You\'ll receive emails about the failed payment so you can update your card details. If all retries fail, your pledge is cancelled.',
  },
  {
    question: 'How do I contact a creator?',
    answer: 'You can message creators through the project page using the "Contact" or "Ask a question" feature. Backers often have priority response times. For pledge-specific issues, always mention your backer email.',
  },
  {
    question: 'What if a creator never delivers?',
    answer: 'Crowdfunding carries inherent risk - you\'re supporting ideas, not buying products. However, our platform has a creator verification process, and creators are legally obligated to fulfill rewards or provide refunds. Report concerning projects to our support team.',
  },
  {
    question: 'Can I back a project anonymously?',
    answer: 'Your pledge is visible to the creator, but you can choose whether to appear publicly on the project\'s backer list. Your personal and payment information is always kept private.',
  },
  {
    question: 'How do stretch goals work?',
    answer: 'Stretch goals are bonus features or upgrades that creators add if the campaign exceeds its original funding goal. If a stretch goal is unlocked while you\'re a backer, you automatically get those upgrades at no extra cost!',
  },
];

function StepCard({ step, number }: { step: Step; number: number }) {
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm">
          {number}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-zinc-900">{step.title}</h4>
          <p className="mt-2 text-sm text-zinc-600">{step.description}</p>
          {step.tip && (
            <div className="mt-3 flex gap-2 rounded-lg bg-emerald-50 p-3">
              <Info className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              <p className="text-sm text-emerald-800">{step.tip}</p>
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
        className="flex w-full items-center justify-between p-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <span className="font-medium text-zinc-900">{faq.question}</span>
        <ArrowRight className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-3 bg-zinc-50">
          <p className="text-sm text-zinc-600">{faq.answer}</p>
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

export default function BackerHandbookPage() {
  const [activeTab, setActiveTab] = useState('discover');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-emerald-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-teal-500/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-primary/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 py-16 text-center text-white relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold">Backer Handbook</h1>
          <p className="mt-2 text-emerald-100">
            Your complete guide to backing projects from start to finish
          </p>
        </div>
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
                id={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
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
          {activeTab === 'discover' && (
            <>
              <SectionHeader
                title="Finding the Perfect Project"
                description="Learn how to discover crowdfunding campaigns that match your interests and evaluate whether they're worth backing."
              />
              <div className="space-y-4">
                {discoverSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'backing' && (
            <>
              <SectionHeader
                title="Making Your Pledge"
                description="A step-by-step walkthrough of the pledge process, from selecting your reward to confirming your support."
              />
              <div className="space-y-4">
                {backingSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'stripe' && (
            <>
              <SectionHeader
                title="Paying with Card (Stripe)"
                description="Everything you need to know about card payments, including when you're charged and what to expect."
              />
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <h4 className="font-medium text-emerald-800">Secure Payment Processing</h4>
                    <p className="mt-1 text-sm text-emerald-700">
                      All card payments are processed by Stripe, trusted by millions of businesses worldwide. Your card details are encrypted and never stored on our servers.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {stripeSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'divinitycoin' && (
            <>
              <SectionHeader
                title="Paying with DivinityCoin"
                description="A guide to using DivinityCoin gift cards for your crowdfunding pledges - it's like a store gift card, not a cryptocurrency."
              />
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Coins className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <h4 className="font-medium text-amber-800">Gift Card System (Not Cryptocurrency)</h4>
                    <p className="mt-1 text-sm text-amber-700">
                      DivinityCoin is a platform gift card, not a cryptocurrency. 1 DivinityCoin = $1 USD, always. No crypto wallet needed - your balance is stored right in your IndieCrowdfund account. Need a refund? Request one within 30 days at divinitycoin.com/dashboard.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {divinityCoinSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'rewards' && (
            <>
              <SectionHeader
                title="Understanding Rewards & Add-ons"
                description="Learn how reward tiers, add-ons, shipping, and delivery estimates work."
              />
              <div className="space-y-4">
                {rewardsTips.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'after' && (
            <>
              <SectionHeader
                title="After You Pledge"
                description="What happens after you back a project - from confirmation to receiving your rewards."
              />
              <div className="space-y-4">
                {afterPledgeSteps.map((step, index) => (
                  <StepCard key={step.title} step={step} number={index + 1} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <SectionHeader
            title="Frequently Asked Questions"
            description="Common questions backers ask about crowdfunding."
          />
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-8 text-center text-white">
          <h3 className="text-2xl font-bold">Ready to Support a Creator?</h3>
          <p className="mt-2 text-emerald-100">Discover amazing projects waiting for backers like you.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <a
              href="/discover"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              <Search className="h-5 w-5" />
              Explore Projects
            </a>
            <a
              href="/dashboard/backer"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white px-6 py-3 font-medium text-white hover:bg-white/10 transition-colors"
            >
              <CheckCircle2 className="h-5 w-5" />
              My Pledges
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
