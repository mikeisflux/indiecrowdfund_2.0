"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function StripeRefreshPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/stripe/connect/refresh", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh onboarding link");
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  // Automatically try to refresh on page load
  useEffect(() => {
    handleRefresh();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <RefreshCw className={`h-10 w-10 text-primary ${isLoading ? "animate-spin" : ""}`} />
          </div>
          <CardTitle className="text-xl sm:text-2xl">
            {isLoading ? "Refreshing..." : "Session Expired"}
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Getting a new onboarding link for you..."
              : "Your Stripe onboarding session has expired. Click below to continue where you left off."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!isLoading && (
            <>
              <Button className="w-full" onClick={handleRefresh}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Continue Stripe Setup
              </Button>
              <Link href="/dashboard">
                <Button variant="ghost" className="w-full">
                  Return to Dashboard
                </Button>
              </Link>
            </>
          )}

          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
