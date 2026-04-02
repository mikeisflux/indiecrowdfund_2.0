"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/fetch-utils";

interface WhopCheckoutEmbedControls {
  submit: (opts?: unknown) => Promise<void>;
  getEmail: (timeout?: number) => Promise<string>;
  setEmail: (email: string, timeout?: number) => Promise<void>;
  setAddress: (address: unknown, timeout?: number) => Promise<void>;
  getAddress: (timeout?: number) => Promise<{ address: unknown; isComplete: boolean }>;
}

interface WhopPaymentFormProps {
  sessionId: string;
  planId: string;
  pledgeId: string;
  environment: "production" | "sandbox";
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  total: number;
}

export function WhopPaymentForm({
  sessionId,
  planId,
  pledgeId,
  environment,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  onSuccess,
  onError,
  total,
}: WhopPaymentFormProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkoutRef = useRef<WhopCheckoutEmbedControls | null>(null);
  const mountedRef = useRef(false);

  // Handle payment completion from Whop embed redirect
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const status = url.searchParams.get("status");
    const receiptId = url.searchParams.get("receiptId");

    if (status === "success" && receiptId && !mountedRef.current) {
      mountedRef.current = true;
      setIsProcessing(true);

      apiFetch(`/api/whop/confirm/${pledgeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId }),
      })
        .then((res) => {
          if (res.ok) {
            onSuccess();
          } else {
            return res.json().then((d) => onError(d.error || "Payment confirmation failed"));
          }
        })
        .catch(() => onError("Failed to confirm payment"))
        .finally(() => setIsProcessing(false));
    } else if (status === "error") {
      setLoadError("Payment was cancelled or failed. Please try again.");
    }
  }, [pledgeId, onSuccess, onError, setIsProcessing]);

  const handlePayNow = async () => {
    if (!agreedToTerms) {
      onError("Please agree to the terms and conditions before completing your pledge.");
      return;
    }
    if (!checkoutRef.current) {
      onError("Checkout is not ready. Please wait a moment and try again.");
      return;
    }
    setIsSubmitting(true);
    try {
      await checkoutRef.current.submit();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!agreedToTerms) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Please agree to the terms and conditions above to continue.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Confirming your payment...</p>
      </div>
    );
  }

  const returnUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/projects/${encodeURIComponent(window.location.pathname.split("/")[2] || "")}/${encodeURIComponent(window.location.pathname.split("/")[3] || "")}/pledge?status=success&pledgeId=${pledgeId}`;

  return (
    <div className="space-y-4">
      <WhopCheckoutEmbed
        ref={checkoutRef}
        planId={planId}
        sessionId={sessionId}
        environment={environment}
        returnUrl={returnUrl}
        hideSubmitButton={true}
        onComplete={() => {
          setIsProcessing(true);
          apiFetch(`/api/whop/confirm/${pledgeId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
            .then((res) => {
              if (res.ok) {
                onSuccess();
              } else {
                return res.json().then((d) => onError(d.error || "Payment confirmation failed"));
              }
            })
            .catch(() => onError("Failed to confirm payment"))
            .finally(() => setIsProcessing(false));
        }}
        fallback={
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading checkout...</p>
          </div>
        }
      />
      <Button
        className="w-full"
        size="lg"
        onClick={handlePayNow}
        disabled={isSubmitting || isProcessing}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing...
          </>
        ) : (
          <>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Pay now &middot; ${total.toFixed(2)}
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Secure checkout powered by Whop
      </p>
    </div>
  );
}

// Dynamic import wrapper that forwards the ref to the SDK component
const WhopCheckoutEmbed = forwardRef<
  WhopCheckoutEmbedControls,
  {
    planId: string;
    sessionId: string;
    environment: "production" | "sandbox";
    returnUrl: string;
    hideSubmitButton: boolean;
    onComplete: (planId: string, receiptId: string) => void;
    fallback: React.ReactNode;
  }
>(function WhopCheckoutEmbedInner(props, ref) {
  const [Component, setComponent] = useState<React.ForwardRefExoticComponent<
    {
      planId: string;
      sessionId: string;
      environment: "production" | "sandbox";
      returnUrl: string;
      hideSubmitButton: boolean;
      onComplete: (planId: string, receiptId: string) => void;
      fallback: React.ReactNode;
    } & React.RefAttributes<WhopCheckoutEmbedControls>
  > | null>(null);

  useEffect(() => {
    import("@whop/checkout/react")
      .then((mod) => {
        setComponent(
          () =>
            mod.WhopCheckoutEmbed as typeof Component
        );
      })
      .catch(() => {
        // Will show nothing — handled by parent error state
      });
  }, []);

  if (!Component) return <>{props.fallback}</>;

  return <Component ref={ref} {...props} />;
});
