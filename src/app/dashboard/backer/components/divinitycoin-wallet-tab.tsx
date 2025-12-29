"use client";

import { useState, useEffect } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Coins,
  ArrowDownLeft,
  Gift,
  Ticket,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Award,
  Users,
  Target,
  Star,
  Loader2,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: "EARNED" | "SPENT" | "REDEEMED" | "BONUS" | "REFERRAL" | "REFUND" | "INITIAL";
  amount: number;
  description: string;
  projectTitle?: string;
  createdAt: string;
  balanceAfter?: number;
  metadata?: Record<string, unknown>;
}

interface WalletData {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  pendingBonuses: number;
  transactions: Transaction[];
  bonusSummary: {
    badgeCount: number;
    rawBonusPercent: string;
    appliedThisMonth: string;
    remainingCap: string;
    totalSavedThisMonth: string;
  };
}

const TRANSACTION_ICONS: Record<string, React.ElementType> = {
  EARNED: Gift,
  SPENT: ArrowDownLeft,
  REDEEMED: Ticket,
  BONUS: Star,
  REFERRAL: Users,
  REFUND: RefreshCw,
  INITIAL: Coins,
};

const TRANSACTION_COLORS: Record<string, string> = {
  EARNED: "text-emerald-500 bg-emerald-500/20",
  SPENT: "text-rose-500 bg-rose-500/20",
  REDEEMED: "text-purple-500 bg-purple-500/20",
  BONUS: "text-amber-500 bg-amber-500/20",
  REFERRAL: "text-blue-500 bg-blue-500/20",
  REFUND: "text-cyan-500 bg-cyan-500/20",
  INITIAL: "text-[#0066FF] bg-[#0066FF]/20",
};

export function DivinityCoinWalletTab() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchWalletData();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchWalletData = async () => {
    try {
      const response = await fetch("/api/backer/wallet", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) throw new Error("Failed to fetch wallet data");
      const walletData = await response.json();
      setData(walletData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
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

      toast.success(`Successfully redeemed ${result.amount} DivinityCoins!`);
      setRedeemCode("");
      setRedeemDialogOpen(false);
      fetchWalletData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setRedeeming(false);
    }
  };

  const handleSyncBalance = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/divinitycoin/sync-balance", {
        method: "POST",
        headers: { ...getCSRFHeaders() },
      });
      if (response.ok) {
        toast.success("Balance synced");
        fetchWalletData();
      }
    } catch {
      toast.error("Failed to sync balance");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load wallet</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchWalletData}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Wallet Balance Card */}
      <Card className="relative overflow-hidden border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/10 via-background to-[#0066FF]/5">
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 opacity-10">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#0066FF" strokeWidth="4"/>
            <circle cx="50" cy="50" r="35" stroke="#0066FF" strokeWidth="2"/>
            <text x="50" y="58" textAnchor="middle" fill="#0066FF" fontSize="28" fontWeight="bold">D</text>
          </svg>
        </div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 opacity-5">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="#0066FF" strokeWidth="4"/>
            <text x="50" y="58" textAnchor="middle" fill="#0066FF" fontSize="28" fontWeight="bold">D</text>
          </svg>
        </div>

        <CardContent className="relative p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-xl bg-[#0066FF]/20 glow-pulse">
                  <Coins className="h-8 w-8 text-[#0066FF]" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="text-4xl font-bold text-[#0066FF]">
                    ◆ {data.balance.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <span className="text-muted-foreground">Lifetime earned:</span>
                  <span className="font-semibold text-emerald-500">◆ {data.lifetimeEarned.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDownLeft className="h-4 w-4 text-rose-500" />
                  <span className="text-muted-foreground">Total spent:</span>
                  <span className="font-semibold text-rose-500">◆ {data.lifetimeSpent.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setRedeemDialogOpen(true)}
                className="bg-gradient-to-r from-[#0066FF] to-purple-500 hover:from-[#0055DD] hover:to-purple-600"
              >
                <Ticket className="h-4 w-4 mr-2" />
                Redeem Code
              </Button>
              <Button
                variant="outline"
                onClick={handleSyncBalance}
                disabled={syncing}
                className="border-[#0066FF]/30 hover:border-[#0066FF]/50"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                Sync Balance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Is DivinityCoin? */}
      <Card className="glass-card border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/5 via-transparent to-purple-500/5">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-[#0066FF] mb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0066FF]/20">
              <HelpCircle className="h-6 w-6 text-[#0066FF]" />
            </div>
            What Is DivinityCoin?
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p className="text-base leading-relaxed">
              <span className="font-semibold text-foreground">DivinityCoin is a gift card system</span> that allows you to back adult (NSFW) projects on IndieCrowdfund without using traditional payment methods directly.
            </p>
            <p className="text-base leading-relaxed">
              Here&apos;s how it works: You purchase DivinityCoin gift cards from{" "}
              <a
                href="https://divinitycoin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0066FF] hover:underline font-medium"
              >
                divinitycoin.com
              </a>
              , then redeem the code here to add credits to your account. These credits can then be used to back any NSFW project on the platform.
            </p>
            <div className="bg-[#0066FF]/10 rounded-xl p-4 border border-[#0066FF]/20">
              <h3 className="font-semibold text-foreground mb-2">Why use DivinityCoin?</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span><span className="font-medium text-foreground">Privacy:</span> Keep adult purchases separate from your main payment methods</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span><span className="font-medium text-foreground">Discretion:</span> Gift card purchases appear as &quot;DivinityCoin&quot; on statements</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span><span className="font-medium text-foreground">Bonus Rewards:</span> Earn badge bonuses on redemptions (up to 3% back!)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span><span className="font-medium text-foreground">Instant:</span> Credits are added immediately after redemption</span>
                </li>
              </ul>
            </div>
            <p className="text-sm">
              Ready to get started?{" "}
              <a
                href="https://divinitycoin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0066FF] hover:underline font-medium"
              >
                Purchase DivinityCoin gift cards →
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Badge Bonus Summary */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-amber-500" />
            Redemption Bonus Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-2xl font-bold text-amber-500">{data.bonusSummary.badgeCount}</p>
              <p className="text-xs text-muted-foreground">Badges Earned</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-2xl font-bold text-emerald-500">{data.bonusSummary.rawBonusPercent}</p>
              <p className="text-xs text-muted-foreground">Raw Bonus Rate</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-500">{data.bonusSummary.remainingCap}</p>
              <p className="text-xs text-muted-foreground">Remaining This Month</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <p className="text-2xl font-bold text-purple-500">{data.bonusSummary.totalSavedThisMonth}</p>
              <p className="text-xs text-muted-foreground">Saved This Month</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Each badge provides 0.5% bonus on redemptions, capped at 3% monthly
          </p>
        </CardContent>
      </Card>

      {/* Ways to Earn */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Ways to Earn DivinityCoins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Gift, title: "Stretch Goal Bonus", desc: "Earn coins when projects hit stretch goals", color: "emerald" },
              { icon: Users, title: "Referral Bonus", desc: "Invite friends to back projects", color: "blue" },
              { icon: Target, title: "Early Backer Bonus", desc: "Back projects in first 24 hours", color: "purple" },
              { icon: CheckCircle, title: "Survey Completion", desc: "Complete surveys promptly", color: "amber" },
              { icon: Star, title: "Anniversary Rewards", desc: "Loyalty bonuses for active backers", color: "rose" },
              { icon: Award, title: "Achievement Badges", desc: "Unlock badges for bonus rates", color: "cyan" },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={cn(
                    "p-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-transparent",
                    "hover:border-primary/30 transition-all",
                    "animate-in fade-in slide-in-from-bottom"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={cn("p-2 rounded-lg w-fit mb-2", `bg-${item.color}-500/20`)}>
                    <Icon className={cn("h-4 w-4", `text-${item.color}-500`)} />
                  </div>
                  <h4 className="font-medium text-sm">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.transactions.map((tx, index) => {
                const Icon = TRANSACTION_ICONS[tx.type] || Gift;
                const colorClass = TRANSACTION_COLORS[tx.type] || TRANSACTION_COLORS.EARNED;
                const isPositive = ["EARNED", "REDEEMED", "BONUS", "REFERRAL", "REFUND", "INITIAL"].includes(tx.type);

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border border-border/50",
                      "bg-gradient-to-r from-muted/20 to-transparent",
                      "hover:border-primary/30 transition-all",
                      "animate-in fade-in slide-in-from-left"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={cn("p-2 rounded-lg", colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{tx.description}</p>
                      {tx.projectTitle && (
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.projectTitle}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-lg font-bold tabular-nums",
                        isPositive ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {isPositive ? "+" : "-"}◆ {Math.abs(tx.amount).toLocaleString()}
                      </div>
                      {tx.balanceAfter !== undefined && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Balance: ◆ {tx.balanceAfter.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redeem Dialog */}
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-[#0066FF]" />
              Redeem DivinityCoin Code
            </DialogTitle>
            <DialogDescription>
              Enter your redemption code to add DivinityCoins to your wallet
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g., DC-XXXX-XXXX)"
              className="text-center text-lg font-mono tracking-wider"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRedeemCode}
              disabled={redeeming || !redeemCode.trim()}
              className="bg-gradient-to-r from-[#0066FF] to-purple-500"
            >
              {redeeming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
