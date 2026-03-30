"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";

interface StripeStatus {
  connected: boolean;
  onboarded: boolean;
  accountId?: string;
}

export default function PaymentSettingsPage() {
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStripeStatus();
  }, []);

  const fetchStripeStatus = async () => {
    try {
      const res = await fetch("/api/stripe/connect");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setStripeStatus(data);
    } catch {
      setError("Failed to load payment settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const res = await apiFetch("/api/stripe/connect", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start Stripe connection");
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsConnecting(false);
    }
  };

  const handleContinueOnboarding = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const res = await apiFetch("/api/stripe/connect/refresh", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to continue onboarding");
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="container max-w-2xl py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-2xl py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Payment Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Connect your Stripe account to receive payments from backers.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#635BFF]/10">
                  <CreditCard className="h-5 w-5 text-[#635BFF]" />
                </div>
                <div>
                  <CardTitle>Stripe</CardTitle>
                  <CardDescription>Accept credit card payments</CardDescription>
                </div>
              </div>
              {stripeStatus?.onboarded ? (
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
              ) : stripeStatus?.connected ? (
                <Badge variant="secondary">Pending</Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stripeStatus?.onboarded ? (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  <p className="text-sm">
                    Your Stripe account is connected and ready to receive payments.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Account ID: {stripeStatus.accountId}</p>
                </div>
                <Button variant="outline" asChild>
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Stripe Dashboard
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </>
            ) : stripeStatus?.connected ? (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-4 text-yellow-800">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">
                    Your Stripe account setup is incomplete. Please finish the onboarding process.
                  </p>
                </div>
                <Button onClick={handleContinueOnboarding} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Continue Stripe Setup
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your Stripe account to start receiving payments from backers.
                  Stripe handles all payment processing securely.
                </p>
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium">With Stripe you can:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>Accept credit and debit cards from backers worldwide</li>
                    <li>Receive payouts directly to your bank account</li>
                    <li>View transaction history and analytics</li>
                    <li>Handle refunds and disputes easily</li>
                  </ul>
                </div>
                <Button onClick={handleConnectStripe} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Connect Stripe Account
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Payment Processing</CardTitle>
            <CardDescription>
              How payments work on IndieCrowdfund
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <p className="font-medium text-foreground">Platform Fee</p>
              <p>
                IndieCrowdfund charges a 5% platform fee on successful pledges.
                This fee is automatically deducted when processing payments.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Stripe Fees</p>
              <p>
                Standard Stripe processing fees apply (typically 2.9% + $0.30 per transaction).
                These fees are charged by Stripe, not IndieCrowdfund.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Payouts</p>
              <p>
                Payments are transferred directly to your connected Stripe account.
                Payout timing depends on your Stripe account settings (typically 2-7 business days).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
