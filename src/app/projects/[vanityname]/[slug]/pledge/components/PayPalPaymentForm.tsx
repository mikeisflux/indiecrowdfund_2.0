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
  clientId,
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

  // Keep ref in sync so the click handler doesn't capture a stale closure
  useEffect(() => {
    agreedToTermsRef.current = agreedToTerms;
  }, [agreedToTerms]);

  // Load PayPal JS SDK v6
  useEffect(() => {
    if (!clientId) return;
    if (window.paypal) {
      setSdkReady(true);
      return;
    }

    const existingScript = document.getElementById("paypal-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => setSdkReady(true));
      return;
    }

    const sdkUrl =
      paypalMode === "sandbox"
        ? "https://www.sandbox.paypal.com/web-sdk/v6/core"
        : "https://www.paypal.com/web-sdk/v6/core";

    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => {
      setLoadError("Failed to load PayPal SDK. Please refresh and try again.");
    };
    document.body.appendChild(script);
  }, [clientId, paypalMode]);

  // Initialize PayPal session and render button once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal || initializedRef.current) return;
    initializedRef.current = true;

    const containerEl = document.getElementById("paypal-button-container");
    if (!containerEl) return;
    const container: HTMLElement = containerEl;

    async function init() {
      try {
        const handleApprove = async (orderId: string) => {
          setIsProcessing(true);
          try {
            const res = await apiFetch(`/api/paypal/capture/${orderId}`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Payment capture failed");
            await apiFetch(`/api/pledges/${pledgeId}/confirm`, { method: "POST" });
            onSuccess();
          } catch (err) {
            onError(err instanceof Error ? err.message : "Payment failed. Please try again.");
            setIsProcessing(false);
          }
        };

        const sdkInstance = await window.paypal.createInstance({
          clientId,
          components: ["paypal-payments"],
          pageType: "checkout",
        });

        const paymentSession = sdkInstance.createPayPalOneTimePaymentSession({
          onApprove: async (data: { orderId: string }) => {
            await handleApprove(data.orderId);
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
        if (paymentSession.hasReturned()) {
          setIsProcessing(true);
          await paymentSession.resume();
          return;
        }

        // Render PayPal button
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
            await paymentSession.start(
              { presentationMode: "auto" },
              Promise.resolve({ orderId: paypalOrderId })
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
  }, [sdkReady, paypalOrderId, pledgeId, clientId]);

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
        id="paypal-button-container"
        className="min-h-[44px]"
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
