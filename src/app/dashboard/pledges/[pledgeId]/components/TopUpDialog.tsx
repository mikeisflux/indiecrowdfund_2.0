"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/fetch-utils";
import { WhopPaymentForm } from "@/app/projects/[vanityname]/[slug]/pledge/components/WhopPaymentForm";

/**
 * "Add Additional Support" — the payment step.
 *
 * A charged pledge can't just have its amount edited; the extra has to be
 * collected. /api/pledges/[id]/add-items opens that collection and returns one
 * of four shapes:
 *
 *   type: "off_session_charge"  DivinityCoin with a saved card. Already
 *                               charged and applied server-side — nothing to
 *                               render, just report it.
 *   type: "payment_intent"      DivinityCoin without a saved card. Confirm
 *                               with Stripe Elements against DC's own
 *                               publishable key, then confirm-add-items.
 *   paymentMethod: "WHOP"       Whop embedded checkout.
 *
 * The dashboard used to read a `checkoutUrl` off that response and, finding
 * none (no processor has ever returned one), fall straight through to
 * toast.success("Additional support added"). So every backer outside the
 * saved-card path was told their money went in while no payment step was ever
 * shown, nothing was charged and the pledge total never moved. That is the bug
 * this component exists to close.
 */

export interface TopUpDialogProps {
  pledgeId: string;
  /** Dollar amount the backer typed. */
  amount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the money is collected AND applied to the pledge. */
  onComplete: () => void;
}

type UpchargeState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "dc_elements"; clientSecret: string }
  | { kind: "whop"; sessionId: string; planId: string; environment: "production" | "sandbox" }
  ;

/** Stripe Elements card form for the DivinityCoin no-saved-card path. */
function DcCardForm({
  total,
  isProcessing,
  setIsProcessing,
  onSuccess,
  onError,
}: {
  total: number;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setIsProcessing(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (result.error) {
        onError(result.error.message || "Payment failed");
        setIsProcessing(false);
        return;
      }
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-3 border-b">
        <Lock className="h-4 w-4 text-emerald-600" />
        <span>Secure Payment</span>
      </div>

      <PaymentElement options={{ layout: { type: "tabs", defaultCollapsed: false } }} />

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>Your payment information is encrypted and secure.</span>
      </div>

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base"
        size="lg"
        onClick={handleSubmit}
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Pay ${total.toFixed(2)}
          </span>
        )}
      </Button>
    </div>
  );
}

export function TopUpDialog({
  pledgeId,
  amount,
  open,
  onOpenChange,
  onComplete,
}: TopUpDialogProps) {
  const [state, setState] = useState<UpchargeState>({ kind: "loading" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  // add-items stamps a 60s reservation marker on the pledge and opens a real
  // payment intent / checkout session, so it must run exactly once per dialog
  // opening. React 18 double-invokes effects in dev, and a re-render must not
  // open a second session either.
  const startedRef = useRef(false);

  const confirmUrl = `/api/pledges/${pledgeId}/confirm-add-items`;

  const start = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await apiFetch(`/api/pledges/${pledgeId}/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addons: [], amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Couldn't start the additional payment");
      }

      // Saved card: already charged and applied by the API. No payment step.
      if (data.type === "off_session_charge" || data.ok === true) {
        onComplete();
        return;
      }

      if (data.paymentMethod === "WHOP") {
        setState({
          kind: "whop",
          sessionId: data.sessionId || "",
          planId: data.planId || "",
          environment: data.environment === "sandbox" ? "sandbox" : "production",
        });
        return;
      }


      if (data.clientSecret) {
        if (!data.publishableKey) {
          throw new Error(
            "Divinity Payments configuration is missing. Please contact support."
          );
        }
        setStripePromise(loadStripe(data.publishableKey));
        setState({ kind: "dc_elements", clientSecret: data.clientSecret });
        return;
      }

      throw new Error("This pledge's payment processor can't take additional support.");
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't start the additional payment",
      });
    }
  }, [pledgeId, amount, onComplete]);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setIsProcessing(false);
      setStripePromise(null);
      setState({ kind: "loading" });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    start();
  }, [open, start]);

  // Payment cleared on the processor — tell the server to apply it. The money
  // is already gone by this point, so a failure here is a support issue, not a
  // retry: never report it as success.
  const applyPayment = useCallback(async () => {
    try {
      const res = await apiFetch(confirmUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            data.error ||
            "Your payment went through but we couldn't add it to your pledge. Please contact support.",
        });
        setIsProcessing(false);
        return;
      }
      onComplete();
    } catch {
      setState({
        kind: "error",
        message:
          "Your payment went through but we couldn't add it to your pledge. Please contact support.",
      });
      setIsProcessing(false);
    }
  }, [confirmUrl, onComplete]);

  const handleError = useCallback((message: string) => {
    setState({ kind: "error", message });
    setIsProcessing(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add ${amount.toFixed(2)} in support</DialogTitle>
          <DialogDescription>
            Complete the payment below to add this to your pledge. Your pledge total updates
            as soon as the payment clears.
          </DialogDescription>
        </DialogHeader>

        {state.kind === "loading" && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Setting up your payment...</p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-3 py-2">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  startedRef.current = true;
                  start();
                }}
              >
                Try Again
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {state.kind === "whop" && (
          <WhopPaymentForm
            sessionId={state.sessionId}
            planId={state.planId}
            pledgeId={pledgeId}
            environment={state.environment}
            agreedToTerms
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            onSuccess={applyPayment}
            onError={handleError}
            total={amount}
            confirmUrl={confirmUrl}
          />
        )}


        {state.kind === "dc_elements" && stripePromise && (
          <Elements
            key={state.clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret: state.clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#028858",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  borderRadius: "8px",
                  spacingUnit: "5px",
                },
                rules: {
                  ".Tab": { borderRadius: "8px", boxShadow: "none" },
                  ".Tab--selected": { borderColor: "#028858", boxShadow: "0 0 0 1.5px #028858" },
                  ".Input": { borderRadius: "8px", boxShadow: "none", padding: "10px 12px" },
                  ".Input:focus": { borderColor: "#028858", boxShadow: "0 0 0 1.5px #028858" },
                  ".Label": { fontWeight: "500", fontSize: "14px", marginBottom: "6px" },
                },
              },
            }}
          >
            <DcCardForm
              total={amount}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              onSuccess={applyPayment}
              onError={handleError}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
