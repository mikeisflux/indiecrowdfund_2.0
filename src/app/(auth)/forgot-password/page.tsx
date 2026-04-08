import { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Sparkles, ArrowLeft, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your IndieCrowdfund account password. Enter your email to receive a password reset link.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-amber-500/5">
        <div className="floating-orb absolute -top-40 right-1/4 w-[450px] h-[450px] bg-amber-500/20" />
        <div className="floating-orb absolute bottom-1/3 -left-40 w-[400px] h-[400px] bg-primary/15" style={{ animationDelay: '-8s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[300px] h-[300px] bg-purple-500/15" style={{ animationDelay: '-15s' }} />
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
            className="glass-card rounded-2xl border p-6 sm:p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '100ms' }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <KeyRound className="h-8 w-8" />
              </div>
            </div>

            <div className="flex flex-col space-y-2 text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Forgot your password?
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link
              </p>
            </div>
            <ForgotPasswordForm />
          </div>

          {/* Back to login */}
          <div
            className="text-center animate-in fade-in duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
