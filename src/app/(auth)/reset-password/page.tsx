import { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Loader2, Sparkles, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Reset Password | IndieCrowdfund",
  description: "Create a new password for your IndieCrowdfund account",
};

function ResetPasswordFormFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-emerald-500/5">
        <div className="floating-orb absolute -top-40 -left-40 w-[500px] h-[500px] bg-emerald-500/20" />
        <div className="floating-orb absolute top-1/2 -right-40 w-[400px] h-[400px] bg-primary/15" style={{ animationDelay: '-6s' }} />
        <div className="floating-orb absolute -bottom-40 left-1/3 w-[350px] h-[350px] bg-cyan-500/15" style={{ animationDelay: '-11s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] dark:opacity-[0.05]" />

      <div className="container relative z-10 flex min-h-screen w-full flex-col items-center justify-center py-12">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          {/* Logo/Brand area */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 mb-4 animate-in fade-in slide-in-from-top-4 duration-500"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              IndieCrowdfund
            </span>
          </Link>

          {/* Main card */}
          <div
            className="glass-card rounded-2xl border p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '100ms' }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-8 w-8" />
              </div>
            </div>

            <div className="flex flex-col space-y-2 text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Reset your password
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your new password below
              </p>
            </div>
            <Suspense fallback={<ResetPasswordFormFallback />}>
              <ResetPasswordForm />
            </Suspense>
          </div>

          {/* Footer */}
          <div
            className="text-center text-sm text-muted-foreground animate-in fade-in duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <p>
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
