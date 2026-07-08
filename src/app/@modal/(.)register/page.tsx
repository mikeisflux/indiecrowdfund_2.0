import { Suspense } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuthModal } from "@/components/auth/auth-modal";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterModal() {
  return (
    <AuthModal>
      <div className="flex flex-col space-y-1 text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground">Start funding or backing creative projects</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
        <RegisterForm />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors">
          Sign in
        </Link>
      </p>
    </AuthModal>
  );
}
