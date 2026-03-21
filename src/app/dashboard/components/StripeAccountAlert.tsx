"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Loader2, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface StripeAccountStatus {
  hasAccount: boolean;
  status: "none" | "enabled" | "restricted" | "restricted_soon" | "pending" | "incomplete" | "revoked";
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  disabledReason?: string | null;
  currentDeadline?: string | null;
  pendingRequirements?: string[];
  pastDue?: boolean;
}

export function StripeAccountAlert() {
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/connect/status");
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } catch {
      // Silently fail - don't block the dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleFixAccount = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/stripe/connect/refresh", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get onboarding link");
      }
      const data = await res.json();
      if (data.onboardingUrl) {
        window.open(data.onboardingUrl, "_blank");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open Stripe onboarding");
    } finally {
      setRefreshing(false);
    }
  };

  // Don't show anything while loading, if dismissed, no account, or account is fine
  if (loading || dismissed || !status?.hasAccount) return null;
  if (status.status === "enabled" || status.status === "none") return null;

  const isRestricted = status.status === "restricted" || status.status === "revoked";
  const isRestrictedSoon = status.status === "restricted_soon";
  const uniqueRequirements = [...new Set(status.pendingRequirements || [])];

  const deadlineDate = status.currentDeadline
    ? new Date(status.currentDeadline).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="container relative mb-4">
      <Alert
        variant={isRestricted ? "destructive" : "warning"}
        className={`relative ${
          isRestricted
            ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800"
            : "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800"
        }`}
      >
        {isRestricted ? (
          <ShieldAlert className="h-5 w-5" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 w-full">
          <div className="flex-1">
            <AlertTitle className="text-base font-semibold">
              {isRestricted
                ? "Your Stripe Account is Restricted"
                : "Stripe Account Action Required"}
            </AlertTitle>
            <AlertDescription className="mt-1">
              <p className={isRestricted ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}>
                {isRestricted
                  ? "Your ability to accept payments, receive payouts, and process transfers has been disabled. Please update your account information to restore full functionality."
                  : "Your Stripe account needs additional information to avoid restrictions on payments and payouts."}
              </p>
              {uniqueRequirements.length > 0 && (
                <div className="mt-2">
                  <p className={`text-sm font-medium ${isRestricted ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    Information needed:
                  </p>
                  <ul className={`mt-1 text-sm list-disc list-inside space-y-0.5 ${isRestricted ? "text-red-600/80 dark:text-red-400/80" : "text-amber-600/80 dark:text-amber-400/80"}`}>
                    {uniqueRequirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
              {deadlineDate && (
                <p className={`mt-2 text-sm font-medium ${isRestricted ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  Deadline: {deadlineDate}
                </p>
              )}
            </AlertDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleFixAccount}
              disabled={refreshing}
              size="sm"
              variant={isRestricted ? "destructive" : "default"}
              className={isRestricted ? "" : "bg-amber-600 hover:bg-amber-700 text-white"}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Fix Now
            </Button>
            {isRestrictedSoon && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDismissed(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Alert>
    </div>
  );
}
