"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

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
  token: string;
}

interface NmiMarketplacePaymentFormProps {
  publicKey: string;
  purchaseId: string;
  amount: number;
  currency: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

// Marketplace PaymentCloud (NMI) Collect.js form. Mirrors the pledge
// flow's NmiPaymentForm but the success path POSTs to the marketplace
// confirm-nmi endpoint and the form charges immediately (marketplace
// items always charge at purchase time). Captures cardholder name +
// billing address inline so AVS runs and we keep interchange / risk down.
export function NmiMarketplacePaymentForm({
  publicKey,
  purchaseId,
  amount,
  currency,
  onSuccess,
  onError,
}: NmiMarketplacePaymentFormProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const setIsProcessingRef = useRef(setIsProcessing);
  const purchaseIdRef = useRef(purchaseId);
  const billingRef = useRef({ firstName, lastName, line1, line2, city, stateField, zip, country });
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    setIsProcessingRef.current = setIsProcessing;
    purchaseIdRef.current = purchaseId;
    billingRef.current = { firstName, lastName, line1, line2, city, stateField, zip, country };
  }, [onSuccess, onError, purchaseId, firstName, lastName, line1, line2, city, stateField, zip, country]);

  useEffect(() => {
    if (!publicKey) return;
    if (typeof window === "undefined") return;
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
    // Match the official Collect.js React demo's shape exactly —
    // `paymentSelector` and `fieldsAvailableCallback` trip the JS-API
    // validator with "Unexpected fields for collectjs" despite being
    // documented as data-* attributes.
    window.CollectJS.configure({
      variant: "inline",
      styleSniffer: "true",
      fields: {
        ccnumber: { selector: "#nmi-mkt-ccnumber", placeholder: "Card number" },
        ccexp: { selector: "#nmi-mkt-ccexp", placeholder: "MM / YY" },
        cvv: { selector: "#nmi-mkt-cvv", placeholder: "CVV" },
      },
      callback: async (resp: CollectJsResponse) => {
        if (!resp?.token) {
          setIsProcessingRef.current(false);
          onErrorRef.current("Card tokenization failed. Please try again.");
          return;
        }
        try {
          const b = billingRef.current;
          const r = await apiFetch(
            `/api/marketplace/purchase/${encodeURIComponent(purchaseIdRef.current)}/confirm-nmi`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentToken: resp.token,
                billingFirstName: b.firstName,
                billingLastName: b.lastName,
                billingLine1: b.line1,
                billingLine2: b.line2 || undefined,
                billingCity: b.city,
                billingState: b.stateField,
                billingZip: b.zip,
                billingCountry: b.country,
              }),
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
    if (!firstName.trim() || !lastName.trim()) {
      onError("Please enter the cardholder's first and last name.");
      return;
    }
    if (!line1.trim() || !city.trim() || !stateField.trim() || !zip.trim() || !country.trim()) {
      onError("Please enter the full billing address.");
      return;
    }
    if (!scriptReady || !window.CollectJS) {
      onError("Card form is still loading — please wait a moment.");
      return;
    }
    setIsProcessing(true);
    window.CollectJS.startPaymentRequest();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!scriptReady && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Loading card form...</p>
        </div>
      )}

      <div className={scriptReady ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-first-name">First name</Label>
            <Input
              id="nmi-mkt-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="cc-given-name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-last-name">Last name</Label>
            <Input
              id="nmi-mkt-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="cc-family-name"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="nmi-mkt-line1">Billing address</Label>
          <Input
            id="nmi-mkt-line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            autoComplete="billing address-line1"
            placeholder="Street address"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nmi-mkt-line2" className="text-xs text-muted-foreground">
            Apt / suite (optional)
          </Label>
          <Input
            id="nmi-mkt-line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            autoComplete="billing address-line2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-city">City</Label>
            <Input
              id="nmi-mkt-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="billing address-level2"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-state">State / region</Label>
            <Input
              id="nmi-mkt-state"
              value={stateField}
              onChange={(e) => setStateField(e.target.value)}
              autoComplete="billing address-level1"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-zip">Postal code</Label>
            <Input
              id="nmi-mkt-zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              autoComplete="billing postal-code"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-country">Country</Label>
            <Input
              id="nmi-mkt-country"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              autoComplete="billing country"
              maxLength={2}
              placeholder="US"
              required
            />
          </div>
        </div>

        <div className="space-y-1 pt-2">
          <Label htmlFor="nmi-mkt-ccnumber">Card number</Label>
          <div
            id="nmi-mkt-ccnumber"
            className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-ccexp">Expiration</Label>
            <div
              id="nmi-mkt-ccexp"
              className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-mkt-cvv">CVV</Label>
            <div
              id="nmi-mkt-cvv"
              className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
            />
          </div>
        </div>
      </div>

      <Button
        id="nmi-mkt-pay"
        type="submit"
        size="lg"
        className="w-full"
        disabled={!scriptReady || isProcessing}
      >
        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isProcessing
          ? "Processing..."
          : `Pay ${currency.toUpperCase()} $${amount.toFixed(2)}`}
      </Button>

      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" />
        Card details are tokenized in your browser by PaymentCloud — they
        never touch our servers.
      </p>
    </form>
  );
}
