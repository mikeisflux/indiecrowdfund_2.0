"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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

interface CollectJsCallbackResponse {
  token: string;
  tokenType?: string;
  card?: {
    number?: string;
    bin?: string;
    exp?: string;
    type?: string;
  };
}

interface SavedCardStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
}

interface NmiChargebackCardSectionProps {
  projectId: string | null;
  publicKey: string | null;
  status: SavedCardStatus;
  setStatus: React.Dispatch<React.SetStateAction<SavedCardStatus>>;
}

// PaymentCloud chargeback card capture. Renders Collect.js iframes for
// the card fields (PAN never enters our DOM) and plain inputs for the
// billing-side data we need to ship with the vault entry. On submit:
//   1. CollectJS.startPaymentRequest() tokenizes the card → callback
//      receives a single-use payment_token + masked card meta
//   2. We POST { paymentToken, billing fields, card meta } to the
//      project's chargeback-card route, which exchanges the token for
//      a Customer Vault id and runs `type=validate` to confirm the
//      card is real / chargeable before saving.
export function NmiChargebackCardSection({
  projectId,
  publicKey,
  status,
  setStatus,
}: NmiChargebackCardSectionProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");

  // Refs so the Collect.js callback (registered once) sees latest state.
  const billingRef = useRef({ firstName, lastName, line1, line2, city, state, zip, country });
  const projectIdRef = useRef(projectId);
  const setStatusRef = useRef(setStatus);
  const setIsSavingRef = useRef(setIsSaving);
  const setShowFormRef = useRef(setShowForm);
  useEffect(() => {
    billingRef.current = { firstName, lastName, line1, line2, city, state, zip, country };
    projectIdRef.current = projectId;
    setStatusRef.current = setStatus;
    setIsSavingRef.current = setIsSaving;
    setShowFormRef.current = setShowForm;
  }, [firstName, lastName, line1, line2, city, state, zip, country, projectId, setStatus]);

  // Load Collect.js once we know the public key and the form is open.
  useEffect(() => {
    if (!showForm || !publicKey) return;
    if (typeof window === "undefined") return;
    if (window.CollectJS) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-collectjs]");
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://paymentcloud.transactiongateway.com/token/Collect.js";
    s.async = true;
    s.dataset.collectjs = "true";
    s.setAttribute("data-tokenization-key", publicKey);
    s.addEventListener("load", () => setScriptReady(true), { once: true });
    document.body.appendChild(s);
  }, [showForm, publicKey]);

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
        ccnumber: { selector: "#nmi-cb-ccnumber", placeholder: "Card number" },
        ccexp: { selector: "#nmi-cb-ccexp", placeholder: "MM / YY" },
        cvv: { selector: "#nmi-cb-cvv", placeholder: "CVV" },
      },
      callback: async (resp: CollectJsCallbackResponse) => {
        if (!resp?.token) {
          setIsSavingRef.current(false);
          toast.error("Card tokenization failed. Please try again.");
          return;
        }
        const pid = projectIdRef.current;
        if (!pid) {
          setIsSavingRef.current(false);
          toast.error("Save the project first before adding a chargeback card.");
          return;
        }
        try {
          const r = await apiFetch(
            `/api/projects/${encodeURIComponent(pid)}/chargeback-card`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentToken: resp.token,
                cardMasked: resp.card?.number,
                cardType: resp.card?.type,
                cardExp: resp.card?.exp,
                billingFirstName: billingRef.current.firstName,
                billingLastName: billingRef.current.lastName,
                billingLine1: billingRef.current.line1,
                billingLine2: billingRef.current.line2 || undefined,
                billingCity: billingRef.current.city,
                billingState: billingRef.current.state,
                billingZip: billingRef.current.zip,
                billingCountry: billingRef.current.country,
              }),
            }
          );
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            setIsSavingRef.current(false);
            toast.error(data?.error || "Failed to save chargeback card.");
            return;
          }
          setStatusRef.current({
            saved: true,
            loading: false,
            lastFour: data.lastFour ?? null,
            brand: data.brand ?? null,
            expMonth: data.expMonth ?? null,
            expYear: data.expYear ?? null,
          });
          setIsSavingRef.current(false);
          setShowFormRef.current(false);
          toast.success("Chargeback card saved and validated by PaymentCloud.");
        } catch (e) {
          setIsSavingRef.current(false);
          toast.error(e instanceof Error ? e.message : "Failed to save chargeback card.");
        }
      },
    });
  }, [scriptReady]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      toast.error("Save the project first before adding a chargeback card.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter the cardholder's first and last name.");
      return;
    }
    if (!line1.trim() || !city.trim() || !state.trim() || !zip.trim() || !country.trim()) {
      toast.error("Please enter the full billing address.");
      return;
    }
    if (!scriptReady || !window.CollectJS) {
      toast.error("Card form is still loading — please wait a moment.");
      return;
    }
    setIsSaving(true);
    window.CollectJS.startPaymentRequest();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <h3 className="font-semibold">Chargeback Protection Card</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Save a credit card that PaymentCloud can charge to recoup any
        chargebacks filed against your campaign. The card is tokenized in
        your browser by PaymentCloud — we never see or store the card number.
        We&apos;ll run a small auth-and-void on it now to confirm it&apos;s valid.
      </p>

      {status.saved && !showForm && (
        <Card>
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  {status.brand || "Card"} ending in {status.lastFour || "????"}
                </p>
                <p className="text-muted-foreground">
                  {status.expMonth && status.expYear
                    ? `Exp ${String(status.expMonth).padStart(2, "0")}/${String(status.expYear).slice(-2)}`
                    : "Saved"} · validated and ready
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              Replace
            </Button>
          </CardContent>
        </Card>
      )}

      {(!status.saved || showForm) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cb-firstName">Cardholder first name</Label>
              <Input
                id="cb-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                required
                autoComplete="cc-given-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-lastName">Cardholder last name</Label>
              <Input
                id="cb-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                required
                autoComplete="cc-family-name"
              />
            </div>
          </div>

          <div className={scriptReady ? "space-y-3" : "hidden"}>
            <div className="space-y-1">
              <Label htmlFor="nmi-cb-ccnumber">Card number</Label>
              <div
                id="nmi-cb-ccnumber"
                className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="nmi-cb-ccexp">Expiration</Label>
                <div
                  id="nmi-cb-ccexp"
                  className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nmi-cb-cvv">CVV</Label>
                <div
                  id="nmi-cb-cvv"
                  className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
                />
              </div>
            </div>
          </div>

          {!scriptReady && publicKey && showForm && (
            <div className="flex flex-col items-center justify-center py-6 border rounded-md">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Loading card form...</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cb-line1">Billing address</Label>
              <Input
                id="cb-line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="123 Main St"
                required
                autoComplete="address-line1"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cb-line2">Address line 2 (optional)</Label>
              <Input
                id="cb-line2"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Apt, suite, etc."
                autoComplete="address-line2"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-city">City</Label>
              <Input
                id="cb-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-state">State / region</Label>
              <Input
                id="cb-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                autoComplete="address-level1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-zip">ZIP / postal code</Label>
              <Input
                id="cb-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                autoComplete="postal-code"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cb-country">Country</Label>
              <Input
                id="cb-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="US"
                required
                autoComplete="country"
              />
            </div>
          </div>

          {!publicKey && (
            <p className="text-xs text-amber-600">
              PaymentCloud isn&apos;t configured yet — admins can add the public key in
              Settings → Payments → PaymentCloud Configuration.
            </p>
          )}

          <Button
            id="nmi-cb-pay-button"
            type="submit"
            disabled={!publicKey || !scriptReady || !projectId || isSaving}
            className="w-full"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : status.saved ? "Replace Card" : "Save Chargeback Card"}
          </Button>
          {status.saved && showForm && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
