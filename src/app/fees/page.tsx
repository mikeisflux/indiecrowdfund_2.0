"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
} from "lucide-react";
import { Footer } from "@/components/footer";

const feeBreakdown = [
  {
    title: "Platform Fee",
    rate: "3%",
    description: "Charged on successfully funded campaigns only",
    details: "Our platform fee covers hosting, tools, customer support, and payment processing infrastructure.",
  },
  {
    title: "Payment Processing",
    rate: "2.9% + $0.30",
    description: "Standard credit card processing rates",
    details: "This fee goes directly to our payment processor (Stripe) and covers the cost of securely handling transactions.",
  },
];

const comparisonData = [
  { platform: "IndieCrowdfund", platformFee: "3%", paymentFee: "2.9% + $0.30", total: "~6%" },
  { platform: "Kickstarter", platformFee: "5%", paymentFee: "3% + $0.20", total: "~8%" },
  { platform: "Indiegogo", platformFee: "5%", paymentFee: "2.9% + $0.30", total: "~8%" },
  { platform: "GoFundMe", platformFee: "0%", paymentFee: "2.9% + $0.30", total: "~3%" },
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

// Calculate fees for a given amount
function calculateFees(amount: number, averagePledge: number = 50) {
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

export default function FeesPage() {
  const [sliderValue, setSliderValue] = useState([50000]); // Default to $50,000
  const amount = sliderValue[0];
  const fees = calculateFees(amount);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              <DollarSign className="mr-1 h-3 w-3" />
              Transparent Pricing
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Simple, Fair Pricing
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-emerald-100">
              No surprises, no hidden fees. We only succeed when you succeed.
            </p>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" className="dark:fill-zinc-950"/>
          </svg>
        </div>
      </section>

      {/* Fee Cards */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
            {feeBreakdown.map((fee) => (
              <Card key={fee.title} className="border-2 hover:border-emerald-200 transition-colors">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                    <Percent className="h-8 w-8 text-emerald-600" />
                  </div>
                  <CardTitle className="text-2xl">{fee.title}</CardTitle>
                  <div className="text-4xl font-bold text-emerald-600 mt-2">{fee.rate}</div>
                  <CardDescription className="text-base mt-2">{fee.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
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
                Total fees: approximately 6% of funds raised
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Calculator Section */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              Estimate Your Earnings
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Use the slider to see how much you&apos;ll take home at different funding levels
            </p>
          </div>

          <Card className="mt-12">
            <CardContent className="p-8">
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
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">Fee Breakdown</h3>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-zinc-400">Campaign raised</span>
                    <span className="font-medium">${amount.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-zinc-400">Platform fee (3%)</span>
                    <span className="text-red-500">-${fees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-zinc-400">Payment processing</span>
                    <span className="text-red-500">-${fees.processingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-zinc-400">Total fees</span>
                    <span className="text-red-500">-${fees.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({fees.feePercentage.toFixed(1)}%)</span>
                  </div>
                </div>

                {/* You Receive */}
                <div className="flex flex-col justify-center items-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-8">
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-2">
                    You receive
                  </span>
                  <span className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                    ${fees.youReceive.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-sm text-emerald-600/70 dark:text-emerald-400/70 mt-2">
                    {((fees.youReceive / amount) * 100).toFixed(1)}% of funds raised
                  </span>
                </div>
              </div>

              {/* Quick comparison */}
              <div className="mt-8 pt-8 border-t">
                <h4 className="text-sm font-medium text-zinc-500 mb-4">Compare with other platforms at ${amount.toLocaleString()}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">IndieCrowdfund</div>
                    <div className="font-bold text-emerald-600">${fees.youReceive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Kickstarter</div>
                    <div className="font-bold text-zinc-600 dark:text-zinc-400">
                      ${(amount * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Indiegogo</div>
                    <div className="font-bold text-zinc-600 dark:text-zinc-400">
                      ${(amount * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-xs text-zinc-500 mb-1">Your savings</div>
                    <div className="font-bold text-green-600">
                      +${(fees.youReceive - (amount * 0.92)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              What&apos;s Included
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Your platform fee covers everything you need to run a successful campaign
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <feature.icon className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 bg-zinc-50 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
              How We Compare
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
              Our fees are lower than other major crowdfunding platforms
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-xl border bg-white dark:bg-zinc-800">
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
                {comparisonData.map((row, index) => (
                  <tr key={row.platform} className={index === 0 ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-white">
                      {row.platform}
                      {index === 0 && (
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
              <h3 className="font-semibold text-zinc-900 dark:text-white">Are there any upfront costs?</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                No. Creating and launching a campaign on IndieCrowdfund is completely free. You only pay fees on successfully funded campaigns.
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold text-zinc-900 dark:text-white">How quickly will I receive my funds?</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                After your campaign ends successfully, funds are typically transferred to your bank account within 14 business days.
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
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <Gift className="mx-auto h-12 w-12 text-white/80 mb-6" />
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Launch Your Campaign?
          </h2>
          <p className="mt-4 text-xl text-emerald-100">
            Join thousands of creators bringing their ideas to life.
          </p>
          <div className="mt-10">
            <Link href="/projects/new">
              <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50">
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
