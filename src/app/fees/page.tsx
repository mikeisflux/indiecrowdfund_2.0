"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign, CheckCircle, ArrowRight, HelpCircle, Calculator,
  Gift, CreditCard, Coins, ExternalLink, ArrowLeft, ShoppingBag, Cloud,
} from "lucide-react";
import { Footer } from "@/components/footer";
import {
  divinityCoinFeeBreakdown, paypalFeeBreakdown,
  whopFeeBreakdown, paymentCloudFeeBreakdown, comparisonData, features, type PaymentMethod,
} from "./data";
import {
  calculatePayPalFees, calculateDivinityCoinFees, calculateWhopFees, calculatePaymentCloudFees,
} from "./calculations";

// ─── Sub-components ────────────────────────────────────────────────────────

interface FeeCard {
  title: string;
  rate: string;
  description: string;
  details: string;
}

function FeeBreakdownCards({
  fees,
  iconBg,
  rateClass,
  Icon,
}: {
  fees: FeeCard[];
  iconBg: string;
  rateClass: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
      {fees.map((fee, index) => (
        <Card
          key={fee.title}
          className="glass-card border shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: `${index * 100}ms`, animationFillMode: "backwards" }}
        >
          <CardHeader className="text-center pb-2">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${iconBg} shadow-lg mb-4`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">{fee.title}</CardTitle>
            <div className={`text-4xl font-bold mt-2 ${rateClass}`}>{fee.rate}</div>
            <CardDescription className="text-base mt-2">{fee.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">{fee.details}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TotalBadge({ color, text }: { color: string; text: string }) {
  return (
    <div className="mt-8 text-center">
      <div className={`inline-flex items-center gap-2 rounded-full px-6 py-3 ${color}`}>
        <Calculator className="h-5 w-5" />
        <span className="font-medium">{text}</span>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FeesPage() {
  const [sliderValue, setSliderValue] = useState([50000]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("whop");
  const amount = sliderValue[0];

  const divinityFees = calculateDivinityCoinFees(amount);
  const paypalFees = calculatePayPalFees(amount);
  const whopFees = calculateWhopFees(amount);
  const paymentCloudFees = calculatePaymentCloudFees(amount);

  const fees =
    paymentMethod === "paypal" ? paypalFees
    : paymentMethod === "whop" ? whopFees
    : paymentMethod === "paymentcloud" ? paymentCloudFees
    : divinityFees;

  const methodLabel =
    paymentMethod === "paypal" ? "PayPal"
    : paymentMethod === "whop" ? "Whop"
    : paymentMethod === "paymentcloud" ? "PaymentCloud"
    : "DivinityCoin";

  const methodColor = ({
    paypal: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-[#003087] dark:text-blue-400" },
    stripe: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
    whop: { bg: "bg-muted/50 dark:bg-zinc-900/20", text: "text-zinc-700 dark:text-muted-foreground" },
    divinitycoin: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400" },
    paymentcloud: { bg: "bg-sky-50 dark:bg-sky-900/20", text: "text-sky-600 dark:text-sky-400" },
  } as const)[paymentMethod] ?? { bg: "bg-muted", text: "text-foreground" };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Back Link */}
      <div className="container mx-auto px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>

      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[600px] h-[600px] bg-emerald-500/15" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[500px] h-[500px] bg-teal-500/10" style={{ animationDelay: "-8s" }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[400px] h-[400px] bg-cyan-500/10" style={{ animationDelay: "-15s" }} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/90 via-teal-600/90 to-cyan-700/90" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30 border-0">
              <DollarSign className="mr-1 h-3 w-3" />
              Transparent Pricing
            </Badge>
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
              Simple, Fair Pricing
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-emerald-100">
              No surprises, no hidden fees. Choose your preferred payment method.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" className="fill-background" />
          </svg>
        </div>
      </section>

      {/* Payment Method Tabs */}
      <section className="relative py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">Payment Options</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              We offer multiple payment solutions to best fit your needs
            </p>
          </div>

          <Tabs
            defaultValue="paymentcloud"
            className="w-full"
            onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
          >
            <TabsList className="grid w-full sm:max-w-md mx-auto grid-cols-1 mb-8">
              <TabsTrigger value="paymentcloud" className="flex items-center gap-2">
                <Cloud className="h-4 w-4" /> PaymentCloud
              </TabsTrigger>
              {/* Legacy processor tabs hidden — PaymentCloud is the only processor
                  offered for new campaigns. Backend continues to honor existing
                  Whop/PayPal/DivinityCoin campaigns.
              <TabsTrigger value="whop" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Whop
              </TabsTrigger>
              <TabsTrigger value="paypal" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> PayPal
              </TabsTrigger>
              <TabsTrigger value="divinitycoin" className="flex items-center gap-2">
                <Coins className="h-4 w-4" /> DivinityCoin
              </TabsTrigger>
              <TabsTrigger value="stripe" className="flex items-center gap-2 opacity-50">
                <CreditCard className="h-4 w-4" /> Stripe (Legacy)
              </TabsTrigger>
              */}
            </TabsList>

            {/* PaymentCloud */}
            <TabsContent value="paymentcloud">
              <div className="lg:max-w-4xl lg:mx-auto mb-8 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-12 sm:py-16 md:py-20 shadow-2xl ring-4 ring-red-500/40 animate-in fade-in zoom-in duration-500">
                <p className="text-center text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] leading-none">
                  100% Guaranteed
                </p>
                <p className="mt-3 sm:mt-4 text-center text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] leading-none">
                  NSFW Friendly
                </p>
              </div>
              <FeeBreakdownCards fees={paymentCloudFeeBreakdown} iconBg="bg-gradient-to-br from-sky-500 to-cyan-500" rateClass="bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent" Icon={Cloud} />
              <Card className="mt-8 lg:max-w-4xl lg:mx-auto border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30">
                      <Cloud className="h-6 w-6 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">What is PaymentCloud?</h3>
                      <p className="text-sm text-zinc-600 dark:text-muted-foreground mb-3">
                        PaymentCloud is a high-risk friendly merchant account on the NMI gateway. Backers enter their card directly on your campaign page — the card is securely tokenized in the browser via Collect.js (PAN never touches our servers) and only charged when your campaign hits its funding goal.
                      </p>
                      <h4 className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">How the money flows (example: $100 pledge):</h4>
                      <ol className="text-sm text-zinc-600 dark:text-muted-foreground space-y-1 list-decimal list-inside mb-4">
                        <li>Backer enters their card at checkout — instantly tokenized via Collect.js</li>
                        <li>Card is stored in PaymentCloud&apos;s vault, no charge yet</li>
                        <li>When your campaign funds, we charge the saved card</li>
                        <li>PaymentCloud processing (4% of $100 = $4.00) deducted at settlement</li>
                        <li>Per-transaction fee ($0.38 × 1 txn = $0.38) deducted at settlement</li>
                        <li>Platform fee (3% of $95.62 = $2.87) deducted at settlement</li>
                        <li>You receive <strong>$92.88</strong> deposited to your bank account</li>
                      </ol>
                      <p className="text-xs text-muted-foreground">PaymentCloud supports both <strong>All-or-Nothing</strong> and <strong>Keep-It-All</strong> campaigns. Cards are only charged on campaign success — failed campaigns trigger zero fees and zero charges.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <TotalBadge color="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400" text="Total fees with PaymentCloud: approximately 7.5% of funds raised" />
            </TabsContent>

            {/* Whop */}
            <TabsContent value="whop">
              <FeeBreakdownCards fees={whopFeeBreakdown} iconBg="bg-black" rateClass="text-zinc-900 dark:text-zinc-100" Icon={ShoppingBag} />
              <Card className="mt-8 lg:max-w-4xl lg:mx-auto border-border dark:border-zinc-800 bg-muted/50/50 dark:bg-zinc-900/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted dark:bg-zinc-900/30">
                      <ShoppingBag className="h-6 w-6 text-zinc-700 dark:text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">What is Whop?</h3>
                      <p className="text-sm text-zinc-600 dark:text-muted-foreground mb-3">
                        Whop is an embedded checkout solution that supports all content types including NSFW/adult projects. Backers complete checkout via Whop&apos;s embedded form — no redirects needed.
                      </p>
                      <h4 className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">How the money flows (example: $100 pledge):</h4>
                      <ol className="text-sm text-zinc-600 dark:text-muted-foreground space-y-1 list-decimal list-inside mb-4">
                        <li>Backer completes checkout via Whop&apos;s embedded form</li>
                        <li>Whop processes the $100 payment immediately</li>
                        <li>Whop fee (~3% = $3.00) deducted at settlement</li>
                        <li>Platform fee (3% of $97 = $2.91) deducted at settlement</li>
                        <li>You receive <strong>$94.09</strong> deposited to your account</li>
                      </ol>
                      <p className="text-xs text-muted-foreground">Whop only supports <strong>Keep It All</strong> campaigns — payments are collected immediately regardless of funding goal.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <TotalBadge color="bg-muted/50 dark:bg-zinc-900/20 text-zinc-700 dark:text-muted-foreground" text="Total fees with Whop: approximately 6% of funds raised" />
            </TabsContent>

            {/* PayPal */}
            <TabsContent value="paypal">
              <FeeBreakdownCards fees={paypalFeeBreakdown} iconBg="bg-[#003087]" rateClass="text-[#003087]" Icon={CreditCard} />
              <Card className="mt-8 lg:max-w-4xl lg:mx-auto border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#003087]/10">
                      <CreditCard className="h-6 w-6 text-[#003087]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">How PayPal fees work</h3>
                      <p className="text-sm text-zinc-600 dark:text-muted-foreground mb-3">
                        PayPal Advanced Checkout lets backers pay with their PayPal wallet or any major credit/debit card inline — no redirects.
                        All pledges flow into IndieCrowdfund&apos;s PayPal account, and your net earnings are deposited directly to your bank account at settlement — no PayPal account required.
                      </p>
                      <h4 className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">How the money flows (example: $100 pledge):</h4>
                      <ol className="text-sm text-zinc-600 dark:text-muted-foreground space-y-1 list-decimal list-inside mb-4">
                        <li>Backer pays $100 via PayPal or card at checkout</li>
                        <li>Full $100 collected into IndieCrowdfund&apos;s PayPal account</li>
                        <li>When your campaign funds, we calculate your settlement</li>
                        <li>PayPal processing fee ($3.98 for this pledge) deducted at settlement</li>
                        <li>Platform fee (3% of $100 = $3.00) deducted at settlement</li>
                        <li>You receive <strong>$93.02</strong> deposited directly to your bank account</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <TotalBadge color="bg-blue-50 dark:bg-blue-900/20 text-[#003087] dark:text-blue-400" text="Total fees with PayPal: approximately 6.5% of funds raised" />
            </TabsContent>

            {/* DivinityCoin */}
            <TabsContent value="divinitycoin">
              <FeeBreakdownCards fees={divinityCoinFeeBreakdown} iconBg="bg-gradient-to-br from-purple-500 to-pink-500" rateClass="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" Icon={Coins} />
              <Card className="mt-8 lg:max-w-4xl lg:mx-auto border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Coins className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">What is DivinityCoin?</h3>
                      <p className="text-sm text-zinc-600 dark:text-muted-foreground mb-3">
                        DivinityCoin is an alternative payment sub-processor that supports all content types including NSFW/adult projects.
                        Backers enter their credit or debit card at checkout — the experience is seamless.
                      </p>
                      <h4 className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">How the money flows (example: $100 pledge):</h4>
                      <ol className="text-sm text-zinc-600 dark:text-muted-foreground space-y-1 list-decimal list-inside mb-4">
                        <li>Backer enters their card at checkout on your campaign</li>
                        <li>DivinityCoin securely processes the $100 payment</li>
                        <li>When your project funds, payment is captured</li>
                        <li>DivinityCoin partner fee (3% = $3.00) deducted at settlement</li>
                        <li>Per-transaction fee ($0.30 × 1 txn = $0.30) deducted at settlement</li>
                        <li>Platform fee (3% of $96.70 = $2.90) deducted at settlement</li>
                        <li>You receive <strong>$93.80</strong> deposited to your account</li>
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
              <TotalBadge color="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" text="Total fees with DivinityCoin: approximately 6.5% of funds raised (varies with avg. pledge size)" />
            </TabsContent>

            {/* Stripe (Legacy) - hidden for now
            <TabsContent value="stripe">
              <FeeBreakdownCards fees={stripeFeeBreakdown} iconBg="bg-gradient-to-br from-emerald-500 to-teal-500" rateClass="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent" Icon={Percent} />
              <TotalBadge color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" text="Total fees with Stripe: approximately 6% of funds raised" />
            </TabsContent>
            */}
          </Tabs>
        </div>
      </section>

      {/* Interactive Calculator */}
      <section className="relative py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">Estimate Your Earnings</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Use the slider to see how much you&apos;ll take home at different funding levels
            </p>
          </div>

          <Card className="mt-12 glass-card border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: "100ms" }}>
            <CardContent className="p-8">
              {/* Payment method toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-lg border p-1 bg-white dark:bg-zinc-800 flex-wrap gap-1">
                  {(["paymentcloud"] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        paymentMethod === m
                          ? "bg-muted text-zinc-700 dark:bg-zinc-700 dark:text-muted-foreground"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-muted-foreground"
                      }`}
                    >
                      {m === "divinitycoin" ? "DivinityCoin" : m === "paymentcloud" ? "PaymentCloud" : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">$1,000</span>
                  <span className="text-2xl font-bold text-zinc-900 dark:text-white">${amount.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">$500,000</span>
                </div>
                <Slider value={sliderValue} onValueChange={setSliderValue} min={1000} max={500000} step={1000} className="w-full" />
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Small Campaign</span>
                  <span>Medium Campaign</span>
                  <span>Large Campaign</span>
                </div>
              </div>

              {/* Results */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Fee breakdown */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
                    Fee Breakdown ({methodLabel})
                  </h3>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-muted-foreground">Campaign raised</span>
                    <span className="font-medium">${amount.toLocaleString()}</span>
                  </div>

                  {paymentMethod === "paypal" ? (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Platform fee (3%)</span>
                        <span className="text-red-500">-${paypalFees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">PayPal processing (3.49% + $0.49/txn)</span>
                        <span className="text-red-500">-${paypalFees.processingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : paymentMethod === "paymentcloud" ? (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">PaymentCloud processing (4%)</span>
                        <span className="text-red-500">-${paymentCloudFees.paymentCloudFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Per-transaction fee ($0.38/txn)</span>
                        <span className="text-red-500">-${paymentCloudFees.perTransactionFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Platform fee (3% of net)</span>
                        <span className="text-red-500">-${paymentCloudFees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : paymentMethod === "whop" ? (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Whop processing fee (~3%)</span>
                        <span className="text-red-500">-${whopFees.whopFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Platform fee (3% of net)</span>
                        <span className="text-red-500">-${whopFees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">DivinityCoin partner fee (3%)</span>
                        <span className="text-red-500">-${divinityFees.divinityPartnerFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Per-transaction fee ($0.30/txn)</span>
                        <span className="text-red-500">-${divinityFees.perTransactionFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-zinc-600 dark:text-muted-foreground">Platform fee (3% of net)</span>
                        <span className="text-red-500">-${divinityFees.platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-zinc-600 dark:text-muted-foreground">Total fees</span>
                    <span className="text-red-500">
                      -${fees.totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({fees.feePercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* You receive */}
                <div className={`flex flex-col justify-center items-center rounded-xl p-8 ${methodColor.bg}`}>
                  <span className={`text-sm font-medium mb-2 ${methodColor.text}`}>You receive</span>
                  <span className={`text-5xl font-bold ${methodColor.text}`}>
                    ${fees.youReceive.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className={`text-sm mt-2 ${methodColor.text} opacity-70`}>
                    {((fees.youReceive / amount) * 100).toFixed(1)}% of funds raised
                  </span>
                </div>
              </div>

              {/* Quick comparison */}
              <div className="mt-8 pt-8 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Compare with other platforms at ${amount.toLocaleString()}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <div className={`text-center p-3 rounded-lg transition-all ring-2 ring-sky-400 bg-sky-50 dark:bg-sky-900/30`}>
                    <div className="text-xs text-muted-foreground mb-1">IndieCrowdfund (PaymentCloud)</div>
                    <div className="font-bold text-sky-600">${paymentCloudFees.youReceive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  {/* Legacy processor comparison cells hidden — PaymentCloud is the
                      only processor offered for new campaigns.
                  <div className={`text-center p-3 rounded-lg transition-all ${paymentMethod === "whop" ? "ring-2 ring-zinc-400 bg-muted dark:bg-zinc-700" : "bg-muted dark:bg-zinc-800"}`}>
                    <div className="text-xs text-muted-foreground mb-1">IndieCrowdfund (Whop)</div>
                    <div className="font-bold text-zinc-700 dark:text-muted-foreground">${whopFees.youReceive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className={`text-center p-3 rounded-lg transition-all ${paymentMethod === "paypal" ? "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/30" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                    <div className="text-xs text-muted-foreground mb-1">IndieCrowdfund (PayPal)</div>
                    <div className="font-bold text-blue-600">${paypalFees.youReceive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  */}
                  <div className="text-center p-3 bg-muted dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Kickstarter</div>
                    <div className="font-bold text-zinc-600 dark:text-muted-foreground">${(amount * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-center p-3 bg-muted dark:bg-zinc-800 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Indiegogo</div>
                    <div className="font-bold text-zinc-600 dark:text-muted-foreground">${(amount * 0.921).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Your savings ({methodLabel} vs Kickstarter)</div>
                    <div className={`font-bold ${fees.youReceive - amount * 0.92 >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {fees.youReceive - amount * 0.92 >= 0 ? "+" : ""}${(fees.youReceive - amount * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features included */}
      <section className="relative py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">What&apos;s Included</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Your platform fee covers everything you need to run a successful campaign
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="text-center glass-card rounded-2xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
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

      {/* Comparison table */}
      <section className="relative py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-muted/50" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">How We Compare</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Our fees are competitive with other major crowdfunding platforms
            </p>
          </div>
          <div className="mt-12 overflow-x-auto rounded-2xl border glass-card shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: "100ms" }}>
            <table className="w-full min-w-[500px]">
              <thead className="bg-muted/50 dark:bg-zinc-900">
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
                      {row.highlight && <Badge className="ml-2 bg-emerald-500">Lowest fees</Badge>}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-zinc-600 dark:text-muted-foreground">{row.platformFee}</td>
                    <td className="px-6 py-4 text-center text-sm text-zinc-600 dark:text-muted-foreground">{row.paymentFee}</td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-4 text-xl sm:text-3xl md:text-4xl font-bold tracking-tight">Common Questions</h2>
          </div>
          <div className="mt-12 space-y-6">
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold">When do I pay fees?</h3>
              <p className="mt-2 text-zinc-600 dark:text-muted-foreground">
                Fees are only deducted when your campaign successfully reaches its funding goal. If you don&apos;t reach your goal, you pay nothing.
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold">What payment processor does IndieCrowdfund use?</h3>
              <p className="mt-2 text-zinc-600 dark:text-muted-foreground">
                All new campaigns are processed through PaymentCloud (~7.5% total: 4% + $0.38/txn processing + 3% platform fee). PaymentCloud supports all content types including NSFW/adult projects, both All-or-Nothing and Keep-It-All campaign styles, and tokenizes cards in your browser via Collect.js so card data never touches our servers.
              </p>
            </div>
            <div className="rounded-lg border p-6">
              <h3 className="font-semibold">How quickly will I receive my funds?</h3>
              <p className="mt-2 text-zinc-600 dark:text-muted-foreground">
                Funds settle to your bank account on PaymentCloud&apos;s standard merchant schedule (typically within 1–2 business days of capture for funded campaigns).
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

      {/* CTA */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 animate-in fade-in zoom-in duration-500">
            <Gift className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white animate-in fade-in slide-in-from-bottom-4 duration-500">
            Ready to Launch Your Campaign?
          </h2>
          <p className="mt-4 text-xl text-emerald-100 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: "100ms" }}>
            Join thousands of creators bringing their ideas to life.
          </p>
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: "200ms" }}>
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
