"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { register } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Loader2, Check, X as XIcon } from "lucide-react";
import { Recaptcha } from "./recaptcha";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const requirements: PasswordRequirement[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least one number", met: /[0-9]/.test(password) },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const strengthPercent = (metCount / requirements.length) * 100;

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {requirements.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < metCount
                ? metCount === requirements.length
                  ? "bg-green-500"
                  : metCount >= 2
                    ? "bg-yellow-500"
                    : "bg-red-500"
                : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Password strength:{" "}
        <span
          className={cn(
            "font-medium",
            strengthPercent === 100
              ? "text-green-600 dark:text-green-400"
              : strengthPercent >= 67
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400"
          )}
        >
          {strengthPercent === 100 ? "Strong" : strengthPercent >= 67 ? "Medium" : "Weak"}
        </span>
      </p>
      <ul className="space-y-1">
        {requirements.map((req, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs">
            {req.met ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <XIcon className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className={req.met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
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

    // Client-side email validation
    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get("email") as string;
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Client-side password strength validation
    const passwordValue = formData.get("password") as string;
    if (!passwordValue || passwordValue.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(passwordValue)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(passwordValue)) {
      setError("Password must contain at least one number.");
      return;
    }

    // Check reCAPTCHA if enabled (but allow if reCAPTCHA failed to load - honeypot will protect)
    if (isRecaptchaEnabled && !recaptchaToken && !recaptchaFailed) {
      setError("Please complete the CAPTCHA");
      return;
    }

    setIsLoading(true);
    setError(null);

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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrengthIndicator password={password} />
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
