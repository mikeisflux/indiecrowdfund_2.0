import { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Loader2, Sparkles, Rocket, Users, Gift } from "lucide-react";

export const metadata: Metadata = {
  title: "Create Account | IndieCrowdfund",
  description: "Create your IndieCrowdfund account to start funding or backing creative projects",
};

function RegisterFormFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const benefits = [
  { icon: Rocket, text: "Launch your creative projects" },
  { icon: Users, text: "Connect with passionate backers" },
  { icon: Gift, text: "Back projects you love" },
];

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-purple-500/5">
        <div className="floating-orb absolute -top-40 -left-40 w-[500px] h-[500px] bg-purple-500/20" />
        <div className="floating-orb absolute top-1/2 -right-40 w-[400px] h-[400px] bg-primary/15" style={{ animationDelay: '-7s' }} />
        <div className="floating-orb absolute -bottom-40 left-1/4 w-[350px] h-[350px] bg-cyan-500/15" style={{ animationDelay: '-12s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02] dark:opacity-[0.05]" />

      <div className="container relative z-10 flex min-h-screen w-full flex-col items-center justify-center py-12">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[420px]">
          {/* Logo/Brand area */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 mb-2 animate-in fade-in slide-in-from-top-4 duration-500"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              IndieCrowdfund
            </span>
          </Link>

          {/* Benefits */}
          <div
            className="flex justify-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500"
            style={{ animationDelay: '50ms' }}
          >
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-1 text-center"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <benefit.icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground max-w-[80px]">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Main card */}
          <div
            className="glass-card rounded-2xl border p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: '100ms' }}
          >
            <div className="flex flex-col space-y-2 text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Create an account
              </h1>
              <p className="text-sm text-muted-foreground">
                Start funding or backing creative projects
              </p>
            </div>
            <Suspense fallback={<RegisterFormFallback />}>
              <RegisterForm />
            </Suspense>
          </div>

          {/* Footer links */}
          <div
            className="text-center text-sm text-muted-foreground animate-in fade-in duration-500"
            style={{ animationDelay: '200ms' }}
          >
            <p>
              Already have an account?{" "}
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
