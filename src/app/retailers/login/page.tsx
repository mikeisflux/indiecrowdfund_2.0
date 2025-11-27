"use client";

import { useState } from "react";
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

export default function RetailerLoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<"credentials" | "accessCode">("credentials");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    accessCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/retailers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: loginMethod,
          ...formData,
        }),
      });

      if (response.ok) {
        router.push("/retailers/dashboard");
      } else {
        const data = await response.json();
        setError(data.error || "Invalid credentials");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/retailers"
            className="inline-flex items-center text-sm text-white/80 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Retailer Info
          </Link>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Store className="h-7 w-7 text-emerald-600" />
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
                    : "text-zinc-500 hover:text-zinc-700"
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
                    : "text-zinc-500 hover:text-zinc-700"
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
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
                    <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
                  <p className="text-xs text-zinc-500">
                    Your access code was sent to you when your application was approved.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={isLoading}
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
              <span className="text-zinc-500">Not a certified retailer yet?</span>{" "}
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
