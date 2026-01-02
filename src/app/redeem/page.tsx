"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSession } from "@/components/providers/auth-provider";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import {
  Coins,
  Ticket,
  Loader2,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  HelpCircle,
} from "lucide-react";

export default function RedeemPage() {
  const { status } = useSession();
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [redeemSuccess, setRedeemSuccess] = useState<{
    amount: number;
    newBalance: number;
    bonus?: { amount: number; percent: string };
  } | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetchBalance();
    } else if (status === "unauthenticated") {
      setLoadingBalance(false);
    }
  }, [status]);

  const fetchBalance = async () => {
    try {
      const response = await fetch("/api/divinitycoin/redeem");
      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance || 0);
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleRedeemCode = async () => {
    if (!redeemCode.trim()) {
      toast.error("Please enter a redemption code");
      return;
    }

    setRedeeming(true);
    try {
      const response = await fetch("/api/divinitycoin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to redeem code");
      }

      setRedeemSuccess({
        amount: result.amount,
        newBalance: result.newBalance,
        bonus: result.bonus,
      });
      setBalance(result.newBalance);
      setRedeemCode("");
      toast.success(result.message || `Successfully redeemed $${result.amount} in credits!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  // Not logged in
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl py-12">
          <Card className="border-[#0066FF]/20">
            <CardContent className="py-12 text-center">
              <Coins className="h-16 w-16 mx-auto mb-6 text-[#0066FF]" />
              <h1 className="text-2xl font-bold mb-4">Redeem DivinityCoin</h1>
              <p className="text-muted-foreground mb-6">
                Please log in to redeem your DivinityCoin code and add credits to your account.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href={`/login?callbackUrl=${encodeURIComponent("/redeem")}`}>
                  <Button>Log In</Button>
                </Link>
                <Link href={`/register?callbackUrl=${encodeURIComponent("/redeem")}`}>
                  <Button variant="outline">Sign Up</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Loading
  if (status === "loading" || loadingBalance) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0066FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#0066FF]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative max-w-2xl py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-[#0066FF]/20 mb-6">
            <Coins className="h-12 w-12 text-[#0066FF]" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Redeem DivinityCoin</h1>
          <p className="text-muted-foreground">
            Enter your code below to add credits to your account
          </p>
        </div>

        {/* Current Balance */}
        {balance !== null && (
          <Card className="mb-6 border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/5 to-transparent">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your Current Balance</span>
                <span className="text-2xl font-bold text-[#0066FF]">
                  ${balance.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {redeemSuccess && (
          <Card className="mb-6 border-emerald-500/30 bg-emerald-500/10">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-emerald-500/20">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Successfully redeemed ${redeemSuccess.amount.toFixed(2)}!
                  </p>
                  {redeemSuccess.bonus && (
                    <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">
                      +${redeemSuccess.bonus.amount.toFixed(2)} badge bonus ({redeemSuccess.bonus.percent})
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    New balance: ${redeemSuccess.newBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Redemption Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-[#0066FF]" />
              Enter Redemption Code
            </CardTitle>
            <CardDescription>
              Enter the code from your DivinityCoin purchase email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g., DC-XXXX-XXXX-XXXX)"
              className="text-center text-lg font-mono tracking-wider h-14"
              onKeyDown={(e) => e.key === "Enter" && handleRedeemCode()}
            />
            <Button
              onClick={handleRedeemCode}
              disabled={redeeming || !redeemCode.trim()}
              className="w-full bg-gradient-to-r from-[#0066FF] to-purple-500 hover:from-[#0055DD] hover:to-purple-600 h-12 text-lg"
            >
              {redeeming ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Redeeming...
                </>
              ) : (
                <>
                  <Ticket className="h-5 w-5 mr-2" />
                  Redeem Code
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              Need DivinityCoin Credits?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-xs font-semibold text-[#0066FF]">1</span>
                <div>
                  <p className="font-medium">Purchase DivinityCoin gift cards</p>
                  <p className="text-muted-foreground">
                    Visit{" "}
                    <a
                      href="https://divinitycoin.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0066FF] hover:underline inline-flex items-center gap-1"
                    >
                      divinitycoin.com
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {" "}and select your desired amount
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-xs font-semibold text-[#0066FF]">2</span>
                <div>
                  <p className="font-medium">Receive your code via email</p>
                  <p className="text-muted-foreground">
                    After purchase, you&apos;ll receive a redemption code in your email
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-xs font-semibold text-[#0066FF]">3</span>
                <div>
                  <p className="font-medium">Redeem here</p>
                  <p className="text-muted-foreground">
                    Enter your code above to add credits to your account instantly
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <a
                href="https://divinitycoin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#0066FF] hover:underline font-medium"
              >
                Purchase DivinityCoin Credits
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* View Wallet Link */}
        <div className="text-center mt-8">
          <Link
            href="/dashboard/backer?tab=wallet"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            View full wallet & transaction history →
          </Link>
        </div>
      </div>
    </div>
  );
}
