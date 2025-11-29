"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  UserCheck,
  Lock,
} from "lucide-react";

interface IDVerificationGateProps {
  projectId: string;
  children: React.ReactNode;
}

interface VerificationStatus {
  required: boolean;
  verified: boolean;
  enabled: boolean;
  loggedIn: boolean;
  reason?: string;
}

interface UserVerification {
  verified: boolean;
  verifiedAt?: string;
  latestVerification?: {
    id: string;
    status: string;
    verificationUrl?: string;
    requestedAt: string;
    completedAt?: string;
    declineReason?: string;
  };
}

export function IDVerificationGate({ projectId, children }: IDVerificationGateProps) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [userVerification, setUserVerification] = useState<UserVerification | null>(null);
  const [startingVerification, setStartingVerification] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  // Check if project requires verification
  useEffect(() => {
    async function checkVerification() {
      try {
        const res = await fetch(`/api/verify-id/check?projectId=${projectId}`);
        const data = await res.json();
        setVerificationStatus(data);
      } catch (error) {
        console.error("Error checking verification:", error);
      } finally {
        setLoading(false);
      }
    }

    if (sessionStatus !== "loading") {
      checkVerification();
    }
  }, [projectId, sessionStatus]);

  // Get user's verification status if logged in
  useEffect(() => {
    async function getUserVerification() {
      if (!session?.user) return;

      try {
        const res = await fetch("/api/verify-id");
        const data = await res.json();
        setUserVerification(data);
      } catch (error) {
        console.error("Error getting user verification:", error);
      }
    }

    getUserVerification();
  }, [session]);

  // Start verification process
  const startVerification = async () => {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/projects/${projectId}`);
      return;
    }

    setStartingVerification(true);

    try {
      const res = await fetch("/api/verify-id", { method: "POST" });
      const data = await res.json();

      if (data.success && data.verificationUrl) {
        setVerificationUrl(data.verificationUrl);
      } else {
        console.error("Verification error:", data.error);
      }
    } catch (error) {
      console.error("Error starting verification:", error);
    } finally {
      setStartingVerification(false);
    }
  };

  // Handle opening verification URL
  const openVerification = () => {
    if (verificationUrl) {
      window.open(verificationUrl, "_blank", "width=600,height=700");
    }
  };

  // Refresh verification status
  const refreshStatus = async () => {
    setLoading(true);
    try {
      const [checkRes, userRes] = await Promise.all([
        fetch(`/api/verify-id/check?projectId=${projectId}`),
        session?.user ? fetch("/api/verify-id") : Promise.resolve(null),
      ]);

      const checkData = await checkRes.json();
      setVerificationStatus(checkData);

      if (userRes) {
        const userData = await userRes.json();
        setUserVerification(userData);
      }
    } catch (error) {
      console.error("Error refreshing status:", error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking
  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // If verification not required or user is verified, show content
  if (!verificationStatus?.required || verificationStatus.verified) {
    return <>{children}</>;
  }

  // Show age gate
  return (
    <>
      {/* Blurred/blocked content placeholder */}
      <div className="relative">
        <div className="absolute inset-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg z-10 flex items-center justify-center">
          <Card className="max-w-lg mx-4">
            <CardContent className="p-8 text-center">
              <div className="rounded-full bg-amber-100 p-4 w-fit mx-auto mb-4">
                <ShieldAlert className="h-12 w-12 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Age Verification Required</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                {verificationStatus.reason || "This project contains age-restricted content."}
              </p>
              <p className="text-sm text-zinc-500 mb-6">
                To view this content, you must verify your identity and age (18+) through our secure verification process.
              </p>

              {!session?.user ? (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/login?callbackUrl=/projects/${projectId}`)}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Sign In to Verify
                  </Button>
                  <p className="text-xs text-zinc-500">
                    You need to be signed in to complete ID verification
                  </p>
                </div>
              ) : userVerification?.latestVerification?.status === "PENDING" ? (
                <div className="space-y-3">
                  <Badge variant="secondary" className="mb-2">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Verification In Progress
                  </Badge>
                  <Button
                    className="w-full"
                    onClick={openVerification}
                    disabled={!userVerification.latestVerification.verificationUrl}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Continue Verification
                  </Button>
                  <Button variant="outline" className="w-full" onClick={refreshStatus}>
                    Refresh Status
                  </Button>
                </div>
              ) : userVerification?.latestVerification?.status === "DECLINED" ? (
                <div className="space-y-3">
                  <Badge variant="destructive" className="mb-2">
                    <XCircle className="mr-1 h-3 w-3" />
                    Verification Declined
                  </Badge>
                  <p className="text-sm text-red-600">
                    {userVerification.latestVerification.declineReason || "Your verification was not successful."}
                  </p>
                  <Button className="w-full" onClick={startVerification} disabled={startingVerification}>
                    {startingVerification ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    onClick={startVerification}
                    disabled={startingVerification}
                  >
                    {startingVerification ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="mr-2 h-4 w-4" />
                    )}
                    Verify My Identity
                  </Button>
                  <p className="text-xs text-zinc-500">
                    Secure verification powered by Shufti Pro. Your data is encrypted and protected.
                  </p>
                </div>
              )}

              {verificationUrl && (
                <div className="mt-4 p-4 bg-violet-50 dark:bg-violet-900/30 rounded-lg">
                  <p className="text-sm font-medium text-violet-800 dark:text-violet-200 mb-2">
                    Verification window opened
                  </p>
                  <p className="text-xs text-violet-600 dark:text-violet-300 mb-3">
                    Complete the verification in the new window, then click refresh below.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={openVerification}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Reopen
                    </Button>
                    <Button size="sm" onClick={refreshStatus}>
                      <CheckCircle className="mr-1 h-3 w-3" />
                      I&apos;ve Completed Verification
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <Button variant="ghost" onClick={() => router.back()}>
                  ← Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blurred placeholder content */}
        <div className="opacity-20 pointer-events-none blur-sm min-h-[600px]">
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Simpler age gate dialog that can be used anywhere
 */
interface AgeGateDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  reason?: string;
}

export function AgeGateDialog({ open, onClose, onVerified, reason }: AgeGateDialogProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  const startVerification = async () => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/verify-id", { method: "POST" });
      const data = await res.json();

      if (data.success && data.verificationUrl) {
        setVerificationUrl(data.verificationUrl);
        window.open(data.verificationUrl, "_blank", "width=600,height=700");
      }
    } catch (error) {
      console.error("Error starting verification:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/verify-id");
      const data = await res.json();

      if (data.verified) {
        onVerified();
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Age Verification Required
          </DialogTitle>
          <DialogDescription>
            {reason || "This content requires age verification to access."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 p-4 mb-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Why is verification needed?
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  This project has been marked as containing adult or age-restricted content.
                  We need to verify you are 18 or older to comply with regulations.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>Quick verification process (2-3 minutes)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>Only needed once for your account</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span>Secure and encrypted</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {verificationUrl ? (
            <Button onClick={checkStatus} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              I&apos;ve Completed Verification
            </Button>
          ) : (
            <Button onClick={startVerification} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              {session?.user ? "Verify My Identity" : "Sign In to Verify"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
