"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  Percent,
  CheckCircle,
  ArrowRight,
  HelpCircle,
  Calculator,
  Shield,
  Zap,
  Gift,
  Globe,
  CreditCard,
  Coins,
  ExternalLink,
} from "lucide-react";
import { Footer } from "@/components/footer";

const stripeFeeBreakdown = [
  {
    title: "Platform Fee",
    rate: "3%",
    description: "Charged on successfully funded campaigns only",
    details: "Our platform fee covers hosting, tools, customer support, and payment processing infrastructure.",
  },
  {
    title: "Stripe Processing",
    rate: "2.9% + $0.30",
    description: "Standard credit card processing rates",
    details: "This fee goes directly to Stripe and covers the cost of securely handling credit card transactions.",
  },
];

const divinityCoinFeeBreakdown = [
  {
    title: "DivinityCoin Partner Fee",
    rate: "6%",
    description: "Total fee deducted at settlement",
    details: "Includes all processing fees (~2.9% + $0.30 Stripe + ~2.8% DivinityCoin platform). Credits are purchased in advance by backers.",
  },
  {
    title: "IndieCrowdfund Platform Fee",
    rate: "3%",
    description: "Deducted from creator payouts",
    details: "Applied when we pay out your earnings from settled DivinityCoin credits. Creators receive ~91% of backer contributions.",
  },
];

const comparisonData = [
  { platform: "IndieCrowdfund (Stripe)", platformFee: "3%", paymentFee: "2.9% + $0.30", total: "~6%", highlight: true },
  { platform: "IndieCrowdfund (DivinityCoin)", platformFee: "3%", paymentFee: "6% partner", total: "~9%", highlight: false },
  { platform: "Kickstarter", platformFee: "5%", paymentFee: "3% + $0.20", total: "~8%", highlight: false },
  { platform: "Indiegogo", platformFee: "5%", paymentFee: "2.9% + $0.30", total: "~8%", highlight: false },
  { platform: "GoFundMe", platformFee: "0%", paymentFee: "2.9% + $0.30", total: "~3%", highlight: false },
];

const features = [
  {
    icon: Shield,
    title: "No Hidden Fees",
    description: "What you see is what you get. No surprise charges or hidden costs.",
  },
  {
    icon: CheckCircle,
    title: "Only Pay When Funded",
    description: "If your campaign doesn't reach its goal, you pay nothing.",
  },
  {
    icon: Zap,
    title: "Fast Payouts",
    description: "Receive your funds within 14 days of campaign completion.",
  },
  {
    icon: Globe,
    title: "Global Payments",
    description: "Accept payments from backers in 135+ countries and currencies.",
  },
];

// Calculate fees for Stripe payments
function calculateStripeFees(amount: number, averagePledge: number = 50) {
  const platformFee = amount * 0.03; // 3% platform fee
  const numTransactions = Math.ceil(amount / averagePledge);
  const processingFee = (amount * 0.029) + (numTransactions * 0.30); // 2.9% + $0.30 per transaction
  const totalFees = platformFee + processingFee;
  const youReceive = amount - totalFees;
  const feePercentage = (totalFees / amount) * 100;

  return {
    platformFee,
    processingFee,
    totalFees,
    youReceive,
    feePercentage,
  };
}

// Calculate fees for DivinityCoin payments
function calculateDivinityCoinFees(amount: number) {
  // DivinityCoin takes 6% total partner fee from the funds
  const divinityPartnerFee = amount * 0.06;
  const amountAfterPartnerFee = amount - divinityPartnerFee;

  // Platform takes 3% from what's left
  const platformFee = amountAfterPartnerFee * 0.03;
  const totalFees = divinityPartnerFee + platformFee;
  const youReceive = amount - totalFees;
  const feePercentage = (totalFees / amount) * 100;

  return {
    divinityPartnerFee,
    platformFee,
    totalFees,
    youReceive,
    feePercentage,
  };
}

export default function FeesPage() {
  const [sliderValue, setSliderValue] = useState([50000]); // Default to $50,000
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "divinitycoin">("stripe");
  const amount = sliderValue[0];
  const stripeFees = calculateStripeFees(amount);
  const divinityFees = calculateDivinityCoinFees(amount);
  const fees = paymentMethod === "stripe" ? stripeFees : divinityFees;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[600px] h-[600px] bg-emerald-500/15" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[500px] h-[500px] bg-teal-500/10" style={{ animationDelay: '-8s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-cyan-500/10" style={{ animationDelay: '-15s' }} />
      </div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/90 via-teal-600/90 to-cyan-700/90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30 border-0">
              <DollarSign className="mr-1 h-3 w-3" />
              Transparent Pricing
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Simple, Fair Pricing
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-emerald-100">
              No surprises, no hidden fees. Choose your preferred payment method.
            </p>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-background"/>
          </svg>
        </div>
      </section>

      {/* Payment Method Selection */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Payment Options
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              We offer two payment solutions to best fit your needs
            </p>
          </div>

          <Tabs defaultValue="stripe" className="w-full" onValueChange={(v) => setPaymentMethod(v as "stripe" | "divinitycoin")}>
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="stripe" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe
              </TabsTrigger>
              <TabsTrigger value="divinitycoin" className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                DivinityCoin
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stripe">
              <div className="grid gap-8 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
                {stripeFeeBreakdown.map((fee, index) => (
                  <Card
                    key={fee.title}
                    className="glass-card border shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                  >
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg mb-4">
                        <Percent className="h-8 w-8 text-white" />
                      </div>
                      <CardTitle className="text-2xl">{fee.title}</CardTitle>
                      <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mt-2">{fee.rate}</div>
                      <CardDescription className="text-base mt-2">{fee.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground text-center">
                        {fee.details}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-6 py-3">
                  <Calculator className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    Total fees with Stripe: approximately 6% of funds raised
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="divinitycoin">
              <div className="grid gap-8 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
                {divinityCoinFeeBreakdown.map((fee, index) => (
                  <Card
                    key={fee.title}
                    className="glass-card border shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
                  >
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg mb-4">
                        <Coins className="h-8 w-8 text-white" />
                      </div>
                      <CardTitle className="text-2xl">{fee.title}</CardTitle>
                      <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mt-2">{fee.rate}</div>
                      <CardDescription className="text-base mt-2">{fee.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground text-center">
                        {fee.details}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* DivinityCoin Info Box */}
              <Card className="mt-8 lg:max-w-4xl lg:mx-auto border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Coins className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">What is DivinityCoin?</h3>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                        DivinityCoin is a universal credit system that allows backers to purchase credits in advance and use them across multiple creator platforms.
                        Backers buy credits in advance, then redeem them on your campaign.
                      </p>
                      <h4 className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">How the money flows:</h4>
                      <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside mb-4">
                        <li>Backer purchases $100 in DivinityCoin credits</li>
                        <li>Backer redeems credits to back your campaign</li>
                        <li>When your project funds, credits are captured</li>
                        <li>DivinityCoin settles with IndieCrowdfund weekly/monthly ($94 after 6% fee)</li>
                        <li>You receive $91.18 after our 3% platform fee</li>
                      </ol>
                      <a
                        href="https://divinitycoin.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Learn more about DivinityCoin
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-900/20 px-6 py-3">
                  <Calculator className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-purple-700 dark:text-purple-400">
                    Total fees with DivinityCoin: approximately 9% of funds raised
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Interactive Calculator Section */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Estimate Your Earnings
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Use the slider to see how much you&apos;ll take home at different funding levels
            </p>
          </div>

          <Card className="mt-12 glass-card border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-8">
              {/* Payment Method Toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-lg border p-1 bg-white dark:bg-zinc-800">
                  <button
                    onClick={() => setPaymentMethod("stripe")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      paymentMethod === "stripe"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    <CreditCard className="inline h-4 w-4 mr-1" />
                    Stripe
                  </button>
                  <button
                    onClick={() => setPaymentMethod("divinitycoin")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      paymentMethod === "divinitycoin"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                    }`}
                  >
                    <Coins className="inline h-4 w-4 mr-1" />
                    DivinityCoin
                  </button>
                </div>
              </div>

              {/* Slider */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-zinc-500">$1,000</span>
                  <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                    ${amount.toLocaleString()}
                  </span>
                  <span className="text-sm text-zinc-500">$500,000</span>
                </div>
                <Slider
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  min={1000}
                  max={500000}
                  step={1000}
                  className="w-full"
                />
                <div className="flex justify-between mt-2 text-xs text-zinc-400">
                  <span>Small Campaign</span>
                  <span>Medium Campaign</span>
                  <span>Large Campaign</span>
                </div>
              </div>

              {/* Results */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Fee Breakdown */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                    Fee Breakdown ({paymentMethod === "stripe" ? "Stripe" : "DivinityCoin"})
                  </h3>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-zinc-400">Campaign raised</span>
                    <span className="font-medium">${amount.toLocaleString()}</span>
                  </div>

                  {paymentMethod === "stripe" ? (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-zinc-400">Platform fee (3%)</span>
                        <span className="text-red-500">-${stripeFees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-zinc-400">Stripe processing (2.9% + $0.30)</span>
                        <span className="text-red-500">-${stripeFees.processingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-zinc-400">DivinityCoin partner fee (6%)</span>
                        <span className="text-red-500">-${divinityFees.divinityPartnerFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-zinc-400">Platform fee (3% of net)</span>
                        <span className="text-red-500">-${divinityFees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-zinc-400">Total fees</span>
                    <span className="text-red-500">
                      -${fees.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      ({fees.feePercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* You Receive */}
                <div className={`flex flex-col justify-center items-center rounded-xl p-8 ${
                  paymentMethod === "stripe"
                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                    : "bg-purple-50 dark:bg-purple-900/20"
                }`}>
                  <span className={`text-sm font-medium mb-2 ${
                    paymentMethod === "stripe"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-purple-600 dark:text-purple-400"
                  }`}>
                    You receive
                  </span>
                  <span className={`text-5xl font-bold ${
                    paymentMethod === "stripe"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-purple-600 dark:text-purple-400"
                  }`}>
                    ${fees.youReceive.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className={`text-sm mt-2 ${
                    paymentMethod === "stripe"
                      ? "text-emerald-600/70 dark:text-emerald-400/70"
                      : "text-purple-600/70 dark:text-purple-400/70"
                  }`}>
                    {((fees.youReceive / amount) * 100).toFixed(1)}% of funds raised
                  </span>
                </div>
              </div>

              {/* Quick comparison */}
              <div className="mt-8 pt-8 border-t">
                <h4 className="text-sm font-medium text-zinc-500 mb-4">Compare with other platforms at ${amount.toLocaleString()}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">IndieCrowdfund (Stripe)</div>
                    <div className="font-bold text-emerald-600">${stripeFees.youReceive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">IndieCrowdfund (DivinityCoin)</div>
                    <div className="font-bold text-purple-600">${divinityFees.youReceive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Kickstarter</div>
                    <div className="font-bold text-zinc-600 dark:text-zinc-400">
                      ${(amount * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Your savings (vs Kickstarter)</div>
                    <div className="font-bold text-green-600">
                      +${(stripeFees.youReceive - (amount * 0.92)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What&apos;s Included
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Your platform fee covers everything you need to run a successful campaign
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="text-center glass-card rounded-2xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How We Compare
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Our fees are competitive with other major crowdfunding platforms
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border glass-card shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-900 dark:text-white">Platform</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">Platform Fee</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">Payment Fee</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {comparisonData.map((row) => (
                  <tr key={row.platform} className={row.highlight ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white">
                      {row.platform}
                      {row.highlight && (
                        <Badge className="ml-2 bg-emerald-500">Lowest fees</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{row.platformFee}</td>
                    <td className="px-6 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{row.paymentFee}</td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Common Questions
            </h2>
          </div>

          <div className="mt-12 space-y-6">
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white">When do I pay fees?</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Fees are only deducted when your campaign successfully reaches its funding goal. If you don&apos;t reach your goal, you pay nothing.
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white">What&apos;s the difference between Stripe and DivinityCoin?</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Stripe is traditional credit card processing with lower overall fees (~6%). DivinityCoin is a prepaid credit system where backers buy credits in advance,
                with slightly higher fees (~9%) but offers cross-platform purchasing power for backers.
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white">How quickly will I receive my funds?</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                For Stripe payments, funds are typically transferred within 14 business days. For DivinityCoin, settlements occur weekly or monthly based on your settings.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/faq">
              <Button variant="outline">
                View All FAQs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 animate-in fade-in zoom-in duration-500">
            <Gift className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white sm:text-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            Ready to Launch Your Campaign?
          </h2>
          <p className="mt-4 text-xl text-emerald-100 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            Join thousands of creators bringing their ideas to life.
          </p>
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
            <Link href="/projects/new">
              <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-xl">
                Start Your Campaign
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
