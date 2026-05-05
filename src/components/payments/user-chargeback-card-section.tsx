"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { useCollectJsIframeVerify } from "@/components/payments/use-collectjs-iframe-verify";

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
  card?: { number?: string; exp?: string; type?: string };
}

interface SavedCardStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
  brand: string | null;
  expMonth: number | null;
  expYear: number | null;
  // false = caller is a collaborator viewing the project creator's card.
  // The Replace button + form are hidden in that case so collaborators
  // see the same "saved" indicator without being able to mutate the
  // creator's saved card.
  canEdit: boolean;
}

// Shared user-level chargeback card section. Same Collect.js + Customer
// Vault flow as the per-project NmiChargebackCardSection but the card
// belongs to the creator's account, so saving it once shows up locked
// + filled in every other surface that renders this component
// (project creation Payments step, IndieKit Payments tab, marketplace
// settings). PAN never enters our DOM — Collect.js iframes own it.
//
// Pass projectId to render in collaborator-aware mode: the GET resolves
// the project creator and shows the creator's saved card to any accepted
// collaborator. Without projectId we fall back to user-scoped lookup
// (marketplace settings page) where the caller is always the owner.
export function UserChargebackCardSection({
  idPrefix = "user-cb",
  projectId,
}: {
  idPrefix?: string;
  projectId?: string | null;
}) {
  const [status, setStatus] = useState<SavedCardStatus>({
    saved: false,
    loading: true,
    lastFour: null,
    brand: null,
    expMonth: null,
    expYear: null,
    canEdit: true,
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");

  const billingRef = useRef({ firstName, lastName, line1, line2, city, stateField, zip, country });
  const setStatusRef = useRef(setStatus);
  const setIsSavingRef = useRef(setIsSaving);
  const setShowFormRef = useRef(setShowForm);
  useEffect(() => {
    billingRef.current = { firstName, lastName, line1, line2, city, stateField, zip, country };
    setStatusRef.current = setStatus;
    setIsSavingRef.current = setIsSaving;
    setShowFormRef.current = setShowForm;
  }, [firstName, lastName, line1, line2, city, stateField, zip, country]);

  // Load saved card status once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = projectId
          ? `/api/creator/marketplace-chargeback-card?projectId=${encodeURIComponent(projectId)}`
          : "/api/creator/marketplace-chargeback-card";
        const r = await fetch(url);
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          if (data.exists) {
            setStatus({
              saved: true,
              loading: false,
              lastFour: data.lastFour ?? null,
              brand: data.brand ?? null,
              expMonth: data.expMonth ?? null,
              expYear: data.expYear ?? null,
              canEdit: data.canEdit !== false,
            });
          } else {
            setStatus({ saved: false, loading: false, lastFour: null, brand: null, expMonth: null, expYear: null, canEdit: data.canEdit !== false });
          }
        } else {
          setStatus({ saved: false, loading: false, lastFour: null, brand: null, expMonth: null, expYear: null, canEdit: true });
        }
      } catch {
        if (!cancelled)
          setStatus({ saved: false, loading: false, lastFour: null, brand: null, expMonth: null, expYear: null, canEdit: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // The card form is visible whenever the creator has no saved card
  // OR they explicitly clicked "Replace" on a saved one (line ~306
  // below: `!status.loading && (!status.saved || showForm)`). Both
  // the publicKey fetch, the Collect.js script-load effect, and the
  // "Loading card form..." indicator need to run in either case —
  // gating them on `showForm` alone broke the first-time-creator
  // path: the form rendered but Collect.js never loaded, so the user
  // saw billing fields with no card-number / exp / CVV inputs and
  // no loading indicator. Reported on the project-creation flow.
  const formVisible = !status.saved || showForm;

  // Load PaymentCloud public key only when the form is open.
  useEffect(() => {
    if (!formVisible) return;
    if (publicKey) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/payments/nmi/public-key");
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          if (data?.publicKey) setPublicKey(data.publicKey);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formVisible, publicKey]);

  // Load Collect.js once we know the public key and the form is open.
  useEffect(() => {
    if (!formVisible || !publicKey) return;
    if (typeof window === "undefined") return;
    if (window.CollectJS) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script#nmi-collectjs");
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://paymentcloud.transactiongateway.com/token/Collect.js";
    s.async = true;
    // Use id, not data-* — Collect.js auto-parses every data-* on its
    // own script tag as a config key.
    s.id = "nmi-collectjs";
    s.setAttribute("data-tokenization-key", publicKey);
    // Required because the merchant has Apple Pay enabled at the gateway;
    // missing these triggers "Could not create PaymentRequestAbstraction".
    // Card-on-file save (no charge), so the price is a placeholder.
    s.setAttribute("data-price", "1.00");
    s.setAttribute("data-currency", "USD");
    s.setAttribute("data-country", "US");
    s.addEventListener("load", () => setScriptReady(true), { once: true });
    document.body.appendChild(s);
  }, [formVisible, publicKey]);

  // Iframe-attach verifier — after scriptReady the placeholder divs
  // should host Collect.js iframes. If they don't (cached
  // window.CollectJS from a prior SPA-route mount silently failed to
  // re-target new selectors), the hook reloads the script once and
  // surfaces loadFailed=true on a second failed attach.
  const { loadFailed: cardFormLoadFailed, resetFailure: resetCardFormFailure } = useCollectJsIframeVerify({
    scriptReady,
    ccnumberId: `${idPrefix}-ccnumber`,
    setScriptReady,
  });

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
        ccnumber: { selector: `#${idPrefix}-ccnumber`, placeholder: "Card number" },
        ccexp: { selector: `#${idPrefix}-ccexp`, placeholder: "MM / YY" },
        cvv: { selector: `#${idPrefix}-cvv`, placeholder: "CVV" },
      },
      // No-op acknowledgement of attachment — verification runs in
      // useCollectJsIframeVerify above. CollectJS doesn't expose a
      // callback for "iframes attached".
      callback: async (resp: CollectJsCallbackResponse) => {
        if (!resp?.token) {
          setIsSavingRef.current(false);
          toast.error("Card tokenization failed. Please try again.");
          return;
        }
        try {
          const r = await apiFetch("/api/creator/marketplace-chargeback-card", {
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
              billingState: billingRef.current.stateField,
              billingZip: billingRef.current.zip,
              billingCountry: billingRef.current.country,
            }),
          });
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
            canEdit: true, // we just saved as the owner
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
  }, [scriptReady, idPrefix]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter the cardholder's first and last name.");
      return;
    }
    if (!line1.trim() || !city.trim() || !stateField.trim() || !zip.trim() || !country.trim()) {
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
        {status.saved && !showForm && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600">
            <Lock className="h-3 w-3" /> Saved
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        One card on file covers chargeback recoups across all your campaigns
        and marketplace sales. PaymentCloud tokenizes the card in your
        browser — we never see or store the card number, and we&apos;ll run
        a small auth-and-void to confirm it&apos;s valid before saving.
      </p>

      {status.loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!status.loading && status.saved && !showForm && (
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
                  {!status.canEdit && " · saved by the project creator"}
                </p>
              </div>
            </div>
            {status.canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Replace
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Collaborators viewing a project where the creator has NOT yet
          saved a chargeback card see a read-only message — the form is
          owner-only, so we don't render it for non-editors. */}
      {!status.loading && !status.saved && !status.canEdit && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            The project creator hasn&apos;t saved a chargeback protection card yet. They&apos;ll need to add one before launch.
          </CardContent>
        </Card>
      )}

      {!status.loading && status.canEdit && (!status.saved || showForm) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-fn`}>Cardholder first name</Label>
              <Input
                id={`${idPrefix}-fn`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="cc-given-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-ln`}>Cardholder last name</Label>
              <Input
                id={`${idPrefix}-ln`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="cc-family-name"
              />
            </div>
          </div>

          {cardFormLoadFailed && (
            <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-1">
                Card form failed to load.
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                The PaymentCloud card-input iframe didn&apos;t attach. Please refresh the page or disable any browser extensions that block third-party iframes (privacy / cookie blockers, strict tracking protection).
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetCardFormFailure();
                  // Trigger the script-loader effect to retry by
                  // toggling showForm off+on. Cheaper than reloading
                  // the page.
                  setShowForm(false);
                  setTimeout(() => setShowForm(true), 50);
                }}
              >
                Retry
              </Button>
            </div>
          )}

          <div className={scriptReady && !cardFormLoadFailed ? "space-y-3" : "hidden"}>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-ccnumber`}>Card number</Label>
              <div
                id={`${idPrefix}-ccnumber`}
                className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-ccexp`}>Expiration</Label>
                <div
                  id={`${idPrefix}-ccexp`}
                  className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-cvv`}>CVV</Label>
                <div
                  id={`${idPrefix}-cvv`}
                  className="h-11 rounded-md border border-input bg-background px-3 flex items-center"
                />
              </div>
            </div>
          </div>

          {!scriptReady && publicKey && formVisible && (
            <div className="flex flex-col items-center justify-center py-6 border rounded-md">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Loading card form...</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`${idPrefix}-line1`}>Billing address</Label>
              <Input id={`${idPrefix}-line1`} value={line1} onChange={(e) => setLine1(e.target.value)} required autoComplete="address-line1" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`${idPrefix}-line2`}>Address line 2 (optional)</Label>
              <Input id={`${idPrefix}-line2`} value={line2} onChange={(e) => setLine2(e.target.value)} autoComplete="address-line2" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-city`}>City</Label>
              <Input id={`${idPrefix}-city`} value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-state`}>State / region</Label>
              <Input id={`${idPrefix}-state`} value={stateField} onChange={(e) => setStateField(e.target.value)} required autoComplete="address-level1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-zip`}>ZIP / postal code</Label>
              <Input id={`${idPrefix}-zip`} value={zip} onChange={(e) => setZip(e.target.value)} required autoComplete="postal-code" />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-country`}>Country</Label>
              <Input id={`${idPrefix}-country`} value={country} onChange={(e) => setCountry(e.target.value)} required autoComplete="country" />
            </div>
          </div>

          <Button id={`${idPrefix}-pay`} type="submit" disabled={!scriptReady || isSaving} className="w-full">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : status.saved ? "Replace Card" : "Save Chargeback Card"}
          </Button>
          {status.saved && showForm && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
