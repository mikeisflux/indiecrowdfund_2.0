"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Loader2, Lock } from "lucide-react";
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

interface RetryInfo {
  pledge: {
    id: string;
    amount: number;
    status: string;
    lastFailureReason: string | null;
    retryCount: number;
    rewardTitle: string | null;
    rewardAmount: number;
    addons: { title: string; quantity: number; amount: number }[];
    shippingAmount: number;
  };
  project: { id: string; title: string; url: string };
  nmiPublicKey: string;
  canRetry: boolean;
}

interface TokenizeResponse {
  token: string;
}

/**
 * Self-service "retry payment" page for a backer whose NMI charge
 * failed. Loads pledge info, renders the Collect.js card form, and
 * runs a fresh cardholder-initiated sale against the new payment
 * token. Same pledge row — reward, addons, survey answers, backer
 * number all preserved on success.
 *
 * URL: /dashboard/pledges/[pledgeId]/retry-payment
 */
export default function RetryPaymentPage() {
  const params = useParams<{ pledgeId: string }>();
  const router = useRouter();
  const pledgeId = params?.pledgeId || "";

  const [info, setInfo] = useState<RetryInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");

  const [scriptReady, setScriptReady] = useState(false);
  const { loadFailed: cardFormLoadFailed } = useCollectJsIframeVerify({
    scriptReady,
    ccnumberId: "nmi-retry-ccnumber",
    setScriptReady,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refs so the Collect.js callback (set up once) always reads the
  // latest billing/state values without re-registering the SDK.
  const billingRef = useRef({ firstName, lastName, line1, line2, city, stateField, zip, country });
  const pledgeIdRef = useRef(pledgeId);
  const setIsProcessingRef = useRef(setIsProcessing);
  const setSuccessRef = useRef(setSuccess);
  const setSubmitErrorRef = useRef(setSubmitError);
  useEffect(() => {
    billingRef.current = { firstName, lastName, line1, line2, city, stateField, zip, country };
    pledgeIdRef.current = pledgeId;
    setIsProcessingRef.current = setIsProcessing;
    setSuccessRef.current = setSuccess;
    setSubmitErrorRef.current = setSubmitError;
  }, [firstName, lastName, line1, line2, city, stateField, zip, country, pledgeId]);

  // Initial load — fetch pledge + public key.
  useEffect(() => {
    if (!pledgeId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/pledges/${encodeURIComponent(pledgeId)}/retry-nmi`);
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(data?.error || "Failed to load retry information");
          return;
        }
        setInfo(data);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load retry information");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pledgeId]);

  // Inject Collect.js once we have the public key.
  useEffect(() => {
    if (!info?.nmiPublicKey || typeof window === "undefined") return;
    if (window.CollectJS) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script#nmi-collectjs");
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://paymentcloud.transactiongateway.com/token/Collect.js";
    script.async = true;
    script.id = "nmi-collectjs";
    script.setAttribute("data-tokenization-key", info.nmiPublicKey);
    script.setAttribute("data-price", info.pledge.amount.toFixed(2));
    script.setAttribute("data-currency", "USD");
    script.setAttribute("data-country", "US");
    script.addEventListener("load", () => setScriptReady(true), { once: true });
    script.addEventListener("error", () => {
      setSubmitError("Failed to load card form. Please refresh and try again.");
    });
    document.body.appendChild(script);
  }, [info?.nmiPublicKey, info?.pledge.amount]);

  // Configure Collect.js fields once script is loaded.
  useEffect(() => {
    if (!scriptReady || !window.CollectJS) return;
    window.CollectJS.configure({
      variant: "inline",
      styleSniffer: "true",
      fields: {
        ccnumber: { selector: "#nmi-retry-ccnumber", placeholder: "Card number" },
        ccexp: { selector: "#nmi-retry-ccexp", placeholder: "MM / YY" },
        cvv: { selector: "#nmi-retry-cvv", placeholder: "CVV" },
      },
      callback: async (resp: TokenizeResponse) => {
        if (!resp?.token) {
          setIsProcessingRef.current(false);
          setSubmitErrorRef.current("Card tokenization failed. Please try again.");
          return;
        }
        try {
          const b = billingRef.current;
          const r = await apiFetch(
            `/api/pledges/${encodeURIComponent(pledgeIdRef.current)}/retry-nmi`,
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
            setSubmitErrorRef.current(data?.error || "Payment failed. Please try again.");
            return;
          }
          setIsProcessingRef.current(false);
          setSuccessRef.current(true);
        } catch (e) {
          setIsProcessingRef.current(false);
          setSubmitErrorRef.current(
            e instanceof Error ? e.message : "Payment failed. Please try again."
          );
        }
      },
    });
  }, [scriptReady]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError("Please enter the cardholder's first and last name.");
      return;
    }
    if (!line1.trim() || !city.trim() || !stateField.trim() || !zip.trim() || !country.trim()) {
      setSubmitError("Please enter the full billing address.");
      return;
    }
    if (!window.CollectJS) {
      setSubmitError("Card form not ready yet. Please wait a moment and try again.");
      return;
    }
    setIsProcessing(true);
    window.CollectJS.startPaymentRequest();
  };

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Couldn&apos;t load this pledge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Link href="/dashboard/backer">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Payment successful
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Your pledge to <strong>{info.project.title}</strong> is now confirmed and your
              reward selection has been preserved. The creator has been notified.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => router.push(info.project.url)}>
                View project
              </Button>
              <Link href="/dashboard/backer">
                <Button variant="outline">Back to dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info.canRetry) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pledge already settled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This pledge is in <strong>{info.pledge.status}</strong> state and doesn&apos;t need a retry.
            </p>
            <Link href="/dashboard/backer">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pledgeAddonsTotal = info.pledge.addons.reduce(
    (s, a) => s + a.amount * a.quantity,
    0
  );

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Retry your pledge payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Your previous card was declined
            </p>
            <p className="text-amber-800 dark:text-amber-300 mt-1">
              {info.pledge.lastFailureReason || "Card was declined by the payment processor."}
            </p>
            <p className="text-amber-800 dark:text-amber-300 mt-2">
              Enter a new card below to complete your pledge. Your reward selection,
              add-ons, and shipping address are preserved — nothing else needs to be
              re-entered.
            </p>
          </div>

          <div className="rounded-lg border p-3 text-sm bg-muted/30 space-y-1">
            <p>
              <strong>{info.project.title}</strong>
            </p>
            {info.pledge.rewardTitle && (
              <p className="text-muted-foreground">
                Reward: {info.pledge.rewardTitle} — ${info.pledge.rewardAmount.toFixed(2)}
              </p>
            )}
            {info.pledge.addons.map((a, i) => (
              <p key={i} className="text-muted-foreground">
                {a.quantity}× {a.title} — ${(a.amount * a.quantity).toFixed(2)}
              </p>
            ))}
            {info.pledge.shippingAmount > 0 && (
              <p className="text-muted-foreground">
                Shipping — ${info.pledge.shippingAmount.toFixed(2)}
              </p>
            )}
            <p className="pt-1 border-t mt-1 font-semibold">
              Total — ${info.pledge.amount.toFixed(2)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              (Reward ${info.pledge.rewardAmount.toFixed(2)} + Add-ons ${pledgeAddonsTotal.toFixed(2)} + Shipping ${info.pledge.shippingAmount.toFixed(2)})
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600" />
            New card details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="retry-firstName">First name</Label>
                <Input
                  id="retry-firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retry-lastName">Last name</Label>
                <Input
                  id="retry-lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Card number</Label>
              <div
                id="nmi-retry-ccnumber"
                className="h-10 rounded-md border border-input bg-background px-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Expiration</Label>
                <div
                  id="nmi-retry-ccexp"
                  className="h-10 rounded-md border border-input bg-background px-3"
                />
              </div>
              <div className="space-y-1">
                <Label>CVV</Label>
                <div
                  id="nmi-retry-cvv"
                  className="h-10 rounded-md border border-input bg-background px-3"
                />
              </div>
            </div>

            {cardFormLoadFailed && (
              <p className="text-sm text-destructive">
                The card form failed to load. Try refreshing the page.
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="retry-line1">Billing address</Label>
              <Input id="retry-line1" value={line1} onChange={(e) => setLine1(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="retry-line2">Address line 2 (optional)</Label>
              <Input id="retry-line2" value={line2} onChange={(e) => setLine2(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="retry-city">City</Label>
                <Input id="retry-city" value={city} onChange={(e) => setCity(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retry-state">State / region</Label>
                <Input id="retry-state" value={stateField} onChange={(e) => setStateField(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retry-zip">ZIP / postcode</Label>
                <Input id="retry-zip" value={zip} onChange={(e) => setZip(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retry-country">Country</Label>
                <Input id="retry-country" value={country} onChange={(e) => setCountry(e.target.value)} required />
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <Button
              type="submit"
              disabled={isProcessing || !scriptReady}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Charging card…
                </>
              ) : (
                <>Charge ${info.pledge.amount.toFixed(2)} and complete pledge</>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Card data is tokenized in your browser and never touches our servers.
              Processing fees on this retry are absorbed by IndieCrowdfund.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
