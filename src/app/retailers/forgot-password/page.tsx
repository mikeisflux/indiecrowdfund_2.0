import { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Store, ArrowLeft, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "Forgot Password | Retailer Portal",
  description: "Reset your retailer account password",
};

export default function RetailerForgotPasswordPage() {
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

          <ForgotPasswordForm />
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
