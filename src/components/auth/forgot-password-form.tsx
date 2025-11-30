"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(formData);
      if (result?.error) {
        if ("_form" in result.error && result.error._form) {
          setError(result.error._form[0]);
        } else if ("email" in result.error && result.error.email) {
          setError(result.error.email[0]);
        }
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            If an account with that email exists, we&apos;ve sent you a password
            reset link. Please check your inbox.
          </AlertDescription>
        </Alert>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <button
            onClick={() => setSuccess(false)}
            className="text-primary hover:underline"
          >
            try again
          </button>
        </p>

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

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
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
