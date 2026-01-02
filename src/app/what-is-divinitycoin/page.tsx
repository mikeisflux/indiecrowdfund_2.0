'use client';

import { useState } from 'react';
import {
  Gift,
  CreditCard,
  ShoppingBag,
  Coins,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Wallet,
  RefreshCw,
  Shield,
  Sparkles,
  DollarSign,
  Store,
  Users,
  Heart,
} from 'lucide-react';
import { Footer } from "@/components/footer";

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'Is DivinityCoin a cryptocurrency?',
    answer: 'No! DivinityCoin is NOT a cryptocurrency. It is a gift card system that uses a digital balance on our platform. There is no blockchain, no crypto wallet needed, and no volatile exchange rates. Think of it exactly like a gift card balance you might have at your favorite store.',
  },
  {
    question: 'How do I get DivinityCoin?',
    answer: 'DivinityCoin can be obtained in several ways: as rewards from creators for backing their projects, as promotional gifts during special events, purchased directly on our platform, or received as refunds from cancelled pledges when the creator offers DivinityCoin refunds.',
  },
  {
    question: 'Can I convert DivinityCoin back to real money?',
    answer: 'No, DivinityCoin cannot be converted back to cash or withdrawn to a bank account. Just like a store gift card, once you have DivinityCoin, it can only be spent on our platform. This is a key reason why it\'s a gift card system, not a currency.',
  },
  {
    question: 'Does my DivinityCoin expire?',
    answer: 'DivinityCoin does not expire. Your balance will remain in your account until you spend it. However, if your account is inactive for an extended period (typically 2+ years), we may reach out before any balance adjustments.',
  },
  {
    question: 'Can I use DivinityCoin and a credit card together?',
    answer: 'Yes! You can use a partial DivinityCoin balance and pay the remainder with a credit card. This is great when your pledge amount exceeds your DivinityCoin balance.',
  },
  {
    question: 'Is DivinityCoin accepted on all projects?',
    answer: 'Most projects on IndieCrowdfund accept DivinityCoin, but creators can choose whether to accept it. Look for the "Accepts DivinityCoin" badge on the project page to confirm before pledging.',
  },
  {
    question: 'Do I need DivinityCoin before I can browse rewards?',
    answer: 'No! You can browse any project, select rewards and add-ons, and see your total before worrying about payment. DivinityCoin is only needed at the final checkout step. If you don\'t have enough balance, you\'ll see clear instructions on how to get more credits and complete your pledge.',
  },
  {
    question: 'What happens to my DivinityCoin if a project fails?',
    answer: 'If you pledged with DivinityCoin and the project doesn\'t reach its funding goal, your DivinityCoin is automatically returned to your account balance. No action needed on your part.',
  },
  {
    question: 'Can I transfer DivinityCoin to another user?',
    answer: 'Currently, DivinityCoin cannot be transferred between users. It\'s tied to your account, just like a personal gift card balance. This helps prevent fraud and abuse.',
  },
  {
    question: 'Can I get a refund for DivinityCoin I purchased?',
    answer: 'Yes! DivinityCoin offers a self-service refund system. If you purchased DivinityCoin directly from DivinityCoin.com, you can request a full refund within 30 days of purchase through your DivinityCoin dashboard at divinitycoin.com/dashboard. No need to contact customer support - it\'s completely self-service. Note: Only full refunds are available (no partial refunds).',
  },
  {
    question: 'What if I already redeemed my DivinityCoin on IndieCrowdfund?',
    answer: 'If you\'ve redeemed your DivinityCoin card on IndieCrowdfund but haven\'t spent the balance, DivinityCoin will automatically coordinate with us to verify your unused balance. If the credits are still available in your IndieCrowdfund wallet, your refund will be processed. This happens automatically - you don\'t need to contact both platforms separately.',
  },
  {
    question: 'What is the refund policy for DivinityCoin?',
    answer: 'DivinityCoin provides a 30-day refund window from the date of purchase. Refunds are full amount only (no partial refunds). Once redeemed and spent on pledges, the DivinityCoin is no longer eligible for refund from DivinityCoin. However, if a project fails on IndieCrowdfund, your DivinityCoin credits are returned to your IndieCrowdfund wallet automatically.',
  },
];

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

export default function WhatIsDivinityCoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-amber-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-yellow-500/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-orange-500/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 py-12 text-center text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-full">
              <Gift className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">What is DivinityCoin?</h1>
          <p className="mt-2 text-amber-100 text-lg">
            A simple gift card system for crowdfunding - not a cryptocurrency
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Key Message Box */}
        <div className="mb-12 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-shrink-0">
              <div className="p-4 bg-amber-100 rounded-full">
                <Gift className="h-10 w-10 text-amber-600" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-zinc-900 mb-2">
                DivinityCoin is a Gift Card System
              </h2>
              <p className="text-zinc-700 text-lg">
                Think of DivinityCoin exactly like a gift card balance at your favorite store.
                It&apos;s a <strong>platform credit</strong> you can use to back projects on IndieCrowdfund.
                It is <strong>NOT</strong> a cryptocurrency, blockchain token, or volatile investment.
              </p>
            </div>
          </div>
        </div>

        {/* What DivinityCoin IS vs IS NOT */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* IS */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <h3 className="text-xl font-bold text-emerald-800">DivinityCoin IS:</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">A <strong>gift card balance</strong> for our platform</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">A <strong>platform credit</strong> stored in your account</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700"><strong>Stable value</strong> - 1 DivinityCoin = $1 USD always</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">A <strong>simple way to back projects</strong> without a card</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">A <strong>reward</strong> creators can give to loyal backers</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700"><strong>Easy to use</strong> - no crypto knowledge needed</span>
              </li>
            </ul>
          </div>

          {/* IS NOT */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-xl font-bold text-red-800">DivinityCoin is NOT:</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">A <strong>cryptocurrency</strong> or blockchain token</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">An <strong>investment</strong> or speculative asset</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700"><strong>Volatile</strong> - it doesn&apos;t fluctuate in value</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700"><strong>Convertible</strong> back to cash or real currency</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700">Requiring a <strong>crypto wallet</strong> or special software</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700"><strong>Tradeable</strong> on exchanges or between users</span>
              </li>
            </ul>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6 text-center">How DivinityCoin Works</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                <Wallet className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 mb-2">1. Get DivinityCoin</h4>
              <p className="text-sm text-zinc-600">
                Receive DivinityCoin as rewards, gifts, or purchase it directly on the platform.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 mb-2">2. Check Your Balance</h4>
              <p className="text-sm text-zinc-600">
                Your DivinityCoin balance appears in your account dashboard. 1 coin = $1 USD.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 mb-2">3. Back a Project</h4>
              <p className="text-sm text-zinc-600">
                At checkout, select DivinityCoin as your payment method to use your balance.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                <Heart className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 mb-2">4. Support Creators</h4>
              <p className="text-sm text-zinc-600">
                Your pledge helps bring creative projects to life. That&apos;s it - simple as that!
              </p>
            </div>
          </div>
        </div>

        {/* Gift Card Comparison */}
        <div className="mb-12 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4 text-center">
            <Gift className="h-6 w-6 inline-block mr-2 text-amber-500" />
            The Gift Card Comparison
          </h2>
          <p className="text-center text-zinc-600 mb-6 max-w-3xl mx-auto">
            If you understand how a gift card works at a retail store, you already understand DivinityCoin.
            Here&apos;s a direct comparison:
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-lg bg-blue-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800">Store Gift Card</h4>
              </div>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• You buy or receive a gift card</li>
                <li>• The balance is stored on the card</li>
                <li>• You can only spend it at that store</li>
                <li>• $50 gift card = $50 to spend</li>
                <li>• Cannot be converted back to cash</li>
                <li>• Cannot be transferred to others</li>
                <li>• No special knowledge required</li>
              </ul>
            </div>
            <div className="rounded-lg bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-5 w-5 text-amber-600" />
                <h4 className="font-semibold text-amber-800">DivinityCoin</h4>
              </div>
              <ul className="space-y-2 text-sm text-zinc-700">
                <li>• You earn, receive, or purchase coins</li>
                <li>• The balance is stored in your account</li>
                <li>• You can only spend it on IndieCrowdfund</li>
                <li>• 50 DivinityCoin = $50 to spend</li>
                <li>• Cannot be converted back to cash</li>
                <li>• Cannot be transferred to others</li>
                <li>• No special knowledge required</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Ways to Earn DivinityCoin */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6 text-center">Ways to Get DivinityCoin</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="h-6 w-6 text-purple-500" />
                <h4 className="font-semibold text-zinc-900">Creator Rewards</h4>
              </div>
              <p className="text-sm text-zinc-600">
                Some creators offer DivinityCoin as a bonus reward for backing their projects.
                Look for &quot;Includes X DivinityCoin&quot; in reward descriptions.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <Gift className="h-6 w-6 text-pink-500" />
                <h4 className="font-semibold text-zinc-900">Promotional Events</h4>
              </div>
              <p className="text-sm text-zinc-600">
                During special events and promotions, we may award DivinityCoin to active backers,
                new users, or as part of referral programs.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <RefreshCw className="h-6 w-6 text-blue-500" />
                <h4 className="font-semibold text-zinc-900">Refunds</h4>
              </div>
              <p className="text-sm text-zinc-600">
                When a project is cancelled or a pledge is refunded, creators may offer
                DivinityCoin refunds instead of or in addition to cash refunds.
              </p>
            </div>
          </div>
        </div>

        {/* Using DivinityCoin Section */}
        <div className="mb-12 rounded-xl border border-border bg-gradient-to-r from-amber-50 to-orange-50 p-6">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Using DivinityCoin to Back Projects</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900">Check Project Eligibility</h4>
                <p className="text-sm text-zinc-600">
                  Look for the &quot;Accepts DivinityCoin&quot; badge on the project page. Not all creators choose to accept it.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900">Select Your Reward</h4>
                <p className="text-sm text-zinc-600">
                  Choose your reward tier and any add-ons you want, just like a normal pledge.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900">Choose DivinityCoin at Checkout</h4>
                <p className="text-sm text-zinc-600">
                  At the payment step, select &quot;Pay with DivinityCoin.&quot; Your available balance will be shown.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900">Complete Your Pledge</h4>
                <p className="text-sm text-zinc-600">
                  Confirm your pledge. Your DivinityCoin balance is deducted immediately, and you&apos;re all set!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* For Creators Section */}
        <div className="mb-12 rounded-xl border border-purple-200 bg-purple-50/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Store className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-bold text-purple-800">For Creators: Accepting DivinityCoin</h2>
          </div>
          <p className="text-zinc-700 mb-4">
            As a creator, you can choose whether to accept DivinityCoin on your projects. Here&apos;s what you need to know:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-white p-4">
              <h4 className="font-semibold text-zinc-900 mb-2">Benefits</h4>
              <ul className="space-y-1 text-sm text-zinc-600">
                <li>• Attracts more backers who have DivinityCoin balances</li>
                <li>• Shows you&apos;re part of the IndieCrowdfund community</li>
                <li>• Can be used as rewards to incentivize pledges</li>
              </ul>
            </div>
            <div className="rounded-lg bg-white p-4">
              <h4 className="font-semibold text-zinc-900 mb-2">How It Works</h4>
              <ul className="space-y-1 text-sm text-zinc-600">
                <li>• Enable DivinityCoin in your project settings</li>
                <li>• DivinityCoin pledges are converted to cash for payouts</li>
                <li>• You receive funds just like card payments</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="mb-12 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-zinc-900">Security & Protection</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900">Secure Balance</h4>
                <p className="text-sm text-zinc-600">Your DivinityCoin balance is securely stored in your account.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900">No Volatility</h4>
                <p className="text-sm text-zinc-600">Unlike crypto, your balance won&apos;t fluctuate. 100 coins = $100 always.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900">Automatic Refunds</h4>
                <p className="text-sm text-zinc-600">If a project fails, your DivinityCoin is automatically returned.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900">No Expiration</h4>
                <p className="text-sm text-zinc-600">Your DivinityCoin doesn&apos;t expire - use it whenever you want.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <HelpCircle className="h-6 w-6 text-amber-500" />
            <h2 className="text-2xl font-bold text-zinc-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-center text-white">
          <Gift className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-2xl font-bold">Ready to Use Your DivinityCoin?</h3>
          <p className="mt-2 text-amber-100 max-w-xl mx-auto">
            Check your balance and discover amazing projects waiting to be backed.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <a
              href="/dashboard/backer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Wallet className="h-5 w-5" />
              Check My Balance
            </a>
            <a
              href="/discover"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white px-6 py-3 font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Users className="h-5 w-5" />
              Discover Projects
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
