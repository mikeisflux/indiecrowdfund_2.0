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

interface MarketplacePayPalFormProps {
  paypalOrderId: string;
  clientId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function MarketplacePayPalForm({
  paypalOrderId,
  clientId,
  onSuccess,
  onError,
}: MarketplacePayPalFormProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [cardFieldsReady, setCardFieldsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const initializedRef = useRef(false);

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

    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=card-fields,buttons&currency=USD`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setLoadError("Failed to load PayPal SDK. Please refresh and try again.");
    document.body.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    if (!sdkReady || !window.paypal || initializedRef.current) return;
    initializedRef.current = true;

    const handleApprove = async (orderId: string) => {
      setIsProcessing(true);
      setCardError(null);
      try {
        const res = await apiFetch(`/api/marketplace/paypal/capture/${orderId}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Payment capture failed");
        onSuccess();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Payment failed. Please try again.");
        setIsProcessing(false);
      }
    };

    if (window.paypal.CardFields) {
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
        cardFields.NameField({ placeholder: "Name on card" }).render("#mp-paypal-card-name");
        cardFields.NumberField({ placeholder: "Card number" }).render("#mp-paypal-card-number");
        cardFields.ExpiryField({ placeholder: "MM/YY" }).render("#mp-paypal-card-expiry");
        cardFields.CVVField({ placeholder: "CVV" }).render("#mp-paypal-card-cvv");
        setCardFieldsReady(true);

        const formEl = document.getElementById("mp-paypal-card-form");
        if (formEl) {
          (formEl as HTMLElement & { _paypalSubmit?: () => void })._paypalSubmit = () =>
            cardFields.submit();
        }
      }
    }

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
      }).render("#mp-paypal-wallet-button");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, paypalOrderId]);

  const handleCardSubmit = () => {
    setIsProcessing(true);
    setCardError(null);
    const formEl = document.getElementById("mp-paypal-card-form") as (HTMLElement & { _paypalSubmit?: () => void }) | null;
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
    <div className="space-y-5" id="mp-paypal-card-form">
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Pay with PayPal</p>
        <div id="mp-paypal-wallet-button" className="min-h-[44px]" />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or pay by card</span>
        </div>
      </div>

      {cardFieldsReady ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name on card</label>
            <div id="mp-paypal-card-name" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Card number</label>
            <div id="mp-paypal-card-number" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Expiry date</label>
              <div id="mp-paypal-card-expiry" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">CVV</label>
              <div id="mp-paypal-card-cvv" className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2" />
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
            disabled={isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
            ) : (
              <><CreditCard className="h-4 w-4 mr-2" />Pay with Card</>
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
