"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink, Loader2, Wallet } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

interface ConnectStatus {
  connected: boolean;
  ready?: boolean;
  status?: string;
  paymentsReceivable?: boolean;
  emailConfirmed?: boolean;
}

/**
 * Creator-facing PayPal Connect onboarding. Kicks off the Partner Referrals
 * flow (POST /api/paypal/connect/onboard) and reflects the live onboarding
 * status (GET /api/paypal/connect/status). Shown when a project selects the
 * PAYPAL_CONNECT processor.
 */
export function PayPalConnectPayoutSection() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/paypal/connect/status");
      const data = await res.json();
      if (res.ok) setStatus(data);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/paypal/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.actionUrl) {
        throw new Error(data.error || "Failed to start PayPal onboarding");
      }
      // Redirect the creator to PayPal to sign up / grant permissions.
      window.location.href = data.actionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start PayPal onboarding");
      setConnecting(false);
    }
  };

  const ready = status?.ready;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#003087] flex items-center justify-center">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          Connect your PayPal account
          {ready && (
            <Badge variant="secondary" className="ml-2 flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" /> Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Link your PayPal account so pledges are paid directly to you, with the
          grant administration fee taken automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking connection status…
          </div>
        ) : ready ? (
          <Alert className="bg-green-50/50 dark:bg-green-900/20 border-green-500/30">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle>PayPal account connected</AlertTitle>
            <AlertDescription>
              Your account can receive payments. You&apos;re all set to accept pledges.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {status?.connected && !ready && (
              <Alert className="bg-amber-50/50 dark:bg-amber-900/20 border-amber-500/30">
                <AlertTitle>Onboarding not finished</AlertTitle>
                <AlertDescription>
                  {status?.emailConfirmed === false
                    ? "Confirm your PayPal account email to finish, then refresh."
                    : "Finish granting permissions on PayPal, then refresh."}
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to PayPal…
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {status?.connected ? "Continue PayPal setup" : "Connect PayPal account"}
                </>
              )}
            </Button>
            {status?.connected && (
              <Button variant="ghost" size="sm" onClick={loadStatus}>
                Refresh status
              </Button>
            )}
          </>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
