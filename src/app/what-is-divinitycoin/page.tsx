'use client';

import { useState } from 'react';
import {
  CreditCard,
  ShoppingBag,
  Coins,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Shield,
  Sparkles,
  Store,
  Users,
  Heart,
  ArrowLeft,
  Lock,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: 'Is DivinityCoin a cryptocurrency?',
    answer: 'No! DivinityCoin is NOT a cryptocurrency. It is a payment processing service that allows you to pay with your regular credit or debit card. There is no blockchain, no crypto wallet, and no volatile exchange rates. Think of it as an alternative payment processor, similar to how other payment services process card payments.',
  },
  {
    question: 'How do I pay with DivinityCoin?',
    answer: 'When a project or marketplace listing uses DivinityCoin as its payment processor, you simply enter your credit or debit card details at checkout. The payment form accepts Visa, Mastercard, American Express, and Discover. Your card is charged securely through DivinityCoin\'s certified payment system.',
  },
  {
    question: 'Do I need to create a DivinityCoin account or buy credits first?',
    answer: 'No! There is nothing to set up in advance. When you back a project or make a marketplace purchase that uses DivinityCoin, you simply enter your card details at checkout — just like any other online purchase.',
  },
  {
    question: 'Why do some creators use DivinityCoin instead of other processors?',
    answer: 'Creators choose DivinityCoin because it supports all content types, including NSFW and adult content, which some standard payment processors may not support. DivinityCoin provides creators with a compliant way to accept card payments for any type of creative work.',
  },
  {
    question: 'Is my card information safe with DivinityCoin?',
    answer: 'Yes! DivinityCoin uses industry-standard PCI-compliant payment processing. Your card details are entered into a secure, encrypted payment form and are never stored by IndieCrowdfund. All payment data is encrypted end-to-end.',
  },
  {
    question: 'Are the fees different with DivinityCoin?',
    answer: 'As a backer, you pay the same price regardless of which payment processor the creator uses. The fee difference (~6% standard vs ~9% DivinityCoin) is handled on the creator side and does not affect what you pay.',
  },
  {
    question: 'Can I use DivinityCoin in the digital marketplace too?',
    answer: 'Yes! If a creator has set DivinityCoin as their payment processor for their marketplace listings, you\'ll see the DivinityCoin payment option at checkout. The experience is the same — enter your card details and complete your purchase.',
  },
  {
    question: 'What cards are accepted?',
    answer: 'DivinityCoin accepts all major card networks: Visa, Mastercard, American Express, and Discover. You can also use bank payments where available.',
  },
  {
    question: 'What happens if a project I backed with DivinityCoin fails?',
    answer: 'If a project doesn\'t reach its funding goal, no money changes hands — the same as with any other payment method. If a refund is needed after a successful charge, it is processed back to your original payment card through DivinityCoin.',
  },
  {
    question: 'How long do DivinityCoin refunds take?',
    answer: 'Refunds are processed back to your original payment method. Processing times depend on your card issuer, but typically take 5-10 business days to appear on your statement.',
  },
  {
    question: 'Can I tell which projects use DivinityCoin before I pledge?',
    answer: 'Yes! Projects that use DivinityCoin as their payment processor will show a DivinityCoin indicator on their project page. You\'ll also see the DivinityCoin payment form at checkout.',
  },
];

function FAQItem({ faq }: { faq: FAQ }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{faq.question}</span>
        <ArrowRight className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="border-t border-border px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{faq.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function WhatIsDivinityCoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5 relative overflow-hidden">
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
      <div className="floating-orb w-96 h-96 bg-amber-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-yellow-500/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-orange-500/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 py-12 text-center text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-full">
              <Coins className="h-12 w-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">What is DivinityCoin?</h1>
          <p className="mt-2 text-amber-100 text-lg">
            A seamless payment processor for creators — pay with your card, not crypto
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Key Message Box */}
        <div className="mb-12 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-shrink-0">
              <div className="p-4 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                <CreditCard className="h-10 w-10 text-amber-600" />
              </div>
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                DivinityCoin is a Payment Processor
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-lg">
                DivinityCoin is an <strong>alternative payment sub-processor</strong> used by some creators on IndieCrowdfund.
                When you back a project that uses DivinityCoin, you simply enter your <strong>credit or debit card</strong> at checkout.
                It is <strong>NOT</strong> a cryptocurrency, token, or wallet system — just a secure way to pay with your card.
              </p>
            </div>
          </div>
        </div>

        {/* What DivinityCoin IS vs IS NOT */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* IS */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-200">DivinityCoin IS:</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">An <strong>alternative payment sub-processor</strong> for IndieCrowdfund</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">A <strong>seamless card payment</strong> experience — enter your card and go</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300"><strong>PCI-compliant</strong> — bank-level encryption and security</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">A way to <strong>support all content types</strong> including NSFW/adult projects</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">Accepts <strong>Visa, Mastercard, Amex, and Discover</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300"><strong>Easy to use</strong> — no setup, accounts, or credits needed</span>
              </li>
            </ul>
          </div>

          {/* IS NOT */}
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-xl font-bold text-red-800 dark:text-red-200">DivinityCoin is NOT:</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">A <strong>cryptocurrency</strong> or blockchain token</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">A <strong>wallet system</strong> where you pre-load credits</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">An <strong>investment</strong> or speculative asset</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300"><strong>Volatile</strong> — it doesn&apos;t fluctuate in value</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300">Requiring a <strong>special account</strong> or software to use</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-zinc-700 dark:text-zinc-300"><strong>Tradeable</strong> on exchanges or between users</span>
              </li>
            </ul>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 text-center">How DivinityCoin Works</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">1. Find a Project</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Browse projects on IndieCrowdfund or the digital marketplace. Some creators use DivinityCoin as their payment processor.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-3">
                <CreditCard className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">2. Enter Your Card</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                At checkout, enter your credit or debit card details into the secure payment form. Visa, Mastercard, Amex, and Discover accepted.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-3">
                <Lock className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">3. Secure Processing</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                DivinityCoin securely processes your payment through their PCI-compliant system. Your card details are encrypted end-to-end.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-3">
                <Heart className="h-6 w-6 text-amber-600" />
              </div>
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">4. You&apos;re Done!</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Your pledge or purchase is confirmed instantly. That&apos;s it — simple as any online card payment.
              </p>
            </div>
          </div>
        </div>

        {/* Comparison: Standard vs DivinityCoin */}
        <div className="mb-12 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 text-center">
            <CreditCard className="h-6 w-6 inline-block mr-2 text-amber-500" />
            Standard Checkout vs DivinityCoin: What&apos;s the Difference?
          </h2>
          <p className="text-center text-zinc-600 dark:text-zinc-400 mb-6 max-w-3xl mx-auto">
            Both are secure payment processors. The main difference is which content types they support.
            As a backer, the checkout experience is nearly identical for both.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">Standard Checkout (Default)</h4>
              </div>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li>• Enter your card at checkout</li>
                <li>• Payment processed directly</li>
                <li>• Supports credit, debit, Apple Pay, Google Pay</li>
                <li>• ~6% total fees (paid by creator)</li>
                <li>• Standard content types only</li>
                <li>• Most projects use this</li>
              </ul>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="h-5 w-5 text-amber-600" />
                <h4 className="font-semibold text-amber-800 dark:text-amber-200">DivinityCoin</h4>
              </div>
              <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li>• Enter your card at checkout</li>
                <li>• Payment processed through DivinityCoin</li>
                <li>• Supports Visa, Mastercard, Amex, Discover</li>
                <li>• ~9% total fees (paid by creator)</li>
                <li>• Supports ALL content types including NSFW</li>
                <li>• Used by creators who need broader content support</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Why Creators Choose DivinityCoin */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 text-center">Why Some Creators Use DivinityCoin</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="h-6 w-6 text-purple-500" />
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">All Content Types</h4>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                DivinityCoin supports all creative content including NSFW and adult-oriented projects that standard payment processors may not allow.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="h-6 w-6 text-emerald-500" />
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Compliance Built-in</h4>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                DivinityCoin handles regulatory compliance behind the scenes, providing creators with a worry-free payment acceptance solution.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="h-6 w-6 text-blue-500" />
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Seamless Experience</h4>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Backers experience the same simple card-entry checkout flow regardless of whether the project uses the standard processor or DivinityCoin.
              </p>
            </div>
          </div>
        </div>

        {/* The Checkout Experience */}
        <div className="mb-12 rounded-xl border border-border bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">The DivinityCoin Checkout Experience</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Here&apos;s exactly what happens when you back a project or buy from the marketplace using DivinityCoin:</p>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Select Your Reward or Product</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Choose your reward tier and any add-ons (for pledges), or select a book/product (for marketplace). This is the same as any project.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">See the Secure Payment Form</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  At checkout, you&apos;ll see a &quot;Secure Payment&quot; header with card brand logos (Visa, Mastercard, Amex, Discover) and a lock icon. This is DivinityCoin&apos;s secure payment form.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Enter Your Card Details</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Enter your card number, expiration date, and CVC. You can also pay via bank where available. Your details are encrypted and never stored by IndieCrowdfund.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600 text-white font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Confirm and You&apos;re Done</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Click the pay button and your pledge or purchase is confirmed. You&apos;ll receive a confirmation email, and digital purchases are delivered to your Digital Library instantly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* For Creators Section */}
        <div className="mb-12 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Store className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-bold text-purple-800 dark:text-purple-200">For Creators: Using DivinityCoin</h2>
          </div>
          <p className="text-zinc-700 dark:text-zinc-300 mb-4">
            As a creator, you can choose DivinityCoin as your payment processor. Here&apos;s what you need to know:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg bg-white dark:bg-zinc-800/50 p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Benefits</h4>
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• Supports all content types including NSFW/adult</li>
                <li>• Backers pay with their regular credit/debit cards</li>
                <li>• Built-in compliance handling</li>
                <li>• Works for both crowdfunding and marketplace</li>
              </ul>
            </div>
            <div className="rounded-lg bg-white dark:bg-zinc-800/50 p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">How It Works</h4>
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• Select DivinityCoin in your project or IndieKit settings</li>
                <li>• Backers enter their card at checkout seamlessly</li>
                <li>• DivinityCoin processes the payment securely</li>
                <li>• You receive funds via settlement to your bank account</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-purple-100 dark:bg-purple-900/30 p-3">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <strong>Fees:</strong> 3% IndieCrowdfund platform fee + 6% DivinityCoin partner fee = ~9% total.
              Settlement to your bank account within 14 business days.
            </p>
          </div>
        </div>

        {/* Security Section */}
        <div className="mb-12 rounded-xl border border-border bg-card/80 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Security & Protection</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">PCI-Compliant Processing</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">All payments processed through PCI DSS Level 1 certified infrastructure.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Card Data Never Stored</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">IndieCrowdfund never sees, stores, or processes your card details.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">End-to-End Encryption</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">All data is encrypted in transit with TLS 1.2+ and at rest with AES-256.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Refund Protection</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Failed campaigns = no charge. Refunds processed back to your original card.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <HelpCircle className="h-6 w-6 text-amber-500" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} faq={faq} />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-center text-white">
          <Coins className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-2xl font-bold">Ready to Back a Project?</h3>
          <p className="mt-2 text-amber-100 max-w-xl mx-auto">
            Discover amazing projects and support creators. Whether they use standard checkout or DivinityCoin, paying is simple.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <a
              href="/discover"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Users className="h-5 w-5" />
              Discover Projects
            </a>
            <a
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white px-6 py-3 font-medium text-white hover:bg-white/10 transition-colors"
            >
              <ShoppingBag className="h-5 w-5" />
              Browse Marketplace
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
