"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Store,
  Lock,
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Key,
} from "lucide-react";
import { Recaptcha } from "@/components/auth/recaptcha";
import { fetchRecaptchaConfig } from "@/lib/recaptcha-client";

export default function RetailerLoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<"credentials" | "accessCode">("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);

  const handleRecaptchaVerify = useCallback((token: string) => {
    setRecaptchaToken(token);
  }, []);

  const handleRecaptchaExpire = useCallback(() => {
    setRecaptchaToken(null);
  }, []);

  // Fetch reCAPTCHA settings from API (supports both DB and env config)
  useEffect(() => {
    fetchRecaptchaConfig().then(({ enabled, siteKey }) => {
      setRecaptchaEnabled(enabled);
      setRecaptchaSiteKey(siteKey);
    });
  }, []);

  // Check if user is already logged in via NextAuth with retailerAccess
  useEffect(() => {
    const checkSession = async () => {
      try {
        // First check if user has retailer access via their session
        const checkResponse = await apiFetch("/api/retailers/session-auth");
        const checkData = await checkResponse.json();

        if (checkData.hasAccess) {
          setSessionMessage("You have retailer access. Redirecting...");

          // Try to auto-authenticate
          const authResponse = await apiFetch("/api/retailers/session-auth", {
            method: "POST"
          });

          if (authResponse.ok) {
            const authData = await authResponse.json();
            if (authData.success || authData.isAdmin) {
              window.location.href = "/retailers/dashboard";
              return;
            }
          } else {
            const authData = await authResponse.json();
            // If there's an error (like pending application), show it
            if (authData.error) {
              setError(authData.error);
            }
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setIsCheckingSession(false);
        setSessionMessage("");
      }
    };

    checkSession();
  }, [router]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    accessCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Check captcha if enabled
    if (recaptchaEnabled && !recaptchaToken) {
      setError("Please complete the CAPTCHA");
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiFetch("/api/retailers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: loginMethod,
          ...formData,
          recaptchaToken,
        }),
      });

      if (response.ok) {
        // Use window.location.href for full navigation to ensure session is properly set
        window.location.href = "/retailers/dashboard";
      } else {
        const data = await response.json();
        setError(data.error || "Invalid credentials");
        // Reset captcha on error
        setRecaptchaToken(null);
      }
    } catch {
      setError("An error occurred. Please try again.");
      setRecaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading spinner while checking session
  if (isCheckingSession) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4 overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-white/10" />
          <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-emerald-400/20" style={{ animationDelay: '-5s' }} />
        </div>
        <div className="text-center relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">
            {sessionMessage || "Checking your session..."}
          </p>
        </div>
      </div>
    );
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
            href="/retailers"
            className="inline-flex items-center text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Retailer Info
          </Link>
        </div>

        <Card className="glass-card shadow-2xl border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
              <Store className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="mt-4 text-2xl">Retailer Portal</CardTitle>
            <CardDescription>
              Sign in to access wholesale pricing and orders
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Login Method Toggle */}
            <div className="mb-6 flex rounded-lg border p-1">
              <button
                type="button"
                onClick={() => setLoginMethod("credentials")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMethod === "credentials"
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-muted-foreground hover:text-zinc-700"
                }`}
              >
                Email & Password
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod("accessCode")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMethod === "accessCode"
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-muted-foreground hover:text-zinc-700"
                }`}
              >
                Access Code
              </button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {loginMethod === "credentials" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="retailer@example.com"
                        className="pl-10"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        href="/retailers/forgot-password"
                        className="text-xs text-emerald-600 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="accessCode">Retailer Access Code</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="accessCode"
                      type="text"
                      placeholder="XXXX-XXXX-XXXX"
                      className="pl-10 font-mono uppercase"
                      value={formData.accessCode}
                      onChange={(e) =>
                        setFormData({ ...formData, accessCode: e.target.value.toUpperCase() })
                      }
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your access code was sent to you when your application was approved.
                  </p>
                </div>
              )}

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
                className="w-full btn-glow bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                disabled={isLoading || (recaptchaEnabled && !recaptchaToken)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Not a certified retailer yet?</span>{" "}
              <Link
                href="/retailers/apply"
                className="font-medium text-emerald-600 hover:underline"
              >
                Apply Now
              </Link>
            </div>
          </CardContent>
        </Card>

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
