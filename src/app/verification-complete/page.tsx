"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function VerificationCompletePage() {
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(3);
  const [isPopup, setIsPopup] = useState(false);
  const returnUrl = searchParams.get("returnUrl") || "/";

  useEffect(() => {
    // Check if opened as a popup
    const hasOpener = !!window.opener;
    setIsPopup(hasOpener);

    if (hasOpener) {
      // Notify the parent window that verification is complete
      try {
        window.opener.postMessage({ type: "verification-complete" }, "*");
      } catch (e) {
        // Ignore cross-origin errors
      }
      // Close the popup after a brief delay
      setTimeout(() => {
        window.close();
      }, 2000);
      return;
    }

    // If not a popup, countdown and redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = decodeURIComponent(returnUrl);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [returnUrl]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-[#05ce78]/10 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-[#05ce78]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-2">Verification Complete</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for completing the identity verification process. Your account has been verified successfully.
          </p>

          {!isPopup && countdown > 0 && (
            <p className="text-sm text-muted-foreground">
              Redirecting you back in {countdown} second{countdown !== 1 ? "s" : ""}...
            </p>
          )}

          {isPopup && (
            <p className="text-sm text-muted-foreground">
              This window will close automatically...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
