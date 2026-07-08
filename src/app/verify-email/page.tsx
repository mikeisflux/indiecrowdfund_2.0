"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const token = searchParams?.get("token") ?? null;
  const email = searchParams?.get("email") ?? null;

  useEffect(() => {
    async function verifyEmail() {
      // Token alone is sufficient — older signup emails only included
      // ?token=... and the API now derives the email from the row.
      // We still pass email when present to skip the lookup.
      if (!token) {
        setStatus("error");
        setMessage("Invalid verification link. Token is missing.");
        return;
      }

      try {
        const params = new URLSearchParams({ token });
        if (email) params.set("email", email);
        const response = await fetch(`/api/user/verify-email?${params}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to verify email. Please try again.");
        }
      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        setMessage("An error occurred while verifying your email. Please try again.");
      }
    }

    verifyEmail();
  }, [token, email]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            )}
            {status === "success" && (
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            )}
            {status === "error" && (
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Verifying Email..."}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription className="mt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "success" && (
            <>
              <p className="text-sm text-muted-foreground">
                Your email is verified. Discover a project to back, or head to
                your dashboard to finish setting up your profile.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => router.push("/crowdfunds")} className="w-full">
                  Browse Crowdfunds
                </Button>
                <Button variant="outline" onClick={() => router.push("/dashboard")} className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}
          {status === "error" && (
            <>
              <p className="text-sm text-muted-foreground">
                The verification link may have expired or been used already.
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/dashboard/settings">
                  <Button className="w-full">
                    <Mail className="mr-2 h-4 w-4" />
                    Request New Verification Email
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => router.push("/")} className="w-full">
                  Go to Home
                </Button>
              </div>
            </>
          )}
          {status === "loading" && (
            <p className="text-sm text-muted-foreground">
              Please wait while we verify your email address...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <CardTitle>Loading...</CardTitle>
          <CardDescription className="mt-2">
            Please wait...
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
