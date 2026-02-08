"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Store, ArrowLeft, KeyRound, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Recaptcha } from "@/components/auth/recaptcha";

export default function RetailerForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);

  // Fetch reCAPTCHA settings from API (supports both DB and env config)
  useEffect(() => {
    async function fetchRecaptchaSettings() {
      try {
        const res = await fetch("/api/auth/recaptcha");
        if (res.ok) {
          const data = await res.json();
          setRecaptchaEnabled(data.enabled);
          setRecaptchaSiteKey(data.siteKey);
        }
      } catch (err) {
        console.error("Failed to fetch reCAPTCHA settings:", err);
      }
    }
    fetchRecaptchaSettings();
  }, []);

  const handleRecaptchaVerify = useCallback((token: string) => {
    setRecaptchaToken(token);
  }, []);

  const handleRecaptchaExpire = useCallback(() => {
    setRecaptchaToken(null);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Check captcha if enabled
    if (recaptchaEnabled && !recaptchaToken) {
      setError("Please complete the CAPTCHA");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/retailers/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recaptchaToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        setRecaptchaToken(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setRecaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4 overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-white/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-emerald-400/20" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-400/15" style={{ animationDelay: '-10s' }} />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Link
            href="/retailers/login"
            className="inline-flex items-center text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sign In
          </Link>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
              <KeyRound className="h-8 w-8 text-white" />
            </div>
          </div>

          <div className="flex flex-col space-y-2 text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Store className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-600">Retailer Portal</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Forgot your password?
            </h1>
            <p className="text-sm text-zinc-500">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {success ? (
            <div className="space-y-6">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  If an approved retailer account exists with that email, we&apos;ve sent you a password reset link. Please check your inbox.
                </AlertDescription>
              </Alert>

              <p className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => {
                    setSuccess(false);
                    setRecaptchaToken(null);
                  }}
                  className="text-emerald-600 hover:underline"
                >
                  try again
                </button>
              </p>

              <Link
                href="/retailers/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-emerald-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {recaptchaEnabled && recaptchaSiteKey && (
                  <div className="flex justify-center">
                    <Recaptcha
                      siteKey={recaptchaSiteKey}
                      onVerify={handleRecaptchaVerify}
                      onExpire={handleRecaptchaExpire}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  disabled={isLoading || (recaptchaEnabled && !recaptchaToken)}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>

              <Link
                href="/retailers/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-emerald-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-white/70">
          Need help?{" "}
          <a
            href="mailto:retailers@indiecrowdfund.com"
            className="text-white hover:underline"
          >
            Contact retailer support
          </a>
        </p>
      </div>
    </div>
  );
}
