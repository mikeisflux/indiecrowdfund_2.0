"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

interface PayPalPaymentFormProps {
  paypalOrderId: string;
  pledgeId: string;
  clientId: string;
  paypalMode: string;
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
  onSuccess: () => void;
  onError: (message: string) => void;
  // Override the post-capture flow. Defaults to capturing via
  // /api/paypal/capture/[orderId] then calling
  // /api/pledges/[id]/confirm. Survey upcharges set
  // `upchargeConfirmUrl` to /api/pledges/[id]/confirm-add-items
  // which captures the order AND applies the items in one call --
  // skipping the standard capture step (it'd 404 because the
  // upcharge orderId isn't tied to a Pledge row).
  upchargeConfirmUrl?: string;
}

export function PayPalPaymentForm({
  paypalOrderId,
  pledgeId,
  clientId,
  paypalMode,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  onSuccess,
  onError,
  upchargeConfirmUrl,
}: PayPalPaymentFormProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const agreedToTermsRef = useRef(agreedToTerms);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync so click handler doesn't capture stale closure
  useEffect(() => {
    agreedToTermsRef.current = agreedToTerms;
  }, [agreedToTerms]);

  // Load PayPal SDK v6 core script
  useEffect(() => {
    if (!clientId) return;

    const scriptId = "paypal-sdk-v6";

    if (window.paypal) {
      setSdkReady(true);
      return;
    }

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      const handleLoad = () => setSdkReady(true);
      const handleErr = () => setLoadError("Failed to load PayPal SDK. Please refresh and try again.");
      existingScript.addEventListener("load", handleLoad);
      existingScript.addEventListener("error", handleErr);
      return () => {
        existingScript.removeEventListener("load", handleLoad);
        existingScript.removeEventListener("error", handleErr);
      };
    }

    // v6 SDK: no client-id in URL — passed to createInstance() later
    const sdkUrl =
      paypalMode === "sandbox"
        ? "https://www.sandbox.paypal.com/web-sdk/v6/core"
        : "https://www.paypal.com/web-sdk/v6/core";

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setLoadError("Failed to load PayPal SDK. Please refresh and try again.");
    };
    document.body.appendChild(script);

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (!window.paypal) {
        setLoadError("PayPal SDK timed out. Please refresh and try again.");
      }
    }, 20000);

    return () => clearTimeout(timeout);
  }, [clientId, paypalMode]);

  // Initialize PayPal v6 and render button once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal || !clientId || initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const container = containerRef.current;

    async function init() {
      try {
        // v6: createInstance with clientId (per official sample)
        const sdkInstance = await window.paypal.createInstance({
          clientId,
          components: ["paypal-payments"],
          pageType: "checkout",
        });

        // Check eligibility before showing button
        const methods = await sdkInstance.findEligibleMethods({ currencyCode: "USD" });

        if (!methods.isEligible("paypal")) {
          setLoadError("PayPal is not available for this transaction. Please contact support.");
          return;
        }

        // Create payment session with callbacks
        const paypalSession = sdkInstance.createPayPalOneTimePaymentSession({
          async onApprove(data: { orderId: string }) {
            setIsProcessing(true);
            try {
              if (upchargeConfirmUrl) {
                // Upcharge path: confirm-add-items captures the order
                // via the PayPal API itself AND applies the addon
                // items in one transactional call.
                const res = await apiFetch(upchargeConfirmUrl, { method: "POST" });
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || "Payment confirmation failed");
              } else {
                // Original-pledge path
                const captureRes = await apiFetch(`/api/paypal/capture/${data.orderId}`, { method: "POST" });
                const captureData = await captureRes.json();
                if (!captureRes.ok) throw new Error(captureData.error || "Payment capture failed");
                await apiFetch(`/api/pledges/${pledgeId}/confirm`, { method: "POST" });
              }
              onSuccess();
            } catch (err) {
              onError(err instanceof Error ? err.message : "Payment failed. Please try again.");
              setIsProcessing(false);
            }
          },
          onCancel() {
            setIsProcessing(false);
          },
          onError(err: { message?: string }) {
            onError(err?.message || "PayPal payment failed. Please try again.");
            setIsProcessing(false);
          },
        });

        // Render the <paypal-button> web component
        const button = document.createElement("paypal-button");
        button.setAttribute("type", "pay");
        button.id = "paypal-pay-button";
        container.appendChild(button);

        button.addEventListener("click", async () => {
          if (!agreedToTermsRef.current) {
            onError("Please agree to the terms and conditions before completing your pledge.");
            return;
          }
          setIsProcessing(true);
          try {
            // Per PayPal sample: pass promise reference, do NOT await before passing
            // createOrder returns { orderId: string }
            const createOrderPromise = Promise.resolve({ orderId: paypalOrderId });
            await paypalSession.start(
              { presentationMode: "auto" },
              createOrderPromise
            );
          } catch (err) {
            onError(err instanceof Error ? err.message : "Failed to start PayPal payment.");
            setIsProcessing(false);
          }
        });
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to initialize PayPal. Please refresh and try again."
        );
      }
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, clientId]);

  if (loadError) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {loadError}
      </div>
    );
  }

  if (!sdkReady) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Loading PayPal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pay with PayPal</p>
      <div
        ref={containerRef}
        id="paypal-button-container"
        className="min-h-[50px]"
        style={{ opacity: isProcessing ? 0.5 : 1, pointerEvents: isProcessing ? "none" : "auto" }}
      />
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing payment...
        </div>
      )}
    </div>
  );
}
