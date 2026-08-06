"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Package,
  RefreshCw,
  UserX,
  XCircle,
} from "lucide-react";

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  launchedAt: string | null;
  backerCount: number;
  fulfilledCount: number;
  unfulfilledCount: number;
  fulfillmentPercent: number;
}

interface CurrentEligibility {
  status: "INSTANT" | "REQUIRES_APPROVAL" | "BLOCKED";
  totalUnfulfilled: number;
  totalFulfilled: number;
  liveProjectCount: number;
  blockedReason: string | null;
  projects: ProjectSummary[];
}

interface DeletionRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "CANCELLED";
  launchedProjectCount: number;
  unfulfilledCount: number;
  fulfilledCount: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  requestIp: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
  };
  reviewedBy: { id: string; name: string | null; email: string } | null;
  current: CurrentEligibility | null;
}

const STATUS_TABS = ["PENDING", "APPROVED", "DENIED", "ALL"] as const;

export default function AccountDeletionsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_TABS)[number]>("PENDING");
  const [selected, setSelected] = useState<DeletionRequest | null>(null);
  const [action, setAction] = useState<"APPROVE" | "DENY" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/account-deletion-requests?status=${statusFilter}`
      );
      if (!res.ok) throw new Error("Failed to load deletion requests");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openReview = (req: DeletionRequest, next: "APPROVE" | "DENY") => {
    setSelected(req);
    setAction(next);
    setNotes("");
  };

  const closeReview = () => {
    setSelected(null);
    setAction(null);
    setNotes("");
  };

  const submitReview = async () => {
    if (!selected || !action) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(
        `/api/admin/account-deletion-requests/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, notes: notes.trim() || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process request");

      toast.success(
        action === "APPROVE"
          ? "Account deleted and the creator has been emailed."
          : "Request denied and the creator has been emailed."
      );
      closeReview();
      fetchRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process request");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: DeletionRequest["status"]) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary">Pending review</Badge>;
      case "APPROVED":
        return <Badge className="bg-red-600 hover:bg-red-600">Deleted</Badge>;
      case "DENIED":
        return <Badge variant="outline">Denied</Badge>;
      default:
        return <Badge variant="outline">Cancelled</Badge>;
    }
  };

  // A pending request whose creator now owes fulfillment can't be approved.
  const isBlocked = (req: DeletionRequest) =>
    req.status === "PENDING" && req.current?.status === "BLOCKED";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserX className="h-6 w-6" />
            Account Deletions
          </h1>
          <p className="text-muted-foreground mt-1">
            Creators who have taken a campaign live must be reviewed before
            their account is deleted — deletion releases them from fulfillment
            obligations. Backers delete themselves and never appear here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as (typeof STATUS_TABS)[number])}
      >
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading requests&hellip;
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No {statusFilter === "ALL" ? "" : statusFilter.toLowerCase()} deletion requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-lg">
                      {req.user.name || "Unnamed user"}
                    </CardTitle>
                    <CardDescription>
                      {req.user.email} &middot; {req.user.role} &middot; requested{" "}
                      {new Date(req.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">{statusBadge(req.status)}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isBlocked(req) && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Cannot approve yet
                      </p>
                      <p className="text-amber-700 dark:text-amber-300">
                        {req.current?.blockedReason}
                      </p>
                    </div>
                  </div>
                )}

                {req.current && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Launched campaigns</p>
                      <p className="text-lg font-semibold">{req.current.projects.length}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Fulfilled backers</p>
                      <p className="text-lg font-semibold text-green-600">
                        {req.current.totalFulfilled}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Unfulfilled backers</p>
                      <p
                        className={`text-lg font-semibold ${
                          req.current.totalUnfulfilled > 0
                            ? "text-destructive"
                            : "text-green-600"
                        }`}
                      >
                        {req.current.totalUnfulfilled}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Running now</p>
                      <p className="text-lg font-semibold">{req.current.liveProjectCount}</p>
                    </div>
                  </div>
                )}

                {req.current && req.current.projects.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Campaigns that went live
                    </p>
                    <div className="space-y-1">
                      {req.current.projects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded border p-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.status} &middot; launched{" "}
                              {p.launchedAt
                                ? new Date(p.launchedAt).toLocaleDateString()
                                : "—"}{" "}
                              &middot; {p.backerCount} backers
                            </p>
                          </div>
                          <Badge
                            variant={p.unfulfilledCount > 0 ? "destructive" : "secondary"}
                            className="shrink-0"
                          >
                            {p.fulfillmentPercent}% fulfilled
                            {p.unfulfilledCount > 0 && ` · ${p.unfulfilledCount} owed`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {req.status !== "PENDING" && (
                  <div className="text-sm text-muted-foreground border-t pt-3">
                    {req.status === "APPROVED" ? "Approved" : "Denied"} by{" "}
                    {req.reviewedBy?.name || req.reviewedBy?.email || "an admin"} on{" "}
                    {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : "—"}
                    {req.reviewNotes && (
                      <p className="mt-1 italic">&ldquo;{req.reviewNotes}&rdquo;</p>
                    )}
                  </div>
                )}

                {req.status === "PENDING" && (
                  <div className="flex gap-2 justify-end border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => openReview(req, "DENY")}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Deny
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isBlocked(req)}
                      onClick={() => openReview(req, "APPROVE")}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve &amp; delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle
              className={action === "APPROVE" ? "text-destructive" : undefined}
            >
              {action === "APPROVE" ? "Approve and delete account" : "Deny this request"}
            </DialogTitle>
            <DialogDescription>
              {action === "APPROVE" ? (
                <>
                  This permanently deletes{" "}
                  <span className="font-medium">{selected?.user.email}</span>. It cannot
                  be undone. They&apos;ll be emailed a confirmation and will not be able
                  to sign in or reuse that email address.
                </>
              ) : (
                <>
                  The account stays active. Your note is included in the email to{" "}
                  <span className="font-medium">{selected?.user.email}</span>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="reviewNotes">
              {action === "APPROVE" ? "Internal note (optional)" : "Reason (shown to them)"}
            </Label>
            <Textarea
              id="reviewNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                action === "APPROVE"
                  ? "Verified all backers shipped…"
                  : "We still show 12 backers awaiting shipment on…"
              }
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeReview} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={action === "APPROVE" ? "destructive" : "default"}
              onClick={submitReview}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing&hellip;
                </>
              ) : action === "APPROVE" ? (
                "Permanently delete"
              ) : (
                "Deny request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
