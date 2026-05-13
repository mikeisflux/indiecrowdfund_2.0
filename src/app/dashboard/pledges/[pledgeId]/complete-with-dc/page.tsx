"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { StripePaymentForm } from "@/app/projects/[vanityname]/[slug]/pledge/components/StripePaymentForm";

interface MigrateInfo {
  pledge: {
    id: string;
    amount: number;
    rewardTitle: string | null;
    rewardAmount: number;
    addons: { title: string; quantity: number; amount: number }[];
    shippingAmount: number;
  };
  project: { title: string; url: string };
  clientSecret: string;
  publishableKey: string;
  paymentIntentId: string;
  alreadyCompleted?: boolean;
  projectUrl?: string;
}

/**
 * Page where a backer completes their pledge with DivinityCoin after
 * the campaign was migrated off Mentom Payments. Reached from the
 * "Action needed" email sent by the admin migrate-to-dc tool.
 *
 * The page calls /api/pledges/[pledgeId]/migrate-to-dc to spin up a
 * fresh DC PaymentIntent and renders Stripe Elements with DC's
 * publishable key. On payment success DC's webhook
 * (POST /api/webhooks/divinitycoin payment.succeeded event) marks
 * the pledge COMPLETED and fires the normal finalize side effects.
 *
 * No data is lost: same pledge id, same reward, same add-ons, same
 * backer number, same shipping address.
 */
export default function CompleteWithDcPage() {
  const params = useParams<{ pledgeId: string }>();
  const router = useRouter();
  const pledgeId = params?.pledgeId || "";

  const [info, setInfo] = useState<MigrateInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (!pledgeId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/pledges/${encodeURIComponent(pledgeId)}/migrate-to-dc`);
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(data?.error || "Failed to load migration info");
          return;
        }
        if (data.alreadyCompleted) {
          // Pledge already paid via DC — backer hit this page after
          // already completing. Show the success state with a CTA back
          // to the project, no need to re-render Elements.
          setInfo(data);
          setSuccess(true);
          return;
        }
        setInfo(data);
        // Lazy-load Stripe.js scoped to DC's publishable key (not the
        // platform's own Stripe Connect key — those are different
        // gateways even though both call themselves "Stripe").
        setStripePromise(loadStripe(data.publishableKey));
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load migration info"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pledgeId]);

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
    const projectUrl = info.projectUrl || info.project?.url || "/";
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Pledge complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Your pledge to <strong>{info.project?.title}</strong> is confirmed on
              the new processor. Reward, add-ons, and backer number are all
              preserved. The creator has been notified.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => router.push(projectUrl)}>View project</Button>
              <Link href="/dashboard/backer">
                <Button variant="outline">Back to dashboard</Button>
              </Link>
            </div>
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
          <CardTitle>Complete your pledge with Divinity Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              Your previous card was never charged
            </p>
            <p className="text-emerald-800 dark:text-emerald-300 mt-1">
              The original processor for this campaign shut down before your
              card was charged. We&apos;ve moved this project to Divinity Payments
              so you can complete your pledge. Re-enter your card below — your
              reward, add-ons, shipping address, and backer number are all
              preserved.
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

      {paymentError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {paymentError}
        </div>
      )}

      {stripePromise && info.clientSecret && (
        <Elements
          key={info.clientSecret}
          stripe={stripePromise}
          options={{
            clientSecret: info.clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#028858",
                fontFamily: "system-ui, -apple-system, sans-serif",
                borderRadius: "8px",
                spacingUnit: "5px",
              },
            },
          }}
        >
          <Card>
            <CardContent className="p-4 sm:p-6">
              <StripePaymentForm
                onSuccess={() => setSuccess(true)}
                onError={(msg) => setPaymentError(msg)}
                agreedToTerms={true}
                isProcessing={isProcessing}
                setIsProcessing={setIsProcessing}
                total={info.pledge.amount}
                intentType="payment_intent"
                pledgeId={info.pledge.id}
                projectPath={info.project.url}
                buttonLabel={`Pay $${info.pledge.amount.toFixed(2)} and complete pledge`}
              />
            </CardContent>
          </Card>
        </Elements>
      )}
    </div>
  );
}
