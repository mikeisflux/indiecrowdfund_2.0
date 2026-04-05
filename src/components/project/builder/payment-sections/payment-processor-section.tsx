"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, AlertTriangle, CheckCircle, Banknote, Wallet, ShoppingBag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PaymentProcessorSectionProps } from "./types";

export function PaymentProcessorSection({
  payment,
  updatePayment,
  mustUseAltProcessor,
  campaignType,
  isLaunched,
  goalAmount,
  platformFee,
  paypalFee,
  paypalTotalFees,
  paypalNetAmount,
  whopFee,
  whopTotalFees,
  whopNetAmount,
}: PaymentProcessorSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Payment Processing</h3>
        <p className="text-sm text-muted-foreground">
          Select how you want to receive payments from backers
        </p>
      </div>

      {isLaunched && (
        <Alert className="bg-amber-50/50 dark:bg-amber-900/20 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Payment processor locked</AlertTitle>
          <AlertDescription>
            The payment processor cannot be changed once a campaign is live.
          </AlertDescription>
        </Alert>
      )}

      {mustUseAltProcessor && (
        <Alert className="bg-amber-50/50 dark:bg-amber-900/20 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Stripe Not Available</AlertTitle>
          <AlertDescription>
            Projects with adult or controversial content cannot use Stripe for payment processing.
            PayPal, DivinityCoin, and Whop are all available and fully supported.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* PayPal Option — first / recommended */}
        <Card
          className={`cursor-pointer transition-all ${
            payment.paymentProcessor === "PAYPAL" ? "border-2 border-primary" : "border"
          } ${isLaunched ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => !isLaunched && updatePayment({ paymentProcessor: "PAYPAL" })}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#003087] flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                PayPal
                <Badge variant="secondary" className="ml-2">Recommended</Badge>
              </CardTitle>
              {payment.paymentProcessor === "PAYPAL" && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>
            <CardDescription>PayPal & card payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>~6.5% total fees (3.49% + $0.49 + 3% platform)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>Credit/debit cards + PayPal wallet</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>Inline Advanced Checkout form</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DivinityCoin Option */}
        <Card
          className={`cursor-pointer transition-all ${
            payment.paymentProcessor === "DIVINITYCOIN" ? "border-2 border-primary" : "border"
          } ${isLaunched ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => !isLaunched && updatePayment({ paymentProcessor: "DIVINITYCOIN" })}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#0066FF] flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-white" />
                </div>
                DivinityCoin
              </CardTitle>
              {payment.paymentProcessor === "DIVINITYCOIN" && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>
            <CardDescription>
              Universal credit system for all content types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>~6% total fees (3% partner + 3% platform)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>Settlements within 14 business days</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>All content types supported</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Whop Option */}
        <Card
          className={`cursor-pointer transition-all ${
            payment.paymentProcessor === "WHOP" ? "border-2 border-primary" : "border"
          } ${campaignType === "ALL_OR_NOTHING" || isLaunched ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => campaignType === "KEEP_IT_ALL" && !isLaunched && updatePayment({ paymentProcessor: "WHOP" })}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                Whop
                {campaignType === "ALL_OR_NOTHING" ? (
                  <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400">Keep It All only</Badge>
                ) : (
                  <Badge variant="secondary" className="ml-2">Available</Badge>
                )}
              </CardTitle>
              {payment.paymentProcessor === "WHOP" && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>
            <CardDescription>
              {campaignType === "ALL_OR_NOTHING"
                ? "Not available for All or Nothing campaigns"
                : "Embedded checkout via Whop — supports all content types"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>~6% total fees (3% Whop + 3% platform)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>Credit/debit cards via embedded checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                <span>Supports adult/controversial content</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Option - DISABLED: Replaced by PayPal */}
        {/* <Card> ... </Card> */}

      </div>

      {/* Stripe Fee Calculator - DISABLED: Replaced by PayPal */}
      {/* {payment.paymentProcessor === "STRIPE" && (
        <div className="rounded-lg bg-muted/50 p-4 border">
          <h4 className="font-medium mb-3">
            Stripe Fee Breakdown for {formatCurrency(goalAmount)} Goal
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Stripe processing fee (~2.9% + $0.30/txn)</span>
              <span className="font-medium">{formatCurrency(stripeFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee (3%)</span>
              <span className="font-medium">{formatCurrency(platformFee)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total fees</span>
              <span className="text-amber-600">{formatCurrency(totalFees)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>You receive</span>
              <span className="text-green-600">{formatCurrency(netAmount)}</span>
            </div>
          </div>
        </div>
      )} */}

      {payment.paymentProcessor === "DIVINITYCOIN" && (
        <>
        <Alert className="bg-gradient-to-r from-blue-50/80 to-sky-50/80 dark:from-blue-900/20 dark:to-sky-900/20 border-[#0066FF]/30 dark:border-[#0066FF]/40">
          <Banknote className="h-4 w-4 text-[#0066FF]" />
          <AlertTitle>Why Choose DivinityCoin?</AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p>
              <strong>Content Freedom:</strong> Unlike traditional payment processors, DivinityCoin has no content restrictions.
              Your campaign cannot be taken down or have payments frozen due to adult, mature, or controversial content in your project.
            </p>
            <p>
              <strong>Protection from Processor Policies:</strong> Stripe and other traditional processors can refuse service
              or freeze funds at any time based on their content policies. With DivinityCoin, your funds are secure and protected
              from arbitrary policy changes.
            </p>
            <p>
              <strong>Pre-funded Payments:</strong> Backers purchase DivinityCoin credits in advance, meaning when they pledge
              to your campaign, the funds are already secured. This eliminates failed payment issues common with traditional
              card processing.
            </p>
            <a
              href="https://divinitycoin.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#0066FF] hover:text-[#0052CC] hover:underline font-medium"
            >
              Learn more about DivinityCoin <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

        <div className="rounded-lg bg-muted/50 p-4 border">
          <h4 className="font-medium mb-3">
            DivinityCoin Fee Breakdown for {formatCurrency(goalAmount)} Goal
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>DivinityCoin partner fee (3%)</span>
              <span className="font-medium">{formatCurrency(goalAmount * 0.03)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee (3%)</span>
              <span className="font-medium">{formatCurrency((goalAmount - goalAmount * 0.03) * 0.03)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total fees</span>
              <span className="text-[#0066FF]">
                {formatCurrency(goalAmount * 0.03 + (goalAmount - goalAmount * 0.03) * 0.03)}
              </span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>You receive</span>
              <span className="text-green-600">
                {formatCurrency(goalAmount - goalAmount * 0.03 - (goalAmount - goalAmount * 0.03) * 0.03)}
              </span>
            </div>
          </div>
        </div>
        </>
      )}

      {payment.paymentProcessor === "PAYPAL" && (
        <div className="rounded-lg bg-muted/50 p-4 border">
          <h4 className="font-medium mb-3">
            PayPal Fee Breakdown for {formatCurrency(goalAmount)} Goal
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>PayPal processing fee (3.49% + $0.49/txn)</span>
              <span className="font-medium">{formatCurrency(paypalFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee (3%)</span>
              <span className="font-medium">{formatCurrency(platformFee)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total fees</span>
              <span className="text-amber-600">{formatCurrency(paypalTotalFees)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>You receive</span>
              <span className="text-green-600">{formatCurrency(paypalNetAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {payment.paymentProcessor === "WHOP" && (
        <div className="rounded-lg bg-muted/50 p-4 border">
          <h4 className="font-medium mb-3">
            Whop Fee Breakdown for {formatCurrency(goalAmount)} Goal
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Whop processing fee (~3%)</span>
              <span className="font-medium">{formatCurrency(whopFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee (3%)</span>
              <span className="font-medium">{formatCurrency(platformFee)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <span>Total fees</span>
              <span className="text-amber-600">{formatCurrency(whopTotalFees)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg">
              <span>You receive</span>
              <span className="text-green-600">{formatCurrency(whopNetAmount)}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
