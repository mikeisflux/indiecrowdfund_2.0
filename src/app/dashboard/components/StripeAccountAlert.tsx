"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface StripeAccountAlertProps {
  projectId?: string;
}

export function StripeAccountAlert({ projectId }: StripeAccountAlertProps) {
  const [processor, setProcessor] = useState<string | null>(null);
  const [isNsfw, setIsNsfw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [switching, setSwitching] = useState(false);

  const fetchProcessor = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/payment`);
      if (!res.ok) return;
      const data = await res.json();
      setProcessor(data.paymentProcessor || null);
      setIsNsfw(Boolean(data.hasAdultContent) || Boolean(data.hasRiskyContent));
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProcessor();
  }, [fetchProcessor]);

  const handleSwitch = async () => {
    if (!projectId) return;
    setSwitching(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentProcessor: "PAYPAL" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to switch processor");
      }
      setProcessor("PAYPAL");
      toast.success("Switched to PayPal! New pledges will now use PayPal checkout.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch to PayPal");
    } finally {
      setSwitching(false);
    }
  };

  // Only show for non-NSFW projects currently using Stripe
  if (loading || dismissed || !projectId || processor !== "STRIPE" || isNsfw) return null;

  return (
    <div className="container relative mb-4">
      <Alert className="relative bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700">
        <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 w-full">
          <div className="flex-1">
            <AlertTitle className="text-base font-semibold text-amber-900 dark:text-amber-200">
              Switch Your Campaign to PayPal
            </AlertTitle>
            <AlertDescription className="mt-1 space-y-1">
              <p className="text-amber-700 dark:text-amber-300">
                IndieCrowdfund now uses PayPal as the primary payment processor. Switch now — existing pledges are unaffected and new pledges will use PayPal checkout immediately.
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-sm">
                Make sure your <strong>PayPal payout email</strong> is saved in Settings → Payments before switching.
              </p>
            </AlertDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleSwitch}
              disabled={switching}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {switching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wallet className="h-4 w-4 mr-2" />
              )}
              Switch to PayPal
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600 hover:text-amber-800 dark:text-amber-400"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
