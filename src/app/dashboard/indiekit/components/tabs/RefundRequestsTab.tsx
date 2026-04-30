"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface RefundRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  reason: string;
  creatorNote: string | null;
  createdAt: string;
  processedAt: string | null;
  user: { id: string; name: string | null; email: string | null };
  pledge: { id: string; amount: number; paymentProcessor: string; status: string };
  project: { id: string; title: string; slug: string };
}

interface Props {
  projectId: string;
}

export function RefundRequestsTab({ projectId }: Props) {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [selectedRequest, setSelectedRequest] = useState<RefundRequest | null>(null);
  const [dialogAction, setDialogAction] = useState<"approve" | "deny" | null>(null);
  const [creatorNote, setCreatorNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/creator/refund-requests?${params}`);
      if (!res.ok) throw new Error("Failed to fetch refund requests");
      const data = await res.json();
      setRequests(data.refundRequests);
    } catch {
      toast.error("Failed to load refund requests");
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openDialog = (request: RefundRequest, action: "approve" | "deny") => {
    setSelectedRequest(request);
    setDialogAction(action);
    setCreatorNote("");
  };

  const handleAction = async () => {
    if (!selectedRequest || !dialogAction) return;
    setIsProcessing(true);
    try {
      const res = await apiFetch(`/api/creator/refund-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: dialogAction, creatorNote: creatorNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process request");
      toast.success(data.message || `Refund request ${dialogAction === "approve" ? "approved" : "denied"}.`);
      setSelectedRequest(null);
      setDialogAction(null);
      fetchRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process refund request");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "DENIED":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Denied
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Refund Requests</h2>
          <p className="text-sm text-muted-foreground">
            Review and respond to refund requests from your backers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="DENIED">Denied</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {pendingCount > 0 && statusFilter !== "PENDING" && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
          You have {pendingCount} pending refund request{pendingCount !== 1 ? "s" : ""} awaiting your review.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No refund requests</h3>
            <p className="text-muted-foreground">
              {statusFilter === "PENDING"
                ? "You have no pending refund requests."
                : `No ${statusFilter.toLowerCase()} refund requests found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{request.user.name || request.user.email || "Unknown backer"}</span>
                      {getStatusBadge(request.status)}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      Project: {request.project.title} · Submitted{" "}
                      {new Date(request.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {request.processedAt &&
                        ` · Reviewed ${new Date(request.processedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-lg font-bold shrink-0">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    {Number(request.pledge.amount).toFixed(2)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-md bg-muted/50 text-sm">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Backer&apos;s reason</p>
                  <p>{request.reason}</p>
                </div>
                {request.creatorNote && (
                  <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Your note</p>
                    <p>{request.creatorNote}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="uppercase font-medium">{request.pledge.paymentProcessor}</span>
                  <span>·</span>
                  <span>Pledge #{request.pledge.id.slice(-8)}</span>
                </div>
                {request.status === "PENDING" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => openDialog(request, "approve")}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                      Approve &amp; Refund
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                      onClick={() => openDialog(request, "deny")}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Deny
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve / Deny Dialog */}
      <Dialog
        open={!!selectedRequest && !!dialogAction}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null);
            setDialogAction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Approve Refund Request" : "Deny Refund Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? `A refund of $${Number(selectedRequest?.pledge.amount).toFixed(2)} will be processed immediately to the backer's original payment method.`
                : "The backer will be notified that their refund request has been denied."}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="py-2 space-y-4">
              <div className="p-3 rounded-md bg-muted/50 text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">Backer&apos;s reason</p>
                <p>{selectedRequest.reason}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="creator-note">Note to backer (optional)</Label>
                <Textarea
                  id="creator-note"
                  placeholder={
                    dialogAction === "approve"
                      ? "Add a message to the backer (optional)..."
                      : "Explain why you're denying this request (optional)..."
                  }
                  value={creatorNote}
                  onChange={(e) => setCreatorNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setDialogAction(null);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isProcessing}
              className={
                dialogAction === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {dialogAction === "approve" ? "Approve & Process Refund" : "Deny Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
