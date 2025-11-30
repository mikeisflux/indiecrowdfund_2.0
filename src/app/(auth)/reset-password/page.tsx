import { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Reset Password | IndieCrowdfund",
  description: "Create a new password for your IndieCrowdfund account",
};

function ResetPasswordFormFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
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
    </div>
  );
}
