"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Users, Download, XCircle, RefreshCw, Trash2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { cn } from "@/lib/utils";
import type { Backer, RewardAddonItem } from "../types";

interface BackersListProps {
  backers: Backer[];
  allRewards: RewardAddonItem[];
  allAddons: RewardAddonItem[];
  projectId: string;
  projectSlug: string;
  onRefresh: () => Promise<void>;
}

export function BackersList({
  backers,
  allRewards,
  allAddons,
  projectId,
  projectSlug,
  onRefresh,
}: BackersListProps) {
  const [cancellingPledge, setCancellingPledge] = useState<string | null>(null);
  const [refundingPledge, setRefundingPledge] = useState<string | null>(null);
  const [deletingPledge, setDeletingPledge] = useState<string | null>(null);

  const [cancelConfirm, setCancelConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [refundConfirm, setRefundConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });

  const [selectedPledges, setSelectedPledges] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ open: boolean; action: "cancel" | "delete" }>({
    open: false,
    action: "cancel",
  });
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const pendingPledges = backers.filter(b => b.status === "PENDING");
  const selectedPendingCount = Array.from(selectedPledges).filter(id =>
    pendingPledges.some(p => p.id === id)
  ).length;

  const togglePledgeSelection = (pledgeId: string) => {
    setSelectedPledges(prev => {
      const next = new Set(prev);
      if (next.has(pledgeId)) {
        next.delete(pledgeId);
      } else {
        next.add(pledgeId);
      }
      return next;
    });
  };

  const toggleAllPending = () => {
    if (selectedPendingCount === pendingPledges.length && pendingPledges.length > 0) {
      setSelectedPledges(prev => {
        const next = new Set(prev);
        pendingPledges.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedPledges(prev => {
        const next = new Set(prev);
        pendingPledges.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  const handleCancelPledge = async () => {
    const pledgeId = cancelConfirm.pledgeId;
    setCancellingPledge(pledgeId);
    setCancelConfirm({ open: false, pledgeId: "" });
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "cancel", reason: "Cancelled by creator" }),
      });

      if (response.ok) {
        await onRefresh();
        toast.success("Pledge cancelled successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to cancel pledge");
      }
    } catch (err) {
      console.error("Failed to cancel pledge:", err);
      toast.error("Failed to cancel pledge");
    } finally {
      setCancellingPledge(null);
    }
  };

  const handleDeletePledge = async () => {
    const pledgeId = deleteConfirm.pledgeId;
    setDeletingPledge(pledgeId);
    setDeleteConfirm({ open: false, pledgeId: "" });
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });

      const responseData = await response.json();

      if (response.ok) {
        toast.success(`Pledge ${pledgeId.slice(-6)} deleted`);
        await onRefresh();
      } else {
        toast.error(responseData.error || "Failed to delete pledge");
      }
    } catch (err) {
      console.error("Failed to delete pledge:", err);
      toast.error("Failed to delete pledge");
    } finally {
      setDeletingPledge(null);
    }
  };

  const handleRefundPledge = async () => {
    const pledgeId = refundConfirm.pledgeId;
    setRefundingPledge(pledgeId);
    setRefundConfirm({ open: false, pledgeId: "" });
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "refund", reason: "Refunded by creator" }),
      });

      if (response.ok) {
        await onRefresh();
        toast.success("Pledge refunded successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to refund pledge");
      }
    } catch (err) {
      console.error("Failed to refund pledge:", err);
      toast.error("Failed to refund pledge");
    } finally {
      setRefundingPledge(null);
    }
  };

  const handleBulkCancel = async () => {
    setBulkProcessing(true);
    const pledgeIds = Array.from(selectedPledges).filter(id =>
      pendingPledges.some(p => p.id === id)
    );

    let successCount = 0;
    let failCount = 0;

    for (const pledgeId of pledgeIds) {
      try {
        const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({ action: "cancel", reason: "Bulk cancelled by creator" }),
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBulkProcessing(false);
    setBulkAction({ open: false, action: "cancel" });
    setSelectedPledges(new Set());
    await onRefresh();

    if (successCount > 0) {
      toast.success(`${successCount} pledge(s) cancelled successfully`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} pledge(s) failed to cancel`);
    }
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    const pledgeIds = Array.from(selectedPledges).filter(id =>
      pendingPledges.some(p => p.id === id)
    );

    try {
      const response = await fetch(`/api/creator/pledges/bulk-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ pledgeIds }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.deletedCount} pending pledge(s) deleted`);
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete pledges");
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error("Failed to delete pledges");
    }

    setBulkProcessing(false);
    setBulkAction({ open: false, action: "delete" });
    setSelectedPledges(new Set());
    await onRefresh();
  };

  const handleExportCSV = () => {
    if (!backers.length) {
      toast.error("No backers to export");
      return;
    }

    const fixedHeaders = [
      "Name",
      "Email",
      "Pledge Amount",
      "Shipping Paid",
      "Fulfillment Status",
      "Address",
      "City",
      "State",
      "Country",
    ];

    const rewardHeaders = allRewards.map((r) => `Reward: ${r.title}`);
    const addonHeaders = allAddons.map((a) => `Addon: ${a.title}`);
    const headers = [...fixedHeaders, ...rewardHeaders, ...addonHeaders];

    const rows = backers.map((backer) => {
      const fixedCols = [
        backer.name,
        backer.email || "",
        backer.amount.toString(),
        backer.shippingAmount.toString(),
        backer.fulfillmentStatus || "",
        backer.shippingAddress || "",
        backer.shippingCity || "",
        backer.shippingState || "",
        backer.shippingCountry || "",
      ];

      const rewardCols = allRewards.map((r) =>
        backer.rewardId === r.id ? "1" : "0"
      );

      const addonCols = allAddons.map((a) =>
        (backer.addonsMap?.[a.id] || 0).toString()
      );

      return [...fixedCols, ...rewardCols, ...addonCols];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backers-${projectSlug}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${backers.length} backers to CSV`);
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            All Backers
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="hover:border-primary/50 bg-card/50">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {pendingPledges.length > 0 && (
            <div className="mb-4 p-3 bg-muted/30 rounded-lg flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-pending"
                  checked={selectedPendingCount === pendingPledges.length && pendingPledges.length > 0}
                  onCheckedChange={toggleAllPending}
                />
                <label htmlFor="select-all-pending" className="text-sm cursor-pointer">
                  Select all pending ({pendingPledges.length})
                </label>
              </div>
              {selectedPendingCount > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedPendingCount} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => setBulkAction({ open: true, action: "cancel" })}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Cancel Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => setBulkAction({ open: true, action: "delete" })}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Selected
                  </Button>
                </>
              )}
            </div>
          )}
          {backers.length > 0 ? (
            <div className="rounded-xl border border-border/50 overflow-x-auto">
              <div className="grid grid-cols-7 gap-4 border-b border-border/50 bg-muted/30 p-3 text-sm font-medium min-w-[900px]">
                <div className="w-8"></div>
                <div>Backer</div>
                <div>Reward</div>
                <div>Amount</div>
                <div>Status</div>
                <div>Date</div>
                <div>Actions</div>
              </div>
              {backers.map((backer, index) => (
                <div
                  key={backer.id}
                  className="grid grid-cols-7 gap-4 border-b border-border/50 p-3 text-sm last:border-0 min-w-[900px] items-center hover:bg-muted/20 transition-colors animate-in fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="w-8">
                    {backer.status === "PENDING" && (
                      <Checkbox
                        checked={selectedPledges.has(backer.id)}
                        onCheckedChange={() => togglePledgeSelection(backer.id)}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      {backer.image && <AvatarImage src={backer.image} />}
                      <AvatarFallback className="text-xs">
                        {backer.name[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div>{backer.name}</div>
                      {backer.email && (
                        <div className="text-xs text-muted-foreground">{backer.email}</div>
                      )}
                    </div>
                  </div>
                  <div>{backer.reward}</div>
                  <div className="font-bold text-primary">${backer.amount}</div>
                  <div>
                    <Badge
                      className={cn(
                        backer.status === "COMPLETED" && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
                        backer.status === "PENDING" && "bg-amber-500/20 text-amber-500 border-amber-500/30",
                        backer.status === "REFUNDED" && "bg-muted text-muted-foreground",
                        backer.status === "CANCELLED" && "bg-rose-500/20 text-rose-500 border-rose-500/30"
                      )}
                    >
                      {backer.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{backer.time}</div>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/messages?projectId=${projectId}&recipientId=${backer.userId}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Message
                      </Button>
                    </Link>
                    {backer.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => setCancelConfirm({ open: true, pledgeId: backer.id })}
                        disabled={cancellingPledge === backer.id}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        {cancellingPledge === backer.id ? "..." : "Cancel"}
                      </Button>
                    )}
                    {backer.status === "COMPLETED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        onClick={() => setRefundConfirm({ open: true, pledgeId: backer.id })}
                        disabled={refundingPledge === backer.id}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${refundingPledge === backer.id ? "animate-spin" : ""}`} />
                        {refundingPledge === backer.id ? "..." : "Refund"}
                      </Button>
                    )}
                    {backer.status === "CANCELLED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => setDeleteConfirm({ open: true, pledgeId: backer.id })}
                        disabled={deletingPledge === backer.id}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {deletingPledge === backer.id ? "..." : "Delete"}
                      </Button>
                    )}
                    {backer.status === "REFUNDED" && (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">No backers yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelConfirm.open}
        onOpenChange={(open) => setCancelConfirm({ ...cancelConfirm, open })}
        title="Cancel Pledge?"
        description="Are you sure you want to cancel this pledge? This will remove the backer and amount from your campaign."
        confirmText="Cancel Pledge"
        variant="destructive"
        onConfirm={handleCancelPledge}
        loading={cancellingPledge === cancelConfirm.pledgeId}
      />

      <ConfirmDialog
        open={refundConfirm.open}
        onOpenChange={(open) => setRefundConfirm({ ...refundConfirm, open })}
        title="Refund Pledge?"
        description="Are you sure you want to refund this pledge? This will process a refund via Stripe and remove the backer from your campaign."
        confirmText="Refund"
        variant="destructive"
        onConfirm={handleRefundPledge}
        loading={refundingPledge === refundConfirm.pledgeId}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Delete Pledge?"
        description="Are you sure you want to permanently delete this pledge? This cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeletePledge}
        loading={deletingPledge === deleteConfirm.pledgeId}
      />

      <ConfirmDialog
        open={bulkAction.open && bulkAction.action === "cancel"}
        onOpenChange={(open) => setBulkAction({ ...bulkAction, open })}
        title={`Cancel ${selectedPendingCount} Pledge(s)?`}
        description="Are you sure you want to cancel all selected pending pledges? This will mark them as cancelled and remove them from your campaign totals."
        confirmText={`Cancel ${selectedPendingCount} Pledge(s)`}
        variant="destructive"
        onConfirm={handleBulkCancel}
        loading={bulkProcessing}
      />

      <ConfirmDialog
        open={bulkAction.open && bulkAction.action === "delete"}
        onOpenChange={(open) => setBulkAction({ ...bulkAction, open })}
        title={`Delete ${selectedPendingCount} Pledge(s)?`}
        description="Are you sure you want to permanently delete all selected pending pledges? This will completely remove them from the database and cannot be undone."
        confirmText={`Delete ${selectedPendingCount} Pledge(s)`}
        variant="destructive"
        onConfirm={handleBulkDelete}
        loading={bulkProcessing}
      />
    </>
  );
}
