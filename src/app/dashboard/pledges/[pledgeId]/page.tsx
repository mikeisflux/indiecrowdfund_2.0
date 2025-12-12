"use client";

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
  Info,
  Loader2,
} from "lucide-react";

interface PledgeDetails {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  project: {
    id: string;
    title: string;
    slug: string;
    status: string;
    currentAmount: number;
    goalAmount: number;
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
  canIncrease: boolean;
  isFunded: boolean;
}

export default function ManagePledgePage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = params.pledgeId as string;

  const [pledge, setPledge] = useState<PledgeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [additionalAmount, setAdditionalAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleCancelPledge = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel pledge");
      }

      toast.success("Pledge cancelled successfully");
      router.push("/dashboard/backer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel pledge");
    } finally {
      setIsProcessing(false);
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
      const response = await fetch(`/api/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "increase", amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to increase pledge");
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

  const fundingPercent = (pledge.project.currentAmount / pledge.project.goalAmount) * 100;

  return (
    <div className="container max-w-2xl py-8">
      <Link href="/dashboard/backer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Your Pledge</h1>
        {getStatusBadge(pledge.status)}
      </div>

      {/* Pledge Details */}
      <Card className="mb-6">
        <CardHeader>
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
                <p className="text-2xl font-bold">${pledge.amount.toFixed(2)}</p>
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
              <p className="text-sm text-muted-foreground">Tier amount: ${pledge.reward.amount}</p>
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
                    <span>${(addon.amount * addon.quantity).toFixed(2)}</span>
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
          <Link href={`/projects/${pledge.project.slug}`}>
            <Button variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Project
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Actions based on pledge status */}
      {pledge.status === "PENDING" && !pledge.isFunded && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Modify Your Pledge</CardTitle>
            <CardDescription>
              The campaign is still active and hasn&apos;t reached its funding goal yet. You can increase or cancel your pledge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Increase Pledge */}
            {pledge.canIncrease && (
              <div className="p-4 rounded-lg border">
                <Label className="text-sm font-medium mb-2 block">Increase Your Pledge</Label>
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

            {/* Cancel Pledge */}
            {pledge.canCancel && (
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
                      Are you sure you want to cancel your ${pledge.amount.toFixed(2)} pledge to &quot;{pledge.project.title}&quot;?
                      This action cannot be undone. Your payment authorization will be released and you will not be charged.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep My Pledge</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelPledge}
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed Pledge - Can only add items */}
      {pledge.status === "COMPLETED" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Your Pledge Has Been Processed</CardTitle>
            <CardDescription>
              The campaign was successfully funded and your payment has been processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add more to pledge if project is still live */}
            {pledge.canIncrease && (
              <div className="p-4 rounded-lg border">
                <Label className="text-sm font-medium mb-2 block">Add to Your Pledge</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  You can still increase your support. Additional amounts will be charged immediately.
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

            {/* Refund Information */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>About Refunds</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Once a pledge has been processed, refunds are handled directly by the project creator.
                  Refund policies vary by project and are at the discretion of each individual creator.
                </p>
                <p className="font-medium">
                  To request a refund, please contact the creator directly through the project&apos;s message system.
                </p>
              </AlertDescription>
            </Alert>

            <Link href="/dashboard/messages">
              <Button variant="outline" className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator About Refund
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Pending Pledge but Project is Funded */}
      {pledge.status === "PENDING" && pledge.isFunded && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Campaign Successfully Funded</CardTitle>
            <CardDescription>
              Great news! The campaign reached its funding goal. Your payment will be processed automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Payment Processing</AlertTitle>
              <AlertDescription>
                Your pledge of ${pledge.amount.toFixed(2)} is being processed. You&apos;ll receive a confirmation once the payment is complete.
              </AlertDescription>
            </Alert>

            {/* Refund Information */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>About Refunds</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Once a campaign is funded, pledges cannot be cancelled through the platform.
                  If you need to request a refund, you must contact the project creator directly.
                </p>
                <p className="font-medium">
                  Refund availability and policies are determined by each creator and are not guaranteed.
                </p>
              </AlertDescription>
            </Alert>

            <Link href="/dashboard/messages">
              <Button variant="outline" className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Creator
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Cancelled or Failed Pledge */}
      {(pledge.status === "CANCELLED" || pledge.status === "FAILED") && (
        <Card className="mb-6">
          <CardContent className="py-8 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {pledge.status === "CANCELLED" ? "Pledge Cancelled" : "Pledge Failed"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {pledge.status === "CANCELLED"
                ? "You cancelled this pledge. No payment was processed."
                : "There was an issue processing your payment."}
            </p>
            {pledge.project.status === "LIVE" && (
              <Link href={`/projects/${pledge.project.slug}/pledge`}>
                <Button>Back This Project Again</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
