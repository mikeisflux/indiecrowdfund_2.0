"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";

export default function StripeCompletePage() {
  const [status, setStatus] = useState<"loading" | "success" | "pending">("loading");

  useEffect(() => {
    // Check the Stripe account status
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/stripe/connect");
        const data = await res.json();

        if (data.onboarded) {
          setStatus("success");
        } else {
          // Account exists but onboarding not complete
          setStatus("pending");
        }
      } catch (error) {
        console.error("Error checking Stripe status:", error);
        setStatus("pending");
      }
    };

    checkStatus();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verifying your Stripe account...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Stripe Connected!</CardTitle>
            <CardDescription>
              Your Stripe account is now connected and ready to receive payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium">What happens next?</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                <li>When backers pledge to your projects, payments will be processed through Stripe</li>
                <li>Funds will be deposited to your connected bank account</li>
                <li>You can manage your payouts in your Stripe Dashboard</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/dashboard">
                <Button className="w-full">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/projects/new">
                <Button variant="outline" className="w-full">
                  Create a Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending state - onboarding not complete
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Almost There!</CardTitle>
          <CardDescription>
            Your Stripe account setup is not yet complete. Please finish the onboarding process to start receiving payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={async () => {
              try {
                const res = await fetch("/api/stripe/connect/refresh", {
                  method: "POST",
                });
                const data = await res.json();
                if (data.onboardingUrl) {
                  window.location.href = data.onboardingUrl;
                }
              } catch (error) {
                console.error("Error refreshing onboarding:", error);
              }
            }}
          >
            Continue Stripe Setup
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full">
              Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
