"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

// PaymentCloud (NMI) Collect.js inline form. The script is loaded with
// `data-tokenization-key={publicKey}` and the actual card fields render
// inside iframes Collect.js injects into our placeholder divs — the PAN
// never enters our DOM. On submit we call CollectJS.startPaymentRequest()
// to get a single-use payment_token, then hand it to the confirm-nmi
// endpoint along with the cardholder name + billing address. The server
// passes those to NMI on add_customer + sale so AVS runs and we keep
// downgraded-interchange / chargeback risk down.

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
  // Apple Pay / Google Pay path — Collect.js puts the wallet-supplied
  // billing/shipping contact here instead of expecting us to read it
  // off React state. We use it when tokenType is "applePay" or
  // "googlePay".
  wallet?: {
    cardDetails?: string;
    cardNetwork?: string;
    email?: string | null;
    billingInfo?: {
      address1?: string | null;
      address2?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      postalCode?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
      phone?: string | null;
    };
    shippingInfo?: Record<string, unknown>;
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
  // Endpoint to POST the tokenized card to. Defaults to confirm-nmi
  // for the new-pledge flow; pass confirm-modify or confirm-add-items
  // when reusing this form for upcharges on existing pledges.
  endpoint?: string;
  // Submit-button label override. Defaults to "Pay $X" / "Pledge $X"
  // depending on isKeepItAll.
  submitLabel?: string;
  // Extra fields to merge into the POST body alongside paymentToken +
  // billing fields. Used by modify-upcharge to send modificationId so
  // confirm-modify can reject submissions whose pendingModification
  // was superseded by a later modify call.
  extraBody?: Record<string, string | number | boolean>;
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
  endpoint,
  submitLabel,
  extraBody,
}: NmiPaymentFormProps) {
  const [scriptReady, setScriptReady] = useState(false);

  // Cardholder name + billing address. NMI/PaymentCloud uses zip + address1
  // for AVS and rejects (or downgrades to higher fees) sales with no
  // billing data. These are captured in plain inputs and sent to our
  // server alongside the Collect.js payment_token.
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
  const pledgeIdRef = useRef(pledgeId);
  const endpointRef = useRef(endpoint);
  const extraBodyRef = useRef(extraBody);
  const billingRef = useRef({ firstName, lastName, line1, line2, city, stateField, zip, country });
  // Keep refs current so the Collect.js callback (registered once on
  // mount) sees the latest handlers/pledge id/billing without re-registering.
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    setIsProcessingRef.current = setIsProcessing;
    pledgeIdRef.current = pledgeId;
    endpointRef.current = endpoint;
    extraBodyRef.current = extraBody;
    billingRef.current = { firstName, lastName, line1, line2, city, stateField, zip, country };
  }, [onSuccess, onError, setIsProcessing, pledgeId, endpoint, extraBody, firstName, lastName, line1, line2, city, stateField, zip, country]);

  useEffect(() => {
    if (!publicKey) return;
    if (typeof window === "undefined") return;
    // Script may already be loaded from a prior mount.
    if (window.CollectJS) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script#nmi-collectjs"
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://paymentcloud.transactiongateway.com/token/Collect.js";
    script.async = true;
    // Use id, not a data-* attribute — Collect.js auto-parses every
    // `data-*` on its own script tag as a config key, so a marker like
    // `data-collectjs="true"` becomes the rejected config field
    // `collectjs` and trips "Unexpected fields for collectjs".
    script.id = "nmi-collectjs";
    script.setAttribute("data-tokenization-key", publicKey);
    // Required by Apple Pay's PaymentRequestAbstraction (the merchant has
    // Apple Pay enabled at the gateway). Without these three, configure()
    // logs "Could not create PaymentRequestAbstraction". Set as data-*
    // because that's the form documented in the Collect.js PDF —
    // the camelCase JS-API equivalents aren't documented and could trip
    // "Unexpected fields".
    script.setAttribute("data-price", total.toFixed(2));
    script.setAttribute("data-currency", "USD");
    script.setAttribute("data-country", "US");
    // Apple Pay button rendering — only Safari / iOS will actually show
    // anything; other browsers ignore. Bind to .nmi-applepay-button div
    // below. Capture billing postal address + name from the Apple Pay
    // sheet so the resulting tokenized sale carries AVS data.
    script.setAttribute("data-field-apple-pay-selector", ".nmi-applepay-button");
    script.setAttribute("data-field-apple-pay-type", "buy");
    script.setAttribute("data-field-apple-pay-total-label", "IndieCrowdfund");
    script.setAttribute(
      "data-field-apple-pay-required-billing-contact-fields",
      JSON.stringify(["postalAddress", "name"])
    );
    script.setAttribute(
      "data-field-apple-pay-contact-fields",
      JSON.stringify(["email"])
    );
    script.setAttribute("data-field-apple-pay-contact-fields-mapped-to", "billing");
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
          // For Apple Pay / Google Pay, take billing from the wallet
          // sheet — the user never typed our billing fields. For card
          // entry, use the typed fields.
          const wallet = resp.wallet?.billingInfo;
          const isWallet =
            resp.tokenType === "applePay" || resp.tokenType === "googlePay";
          const b = isWallet
            ? {
                firstName: wallet?.firstName || "",
                lastName: wallet?.lastName || "",
                line1: wallet?.address1 || "",
                line2: wallet?.address2 || "",
                city: wallet?.city || "",
                stateField: wallet?.state || "",
                zip: wallet?.postalCode || "",
                country: wallet?.country || "US",
              }
            : billingRef.current;
          const targetEndpoint = endpointRef.current
            || `/api/pledges/${encodeURIComponent(pledgeIdRef.current)}/confirm-nmi`;
          const r = await apiFetch(targetEndpoint, {
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
              ...(extraBodyRef.current || {}),
            }),
          });
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

  const buttonLabel = isProcessing
    ? "Processing..."
    : submitLabel
    ? submitLabel
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

      <div className={scriptReady ? "space-y-4" : "hidden"}>
        {/* Apple Pay button — Collect.js renders the actual styled
            button into this div on Safari/iOS only; on other browsers
            this stays empty. Bypasses our typed billing fields entirely
            because the wallet sheet provides billing info directly. */}
        <div className="nmi-applepay-button" />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-first-name">First name</Label>
            <Input
              id="nmi-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="cc-given-name"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-last-name">Last name</Label>
            <Input
              id="nmi-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="cc-family-name"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="nmi-line1">Billing address</Label>
          <Input
            id="nmi-line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            autoComplete="billing address-line1"
            placeholder="Street address"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nmi-line2" className="text-xs text-muted-foreground">
            Apt / suite (optional)
          </Label>
          <Input
            id="nmi-line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            autoComplete="billing address-line2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-city">City</Label>
            <Input
              id="nmi-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="billing address-level2"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-state">State / region</Label>
            <Input
              id="nmi-state"
              value={stateField}
              onChange={(e) => setStateField(e.target.value)}
              autoComplete="billing address-level1"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-zip">Postal code</Label>
            <Input
              id="nmi-zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              autoComplete="billing postal-code"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-country">Country</Label>
            <Input
              id="nmi-country"
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
          <Label htmlFor="nmi-ccnumber">Card number</Label>
          <div
            id="nmi-ccnumber"
            className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nmi-ccexp">Expiration</Label>
            <div
              id="nmi-ccexp"
              className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nmi-cvv">CVV</Label>
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
