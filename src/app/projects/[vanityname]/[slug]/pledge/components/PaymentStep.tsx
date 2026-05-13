"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";
import type { Stripe } from "@stripe/stripe-js";
import { ProjectData } from "../types";
import { PayPalPaymentForm } from "./PayPalPaymentForm";
import { WhopPaymentForm } from "./WhopPaymentForm";
import { apiFetch } from "@/lib/fetch-utils";

// Dynamically import the DC/Stripe wrapper so Stripe.js only loads when payment is initiated
const DCPaymentWrapper = dynamic(() => import("./DCPaymentWrapper"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">Loading payment form...</p>
    </div>
  ),
});

interface PaymentStepProps {
  project: ProjectData | null;
  isAddItemsMode: boolean;
  isModifyMode?: boolean;
  modifyChargeAmount?: number | null;
  paymentError: string | null;
  setPaymentError: (val: string | null) => void;
  setClientSecret: (val: string | null) => void;
  setIsProcessing: (val: boolean) => void;
  total: number;
  agreedToTerms: boolean;
  currentPledgeId: string | null;
  handlePaymentSuccess: () => void;
  handlePaymentError: (message: string) => void;
  isProcessing: boolean;
  clientSecret: string | null;
  dcStripePromise: Promise<Stripe | null> | null;
  projectPath: string;
  paypalOrderId: string | null;
  paypalClientId: string | null;
  paypalMode: string;
  whopSessionId: string | null;
  whopPlanId: string | null;
  whopEnvironment: "production" | "sandbox";
  // Drives Stripe-based forms (DC) — "setup_intent" for AoN-unfunded
  // DC pledges that save the card now and defer the charge to the
  // success cron, "payment_intent" for KIA / already-funded AoN.
  intentType: "payment_intent" | "setup_intent";
}

const isEmailVerificationError = (error: string | null) =>
  !!error && error.toLowerCase().includes("verify your email");

function ResendVerificationButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResend = async () => {
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await apiFetch("/api/user/verify-email", { method: "POST" });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      // Pull the real server-side reason ("address is on our blocklist",
      // "provider down", rate-limit, etc.) so the user knows what to do
      // — generic "try again" was masking real failures (Jeremy's
      // verify-email bug, May 2026).
      let msg = "Failed to send. Please try again.";
      try {
        const data = await res.json();
        if (data?.error && typeof data.error === "string") {
          msg = data.error;
        }
      } catch {
        // Body wasn't JSON — keep the generic message.
      }
      setErrorMsg(msg);
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex flex-col gap-1 mt-2">
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <MailCheck className="h-4 w-4" />
          Verification email sent! Check your inbox.
        </div>
        <div className="text-xs text-muted-foreground pl-6">
          Don&apos;t see it? Check spam or promotions. Search Gmail for
          <span className="font-mono"> from:noreply@indiecrowdfund.com</span>.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 mt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={status === "sending"}
      >
        {status === "sending" ? (
          <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending...</>
        ) : (
          "Resend verification email"
        )}
      </Button>
      {status === "error" && errorMsg && (
        <p className="text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}

export function PaymentStep({
  project,
  isAddItemsMode,
  isModifyMode = false,
  modifyChargeAmount,
  paymentError,
  setPaymentError,
  setClientSecret,
  setIsProcessing,
  total,
  agreedToTerms,
  currentPledgeId,
  handlePaymentSuccess,
  handlePaymentError,
  isProcessing,
  clientSecret,
  dcStripePromise,
  projectPath,
  paypalOrderId,
  paypalClientId,
  paypalMode,
  whopSessionId,
  whopPlanId,
  whopEnvironment,
  intentType,
}: PaymentStepProps) {
  // In modify mode, show the charge amount (difference), not the full total
  const displayTotal = isModifyMode && modifyChargeAmount != null ? modifyChargeAmount : total;
  return (
    <div className="space-y-8">
      {/* Confirm payment method heading */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Confirm your payment method</h2>
        {isModifyMode ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            You&apos;re modifying your pledge. Only the additional amount of{" "}
            <span className="font-semibold text-foreground">${displayTotal.toFixed(2)}</span>{" "}
            will be charged to your payment method.
          </p>
        ) : isAddItemsMode ? (
          // Add-items mode - always charged immediately
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your payment method will be charged immediately for these additional items.
            You&apos;ll receive a confirmation email when your purchase is successfully processed.
          </p>
        ) : project?.campaignType === "KEEP_IT_ALL" ? (
          // Keep It All - always charged immediately regardless of funding progress
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This is a <strong>Keep It All</strong> campaign — your payment method will be charged immediately
              when you complete your pledge. The creator keeps all pledges regardless of whether the funding goal is reached.
              You&apos;ll receive a confirmation email when your pledge is successfully processed.
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Any shipping costs and applicable taxes will be charged separately, when the creator is ready to
              begin fulfillment.
            </p>
          </>
        ) : project && Number(project.currentAmount) >= Number(project.goalAmount) ? (
          // All or Nothing - campaign already funded - charged immediately
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
          // All or Nothing - not yet funded - card saved for later
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

          {/* Show error if any - Stripe removed, kept for DivinityCoin fallback */}
          {/* {paymentError && project?.paymentProcessor === "STRIPE" && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
              {isEmailVerificationError(paymentError) ? (
                <ResendVerificationButton />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setPaymentError(null);
                    setClientSecret(null);
                    setIsProcessing(false);
                  }}
                >
                  Try Again
                </Button>
              )}
            </div>
          )} */}

          {/* Payment Form — DivinityCoin / PayPal / Whop are the supported
              processors. Stripe path remains commented out below for the
              legacy campaigns that still have it stored. */}
          {project?.paymentProcessor === "WHOP" ? (
            /* Whop Embedded Checkout */
            whopSessionId && whopPlanId && currentPledgeId ? (
              <WhopPaymentForm
                sessionId={whopSessionId}
                planId={whopPlanId}
                pledgeId={currentPledgeId}
                environment={whopEnvironment}
                agreedToTerms={agreedToTerms}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                total={displayTotal}
              />
            ) : paymentError ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setPaymentError(null);
                    setIsProcessing(false);
                  }}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Loading Whop checkout...</p>
              </div>
            )
          ) : project?.paymentProcessor === "PAYPAL" ? (
            /* PayPal Advanced Checkout - inline card fields + PayPal wallet button */
            paypalOrderId && paypalClientId && currentPledgeId ? (
              <PayPalPaymentForm
                paypalOrderId={paypalOrderId}
                pledgeId={currentPledgeId}
                clientId={paypalClientId}
                paypalMode={paypalMode}
                agreedToTerms={agreedToTerms}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                total={displayTotal}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            ) : paymentError ? (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setPaymentError(null);
                    setClientSecret(null);
                    setIsProcessing(false);
                  }}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Loading PayPal...</p>
              </div>
            )
          ) : project?.paymentProcessor === "DIVINITYCOIN" ? (
            /* DivinityCoin Payment - Card form via DC's Stripe account (lazily loaded) */
            clientSecret && dcStripePromise ? (
              <DCPaymentWrapper
                clientSecret={clientSecret}
                dcStripePromise={dcStripePromise}
                pledgeId={currentPledgeId}
                projectPath={projectPath}
                agreedToTerms={agreedToTerms}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                displayTotal={displayTotal}
                isModifyMode={isModifyMode}
                intentType={intentType}
              />
            ) : (
              <div className="space-y-4">
                {paymentError ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
                    {isEmailVerificationError(paymentError) ? (
                      <ResendVerificationButton />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setPaymentError(null);
                          setClientSecret(null);
                          setIsProcessing(false);
                        }}
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Loading payment form...</p>
                  </div>
                )}
              </div>
            )
          ) : (
            /* Stripe Payment - DISABLED: Replaced by PayPal */
            /* clientSecret && stripePromise ? (
              <Elements
                key={clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#028858",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      borderRadius: "8px",
                      spacingUnit: "5px",
                    },
                    rules: {
                      ".Tab": {
                        borderRadius: "8px",
                        boxShadow: "none",
                      },
                      ".Tab--selected": {
                        borderColor: "#028858",
                        boxShadow: "0 0 0 1.5px #028858",
                      },
                      ".Input": {
                        borderRadius: "8px",
                        boxShadow: "none",
                        padding: "10px 12px",
                      },
                      ".Input:focus": {
                        borderColor: "#028858",
                        boxShadow: "0 0 0 1.5px #028858",
                      },
                      ".Label": {
                        fontWeight: "500",
                        fontSize: "14px",
                        marginBottom: "6px",
                      },
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
                  total={displayTotal}
                  intentType={intentType}
                  pledgeId={currentPledgeId}
                  projectPath={projectPath}
                  buttonLabel={isModifyMode ? `Pay Additional $${displayTotal.toFixed(2)}` : undefined}
                />
              </Elements>
            ) : paymentError ? null : (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Loading payment form...</p>
                </div>
              </div>
            ) */
            paymentError ? null : (
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
