"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  resetPassword,
  verifyResetToken,
  type ResetTokenFailure,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  // Why the check failed. "error" means we couldn't reach the server, which
  // is worth retrying — the old code showed those as "invalid link", sending
  // people to request a replacement that would fail identically.
  const [tokenFailure, setTokenFailure] = useState<ResetTokenFailure | null>(null);
  const [recheckNonce, setRecheckNonce] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenFailure("not_found");
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      try {
        const result = await verifyResetToken(token);
        setIsValidToken(result.valid);
        setTokenFailure(result.valid ? null : (result.reason ?? "not_found"));
      } catch {
        // Network failure, a 403/429 from the bot filter, a deploy mid-click
        // — none of these mean the link is bad.
        setIsValidToken(false);
        setTokenFailure("error");
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token, recheckNonce]);

  async function handleSubmit(formData: FormData) {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await resetPassword(formData, token);
      if (result?.error) {
        if ("_form" in result.error && result.error._form) {
          setError(result.error._form[0]);
        } else if ("password" in result.error && result.error.password) {
          setError(result.error.password[0]);
        }
      } else if (result?.success) {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isValidating) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Couldn't reach the server to check. Offer a retry — requesting a new
  // link doesn't help when the check itself is what failed.
  if (tokenFailure === "error") {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            We couldn&apos;t check your reset link just now. This is a problem on
            our end, not with your link — please try again.
          </AlertDescription>
        </Alert>

        <Button className="w-full" onClick={() => setRecheckNonce((n) => n + 1)}>
          Try again
        </Button>

        <Link
          href="/forgot-password"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (!token || !isValidToken) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {tokenFailure === "expired"
              ? "This password reset link has expired. Links are good for 24 hours — request a new one below."
              : "This password reset link has already been used, or it isn't valid. Request a new one below."}
          </AlertDescription>
        </Alert>

        <Link
          href="/forgot-password"
          className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Your password has been reset successfully. You can now sign in with
            your new password.
          </AlertDescription>
        </Alert>

        <Button
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your new password"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reset password
        </Button>
      </form>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
    </div>
  );
}
