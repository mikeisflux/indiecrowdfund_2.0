"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

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
}: WhopPaymentFormProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const agreedToTermsRef = useRef(agreedToTerms);
  const mountedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    agreedToTermsRef.current = agreedToTerms;
  }, [agreedToTerms]);

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
        planId={planId}
        sessionId={sessionId}
        environment={environment}
        returnUrl={returnUrl}
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
      <p className="text-xs text-muted-foreground text-center">
        Secure checkout powered by Whop
      </p>
    </div>
  );
}

// Dynamic import of WhopCheckoutEmbed to avoid SSR issues
function WhopCheckoutEmbed({
  planId,
  sessionId,
  environment,
  returnUrl,
  onComplete,
  fallback,
}: {
  planId: string;
  sessionId: string;
  environment: "production" | "sandbox";
  returnUrl: string;
  onComplete: (planId: string, receiptId: string) => void;
  fallback: React.ReactNode;
}) {
  const [Component, setComponent] = useState<React.ComponentType<{
    planId: string;
    sessionId: string;
    environment: "production" | "sandbox";
    returnUrl: string;
    onComplete: (planId: string, receiptId: string) => void;
    fallback: React.ReactNode;
  }> | null>(null);

  useEffect(() => {
    import("@whop/checkout/react")
      .then((mod) => {
        setComponent(() => mod.WhopCheckoutEmbed as typeof Component);
      })
      .catch(() => {
        // Will show nothing — handled by parent error state
      });
  }, []);

  if (!Component) return <>{fallback}</>;

  return (
    <Component
      planId={planId}
      sessionId={sessionId}
      environment={environment}
      returnUrl={returnUrl}
      onComplete={onComplete}
      fallback={fallback}
    />
  );
}
