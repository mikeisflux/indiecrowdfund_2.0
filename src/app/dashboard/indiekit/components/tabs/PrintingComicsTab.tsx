"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertTriangle,
  Printer,
  Loader2,
  ExternalLink,
  RefreshCw,
  Send,
  Plus,
  CreditCard,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";

// PRINT ORDERS for the campaign — creator submits ONE order per
// print run (initial run, reprint, variant cover, etc). Books ship
// to the CREATOR, who then fulfills backers manually.
//
// Backed by:
//   GET  /api/creator/printingcomics/catalog
//   GET  /api/creator/printingcomics/uploads
//   POST /api/creator/printingcomics/uploads        — push R2 PDFs
//   GET  /api/creator/printingcomics/project-orders
//   POST /api/creator/printingcomics/project-orders
//
// Status updates land via /api/webhooks/printingcomics → updates the
// ProjectPrintOrder row in place.

interface PCProductSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
}

interface PCUploadSummary {
  id: string;
  filename: string;
  purpose?: string;
}

interface ProjectPrintOrder {
  id: string;
  printingComicsOrderId: string | null;
  printingComicsOrderNumber: string | null;
  status: string;
  shippingMethod: string | null;
  trackingNumber: string | null;
  lastSyncedAt: string | null;
  productSlug: string;
  quantity: number;
  options: Record<string, unknown>;
  files: Array<{ uploadId: string; purpose: string }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  email: string;
  subtotalCents: number | null;
  shippingCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  currency: string | null;
  // PayPal-hosted payment fields. approvalUrl + expiresAt are nullable
  // (cleared on paid, never set on markAsPaid path); paymentProvider
  // is "paypal" | "manual" | null.
  paymentApprovalUrl: string | null;
  paymentApprovalUrlExpiresAt: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PAID: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PRODUCTION: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  SHIPPED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  DELIVERED: "bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  CANCELLED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  REFUNDED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface PrintingComicsTabProps {
  projectId?: string;
}

export function PrintingComicsTab({ projectId }: PrintingComicsTabProps) {
  // Catalog state — load lazily when the form is opened.
  const [catalog, setCatalog] = useState<PCProductSummary[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [uploads, setUploads] = useState<PCUploadSummary[]>([]);

  // Project's existing print orders.
  const [orders, setOrders] = useState<ProjectPrintOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // New-order form state.
  const [formOpen, setFormOpen] = useState(false);
  const [productSlug, setProductSlug] = useState("");
  const [quantity, setQuantity] = useState("250");
  const [optionsJson, setOptionsJson] = useState("{}");
  const [coverUploadId, setCoverUploadId] = useState("");
  const [interiorUploadId, setInteriorUploadId] = useState("");
  const [shipFirstName, setShipFirstName] = useState("");
  const [shipLastName, setShipLastName] = useState("");
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipRegion, setShipRegion] = useState("");
  const [shipPostalCode, setShipPostalCode] = useState("");
  const [shipCountry, setShipCountry] = useState("US");
  const [contactEmail, setContactEmail] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Per-row "Refresh payment link" busy state (the row id we're
  // currently refreshing, or null).
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const handleRefreshPaymentLink = async (orderId: string) => {
    setRefreshingId(orderId);
    try {
      const r = await apiFetch(
        `/api/creator/printingcomics/project-orders/${encodeURIComponent(orderId)}/refresh-payment-link`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = await r.json();
      if (!r.ok) {
        toast.error(data?.error || `Refresh failed (HTTP ${r.status})`);
        return;
      }
      // Open the new approval URL immediately — that's the whole
      // point of clicking refresh.
      if (data.payment?.approvalUrl) {
        window.open(data.payment.approvalUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("New PayPal link opened");
      loadOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshingId(null);
    }
  };

  const loadOrders = useCallback(async () => {
    if (!projectId) {
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const r = await apiFetch(
        `/api/creator/printingcomics/project-orders?projectId=${encodeURIComponent(projectId)}`
      );
      const data = await r.json();
      if (!r.ok) {
        setOrdersError(data?.error || `HTTP ${r.status}`);
        setOrders([]);
        return;
      }
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      // If the creator's previous order has a shipping address, pre-fill
      // the form so they don't retype it for reprints.
      const last = (data?.orders || [])[0] as ProjectPrintOrder | undefined;
      if (last) {
        setShipFirstName((p) => p || last.shippingAddress.firstName || "");
        setShipLastName((p) => p || last.shippingAddress.lastName || "");
        setShipLine1((p) => p || last.shippingAddress.line1 || "");
        setShipLine2((p) => p || last.shippingAddress.line2 || "");
        setShipCity((p) => p || last.shippingAddress.city || "");
        setShipRegion((p) => p || last.shippingAddress.region || "");
        setShipPostalCode((p) => p || last.shippingAddress.postalCode || "");
        setShipCountry((p) => p || last.shippingAddress.country || "US");
        setContactEmail((p) => p || last.email || "");
      }
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }, [projectId]);

  const loadCatalogAndUploads = useCallback(async () => {
    if (catalog === null && !catalogLoading) {
      setCatalogLoading(true);
      try {
        const [cr, ur] = await Promise.all([
          apiFetch("/api/creator/printingcomics/catalog"),
          apiFetch("/api/creator/printingcomics/uploads?limit=100"),
        ]);
        const cd = await cr.json();
        const ud = await ur.json();
        setCatalog(Array.isArray(cd?.products) ? cd.products : []);
        setUploads(Array.isArray(ud?.uploads) ? ud.uploads : []);
      } catch {
        // toast handled when user actually submits
      } finally {
        setCatalogLoading(false);
      }
    }
  }, [catalog, catalogLoading]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openForm = () => {
    setFormOpen(true);
    loadCatalogAndUploads();
  };

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error("Pick a project first");
      return;
    }
    if (!productSlug.trim()) {
      toast.error("Pick a product slug");
      return;
    }
    let parsedOptions: Record<string, string | number> = {};
    try {
      parsedOptions = JSON.parse(optionsJson || "{}");
    } catch {
      toast.error("Options must be valid JSON");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Quantity must be a positive number");
      return;
    }
    if (!shipFirstName || !shipLastName || !shipLine1 || !shipCity || !shipRegion || !shipPostalCode || !shipCountry) {
      toast.error("Fill in the full ship-to address (this is YOUR receiving address — printer ships the cartons here)");
      return;
    }
    if (!contactEmail) {
      toast.error("Contact email is required");
      return;
    }
    const files: { uploadId: string; purpose: string }[] = [];
    if (coverUploadId) files.push({ uploadId: coverUploadId, purpose: "cover" });
    if (interiorUploadId) files.push({ uploadId: interiorUploadId, purpose: "interior" });

    setSubmitting(true);
    try {
      const r = await apiFetch("/api/creator/printingcomics/project-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          productSlug: productSlug.trim(),
          quantity: qty,
          options: parsedOptions,
          files,
          shippingAddress: {
            firstName: shipFirstName,
            lastName: shipLastName,
            line1: shipLine1,
            line2: shipLine2 || undefined,
            city: shipCity,
            region: shipRegion,
            postalCode: shipPostalCode,
            country: shipCountry,
          },
          email: contactEmail,
          notes: orderNotes || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data?.error || `Submit failed (HTTP ${r.status})`);
        return;
      }
      toast.success(
        data.idempotent
          ? `Already submitted as ${data.order?.printingComicsOrderNumber}`
          : `Submitted ${data.order?.printingComicsOrderNumber || "(awaiting number)"}`
      );
      setFormOpen(false);
      loadOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Beta warning — first thing the creator sees */}
      <div
        role="alert"
        className="flex items-start gap-3 p-4 rounded-lg border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
      >
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            This is in the testing phase. Do not place an order.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Provider docs:{" "}
            <a
              href="https://printingcomics.com/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground inline-flex items-center gap-1"
            >
              printingcomics.com/developers
              <ExternalLink className="h-3 w-3" />
            </a>
            . Submitting on this page calls the live API. The creator pays Printing Comics directly via their billing; books ship to the address you enter (your warehouse / home), then you fulfill backers.
          </p>
        </div>
      </div>

      {/* Existing orders for this project */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print orders for this campaign
              </p>
              <p className="text-xs text-muted-foreground">
                Each order is one print run (e.g. initial 500 copies, then a reprint of 100).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadOrders} disabled={ordersLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${ordersLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={openForm} disabled={!projectId}>
                <Plus className="h-4 w-4 mr-2" />
                New print order
              </Button>
            </div>
          </div>

          {ordersError && (
            <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 mb-3">
              {ordersError}
            </div>
          )}
          {ordersLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No print orders yet for this campaign. Click <strong>New print order</strong> to submit one.
            </p>
          ) : (
            <div className="border rounded-md divide-y">
              {orders.map((o) => {
                // Approval URL is "live" if it exists and hasn't
                // expired (ish — provider's clock vs ours). Treat a
                // 5-minute buffer as expired.
                const expiresAt = o.paymentApprovalUrlExpiresAt
                  ? new Date(o.paymentApprovalUrlExpiresAt).getTime()
                  : 0;
                const linkLive = !!o.paymentApprovalUrl && expiresAt > Date.now() + 5 * 60 * 1000;
                const linkExpired = !!o.paymentApprovalUrl && !linkLive;
                const needsPayment =
                  !o.paidAt &&
                  (o.status === "PENDING" || o.status === "DRAFT") &&
                  !!o.printingComicsOrderId;
                return (
                  <div key={o.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {o.quantity}× <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">{o.productSlug}</code>
                          {o.printingComicsOrderNumber && (
                            <span className="text-xs text-muted-foreground ml-2">{o.printingComicsOrderNumber}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ships to {o.shippingAddress.firstName} {o.shippingAddress.lastName}, {o.shippingAddress.city}, {o.shippingAddress.region} {o.shippingAddress.postalCode} {o.shippingAddress.country}
                        </p>
                        {o.trackingNumber && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Tracking: {o.trackingNumber}{o.shippingMethod ? ` · ${o.shippingMethod}` : ""}
                          </p>
                        )}
                        {o.totalCents != null && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Total: ${(o.totalCents / 100).toFixed(2)} {o.currency || "USD"}
                            {o.paidAt && (
                              <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                                · paid {new Date(o.paidAt).toLocaleDateString()}
                                {o.paymentProvider ? ` (${o.paymentProvider})` : ""}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <Badge className={STATUS_BADGE[o.status] || "bg-zinc-200 text-zinc-700"}>
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {needsPayment && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {linkLive ? (
                          <Button asChild size="sm">
                            <a
                              href={o.paymentApprovalUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                              Pay with PayPal
                              <ExternalLink className="h-3 w-3 ml-1.5" />
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleRefreshPaymentLink(o.id)}
                            disabled={refreshingId === o.id}
                          >
                            {refreshingId === o.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {linkExpired ? "Refresh PayPal link" : "Generate PayPal link"}
                          </Button>
                        )}
                        {linkExpired && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            The previous PayPal link expired (links live ~3h). Click refresh to mint a new one.
                          </p>
                        )}
                        {!linkLive && !linkExpired && (
                          <p className="text-[11px] text-muted-foreground">
                            Click to mint a PayPal approval URL — pay there with a PayPal account or guest credit card.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New-order dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit a new print order</DialogTitle>
            <DialogDescription>
              Cartons will ship to the address you enter — that&apos;s YOUR address, not a backer&apos;s. Once the books arrive you&apos;ll fulfill backers from your end.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Product</Label>
                {catalogLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : catalog && catalog.length > 0 ? (
                  <Select value={productSlug} onValueChange={setProductSlug}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.map((p) => (
                        <SelectItem key={p.id} value={p.slug}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={productSlug}
                    onChange={(e) => setProductSlug(e.target.value)}
                    placeholder="standard-comic-book"
                  />
                )}
                <p className="text-[10px] text-muted-foreground">From the Printing Comics catalog.</p>
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Total copies for this print run.</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Configurator options (JSON)</Label>
              <Textarea
                rows={3}
                value={optionsJson}
                onChange={(e) => setOptionsJson(e.target.value)}
                placeholder='{"interior_pages":32,"interior_color":"Full Color","interior_paper":"80lb Gloss","cover_paper":"100lb Gloss"}'
              />
              <p className="text-[10px] text-muted-foreground">
                Per-product configurator values. See provider docs for keys + accepted values.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cover PDF</Label>
                <Select
                  value={coverUploadId || "__none__"}
                  onValueChange={(v) => setCoverUploadId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(none)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(none)</SelectItem>
                    {uploads.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.filename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Interior PDF</Label>
                <Select
                  value={interiorUploadId || "__none__"}
                  onValueChange={(v) => setInteriorUploadId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="(none)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(none)</SelectItem>
                    {uploads.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.filename}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground -mt-2">
              Need to upload a new PDF? POST <code>{`{r2Key, purpose}`}</code> to <code>/api/creator/printingcomics/uploads</code> first. UI to pick from R2 is coming.
            </p>

            <div className="pt-2 border-t">
              <p className="text-sm font-semibold mb-2">Ship cartons to (your receiving address)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>First name</Label>
                  <Input value={shipFirstName} onChange={(e) => setShipFirstName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Last name</Label>
                  <Input value={shipLastName} onChange={(e) => setShipLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label>Address line 1</Label>
                <Input value={shipLine1} onChange={(e) => setShipLine1(e.target.value)} />
              </div>
              <div className="space-y-1 mt-3">
                <Label>Address line 2 (optional)</Label>
                <Input value={shipLine2} onChange={(e) => setShipLine2(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input value={shipCity} onChange={(e) => setShipCity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>State / region</Label>
                  <Input value={shipRegion} onChange={(e) => setShipRegion(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Postal code</Label>
                  <Input value={shipPostalCode} onChange={(e) => setShipPostalCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label>Country</Label>
                <Input value={shipCountry} onChange={(e) => setShipCountry(e.target.value)} placeholder="US" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <p className="text-[10px] text-muted-foreground">
                  Printing Comics emails order updates + invoices here.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any special instructions for the printer."
                />
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
              On submit we send <code>externalRef = {projectId ? "<orderId>" : "—"}</code> to Printing Comics so re-submitting the same order is idempotent. Payment is handled directly between you and Printing Comics through their billing; we just track status here via webhook.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Submit print order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
