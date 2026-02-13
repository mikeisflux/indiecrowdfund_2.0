"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
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
  total: number;
  agreedToTerms: boolean;
  currentPledgeId: string | null;
  handlePaymentSuccess: () => void;
  handlePaymentError: (message: string) => void;
  isProcessing: boolean;
  clientSecret: string | null;
  stripePromise: Promise<Stripe | null> | null;
  dcStripePromise: Promise<Stripe | null> | null;
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
  total,
  agreedToTerms,
  currentPledgeId,
  handlePaymentSuccess,
  handlePaymentError,
  isProcessing,
  clientSecret,
  stripePromise,
  dcStripePromise,
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

          {/* Show error if any - only for Stripe */}
          {paymentError && project?.paymentProcessor === "STRIPE" && (
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

          {/* Payment Form - DivinityCoin, Chain2Pay, or Stripe */}
          {project?.paymentProcessor === "DIVINITYCOIN" ? (
            /* DivinityCoin Payment - Card form via DC's Stripe account */
            clientSecret && dcStripePromise ? (
              <Elements
                stripe={dcStripePromise}
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
                  intentType="payment_intent"
                  pledgeId={currentPledgeId}
                  projectPath={projectPath}
                />
              </Elements>
            ) : (
              <div className="space-y-4">
                {paymentError ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-2">{paymentError}</p>
                    <Button
                      variant="outline"
                      size="sm"
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
                    <p className="text-sm text-muted-foreground">Loading payment form...</p>
                  </div>
                )}
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
