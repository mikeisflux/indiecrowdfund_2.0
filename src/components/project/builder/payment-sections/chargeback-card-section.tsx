"use client";

import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, AlertTriangle, CheckCircle, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { ChargebackCardSectionProps } from "./types";

// Chargeback protection card, saved through the DivinityCoin vault.
//
// The card number and CVC are entered into Stripe Elements pointed at DC's
// publishable key, so they go from the creator's browser to DC and never
// touch our servers. DC verifies the CVC and billing details with a
// zero-dollar authorization; we keep only the saved-card token and charge
// it off-session when a dispute lands on the campaign.

function VaultCardForm({
  projectId,
  onSaved,
}: {
  projectId: string;
  onSaved: (card: { lastFour: string; brand: string | null; expMonth: number; expYear: number; recoupedOutstanding: number }) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!stripe || !elements || isSaving) return;
    setIsSaving(true);
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error) {
        toast.error(result.error.message || "Card could not be verified");
        return;
      }
      const pm = result.setupIntent?.payment_method;
      const paymentMethodId = typeof pm === "string" ? pm : pm?.id;
      const res = await apiFetch(`/api/projects/${projectId}/chargeback-card/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId: result.setupIntent?.id, paymentMethodId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to save card");
        return;
      }
      toast.success("Chargeback protection card verified and saved");
      onSaved({
        lastFour: data.lastFour,
        brand: data.brand,
        expMonth: data.expMonth,
        expYear: data.expYear,
        recoupedOutstanding: data.recoupedOutstanding || 0,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save card");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-3 border-b">
        <Lock className="h-4 w-4 text-emerald-600" />
        <span>Secure card entry — handled by Divinity Payments</span>
      </div>
      <PaymentElement options={{ layout: { type: "tabs", defaultCollapsed: false } }} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>
          Your card number and security code go directly to Divinity Payments and are never stored on IndieCrowdfund.
          The card is verified now with a $0 authorization; nothing is charged unless a dispute is filed against this campaign.
        </span>
      </div>
      <Button onClick={handleSave} disabled={!stripe || !elements || isSaving} className="w-full sm:w-auto">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verifying card...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Verify & Save Card
          </>
        )}
      </Button>
    </div>
  );
}

export function ChargebackCardSection({
  chargebackCardStatus,
  setChargebackCardStatus,
  projectId,
}: ChargebackCardSectionProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const startForm = async () => {
    if (!projectId) {
      toast.error("Save your project first, then add the card");
      return;
    }
    setIsStarting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/chargeback-card/setup-intent`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start the secure form");
      setStripePromise(loadStripe(data.publishableKey));
      setClientSecret(data.clientSecret);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the secure form");
    } finally {
      setIsStarting(false);
    }
  };

  const showForm = !!clientSecret && !!stripePromise;
  const needsReentry = chargebackCardStatus.saved && !chargebackCardStatus.vaulted;

  return (
    <div className="space-y-4 pt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Chargeback Protection Card
          </CardTitle>
          <CardDescription>
            A valid credit or debit card is required for every campaign. If a backer&apos;s bank reverses a pledge,
            the disputed amount plus the dispute fee is charged to this card automatically. This is a standard
            requirement for all creators on our platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {chargebackCardStatus.loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking card status...</span>
            </div>
          ) : chargebackCardStatus.saved && chargebackCardStatus.vaulted && !showForm ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-400">Card verified and on file</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-500">
                  {chargebackCardStatus.brand} ending in {chargebackCardStatus.lastFour}
                  {chargebackCardStatus.expMonth && chargebackCardStatus.expYear ? (
                    <> &middot; Expires {String(chargebackCardStatus.expMonth).padStart(2, "0")}/{chargebackCardStatus.expYear}</>
                  ) : null}
                  {" "}&middot; Held in the Divinity Payments vault
                </AlertDescription>
              </Alert>
              <Button variant="outline" size="sm" onClick={startForm} disabled={isStarting}>
                {isStarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Replace Card
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {needsReentry && !showForm ? (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-700 dark:text-red-400">Please re-enter your card</AlertTitle>
                  <AlertDescription className="text-red-600 dark:text-red-500">
                    Your {chargebackCardStatus.brand} ending in {chargebackCardStatus.lastFour} was saved before we moved
                    card storage to Divinity Payments&apos; secure vault. Enter it once through the secure form below so
                    disputes can be handled automatically instead of by hand.
                  </AlertDescription>
                </Alert>
              ) : !showForm ? (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-400">Required</AlertTitle>
                  <AlertDescription className="text-amber-600 dark:text-amber-500">
                    A verified chargeback protection card must be on file before your project can be launched.
                  </AlertDescription>
                </Alert>
              ) : null}

              {showForm && stripePromise !== null && clientSecret ? (
                <Elements
                  key={clientSecret}
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: { theme: "stripe" } }}
                >
                  <VaultCardForm
                    projectId={projectId as string}
                    onSaved={(card) => {
                      setClientSecret(null);
                      setChargebackCardStatus({
                        saved: true,
                        loading: false,
                        vaulted: true,
                        lastFour: card.lastFour,
                        brand: card.brand,
                        expMonth: card.expMonth,
                        expYear: card.expYear,
                      });
                      if (card.recoupedOutstanding > 0) {
                        toast.info(
                          `${card.recoupedOutstanding} outstanding dispute amount${card.recoupedOutstanding === 1 ? " was" : "s were"} collected from the new card.`
                        );
                      }
                    }}
                  />
                </Elements>
              ) : (
                <Button onClick={startForm} disabled={isStarting || !projectId}>
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Opening secure form...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {needsReentry ? "Re-enter Card Securely" : "Add Card Securely"}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
