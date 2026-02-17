"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { StripeConnectSectionProps } from "./types";

export function StripeConnectSection({
  stripeStatus,
  connectError,
  isConnecting,
  isResetting,
  handleConnectStripe,
  setShowResetConfirm,
}: StripeConnectSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Connect Your Stripe Account</h3>

      {/* Show errors if any */}
      {(stripeStatus.error || connectError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stripe Connection Issue</AlertTitle>
          <AlertDescription className="space-y-3">
            <span>{stripeStatus.error || connectError}</span>
            {connectError?.includes("already connected") && (
              <div className="flex flex-col gap-2">
                <span>
                  If you previously connected a Stripe account but never completed onboarding,
                  you can reset your connection and try again.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isResetting}
                  className="w-fit"
                >
                  {isResetting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset Stripe Connection
                    </>
                  )}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card className={stripeStatus.onboarded ? "border-green-500" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                stripeStatus.onboarded ? "bg-green-500" : "bg-[#635BFF]"
              }`}>
                {stripeStatus.onboarded ? (
                  <CheckCircle className="h-6 w-6 text-white" />
                ) : (
                  <CreditCard className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {stripeStatus.onboarded ? "Stripe Connected" : "Stripe Connect"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stripeStatus.loading ? (
                    "Checking connection status..."
                  ) : stripeStatus.onboarded ? (
                    "Your Stripe account is connected and ready to receive payments."
                  ) : stripeStatus.connected ? (
                    "Your Stripe account is connected but onboarding is incomplete. Click to continue setup."
                  ) : (
                    "Connect or create a Stripe account to receive payouts. You'll complete identity verification through Stripe's secure process."
                  )}
                </p>
              </div>
            </div>
            {stripeStatus.onboarded ? (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isResetting}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {isResetting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnectStripe}
                disabled={isConnecting || stripeStatus.loading}
              >
                {stripeStatus.loading ? "Checking..." : isConnecting ? "Connecting..." : stripeStatus.connected ? "Complete Setup" : "Connect Stripe"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!stripeStatus.onboarded && (
        <p className="text-xs text-muted-foreground">
          Don&apos;t have a Stripe account?{" "}
          <a
            href="https://stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Sign up for free
          </a>
          {" "}&bull; It only takes a few minutes to get started
        </p>
      )}
    </div>
  );
}
