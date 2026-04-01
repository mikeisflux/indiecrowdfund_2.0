"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
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
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  total,
  onSuccess,
  onError,
}: PayPalPaymentFormProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [cardFieldsReady, setCardFieldsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Load PayPal JS SDK — try with card-fields first, fall back to buttons-only
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

    const loadSdk = (components: string) => {
      // Remove any previous failed script
      const prev = document.getElementById("paypal-sdk");
      if (prev) prev.remove();

      const script = document.createElement("script");
      script.id = "paypal-sdk";
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=${components}&currency=USD`;
      script.async = true;
      script.onload = () => setSdkReady(true);
      script.onerror = () => {
        if (components === "card-fields,buttons") {
          // card-fields not approved for this account — retry with buttons only
          loadSdk("buttons");
        } else {
          setLoadError("Failed to load PayPal SDK. Please refresh and try again.");
        }
      };
      document.body.appendChild(script);
    };

    loadSdk("card-fields,buttons");
  }, [clientId]);

  // Initialize card fields once SDK is ready
  useEffect(() => {
    if (!sdkReady || !window.paypal || initializedRef.current) return;
    if (!window.paypal.CardFields) {
      // Advanced card fields not supported in this environment
      setCardFieldsReady(false);
      return;
    }
    initializedRef.current = true;

    const handleApprove = async (orderId: string) => {
      setIsProcessing(true);
      setCardError(null);
      try {
        const res = await apiFetch(`/api/paypal/capture/${orderId}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Payment capture failed");
        // Confirm pledge stats
        await apiFetch(`/api/pledges/${pledgeId}/confirm`, { method: "POST" });
        onSuccess();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Payment failed. Please try again.");
        setIsProcessing(false);
      }
    };

    // Initialize inline card fields
    const cardFields = window.paypal.CardFields({
      createOrder: () => paypalOrderId,
      onApprove: (data: { orderID: string }) => handleApprove(data.orderID),
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Card payment failed. Please try again.";
        setCardError(msg);
        setIsProcessing(false);
      },
      style: {
        input: {
          "font-size": "14px",
          "font-family": "system-ui, -apple-system, sans-serif",
          color: "inherit",
        },
        ".valid": { color: "#15803d" },
        ".invalid": { color: "#dc2626" },
      },
    });

    if (cardFields.isEligible()) {
      cardFields.NameField({ placeholder: "Name on card" }).render("#paypal-card-name");
      cardFields.NumberField({ placeholder: "Card number" }).render("#paypal-card-number");
      cardFields.ExpiryField({ placeholder: "MM/YY" }).render("#paypal-card-expiry");
      cardFields.CVVField({ placeholder: "CVV" }).render("#paypal-card-cvv");
      setCardFieldsReady(true);

      // Store submit handler on the element for the button click
      const formEl = document.getElementById("paypal-card-form");
      if (formEl) {
        (formEl as HTMLElement & { _paypalSubmit?: () => void })._paypalSubmit = () =>
          cardFields.submit();
      }
    }

    // Render PayPal wallet button
    if (window.paypal.Buttons) {
      window.paypal.Buttons({
        createOrder: () => paypalOrderId,
        onApprove: (data: { orderID: string }) => handleApprove(data.orderID),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "PayPal payment failed. Please try again.";
          onError(msg);
          setIsProcessing(false);
        },
        style: { layout: "horizontal", color: "gold", shape: "rect", label: "pay", height: 44 },
      }).render("#paypal-wallet-button");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, paypalOrderId, pledgeId]);

  const handleCardSubmit = () => {
    if (!agreedToTerms) {
      onError("Please agree to the terms and conditions before completing your pledge.");
      return;
    }
    setIsProcessing(true);
    setCardError(null);
    const formEl = document.getElementById("paypal-card-form") as (HTMLElement & { _paypalSubmit?: () => void }) | null;
    if (formEl?._paypalSubmit) {
      formEl._paypalSubmit();
    }
  };

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
    <div className="space-y-5" id="paypal-card-form">
      {/* PayPal wallet button */}
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Pay with PayPal</p>
        <div id="paypal-wallet-button" className="min-h-[44px]" />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or pay by card</span>
        </div>
      </div>

      {/* Advanced inline card fields */}
      {cardFieldsReady ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name on card</label>
            <div
              id="paypal-card-name"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Card number</label>
            <div
              id="paypal-card-number"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Expiry date</label>
              <div
                id="paypal-card-expiry"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">CVV</label>
              <div
                id="paypal-card-cvv"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              />
            </div>
          </div>

          {cardError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {cardError}
            </div>
          )}

          <Button
            onClick={handleCardSubmit}
            disabled={isProcessing || !agreedToTerms}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
            ) : (
              <><CreditCard className="h-4 w-4 mr-2" />Pay ${total.toFixed(2)} with Card</>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 border border-dashed rounded-lg text-muted-foreground text-sm gap-2">
          <CreditCard className="h-6 w-6" />
          <p>Card fields not available. Use the PayPal button above.</p>
        </div>
      )}
    </div>
  );
}
