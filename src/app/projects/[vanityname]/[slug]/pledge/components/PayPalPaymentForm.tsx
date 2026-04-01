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
  clientToken: string | null;
  paypalMode: string;
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function PayPalPaymentForm({
  paypalOrderId,
  pledgeId,
  clientToken,
  paypalMode,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  onSuccess,
  onError,
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
    const scriptId = "paypal-sdk-v6";

    if (window.paypal) {
      setSdkReady(true);
      return;
    }

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      const onLoad = () => setSdkReady(true);
      const onErr = () => setLoadError("Failed to load PayPal SDK. Please refresh and try again.");
      existingScript.addEventListener("load", onLoad);
      existingScript.addEventListener("error", onErr);
      return () => {
        existingScript.removeEventListener("load", onLoad);
        existingScript.removeEventListener("error", onErr);
      };
    }

    // SDK v6: clientId is NOT in the URL — passed to createInstance via clientToken
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

    // Timeout fallback in case onload/onerror never fires
    const timeout = setTimeout(() => {
      if (!window.paypal) {
        setLoadError("PayPal SDK timed out. Please refresh and try again.");
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [paypalMode]);

  // Initialize PayPal v6 session and render button once SDK and clientToken are ready
  useEffect(() => {
    if (!sdkReady || !window.paypal || !clientToken || initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const container = containerRef.current;

    async function init() {
      try {
        // createInstance requires clientToken (not clientId) in v6
        const sdkInstance = await window.paypal.createInstance({
          clientToken,
          components: ["paypal-payments"],
          pageType: "checkout",
        });

        // Check eligibility before rendering button
        const methods = await sdkInstance.findEligibleMethods({ currencyCode: "USD" });

        if (!methods.isEligible("paypal")) {
          setLoadError("PayPal is not available for this transaction. Please contact support.");
          return;
        }

        const paypalSession = sdkInstance.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId }: { orderId: string }) => {
            setIsProcessing(true);
            try {
              const captureRes = await apiFetch(`/api/paypal/capture/${orderId}`, { method: "POST" });
              const captureData = await captureRes.json();
              if (!captureRes.ok) throw new Error(captureData.error || "Payment capture failed");
              await apiFetch(`/api/pledges/${pledgeId}/confirm`, { method: "POST" });
              onSuccess();
            } catch (err) {
              onError(err instanceof Error ? err.message : "Payment failed. Please try again.");
              setIsProcessing(false);
            }
          },
          onCancel: () => {
            setIsProcessing(false);
          },
          onError: (err: { message?: string }) => {
            onError(err?.message || "PayPal payment failed. Please try again.");
            setIsProcessing(false);
          },
        });

        // Handle redirect return (for redirect-based flows)
        if (typeof paypalSession.hasReturned === "function" && paypalSession.hasReturned()) {
          setIsProcessing(true);
          await paypalSession.resume();
          return;
        }

        // Render the PayPal button web component
        const button = document.createElement("paypal-button");
        button.setAttribute("type", "pay");
        button.className = "paypal-gold";
        container.appendChild(button);

        button.addEventListener("click", async () => {
          if (!agreedToTermsRef.current) {
            onError("Please agree to the terms and conditions before completing your pledge.");
            return;
          }
          setIsProcessing(true);
          try {
            // Pass the pre-created order ID as a resolved promise
            await paypalSession.start(
              { presentationMode: "auto" },
              Promise.resolve(paypalOrderId)
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
  }, [sdkReady, clientToken]);

  if (loadError) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {loadError}
      </div>
    );
  }

  if (!sdkReady || !clientToken) {
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
