import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthModal } from "@/components/auth/auth-modal";

export default function ForgotPasswordModal() {
  return (
    <AuthModal>
      <div className="flex flex-col space-y-1 text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground mt-6">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthModal>
  );
}
