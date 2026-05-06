"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Library, Loader2, XCircle, ArrowLeft } from "lucide-react";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams?.get("session_id") ?? null;

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setErrorMessage("No session ID provided");
      return;
    }

    const verifySession = async () => {
      try {
        const res = await fetch(`/api/marketplace/checkout/verify?session_id=${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error || "Failed to verify purchase");
          return;
        }

        setStatus("success");
        setBookTitle(data.bookTitle);
      } catch {
        setStatus("error");
        setErrorMessage("Failed to verify purchase. Please check your Digital Library.");
      }
    };

    verifySession();
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="bg-card backdrop-blur-md border-border max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-purple-500 dark:text-purple-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Verifying Purchase...</h1>
            <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="bg-card backdrop-blur-md border-border max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-500 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Something Went Wrong</h1>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            <div className="grid gap-3">
              <Link href="/dashboard/backer?tab=downloads">
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                  <Library className="w-4 h-4 mr-2" />
                  Check Digital Library
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Marketplace
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="bg-card backdrop-blur-md border-border max-w-md w-full mx-4 relative">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Purchase Successful!</h1>
          <p className="text-muted-foreground mb-6">
            {bookTitle ? (
              <>
                &quot;{bookTitle}&quot; has been delivered to your Digital Library.
              </>
            ) : (
              <>Your book has been delivered to your Digital Library.</>
            )}
          </p>
          <div className="grid gap-3">
            <Link href="/dashboard/backer?tab=downloads">
              <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Library className="w-4 h-4 mr-2" />
                Go Read It Now
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/marketplace")}
            >
              Continue Browsing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-purple-500 dark:text-purple-400 animate-spin" />
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
