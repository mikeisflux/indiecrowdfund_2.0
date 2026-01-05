"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Coins } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { Stripe } from "@stripe/stripe-js";
import { ProjectData } from "../types";
import { StripePaymentForm } from "./StripePaymentForm";

interface PaymentStepProps {
  project: ProjectData | null;
  isAddItemsMode: boolean;
  paymentError: string | null;
  setPaymentError: (val: string | null) => void;
  setClientSecret: (val: string | null) => void;
  setIsProcessing: (val: boolean) => void;
  divinityCoinReady: boolean;
  divinityCoinBalance: number;
  total: number;
  agreedToTerms: boolean;
  currentPledgeId: string | null;
  handlePaymentSuccess: () => void;
  handlePaymentError: (message: string) => void;
  isProcessing: boolean;
  setDivinityCoinBalance: (val: number) => void;
  clientSecret: string | null;
  stripePromise: Promise<Stripe | null> | null;
  intentType: "payment_intent" | "setup_intent";
  projectPath: string;
}

export function PaymentStep({
  project,
  isAddItemsMode,
  paymentError,
  setPaymentError,
  setClientSecret,
  setIsProcessing,
  divinityCoinReady,
  divinityCoinBalance,
  total,
  agreedToTerms,
  currentPledgeId,
  handlePaymentSuccess,
  handlePaymentError,
  isProcessing,
  setDivinityCoinBalance,
  clientSecret,
  stripePromise,
  intentType,
  projectPath,
}: PaymentStepProps) {
  return (
    <div className="space-y-8">
      {/* Confirm payment method heading */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Confirm your payment method</h2>
        {isAddItemsMode ? (
          // Add-items mode - always charged immediately
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your payment method will be charged immediately for these additional items.
            You&apos;ll receive a confirmation email when your purchase is successfully processed.
          </p>
        ) : project && Number(project.currentAmount) >= Number(project.goalAmount) ? (
          // Campaign already funded - charged immediately
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This project has already reached its funding goal! Your payment method will be charged immediately
              when you complete your pledge. You&apos;ll receive a confirmation email when your pledge is successfully processed.
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Any shipping costs and applicable taxes will be charged separately, when the creator is ready to
              begin fulfillment.
            </p>
          </>
        ) : (
          // Campaign not yet funded - card saved for later
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We won&apos;t charge you at this time. If the project reaches its funding goal, your payment method will
              be charged when the campaign ends. You&apos;ll receive a confirmation email when your pledge is successfully processed.
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Any shipping costs and applicable taxes will be charged separately, when the creator is ready to
              begin fulfillment.
            </p>
          </>
        )}
      </div>

      {/* Collection plan */}
      <Card>
        <CardContent className="p-0">
          <h3 className="font-medium px-5 pt-5 pb-3">Collection plan</h3>

          {/* Pledge in full option */}
          <div className="border-t px-5 py-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="mt-0.5">
                <div className="w-5 h-5 rounded-full border-2 border-foreground flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
                </div>
              </div>
              <span className="font-medium">Pledge in full</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-medium mb-4">Payment</h3>

          {/* Show error if any - only for Stripe, not DivinityCoin */}
          {paymentError && project?.paymentProcessor !== "DIVINITYCOIN" && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{paymentError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentError(null);
                  setClientSecret(null);
                  setIsProcessing(false);
                  // This will trigger the useEffect to create a new pledge
                }}
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Payment Form - DivinityCoin or Stripe */}
          {project?.paymentProcessor === "DIVINITYCOIN" ? (
            /* DivinityCoin Payment */
            divinityCoinReady ? (
              <div className="space-y-4">
                {/* DivinityCoin Balance Card */}
                <div className="rounded-xl border-2 border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/5 via-white to-[#0066FF]/10 dark:from-[#0066FF]/10 dark:via-zinc-900 dark:to-[#0066FF]/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#0066FF] flex items-center justify-center">
                        <span className="text-white font-bold text-sm">D</span>
                      </div>
                      <span className="font-semibold text-[#0066FF]">DivinityCoin</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Your Balance</span>
                      <span className="font-semibold">${divinityCoinBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pledge Amount</span>
                      <span className="font-semibold">${total.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className={divinityCoinBalance >= total ? "text-emerald-600" : "text-red-500"}>
                          {divinityCoinBalance >= total ? "Remaining Balance" : "Additional Needed"}
                        </span>
                        <span className={`font-bold ${divinityCoinBalance >= total ? "text-emerald-600" : "text-red-500"}`}>
                          ${Math.abs(divinityCoinBalance - total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {divinityCoinBalance < total && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      You need ${(total - divinityCoinBalance).toFixed(2)} more in credits to complete this pledge.
                    </p>
                    <div className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
                      <p className="flex items-start gap-2">
                        <span className="font-semibold">1.</span>
                        <span>
                          <a
                            href="https://divinitycoin.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline"
                          >
                            Purchase DivinityCoin credits
                          </a>{" "}
                          - you&apos;ll receive a voucher code
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-semibold">2.</span>
                        <span>
                          <a
                            href="/dashboard/backer?tab=wallet"
                            className="font-semibold underline"
                          >
                            Redeem your code in your wallet
                          </a>{" "}
                          to add credits to your balance
                        </span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-semibold">3.</span>
                        <span>Return here to complete your pledge</span>
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white font-medium disabled:opacity-50"
                  size="lg"
                  onClick={async () => {
                    if (!agreedToTerms || divinityCoinBalance < total) return;
                    setIsProcessing(true);
                    try {
                      // Process DivinityCoin payment
                      const response = await fetch("/api/divinitycoin/pay", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
                        body: JSON.stringify({
                          pledgeId: currentPledgeId,
                          amount: total,
                        }),
                      });
                      const result = await response.json();
                      if (!response.ok) {
                        throw new Error(result.error || "Payment failed");
                      }
                      setDivinityCoinBalance(result.newBalance);
                      handlePaymentSuccess();
                    } catch (err) {
                      handlePaymentError(err instanceof Error ? err.message : "Payment failed");
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={!agreedToTerms || divinityCoinBalance < total || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 mr-2" />
                      Pay ${total.toFixed(2)} with DivinityCoin
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#0066FF] mb-3" />
                  <p className="text-sm text-muted-foreground">Loading DivinityCoin...</p>
                </div>
              </div>
            )
          ) : (
            /* Stripe Payment */
            clientSecret && stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#028858",
                    },
                  },
                }}
              >
                <StripePaymentForm
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  agreedToTerms={agreedToTerms}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                  total={total}
                  intentType={intentType}
                  pledgeId={currentPledgeId}
                  projectPath={projectPath}
                />
              </Elements>
            ) : (
              /* Loading state while creating pledge and loading Stripe */
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Loading payment form...</p>
                </div>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
