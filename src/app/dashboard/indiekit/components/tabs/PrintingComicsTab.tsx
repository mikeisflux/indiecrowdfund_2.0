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
  Trash2,
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
  // Multi-item orders store the full line-item array here. Null on
  // legacy rows; in that case we render from the flat fields above.
  items: Array<{
    productSlug: string;
    quantity: number;
    options?: Record<string, unknown>;
    files?: Array<{ uploadId: string; purpose: string }>;
    label?: string;
  }> | null;
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

  // New-order form state. Each "line item" is one variant the printer
  // will produce as part of this print run — e.g. 6 different cover
  // variants of the same comic, or a regular edition + a hardcover
  // edition shipped together. Common Printing Comics configurator
  // keys (interior_pages, interior_color, interior_paper, cover_paper)
  // are surfaced as labeled fields per item; everything else falls
  // through the "advanced JSON" textarea on each item.
  interface LineItemState {
    productSlug: string;
    quantity: string;
    interiorPages: string;
    interiorColor: string;
    interiorPaper: string;
    coverPaper: string;
    coverFinish: string;
    binding: string;
    extraOptionsJson: string;
    coverUploadId: string;
    interiorUploadId: string;
    label: string;        // creator-facing label for "Variant A", "Hardcover", etc
  }
  const blankItem = (): LineItemState => ({
    productSlug: "",
    quantity: "250",
    interiorPages: "",
    interiorColor: "",
    interiorPaper: "",
    coverPaper: "",
    coverFinish: "",
    binding: "",
    extraOptionsJson: "",
    coverUploadId: "",
    interiorUploadId: "",
    label: "",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemState[]>([blankItem()]);
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

  // Build the items[] payload from the form state. Returns null + a
  // toast if anything is malformed, so the caller just bails.
  const buildItemsPayload = (): Array<{
    productSlug: string;
    quantity: number;
    options: Record<string, string | number>;
    files: { uploadId: string; purpose: string }[];
  }> | null => {
    const out: Array<{
      productSlug: string;
      quantity: number;
      options: Record<string, string | number>;
      files: { uploadId: string; purpose: string }[];
    }> = [];
    for (const [idx, item] of lineItems.entries()) {
      const human = item.label || `Item ${idx + 1}`;
      if (!item.productSlug.trim()) {
        toast.error(`${human}: pick a product`);
        return null;
      }
      const qty = parseInt(item.quantity, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        toast.error(`${human}: quantity must be a positive number`);
        return null;
      }
      // Structured fields → configurator key/value map. Empty values
      // are skipped so the printer falls back to product defaults.
      const options: Record<string, string | number> = {};
      if (item.interiorPages.trim()) {
        const pages = parseInt(item.interiorPages, 10);
        if (!Number.isFinite(pages) || pages < 1) {
          toast.error(`${human}: interior pages must be a positive number`);
          return null;
        }
        options.interior_pages = pages;
      }
      if (item.interiorColor) options.interior_color = item.interiorColor;
      if (item.interiorPaper) options.interior_paper = item.interiorPaper;
      if (item.coverPaper) options.cover_paper = item.coverPaper;
      if (item.coverFinish) options.cover_finish = item.coverFinish;
      if (item.binding) options.binding = item.binding;
      // Power-user escape hatch: any extra configurator keys not
      // covered by the structured fields go through the JSON textarea.
      if (item.extraOptionsJson.trim()) {
        try {
          const extra = JSON.parse(item.extraOptionsJson) as Record<string, string | number>;
          if (extra && typeof extra === "object" && !Array.isArray(extra)) {
            Object.assign(options, extra);
          } else {
            toast.error(`${human}: advanced options must be a JSON object`);
            return null;
          }
        } catch {
          toast.error(`${human}: advanced options must be valid JSON`);
          return null;
        }
      }
      const files: { uploadId: string; purpose: string }[] = [];
      if (item.coverUploadId) files.push({ uploadId: item.coverUploadId, purpose: "cover" });
      if (item.interiorUploadId) files.push({ uploadId: item.interiorUploadId, purpose: "interior" });
      out.push({ productSlug: item.productSlug.trim(), quantity: qty, options, files });
    }
    return out;
  };

  const updateLineItem = (idx: number, patch: Partial<LineItemState>) => {
    setLineItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addLineItem = () => setLineItems((prev) => [...prev, blankItem()]);
  const removeLineItem = (idx: number) =>
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error("Pick a project first");
      return;
    }
    const items = buildItemsPayload();
    if (!items) return;
    if (!shipFirstName || !shipLastName || !shipLine1 || !shipCity || !shipRegion || !shipPostalCode || !shipCountry) {
      toast.error("Fill in the full ship-to address (this is YOUR receiving address — printer ships the cartons here)");
      return;
    }
    if (!contactEmail) {
      toast.error("Contact email is required");
      return;
    }

    setSubmitting(true);
    try {
      const r = await apiFetch("/api/creator/printingcomics/project-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          items,
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
                          {Array.isArray(o.items) && o.items.length > 1 && (
                            <span className="text-xs text-muted-foreground ml-2">
                              +{o.items.length - 1} more variant{o.items.length - 1 === 1 ? "" : "s"}
                            </span>
                          )}
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Books in this print run</p>
                  <p className="text-xs text-muted-foreground">
                    Add a separate item for each variant — different cover art, hardcover vs softcover, page-count variant, etc. They&apos;ll all ship together to the address below.
                  </p>
                </div>
              </div>

              {lineItems.map((item, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                        Item {idx + 1}
                      </span>
                      <Input
                        value={item.label}
                        onChange={(e) => updateLineItem(idx, { label: e.target.value })}
                        placeholder='Optional label (e.g. "Cover A", "Hardcover edition")'
                        className="h-8 text-sm"
                      />
                    </div>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(idx)}
                        aria-label={`Remove item ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Product</Label>
                      {catalogLoading ? (
                        <Skeleton className="h-10 w-full" />
                      ) : catalog && catalog.length > 0 ? (
                        <Select
                          value={item.productSlug}
                          onValueChange={(v) => updateLineItem(idx, { productSlug: v })}
                        >
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
                          value={item.productSlug}
                          onChange={(e) => updateLineItem(idx, { productSlug: e.target.value })}
                          placeholder="standard-comic-book"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, { quantity: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Interior pages</Label>
                      <Input
                        type="number"
                        min={1}
                        step={4}
                        value={item.interiorPages}
                        onChange={(e) => updateLineItem(idx, { interiorPages: e.target.value })}
                        placeholder="e.g. 32"
                      />
                      <p className="text-[10px] text-muted-foreground">Multiples of 4. Leave blank for product default.</p>
                    </div>
                    <div className="space-y-1">
                      <Label>Interior color</Label>
                      <Select
                        value={item.interiorColor || "__default__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { interiorColor: v === "__default__" ? "" : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Product default</SelectItem>
                          <SelectItem value="Full Color">Full color</SelectItem>
                          <SelectItem value="Black & White">Black &amp; white</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Interior paper</Label>
                      <Select
                        value={item.interiorPaper || "__default__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { interiorPaper: v === "__default__" ? "" : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Product default</SelectItem>
                          <SelectItem value="60lb Uncoated">60lb uncoated (matte / classic feel)</SelectItem>
                          <SelectItem value="70lb Matte">70lb matte</SelectItem>
                          <SelectItem value="80lb Gloss">80lb gloss (vibrant color)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Cover paper</Label>
                      <Select
                        value={item.coverPaper || "__default__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { coverPaper: v === "__default__" ? "" : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Product default</SelectItem>
                          <SelectItem value="80lb Cover">80lb cover</SelectItem>
                          <SelectItem value="100lb Cover">100lb cover</SelectItem>
                          <SelectItem value="10pt C1S">10pt C1S</SelectItem>
                          <SelectItem value="12pt C1S">12pt C1S</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Cover finish</Label>
                      <Select
                        value={item.coverFinish || "__default__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { coverFinish: v === "__default__" ? "" : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Product default</SelectItem>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="Gloss Lamination">Gloss lamination</SelectItem>
                          <SelectItem value="Matte Lamination">Matte lamination</SelectItem>
                          <SelectItem value="Spot UV">Spot UV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Binding</Label>
                      <Select
                        value={item.binding || "__default__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { binding: v === "__default__" ? "" : v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Product default</SelectItem>
                          <SelectItem value="Saddle Stitch">Saddle stitch (stapled)</SelectItem>
                          <SelectItem value="Perfect Bound">Perfect bound (glued spine)</SelectItem>
                          <SelectItem value="Hardcover">Hardcover</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Cover PDF</Label>
                      <Select
                        value={item.coverUploadId || "__none__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { coverUploadId: v === "__none__" ? "" : v })
                        }
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
                        value={item.interiorUploadId || "__none__"}
                        onValueChange={(v) =>
                          updateLineItem(idx, { interiorUploadId: v === "__none__" ? "" : v })
                        }
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

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                      Advanced: extra configurator options (JSON)
                    </summary>
                    <Textarea
                      rows={2}
                      value={item.extraOptionsJson}
                      onChange={(e) => updateLineItem(idx, { extraOptionsJson: e.target.value })}
                      placeholder='{"trim_size":"6.625x10.25","custom_key":"value"}'
                      className="mt-2 font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Only needed for product-specific options not in the dropdowns above. See provider docs for keys.
                    </p>
                  </details>
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add another book / cover variant
              </Button>

              <p className="text-[10px] text-muted-foreground">
                Need to upload a new PDF? POST <code>{`{r2Key, purpose}`}</code> to <code>/api/creator/printingcomics/uploads</code> first. UI to pick from R2 is coming.
              </p>
            </div>

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
