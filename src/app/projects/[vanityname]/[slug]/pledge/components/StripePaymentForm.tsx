"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, ShieldCheck } from "lucide-react";

interface StripePaymentFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
  agreedToTerms?: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
  intentType: "payment_intent" | "setup_intent";
  pledgeId?: string | null;
  projectPath?: string;
  buttonLabel?: string;
  returnUrl?: string;
}

// Fire-and-forget diagnostic report to PM2 logs
function reportDiag(event: string, data: Record<string, unknown>) {
  fetch("/api/diagnostics/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data }),
  }).catch(() => { /* ignore */ });
}

function CardBrandLogos() {
  return (
    <div className="flex items-center gap-2">
      {/* Visa */}
      <div className="h-8 w-12 rounded border border-border bg-white flex items-center justify-center px-1">
        <svg viewBox="0 0 780 500" className="h-5 w-10">
          <path d="M293.2 348.7l33.4-195.8h53.4l-33.4 195.8h-53.4z" fill="#1A1F71"/>
          <path d="M533.7 157.5c-10.5-4-27.1-8.3-47.7-8.3-52.6 0-89.7 26.5-89.9 64.5-.3 28.1 26.5 43.7 46.7 53.1 20.8 9.6 27.8 15.7 27.7 24.3-.1 13.1-16.6 19.1-31.9 19.1-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56 0 92.3-26.2 92.7-66.8.2-22.3-14-39.2-44.8-53.2-18.6-9.1-30.1-15.1-30-24.3 0-8.1 9.7-16.8 30.6-16.8 17.5-.3 30.1 3.5 39.9 7.5l4.8 2.3 7.2-42.4h.2z" fill="#1A1F71"/>
          <path d="M610.1 152.9h-41.2c-12.8 0-22.3 3.5-27.9 16.2l-79.2 179.6h56s9.1-24.1 11.2-29.4c6.1 0 60.4.1 68.2.1 1.6 6.9 6.5 29.3 6.5 29.3h49.5l-43.1-195.8zm-65.4 126.3c4.4-11.3 21.3-54.7 21.3-54.7-.3.5 4.4-11.3 7.1-18.7l3.6 16.9s10.2 46.8 12.4 56.5h-44.4z" fill="#1A1F71"/>
          <path d="M247.8 152.9l-52.2 133.5-5.6-27.1c-9.7-31.2-39.8-65-73.5-81.9l47.8 171.2 56.4-.1 83.9-195.7h-56.8v.1z" fill="#1A1F71"/>
          <path d="M146.9 152.9H59.6l-.7 3.8c66.9 16.2 111.2 55.3 129.6 102.3l-18.7-90c-3.2-12.3-12.6-15.7-23.9-16.1z" fill="#F7A600"/>
        </svg>
      </div>
      {/* Mastercard */}
      <div className="h-8 w-12 rounded border border-border bg-white flex items-center justify-center">
        <svg viewBox="0 0 32 20" className="h-5 w-8">
          <circle cx="11" cy="10" r="7.5" fill="#EB001B" />
          <circle cx="21" cy="10" r="7.5" fill="#F79E1B" />
          <path d="M16 3.8a7.5 7.5 0 0 1 0 12.4 7.5 7.5 0 0 1 0-12.4z" fill="#FF5F00" />
        </svg>
      </div>
      {/* Amex */}
      <div className="h-8 w-12 rounded border border-border bg-[#006FCF] flex items-center justify-center">
        <svg viewBox="0 0 40 14" className="h-3 w-9">
          <text x="2" y="11" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="11" fill="white" letterSpacing="0.5">AMEX</text>
        </svg>
      </div>
      {/* Discover */}
      <div className="h-8 w-12 rounded border border-border bg-white flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 56 16" className="h-3.5 w-11">
          <rect x="0" y="0" width="56" height="16" fill="white" rx="1"/>
          <text x="3" y="12" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="9" fill="#231F20">DISC</text>
          <circle cx="38" cy="8" r="6" fill="#F47216"/>
          <text x="33" y="11" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="8" fill="white">VER</text>
        </svg>
      </div>
    </div>
  );
}

export function StripePaymentForm({
  onSuccess,
  onError,
  agreedToTerms = true,
  isProcessing,
  setIsProcessing,
  total,
  intentType,
  pledgeId,
  projectPath,
  buttonLabel,
  returnUrl,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  // Report Stripe initialization status to server (PM2 logs)
  useEffect(() => {
    if (stripe && elements) {
      reportDiag("elements_ready", { pledgeId, intentType, total });
    }
  }, [stripe, elements, pledgeId, intentType, total]);

  // Report if Stripe/Elements stay null for too long (form can't load)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!stripe || !elements) {
        reportDiag("elements_timeout", {
          pledgeId,
          intentType,
          stripeLoaded: !!stripe,
          elementsLoaded: !!elements,
        });
      }
    }, 8000); // 8s is plenty for Stripe.js to initialize
    return () => clearTimeout(timer);
  }, [stripe, elements, pledgeId, intentType]);

  const handleSubmit = async () => {
    if (!stripe || !elements || !agreedToTerms) {
      reportDiag("submit_blocked", {
        pledgeId,
        stripe: !!stripe,
        elements: !!elements,
        agreedToTerms,
      });
      return;
    }

    setIsProcessing(true);
    reportDiag("confirm_started", { pledgeId, intentType, total });

    try {
      const return_url = returnUrl ||
        `${window.location.origin}${projectPath || ""}/pledge?success=true${pledgeId ? `&pledgeId=${pledgeId}` : ""}`;

      let error;

      if (intentType === "setup_intent") {
        const result = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url,
          },
          redirect: "if_required",
        });
        error = result.error;
      } else {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url,
          },
          redirect: "if_required",
        });
        error = result.error;
      }

      if (error) {
        reportDiag("confirm_error", {
          pledgeId,
          intentType,
          errorType: error.type,
          errorCode: error.code,
          errorMessage: error.message,
        });
        onError(error.message || "Payment failed");
        setIsProcessing(false);
      } else {
        reportDiag("confirm_success", { pledgeId, intentType, total });
        onSuccess();
      }
    } catch (err) {
      reportDiag("confirm_exception", {
        pledgeId,
        intentType,
        error: err instanceof Error ? err.message : String(err),
      });
      onError("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  const label = buttonLabel || (intentType === "setup_intent" ? `Pledge $${total}` : `Pay $${total}`);

  return (
    <div className="space-y-4">
      {/* Secure payment header with card brands */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Secure Payment</span>
        </div>
        <CardBrandLogos />
      </div>

      {/* Stripe Payment Element */}
      <div className="rounded-lg">
        <PaymentElement
          options={{
            layout: {
              type: "tabs",
              defaultCollapsed: false,
            },
          }}
        />
      </div>

      {/* Security assurance */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Your payment information is encrypted and secure. We never store your card details.</span>
      </div>

      {/* Submit Button */}
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base shadow-lg shadow-emerald-600/20 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none transition-all"
        size="lg"
        onClick={handleSubmit}
        disabled={!stripe || !elements || !agreedToTerms || isProcessing}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            Processing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {label}
          </span>
        )}
      </Button>
    </div>
  );
}
