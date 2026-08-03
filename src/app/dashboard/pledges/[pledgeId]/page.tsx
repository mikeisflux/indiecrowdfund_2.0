"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  Gift,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  MessageSquare,
  ExternalLink,
  Clock,
  Loader2,
  Edit,
  ShieldAlert,
  Lock,
  Hash,
  Shield,
  FileText,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface RewardOption {
  id: string;
  title: string;
  description: string;
  amount: number;
  type: "TIER" | "ADDON";
  quantityAvailable: number | null;
  quantityClaimed: number;
}

interface PledgeDetails {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  backerNumber: number | null;
  project: {
    id: string;
    title: string;
    slug: string;
    status: string;
    currentAmount: number;
    goalAmount: number;
    projectUrl: string;
    creatorId: string;
    creatorName: string | null;
  };
  reward: {
    id: string;
    title: string;
    amount: number;
  } | null;
  addons: Array<{
    id: string;
    title: string;
    amount: number;
    quantity: number;
  }>;
  canCancel: boolean;
  canRefund: boolean;
  canRequestRefund: boolean;
  canModify: boolean;
  canIncrease: boolean;
  locked: boolean;
  isFunded: boolean;
  campaignClosed: boolean;
  refundRequest: {
    id: string;
    status: string;
    reason: string;
    creatorNote: string | null;
    createdAt: string;
    processedAt: string | null;
  } | null;
}

export default function ManagePledgePage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = (params?.pledgeId as string) || "";

  const [pledge, setPledge] = useState<PledgeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  // Inline modify state
  const [availableRewards, setAvailableRewards] = useState<RewardOption[]>([]);
  const [availableAddons, setAvailableAddons] = useState<RewardOption[]>([]);
  const [modifyMode, setModifyMode] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [isSavingModify, setIsSavingModify] = useState(false);

  useEffect(() => {
    async function fetchPledge() {
      try {
        const response = await fetch(`/api/pledges/${pledgeId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch pledge details");
        }
        const data = await response.json();
        setPledge(data.pledge);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    if (pledgeId) {
      fetchPledge();
    }
  }, [pledgeId]);

  const handleCancelPledge = async (reason?: string) => {
    setIsProcessing(true);
    try {
      const response = await apiFetch(`/api/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action: "cancel", reason }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel pledge");
      }

      if (data.refunded) {
        toast.success("Pledge cancelled and refund processed. It may take 5-10 business days to appear.");
      } else {
        toast.success("Pledge cancelled successfully");
      }
      router.push("/dashboard/backer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel pledge");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!refundReason.trim()) {
      toast.error("Please provide a reason for your refund request");
      return;
    }
    setIsProcessing(true);
    try {
      const response = await apiFetch(`/api/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: refundReason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit refund request");
      }
      toast.success("Refund request submitted. The creator will review it and respond.");
      setRefundDialogOpen(false);
      setRefundReason("");
      // Refresh pledge data to show request status
      const refreshResponse = await fetch(`/api/pledges/${pledgeId}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setPledge(refreshData.pledge);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit refund request");
    } finally {
      setIsProcessing(false);
    }
  };

  const openModify = async () => {
    if (!pledge) return;
    setIsLoadingRewards(true);
    try {
      const res = await fetch(`/api/projects/${pledge.project.id}/rewards`);
      if (res.ok) {
        const data = await res.json();
        const tiers = (data.rewards as RewardOption[]).filter(r => r.type === "TIER");
        const addons = (data.rewards as RewardOption[]).filter(r => r.type === "ADDON");
        setAvailableRewards(tiers);
        setAvailableAddons(addons);
        setSelectedRewardId(pledge.reward?.id ?? null);
        const addonMap = new Map<string, number>();
        pledge.addons.forEach(a => addonMap.set(a.id, a.quantity));
        setSelectedAddons(addonMap);
        setModifyMode(true);
      } else {
        toast.error("Failed to load rewards");
      }
    } catch {
      toast.error("Failed to load rewards");
    } finally {
      setIsLoadingRewards(false);
    }
  };

  const handleSaveModify = async () => {
    if (!pledge) return;
    const addonList = Array.from(selectedAddons.entries())
      .filter(([, qty]) => qty > 0)
      .map(([id, quantity]) => ({ id, quantity }));

    const rewardAmount = availableRewards.find(r => r.id === selectedRewardId)?.amount ?? 0;
    const addonsTotal = addonList.reduce((sum, a) => {
      const price = availableAddons.find(x => x.id === a.id)?.amount ?? 0;
      return sum + price * a.quantity;
    }, 0);
    const newAmount = rewardAmount + addonsTotal;

    if (newAmount <= 0) {
      toast.error("Total must be greater than $0");
      return;
    }

    setIsSavingModify(true);
    try {
      const res = await apiFetch(`/api/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "modify",
          rewardId: selectedRewardId || "no-reward",
          addons: addonList,
          newAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update pledge");

      if (data.requiresPayment) {
        // Redirect to pledge flow for upcharge
        toast.info("Additional payment required — redirecting to checkout...");
        router.push(`${pledge.project.projectUrl}/pledge?modify=${pledge.id}`);
        return;
      }

      toast.success(data.message || "Pledge updated successfully");
      setModifyMode(false);
      // Refresh
      const refreshRes = await fetch(`/api/pledges/${pledgeId}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json().catch(() => null);
        if (refreshData?.pledge) setPledge(refreshData.pledge);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pledge");
    } finally {
      setIsSavingModify(false);
    }
  };

  const handleIncreasePledge = async () => {
    const amount = parseFloat(additionalAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiFetch(`/api/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action: "increase", amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to increase pledge");
      }

      // Charged pledges can't be topped up by editing the amount — the extra
      // has to be collected. The API hands back a top-up route; run it through
      // the same add-items payment flow "Change Reward or Add-ons" uses, but
      // with no add-ons, so a backer can simply give more.
      if (data.requiresPayment && data.topUpUrl) {
        const topUp = await apiFetch(data.topUpUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addons: [], amount: data.amount ?? amount }),
        });
        const topUpData = await topUp.json();
        if (!topUp.ok) {
          throw new Error(topUpData.error || "Couldn't start the additional payment");
        }
        // Send the backer to the pledge page to complete payment, the same
        // destination the add-ons upcharge uses.
        if (topUpData.checkoutUrl) {
          window.location.href = topUpData.checkoutUrl;
          return;
        }
        toast.success("Additional support added");
        setAdditionalAmount("");
        const refreshTopUp = await fetch(`/api/pledges/${pledgeId}`);
        if (refreshTopUp.ok) {
          const refreshed = await refreshTopUp.json();
          setPledge(refreshed.pledge);
        }
        return;
      }

      toast.success(data.message);
      setAdditionalAmount("");
      // Refresh pledge data
      const refreshResponse = await fetch(`/api/pledges/${pledgeId}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setPledge(refreshData.pledge);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to increase pledge");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "REFUNDED":
        return (
          <Badge variant="outline" className="text-blue-500 border-blue-500/50">
            <DollarSign className="w-3 h-3 mr-1" />
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !pledge) {
    return (
      <div className="container max-w-2xl py-8">
        <Link href="/dashboard/backer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Failed to load pledge</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fundingPercent = Number(pledge.project.goalAmount) > 0
    ? (Number(pledge.project.currentAmount) / Number(pledge.project.goalAmount)) * 100
    : 0;
  const isPending = pledge.status === "PENDING";
  const isCompleted = pledge.status === "COMPLETED";
  const isCampaignLive = pledge.project.status === "LIVE";
  const hasReachedGoal = pledge.isFunded;

  // Modify panel computed values
  const modifyRewardAmount = availableRewards.find(r => r.id === selectedRewardId)?.amount ?? 0;
  const modifyAddonsTotal = Array.from(selectedAddons.entries()).reduce((sum, [id, qty]) => {
    const price = availableAddons.find(x => x.id === id)?.amount ?? 0;
    return sum + price * qty;
  }, 0);
  const modifyNewTotal = modifyRewardAmount + modifyAddonsTotal;
  const modifyDiff = modifyNewTotal - pledge.amount;
  const isAonUnfunded = isPending && !hasReachedGoal;

  return (
    <div className="container max-w-2xl py-8">
      <Link href="/dashboard/backer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Manage Your Pledge</h1>
        {getStatusBadge(pledge.status)}
      </div>

      {/* Pledge Details */}
      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {pledge.project.title}
            </CardTitle>
            <CardDescription>
              Pledged on {new Date(pledge.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pledge Amount */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Pledge</p>
                <p className="text-2xl font-bold">${Number(pledge.amount).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Backer Number & Confirmation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pledge.backerNumber && (
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-primary/5 border-primary/20">
                <div className="p-2 rounded-full bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Backer Number</p>
                  <p className="text-xl font-bold text-primary">#{pledge.backerNumber}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
              <div className="p-2 rounded-full bg-muted">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confirmation #</p>
                <p className="text-sm font-mono font-semibold">{pledge.id}</p>
              </div>
            </div>
          </div>

          {/* Reward Tier */}
          {pledge.reward && (
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Reward Tier</span>
              </div>
              <p className="text-lg font-semibold">{pledge.reward.title}</p>
              <p className="text-sm text-muted-foreground">Tier amount: ${Number(pledge.reward.amount).toFixed(2)}</p>
            </div>
          )}

          {/* Add-ons */}
          {pledge.addons.length > 0 && (
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Plus className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Add-ons</span>
              </div>
              <div className="space-y-2">
                {pledge.addons.map((addon) => (
                  <div key={addon.id} className="flex justify-between text-sm">
                    <span>{addon.title} x{addon.quantity}</span>
                    <span>${(Number(addon.amount) * addon.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Funding Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Campaign Progress</span>
              <span className="font-medium">{fundingPercent.toFixed(0)}% funded</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 rounded-full"
                style={{ width: `${Math.min(fundingPercent, 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              ${pledge.project.currentAmount.toLocaleString()} of ${pledge.project.goalAmount.toLocaleString()} goal
            </p>
          </div>

          {/* View Project Button */}
          <Link href={pledge.project.projectUrl}>
            <Button variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Project
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Order locked: pledge is final — no edits, no refunds. They can still
          start a fresh pledge (which gets its own backer number). */}
      {pledge.locked && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="py-5">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Your order is locked
                </p>
                <p className="text-sm text-emerald-800/90 dark:text-emerald-300/90">
                  You&apos;ve locked in this pledge, so it can no longer be edited, cancelled, or refunded.
                  If you&apos;d like to add something else, you can place a new pledge — it&apos;ll be tracked
                  separately with its own backer number.
                </p>
                <Link href={`${pledge.project.projectUrl}/pledge`}>
                  <Button size="sm" className="mt-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Back this project again
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PENDING + NOT FUNDED: Full modification options */}
      {isPending && !hasReachedGoal && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Modify Your Pledge
            </CardTitle>
            <CardDescription>
              The campaign hasn&apos;t funded yet, so your card isn&apos;t charged on changes — your full updated total will be charged if the campaign funds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inline Modify Panel */}
            {pledge.canModify && (
              <ModifyPanel
                pledge={pledge}
                modifyMode={modifyMode}
                isLoadingRewards={isLoadingRewards}
                isSavingModify={isSavingModify}
                availableRewards={availableRewards}
                availableAddons={availableAddons}
                selectedRewardId={selectedRewardId}
                setSelectedRewardId={setSelectedRewardId}
                selectedAddons={selectedAddons}
                setSelectedAddons={setSelectedAddons}
                modifyNewTotal={modifyNewTotal}
                modifyDiff={modifyDiff}
                isAonUnfunded={isAonUnfunded}
                onOpen={openModify}
                onSave={handleSaveModify}
                onCancel={() => setModifyMode(false)}
              />
            )}

            <Separator />

            {/* Increase Pledge */}
            {pledge.canIncrease && (
              <div className="p-4 rounded-lg border">
                <Label className="text-sm font-medium mb-2 block">Increase Your Pledge</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Add extra support to this project. The additional amount will be collected if the campaign reaches its goal.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Additional amount"
                      value={additionalAmount}
                      onChange={(e) => setAdditionalAmount(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button
                    onClick={handleIncreasePledge}
                    disabled={isProcessing || !additionalAmount}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Cancel Pledge */}
            {pledge.canCancel && (
              <div className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
                <Label className="text-sm font-medium mb-2 block text-red-700 dark:text-red-300">
                  Cancel Your Pledge
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  If you&apos;ve changed your mind, you can cancel your pledge. No payment will be collected and your support will be removed from the campaign.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={isProcessing}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Pledge
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Your Pledge?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your ${Number(pledge.amount).toFixed(2)} pledge to &quot;{pledge.project.title}&quot;?
                        This action cannot be undone. Your payment authorization will be released and you will not be charged.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep My Pledge</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancelPledge()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Yes, Cancel Pledge
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PENDING + FUNDED: Payment processing, no cancellation */}
      {isPending && hasReachedGoal && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Campaign Successfully Funded
            </CardTitle>
            <CardDescription>
              Great news! The campaign reached its funding goal. Your payment will be processed automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-300">Payment Processing</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                Your pledge of ${Number(pledge.amount).toFixed(2)} is being processed. You&apos;ll receive a confirmation once the payment is complete.
              </AlertDescription>
            </Alert>

            {/* Refund Policy Alert */}
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-700 dark:text-amber-300">Important: Refund Policy</AlertTitle>
              <AlertDescription className="text-amber-600 dark:text-amber-400 space-y-2">
                <p>
                  Once a campaign reaches its funding goal, pledges cannot be cancelled through the platform.
                </p>
                <p>
                  <strong>If you need a refund after your payment is processed, you must contact the project creator directly.</strong> Refund availability and policies are determined by each individual creator and are not guaranteed.
                </p>
              </AlertDescription>
            </Alert>

            <Link href={`/dashboard/messages?projectId=${pledge.project.id}&recipientId=${pledge.project.creatorId}`}>
              <Button variant="outline" className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* COMPLETED: Payment processed */}
      {isCompleted && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Payment Completed
            </CardTitle>
            <CardDescription>
              Your pledge has been successfully processed. Thank you for supporting this project!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inline Modify Panel - show if campaign is still live */}
            {pledge.canModify && (
              <ModifyPanel
                pledge={pledge}
                modifyMode={modifyMode}
                isLoadingRewards={isLoadingRewards}
                isSavingModify={isSavingModify}
                availableRewards={availableRewards}
                availableAddons={availableAddons}
                selectedRewardId={selectedRewardId}
                setSelectedRewardId={setSelectedRewardId}
                selectedAddons={selectedAddons}
                setSelectedAddons={setSelectedAddons}
                modifyNewTotal={modifyNewTotal}
                modifyDiff={modifyDiff}
                isAonUnfunded={isAonUnfunded}
                onOpen={openModify}
                onSave={handleSaveModify}
                onCancel={() => setModifyMode(false)}
              />
            )}


            {/* Add to pledge if campaign still live */}
            {isCampaignLive && pledge.canIncrease && (
              <div className="p-4 rounded-lg border">
                <Label className="text-sm font-medium mb-2 block">Add Additional Support</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Want to add more to your contribution? Additional amounts will be charged immediately.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Additional amount"
                      value={additionalAmount}
                      onChange={(e) => setAdditionalAmount(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button
                    onClick={handleIncreasePledge}
                    disabled={isProcessing || !additionalAmount}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Cancel Pledge with Refund */}
            {pledge.canRefund && (
              <div className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
                <Label className="text-sm font-medium mb-2 block text-red-700 dark:text-red-300">
                  Cancel Pledge &amp; Request Refund
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  If you&apos;ve changed your mind, you can cancel your pledge and receive a full refund. Refunds typically take 5-10 business days to process.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={isProcessing}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Pledge &amp; Refund
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Pledge &amp; Request Refund?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Are you sure you want to cancel your ${Number(pledge.amount).toFixed(2)} pledge to &quot;{pledge.project.title}&quot;?
                        </p>
                        <p>
                          A full refund of <strong>${Number(pledge.amount).toFixed(2)}</strong> will be processed to your original payment method. This typically takes 5-10 business days.
                        </p>
                        <p className="font-medium text-destructive">
                          This action cannot be undone.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep My Pledge</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancelPledge("Cancelled by backer")}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Yes, Cancel &amp; Refund
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Refund Request for closed campaigns */}
            {pledge.canRequestRefund && !pledge.refundRequest && (
              <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                <Label className="text-sm font-medium mb-2 block text-amber-700 dark:text-amber-300">
                  Request a Refund
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  The campaign has closed. You can submit a refund request for the creator to review. Refunds are not guaranteed and are at the creator&apos;s discretion.
                </p>
                <Button
                  variant="outline"
                  className="w-full border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
                  onClick={() => setRefundDialogOpen(true)}
                  disabled={isProcessing}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Submit Refund Request
                </Button>
              </div>
            )}

            {/* Existing refund request status */}
            {pledge.refundRequest && (
              <div className={`p-4 rounded-lg border ${
                pledge.refundRequest.status === "APPROVED"
                  ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20"
                  : pledge.refundRequest.status === "DENIED"
                  ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                  : "border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium text-sm">Refund Request</span>
                  <Badge
                    variant="outline"
                    className={
                      pledge.refundRequest.status === "APPROVED"
                        ? "text-green-600 border-green-500/50"
                        : pledge.refundRequest.status === "DENIED"
                        ? "text-red-600 border-red-500/50"
                        : "text-amber-600 border-amber-500/50"
                    }
                  >
                    {pledge.refundRequest.status === "APPROVED" ? (
                      <><CheckCircle className="w-3 h-3 mr-1" />Approved</>
                    ) : pledge.refundRequest.status === "DENIED" ? (
                      <><XCircle className="w-3 h-3 mr-1" />Denied</>
                    ) : (
                      <><Clock className="w-3 h-3 mr-1" />Pending Review</>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  <span className="font-medium">Your reason:</span> {pledge.refundRequest.reason}
                </p>
                {pledge.refundRequest.creatorNote && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Creator&apos;s note:</span> {pledge.refundRequest.creatorNote}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Submitted {new Date(pledge.refundRequest.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  {pledge.refundRequest.processedAt && ` · Reviewed ${new Date(pledge.refundRequest.processedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
                </p>
              </div>
            )}

            {/* Contact Creator */}
            <Link href={`/dashboard/messages?projectId=${pledge.project.id}&recipientId=${pledge.project.creatorId}`}>
              <Button variant="outline" className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Refund Request Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Refund Request</DialogTitle>
            <DialogDescription>
              Explain why you&apos;re requesting a refund for your ${Number(pledge?.amount).toFixed(2)} pledge to &quot;{pledge?.project.title}&quot;. The creator will review your request and respond.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="refund-reason">Reason for refund</Label>
            <Textarea
              id="refund-reason"
              placeholder="Please explain why you are requesting a refund..."
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{refundReason.length}/1000</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleRequestRefund} disabled={isProcessing || !refundReason.trim()}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refunded Pledge */}
      {pledge.status === "REFUNDED" && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-blue-500" />
            <h3 className="text-lg font-semibold mb-2">Pledge Refunded</h3>
            <p className="text-muted-foreground mb-4">
              Your pledge of ${Number(pledge.amount).toFixed(2)} has been refunded. It may take 5-10 business days for the refund to appear on your statement.
            </p>
            {pledge.project.status === "LIVE" && (
              <Link href={`${pledge.project.projectUrl}/pledge`}>
                <Button>Back This Project Again</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancelled or Failed Pledge */}
      {(pledge.status === "CANCELLED" || pledge.status === "FAILED") && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {pledge.status === "CANCELLED" ? "Pledge Cancelled" : "Payment Failed"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {pledge.status === "CANCELLED"
                ? "You cancelled this pledge. No payment was processed."
                : "There was an issue processing your payment. This may be due to insufficient funds, an expired card, or a bank decline."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {pledge.project.status === "LIVE" && (
                <Link href={`${pledge.project.projectUrl}/pledge`}>
                  <Button>Back This Project Again</Button>
                </Link>
              )}
              {pledge.status === "FAILED" && (
                <Link href="/dashboard/settings">
                  <Button variant="outline">Update Payment Method</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Inline Modify Panel ─────────────────────────────────────────────────────

interface ModifyPanelProps {
  pledge: {
    id: string;
    amount: number;
    status: string;
    reward: { id: string; title: string; amount: number } | null;
    addons: Array<{ id: string; title: string; amount: number; quantity: number }>;
    project: { projectUrl: string };
  };
  modifyMode: boolean;
  isLoadingRewards: boolean;
  isSavingModify: boolean;
  availableRewards: RewardOption[];
  availableAddons: RewardOption[];
  selectedRewardId: string | null;
  setSelectedRewardId: (id: string | null) => void;
  selectedAddons: Map<string, number>;
  setSelectedAddons: (m: Map<string, number>) => void;
  modifyNewTotal: number;
  modifyDiff: number;
  isAonUnfunded: boolean;
  onOpen: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function ModifyPanel({
  pledge,
  modifyMode,
  isLoadingRewards,
  isSavingModify,
  availableRewards,
  availableAddons,
  selectedRewardId,
  setSelectedRewardId,
  selectedAddons,
  setSelectedAddons,
  modifyNewTotal,
  modifyDiff,
  isAonUnfunded,
  onOpen,
  onSave,
  onCancel,
}: ModifyPanelProps) {
  const setAddonQty = (id: string, qty: number) => {
    const next = new Map(selectedAddons);
    if (qty <= 0) next.delete(id);
    else next.set(id, qty);
    setSelectedAddons(next);
  };

  if (!modifyMode) {
    return (
      <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start justify-between mb-2">
          <Label className="text-sm font-medium text-blue-700 dark:text-blue-300">Modify Your Order</Label>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Change your reward tier or add-ons.{" "}
          {isAonUnfunded
            ? "Since the campaign hasn't funded yet, your card isn't charged for changes — your full updated total will be charged if the campaign funds."
            : "If your new total is less you'll receive a refund; if it's more you'll pay the difference."}
        </p>
        <Button
          variant="outline"
          className="w-full border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900"
          onClick={onOpen}
          disabled={isLoadingRewards}
        >
          {isLoadingRewards ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Edit className="h-4 w-4 mr-2" />
          )}
          Change Reward or Add-ons
        </Button>
      </div>
    );
  }

  const diffAbs = Math.abs(modifyDiff);
  const diffLabel =
    isAonUnfunded
      ? "Saved — your card is charged for the full total if the campaign funds"
      : modifyDiff === 0
      ? "No price change"
      : modifyDiff > 0
      ? `You'll pay an additional $${diffAbs.toFixed(2)}`
      : `You'll receive a $${diffAbs.toFixed(2)} refund`;

  const diffColor =
    isAonUnfunded || modifyDiff === 0
      ? "text-muted-foreground"
      : modifyDiff > 0
      ? "text-amber-600 dark:text-amber-400"
      : "text-green-600 dark:text-green-400";

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Edit className="h-4 w-4" />
          Modify Your Order
        </h4>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSavingModify}>
          Cancel
        </Button>
      </div>

      {/* Reward selection */}
      {availableRewards.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reward Tier</Label>
          <div className="space-y-2">
            <div
              onClick={() => setSelectedRewardId(null)}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                selectedRewardId === null
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
            >
              <span className="text-sm">No reward</span>
              {selectedRewardId === null && <CheckCircle className="h-4 w-4 text-primary" />}
            </div>
            {availableRewards.map(r => {
              const soldOut = r.quantityAvailable !== null && r.quantityClaimed >= r.quantityAvailable && r.id !== pledge.reward?.id;
              return (
                <div
                  key={r.id}
                  onClick={() => !soldOut && setSelectedRewardId(r.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    soldOut ? "opacity-50 cursor-not-allowed" :
                    selectedRewardId === r.id
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : "border-muted hover:border-muted-foreground/50 cursor-pointer"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {soldOut && <p className="text-xs text-red-500">Sold out</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-sm font-semibold">${r.amount.toFixed(2)}</span>
                    {selectedRewardId === r.id && <CheckCircle className="h-4 w-4 text-primary" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Addon selection */}
      {availableAddons.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add-ons</Label>
          <div className="space-y-2">
            {availableAddons.map(a => {
              const qty = selectedAddons.get(a.id) ?? 0;
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">${a.amount.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <Button
                      variant="outline" size="icon"
                      className="h-7 w-7"
                      onClick={() => setAddonQty(a.id, qty - 1)}
                      disabled={qty === 0}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{qty}</span>
                    <Button
                      variant="outline" size="icon"
                      className="h-7 w-7"
                      onClick={() => setAddonQty(a.id, qty + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border p-3 bg-background space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current total</span>
          <span>${pledge.amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>New total</span>
          <span>${modifyNewTotal.toFixed(2)}</span>
        </div>
        <div className={`flex justify-between text-xs font-medium ${diffColor}`}>
          <span>Difference</span>
          <span>{diffLabel}</span>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={onSave}
        disabled={isSavingModify || modifyNewTotal <= 0}
      >
        {isSavingModify ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
        ) : (
          <><RefreshCw className="h-4 w-4 mr-2" />Save Changes</>
        )}
      </Button>
    </div>
  );
}
