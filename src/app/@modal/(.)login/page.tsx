import { Suspense } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuthModal } from "@/components/auth/auth-modal";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginModal() {
  return (
    <AuthModal>
      <div className="flex flex-col space-y-1 text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors">
          Create one
        </Link>
      </p>
    </AuthModal>
  );
}
