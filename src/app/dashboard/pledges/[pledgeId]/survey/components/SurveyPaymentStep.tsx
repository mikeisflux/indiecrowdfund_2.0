"use client";

import { CreditCard, ChevronLeft, Lock, ShieldCheck, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Stripe } from "@stripe/stripe-js";
import { SurveyData } from "./types";

// Stripe Payment Form for Survey Addons
function SurveyPaymentForm({
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
  total,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/backer?tab=wallet`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        onError(result.error.message || "Payment failed");
        setIsProcessing(false);
      } else {
        onSuccess();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Secure payment header */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-3 border-b">
        <Lock className="h-4 w-4 text-emerald-600" />
        <span>Secure Payment</span>
      </div>

      <PaymentElement
        options={{
          layout: { type: "tabs", defaultCollapsed: false },
        }}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>Your payment information is encrypted and secure.</span>
      </div>

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base"
        size="lg"
        onClick={handleSubmit}
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Pay ${total.toFixed(2)}
          </span>
        )}
      </Button>
    </div>
  );
}

interface SurveyPaymentStepProps {
  data: SurveyData;
  selectedAddons: Record<string, number>;
  addonsTotal: number;
  clientSecret: string | null;
  stripePromise: Promise<Stripe | null> | null;
  isProcessingPayment: boolean;
  setIsProcessingPayment: (val: boolean) => void;
  paymentError: string | null;
  setPaymentError: (val: string | null) => void;
  setClientSecret: (val: string | null) => void;
  creatingPaymentRef: React.MutableRefObject<boolean>;
  onSuccess: () => void;
  onError: (message: string) => void;
  onPrev: () => void;
}

export function SurveyPaymentStep({
  data,
  selectedAddons,
  addonsTotal,
  clientSecret,
  stripePromise,
  isProcessingPayment,
  setIsProcessingPayment,
  paymentError,
  setPaymentError,
  setClientSecret,
  creatingPaymentRef,
  onSuccess,
  onError,
  onPrev,
}: SurveyPaymentStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Complete Payment
      </h2>

      <p className="text-sm text-muted-foreground">
        Your survey has been submitted. Complete your payment below to finalize your add-on purchases.
      </p>

      {/* Order Summary */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <h3 className="font-medium mb-3">Order Summary</h3>
          {data.availableAddons && Object.entries(selectedAddons)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => {
              const addon = data.availableAddons?.find((a) => a.id === id);
              if (!addon) return null;
              return (
                <div key={id} className="flex justify-between text-sm py-1">
                  <span>{addon.title} x{qty}</span>
                  <span>${(addon.price * qty).toFixed(2)}</span>
                </div>
              );
            })}
          <div className="flex justify-between font-semibold text-lg pt-3 mt-3 border-t">
            <span>Total</span>
            <span className="text-emerald-600">${addonsTotal.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Error */}
      {paymentError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 mb-2">{paymentError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPaymentError(null);
              setClientSecret(null);
              setIsProcessingPayment(false);
              creatingPaymentRef.current = false;
            }}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Payment Form — Stripe (Elements) for STRIPE/DC */}
      <Card>
        <CardContent className="py-5">
          {clientSecret && stripePromise ? (
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
                    ".Tab": { borderRadius: "8px", boxShadow: "none" },
                    ".Tab--selected": { borderColor: "#028858", boxShadow: "0 0 0 1.5px #028858" },
                    ".Input": { borderRadius: "8px", boxShadow: "none", padding: "10px 12px" },
                    ".Input:focus": { borderColor: "#028858", boxShadow: "0 0 0 1.5px #028858" },
                    ".Label": { fontWeight: "500", fontSize: "14px", marginBottom: "6px" },
                  },
                },
              }}
            >
              <SurveyPaymentForm
                onSuccess={onSuccess}
                onError={onError}
                isProcessing={isProcessingPayment}
                setIsProcessing={setIsProcessingPayment}
                total={addonsTotal}
              />
            </Elements>
          ) : !paymentError ? (
            <div className="flex flex-col items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Loading payment form...</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Review
        </Button>
      </div>
    </div>
  );
}
