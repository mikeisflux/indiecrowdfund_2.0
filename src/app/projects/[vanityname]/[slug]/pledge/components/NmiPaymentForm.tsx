"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

// PaymentCloud (NMI) Collect.js inline form. The script is loaded with
// `data-tokenization-key={publicKey}` and the actual card fields render
// inside iframes Collect.js injects into our placeholder divs — the PAN
// never enters our DOM. On submit we call CollectJS.startPaymentRequest()
// to get a single-use payment_token, then hand it to the confirm-nmi
// endpoint which exchanges it for a stable Customer Vault id.

declare global {
  interface Window {
    CollectJS?: {
      configure: (opts: Record<string, unknown>) => void;
      startPaymentRequest: (event?: unknown) => void;
      closePaymentRequest?: () => void;
    };
  }
}

interface CollectJsResponse {
  tokenType: string;
  token: string;
  card?: {
    number?: string;
    bin?: string;
    exp?: string;
    type?: string;
  };
}

interface NmiPaymentFormProps {
  publicKey: string;
  pledgeId: string;
  isKeepItAll: boolean;
  total: number;
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}

export function NmiPaymentForm({
  publicKey,
  pledgeId,
  isKeepItAll,
  total,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  onSuccess,
  onError,
}: NmiPaymentFormProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const setIsProcessingRef = useRef(setIsProcessing);
  const pledgeIdRef = useRef(pledgeId);
  // Keep refs current so the Collect.js callback (registered once on
  // mount) sees the latest handlers/pledge id without re-registering.
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    setIsProcessingRef.current = setIsProcessing;
    pledgeIdRef.current = pledgeId;
  }, [onSuccess, onError, setIsProcessing, pledgeId]);

  useEffect(() => {
    if (!publicKey) return;
    if (typeof window === "undefined") return;
    // Script may already be loaded from a prior mount.
    if (window.CollectJS) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-collectjs]"
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://paymentcloud.transactiongateway.com/token/Collect.js";
    script.async = true;
    script.dataset.collectjs = "true";
    script.setAttribute("data-tokenization-key", publicKey);
    script.addEventListener("load", () => setScriptReady(true), { once: true });
    script.addEventListener("error", () => {
      onErrorRef.current("Failed to load card form. Please refresh and try again.");
    });
    document.body.appendChild(script);
  }, [publicKey]);

  useEffect(() => {
    if (!scriptReady || !window.CollectJS) return;
    // Configure once. Subsequent calls would re-mount the iframes.
    // Keep this config minimal and match the official Collect.js React demo's
    // shape exactly — `paymentSelector` and `fieldsAvailableCallback` are
    // documented as `data-*` attributes but trip Collect.js's JS-API
    // validator with "Unexpected fields for collectjs" when passed via
    // configure(). We trigger startPaymentRequest manually from our
    // form's onSubmit handler instead, and treat fields as ready as soon
    // as the script loads (Collect.js mounts iframes synchronously after
    // configure() returns).
    window.CollectJS.configure({
      variant: "inline",
      styleSniffer: "true",
      fields: {
        ccnumber: {
          selector: "#nmi-ccnumber",
          placeholder: "Card number",
        },
        ccexp: {
          selector: "#nmi-ccexp",
          placeholder: "MM / YY",
        },
        cvv: {
          selector: "#nmi-cvv",
          placeholder: "CVV",
        },
      },
      callback: async (resp: CollectJsResponse) => {
        if (!resp?.token) {
          setIsProcessingRef.current(false);
          onErrorRef.current("Card tokenization failed. Please try again.");
          return;
        }
        try {
          const r = await apiFetch(
            `/api/pledges/${encodeURIComponent(pledgeIdRef.current)}/confirm-nmi`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentToken: resp.token }),
            }
          );
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            setIsProcessingRef.current(false);
            onErrorRef.current(data?.error || "Payment failed. Please try again.");
            return;
          }
          onSuccessRef.current();
        } catch (e) {
          setIsProcessingRef.current(false);
          onErrorRef.current(
            e instanceof Error ? e.message : "Payment failed. Please try again."
          );
        }
      },
    });
  }, [scriptReady]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      onError("Please agree to the terms before pledging.");
      return;
    }
    if (!scriptReady || !window.CollectJS) {
      onError("Card form is still loading — please wait a moment.");
      return;
    }
    setIsProcessing(true);
    window.CollectJS.startPaymentRequest();
  };

  const buttonLabel = isProcessing
    ? "Processing..."
    : isKeepItAll
    ? `Pay $${total.toFixed(2)}`
    : `Pledge $${total.toFixed(2)}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!scriptReady && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Loading card form...</p>
        </div>
      )}

      <div
        className={
          scriptReady ? "space-y-3" : "hidden"
        }
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="nmi-ccnumber">
            Card number
          </label>
          <div
            id="nmi-ccnumber"
            className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="nmi-ccexp">
              Expiration
            </label>
            <div
              id="nmi-ccexp"
              className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="nmi-cvv">
              CVV
            </label>
            <div
              id="nmi-cvv"
              className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
            />
          </div>
        </div>
      </div>

      <Button
        id="nmi-pay-button"
        type="submit"
        size="lg"
        className="w-full"
        disabled={!scriptReady || !agreedToTerms || isProcessing}
      >
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {buttonLabel}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Card details are tokenized in your browser by PaymentCloud — they never touch our servers.
      </p>
    </form>
  );
}
