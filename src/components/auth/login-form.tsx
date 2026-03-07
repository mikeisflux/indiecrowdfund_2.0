"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  // Support both 'callbackUrl' and 'redirect' params
  const callbackUrl = searchParams?.get("callbackUrl") || searchParams?.get("redirect") || "/choose-role";

  // Handle URL error params on mount
  useEffect(() => {
    const urlError = searchParams?.get("error");
    if (urlError) {
      setError(urlError === "SessionRequired"
        ? "Please sign in to access this page."
        : "An error occurred. Please try again.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Client-side email validation
    const email = formData.get("email") as string;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const password = formData.get("password") as string;
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData, callbackUrl);

      if (result?.success && result?.redirectTo) {
        // Use hard navigation to ensure cookie is sent with request
        window.location.href = result.redirectTo;
        return;
      }

      if (result?.error) {
        const errorObj = result.error as Record<string, string[] | undefined>;
        if (errorObj._form) {
          setError(errorObj._form[0]);
        } else if (errorObj.email) {
          setError(errorObj.email[0]);
        } else if (errorObj.password) {
          setError(errorObj.password[0]);
        } else {
          setError("Invalid email or password");
        }
      } else if (!result?.success) {
        // No result or unexpected response
        setError("Something went wrong. Please refresh the page and try again.");
      }
    } catch (err) {
      // Log error for debugging
      console.error("Login error:", err);
      // Likely a stale page/server action issue
      setError("Something went wrong. Please refresh the page (Ctrl+Shift+R) and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary/80 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href={callbackUrl !== "/choose-role" ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"} className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
