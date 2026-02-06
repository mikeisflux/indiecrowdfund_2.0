"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  ExternalLink,
  RefreshCw,
  Check,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";

interface DivinityCoinWalletProps {
  balance: number;
  total: number;
  onBalanceUpdate: (newBalance: number) => void;
  isLoading?: boolean;
}

export function DivinityCoinWallet({
  balance,
  total,
  onBalanceUpdate,
  isLoading = false
}: DivinityCoinWalletProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const hasEnough = balance >= total;
  const amountNeeded = Math.max(0, total - balance);

  const refreshBalance = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/divinitycoin/redeem");
      if (response.ok) {
        const data = await response.json();
        onBalanceUpdate(data.balance || 0);
      }
    } catch (err) {
      console.error("Failed to refresh balance:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;

    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(false);

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

      onBalanceUpdate(result.newBalance);
      setRedeemCode("");
      setRedeemSuccess(true);
      setTimeout(() => setRedeemSuccess(false), 3000);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setIsRedeeming(false);
    }
  };

  const copyAmountNeeded = () => {
    navigator.clipboard.writeText(amountNeeded.toFixed(2));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  if (isLoading) {
    return (
      <Card className="border-[#0066FF]/30 bg-gradient-to-br from-[#0066FF]/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066FF]/10 flex items-center justify-center animate-pulse">
              <Wallet className="w-5 h-5 text-[#0066FF]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-24" />
              <div className="h-3 bg-muted rounded animate-pulse w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#0066FF]/30 bg-gradient-to-br from-[#0066FF]/5 via-background to-[#0066FF]/5 overflow-hidden">
      <CardContent className="p-0">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-[#0066FF]/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0066FF] flex items-center justify-center shadow-lg shadow-[#0066FF]/20">
              <span className="text-white font-bold">D</span>
            </div>
            <div className="text-left">
              <p className="font-semibold text-[#0066FF]">DivinityCoin Wallet</p>
              <p className="text-sm text-muted-foreground">
                Balance: <span className="font-semibold text-foreground">${balance.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasEnough ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                <Check className="w-3 h-3" />
                Ready
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Need ${amountNeeded.toFixed(2)}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expandable Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-[#0066FF]/10">
            {/* Balance Details */}
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Balance</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold">${balance.toFixed(2)}</span>
                  <button
                    onClick={refreshBalance}
                    disabled={isRefreshing}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className={`w-3 h-3 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pledge Total</span>
                <span className="font-semibold">${total.toFixed(2)}</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between">
                <span className={hasEnough ? "text-emerald-600" : "text-amber-600"}>
                  {hasEnough ? "Remaining After" : "Amount Needed"}
                </span>
                <span className={`font-bold ${hasEnough ? "text-emerald-600" : "text-amber-600"}`}>
                  ${hasEnough ? (balance - total).toFixed(2) : amountNeeded.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Quick Actions when more funds needed */}
            {!hasEnough && (
              <div className="space-y-3 pt-2">
                {/* Amount needed with copy */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Purchase this amount:</p>
                    <p className="text-lg font-bold text-amber-800 dark:text-amber-200">${amountNeeded.toFixed(2)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyAmountNeeded}
                    className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    {copiedAmount ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                {/* Buy DivinityCoin link */}
                <a
                  href="https://divinitycoin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white font-medium transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  Buy DivinityCoin
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Quick Redeem */}
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-muted-foreground">Quick Redeem Code</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter voucher code"
                  value={redeemCode}
                  onChange={(e) => {
                    setRedeemCode(e.target.value);
                    setRedeemError(null);
                  }}
                  className="flex-1 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && redeemCode.trim()) {
                      handleRedeem();
                    }
                  }}
                />
                <Button
                  onClick={handleRedeem}
                  disabled={!redeemCode.trim() || isRedeeming}
                  size="sm"
                  className="bg-[#0066FF] hover:bg-[#0052CC]"
                >
                  {isRedeeming ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Redeem"
                  )}
                </Button>
              </div>
              {redeemError && (
                <p className="text-xs text-red-500">{redeemError}</p>
              )}
              {redeemSuccess && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Code redeemed successfully!
                </p>
              )}
            </div>

            {/* Link to full wallet page */}
            <Link
              href="/dashboard/backer?tab=wallet"
              className="flex items-center justify-center gap-2 w-full p-2 text-sm text-[#0066FF] hover:bg-[#0066FF]/10 rounded-lg transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Go to My Wallet
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
