"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { register } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { Recaptcha } from "./recaptcha";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);
  const [isRecaptchaEnabled, setIsRecaptchaEnabled] = useState(false);
  const [recaptchaFailed, setRecaptchaFailed] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || searchParams?.get("redirect");

  // Fetch reCAPTCHA settings from API (supports both DB and env config)
  useEffect(() => {
    async function fetchRecaptchaSettings() {
      try {
        const res = await fetch("/api/auth/recaptcha");
        if (res.ok) {
          const data = await res.json();
          setIsRecaptchaEnabled(data.enabled);
          setRecaptchaSiteKey(data.siteKey);
        }
      } catch (err) {
        console.error("Failed to fetch reCAPTCHA settings:", err);
      }
    }
    fetchRecaptchaSettings();
  }, []);

  // Timeout for reCAPTCHA loading - if it doesn't load in 10s, allow fallback
  useEffect(() => {
    if (!isRecaptchaEnabled || !recaptchaSiteKey) return;

    const timeout = setTimeout(() => {
      if (!recaptchaLoaded && !recaptchaToken) {
        console.warn("[reCAPTCHA] Failed to load - may be blocked by browser/extension");
        setRecaptchaFailed(true);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isRecaptchaEnabled, recaptchaSiteKey, recaptchaLoaded, recaptchaToken]);

  const handleRecaptchaVerify = useCallback((token: string) => {
    setRecaptchaToken(token);
    setRecaptchaLoaded(true);
  }, []);

  const handleRecaptchaLoad = useCallback(() => {
    setRecaptchaLoaded(true);
  }, []);

  const handleRecaptchaExpire = useCallback(() => {
    setRecaptchaToken(null);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Check reCAPTCHA if enabled (but allow if reCAPTCHA failed to load - honeypot will protect)
    if (isRecaptchaEnabled && !recaptchaToken && !recaptchaFailed) {
      setError("Please complete the CAPTCHA");
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Add reCAPTCHA token if available
    if (recaptchaToken) {
      formData.set("recaptchaToken", recaptchaToken);
    }

    try {
      const result = await register(formData, callbackUrl);

      if (result?.success && result?.redirectTo) {
        // Use hard navigation to ensure cookie is sent with request
        window.location.href = result.redirectTo;
        return;
      }

      if (result?.error) {
        if (typeof result.error === "object") {
          const firstError = Object.values(result.error).flat()[0];
          setError(firstError as string);
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else if (!result?.success) {
        // No result or unexpected response
        setError("Something went wrong. Please refresh the page and try again.");
      }
    } catch (err) {
      // Log the error for debugging
      console.error("Registration error:", err);
      // Show user-friendly error - likely a stale page/server action issue
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
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            autoComplete="name"
            required
            disabled={isLoading}
          />
        </div>

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
          <Label htmlFor="password">Password</Label>
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

        {/* Honeypot field - hidden from users, bots will fill it */}
        <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
          <label htmlFor="website">Website (leave blank)</label>
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* reCAPTCHA - only show if enabled and not failed */}
        {isRecaptchaEnabled && recaptchaSiteKey && !recaptchaFailed && (
          <div className="flex justify-center">
            <Recaptcha
              siteKey={recaptchaSiteKey}
              onVerify={handleRecaptchaVerify}
              onExpire={handleRecaptchaExpire}
              onLoad={handleRecaptchaLoad}
            />
          </div>
        )}

        {/* Warning when reCAPTCHA failed to load */}
        {recaptchaFailed && (
          <p className="text-xs text-muted-foreground text-center">
            Security verification couldn&apos;t load (may be blocked by your browser or an extension).
            You can still create an account.
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || (isRecaptchaEnabled && !recaptchaToken && !recaptchaFailed)}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms of Service & Privacy Policy
        </Link>
      </p>
    </div>
  );
}
