"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  X,
  Check,
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
  proofStatus: string | null;
  proofUrl: string | null;
  proofReviewUrl: string | null;
  proofVersion: number | null;
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
  // edition shipped together.
  //
  // The configurator option keys + accepted values are PER-PRODUCT and
  // pulled live from PrintingComics' catalog (`GET /catalog/products/:slug`).
  // We render dropdowns from that response so the values exactly match
  // what the storefront accepts — no hardcoded guesses about whether
  // a product offers "60lb Uncoated" or only "80lb Gloss".
  interface LineItemState {
    productSlug: string;
    quantity: string;
    options: Record<string, string | number>;  // keyed by configurator option key
    extraOptionsJson: string;                   // power-user override
    coverUploadId: string;
    interiorUploadId: string;
    label: string;                              // creator-facing variant label
  }
  const blankItem = (): LineItemState => ({
    productSlug: "",
    quantity: "250",
    options: {},
    extraOptionsJson: "",
    coverUploadId: "",
    interiorUploadId: "",
    label: "",
  });

  // Per-product configurator schema, fetched on demand from the catalog
  // proxy. Keyed by product slug. Each option carries its key, label,
  // type, and (for select-type options) the accepted values.
  // Mirrors PrintingComics' GET /catalog/products/:slug option schema
  // (server/src/routes/v1/catalog.ts + prisma ProductOption/Value models).
  type PCOptionType =
    | "TILES"    // image grid (cover/interior paper)
    | "RADIO"    // inline buttons (yes/no)
    | "SELECT"   // dropdown
    | "TOGGLE"   // boolean switch
    | "TEXT"     // free text
    | "NUMBER"   // numeric
    | "UPLOAD"   // file upload
    | "CONFIRM"; // required acknowledgement checkbox
  interface PCOptionValue {
    id: string;
    label: string;              // ALSO the identifier submitted in the order options map
    subLabel?: string | null;
    imageUrl?: string | null;
    priceModifierCents?: number;
    sortOrder?: number;
  }
  interface PCOption {
    id: string;
    name: string;               // creator-facing label
    internalKey?: string | null; // key for the order options map (falls back to id)
    section?: string | null;
    type: PCOptionType;
    required?: boolean;
    helpText?: string | null;
    longDescription?: string | null;
    sortOrder?: number;
    dependsOnOptionId?: string | null;
    dependsOnValue?: string | null;
    values?: PCOptionValue[];
  }
  interface PCProductFull {
    slug: string;
    name: string;
    minQuantity?: number;
    options: PCOption[];
  }
  const [productConfig, setProductConfig] = useState<Record<string, PCProductFull | "loading" | "error">>({});

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

  // Live pricing preview from PrintingComics' /pricing/quote. Recomputed
  // on a debounce as the creator changes items / address / shipping
  // method, so the total they see in the dialog matches what they'll
  // be charged on the PayPal approval URL down to the cent.
  interface PricingQuoteLine {
    productSlug: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }
  interface PricingQuoteShippingOption {
    id: string;
    name: string;
    rateCents: number;
    estimatedDays?: string;
  }
  interface PricingQuote {
    items: PricingQuoteLine[];
    subtotalCents: number;
    discountCents: number;
    shippingOptions: PricingQuoteShippingOption[];
    shippingCents?: number;
    taxCents: number;
    totalCents: number;
    currency: string;
  }
  const [pricingQuote, setPricingQuote] = useState<PricingQuote | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [shippingRateId, setShippingRateId] = useState<string>("");

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
    setPricingQuote(null);
    setPricingError(null);
    setShippingRateId("");
    loadCatalogAndUploads();
  };

  // Build the items[] payload from the form state. Returns null + a
  // toast if anything is malformed, so the caller just bails.
  // Fetch the per-product configurator from PrintingComics' catalog the
  // first time a creator picks the product. Cached forever in component
  // state — products don't change schema during a single dialog session.
  const loadProductConfig = useCallback(async (slug: string) => {
    if (!slug) return;
    setProductConfig((prev) => {
      if (prev[slug]) return prev;
      return { ...prev, [slug]: "loading" };
    });
    try {
      const r = await apiFetch(
        `/api/creator/printingcomics/catalog?slug=${encodeURIComponent(slug)}`
      );
      const data = await r.json();
      if (!r.ok) {
        setProductConfig((prev) => ({ ...prev, [slug]: "error" }));
        return;
      }
      // The provider's response wraps the product in either { product }
      // or returns the product directly — accept both.
      const product: PCProductFull = (data?.product || data) as PCProductFull;
      setProductConfig((prev) => ({ ...prev, [slug]: product }));
    } catch {
      setProductConfig((prev) => ({ ...prev, [slug]: "error" }));
    }
  }, []);

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
      // Start from the per-item options map (structured dropdowns from
      // the live catalog); merge the advanced JSON on top so power users
      // can override or add keys the dropdowns don't surface.
      const options: Record<string, string | number> = { ...item.options };
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
  // Set/clear a single configurator option on a line item without
  // disturbing the other options.
  const updateLineItemOption = (idx: number, key: string, value: string | number | undefined) => {
    setLineItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const nextOptions = { ...it.options };
        if (value === undefined || value === "" || value === "__default__") {
          delete nextOptions[key];
        } else {
          nextOptions[key] = value;
        }
        return { ...it, options: nextOptions };
      })
    );
  };
  // When a product is picked, fetch its configurator and clear stale
  // option values from a previously-selected product.
  const updateLineItemProduct = (idx: number, slug: string) => {
    setLineItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, productSlug: slug, options: {} } : it))
    );
    if (slug) loadProductConfig(slug);
  };
  const addLineItem = () => setLineItems((prev) => [...prev, blankItem()]);
  const removeLineItem = (idx: number) =>
    setLineItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  // Debounced pricing preview. Re-runs whenever the items, destination,
  // or selected shipping option change. We don't toast errors — just
  // surface them inline so the creator can still submit even if the
  // quote fetch is having a moment.
  useEffect(() => {
    if (!formOpen) return;
    // Need at least one fully-specified line item AND a country to
    // ask for a quote. Anything less and the API will reject anyway.
    const validItems = lineItems
      .filter((it) => it.productSlug.trim() && parseInt(it.quantity, 10) > 0)
      .map((it) => ({
        productSlug: it.productSlug.trim(),
        quantity: parseInt(it.quantity, 10),
        // Merge structured options with the advanced JSON, mirroring
        // buildItemsPayload(). Bad JSON just falls back to dropdowns.
        options: (() => {
          let extra: Record<string, string | number> = {};
          if (it.extraOptionsJson.trim()) {
            try {
              const parsed = JSON.parse(it.extraOptionsJson);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                extra = parsed;
              }
            } catch {
              // ignore — quote uses what we have, full validation runs at submit
            }
          }
          return { ...it.options, ...extra };
        })(),
      }));
    if (validItems.length === 0 || !shipCountry.trim()) {
      setPricingQuote(null);
      setPricingError(null);
      return;
    }
    const handle = setTimeout(async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const r = await apiFetch("/api/creator/printingcomics/pricing/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: validItems,
            shippingAddress: {
              country: shipCountry.trim(),
              region: shipRegion.trim() || undefined,
              postalCode: shipPostalCode.trim() || undefined,
            },
            shippingRateId: shippingRateId || undefined,
          }),
        });
        const data = await r.json();
        if (!r.ok) {
          setPricingQuote(null);
          setPricingError(typeof data?.error === "string" ? data.error : `Quote failed (HTTP ${r.status})`);
          return;
        }
        setPricingQuote(data as PricingQuote);
        // If the user hasn't picked a shipping rate yet, default to the
        // cheapest option so the total has a real number rather than a
        // "+ shipping TBD" placeholder.
        if (!shippingRateId && Array.isArray(data?.shippingOptions) && data.shippingOptions.length > 0) {
          const cheapest = [...data.shippingOptions].sort(
            (a: PricingQuoteShippingOption, b: PricingQuoteShippingOption) => a.rateCents - b.rateCents
          )[0];
          setShippingRateId(cheapest.id);
        }
      } catch (err) {
        setPricingError(err instanceof Error ? err.message : "Quote failed");
      } finally {
        setPricingLoading(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [formOpen, lineItems, shipCountry, shipRegion, shipPostalCode, shippingRateId]);

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
          shippingRateId: shippingRateId || undefined,
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

                    {/* Hard proof — surfaced from the printer's proof webhook. */}
                    {o.proofStatus && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                        <span className="text-xs font-medium">
                          Proof: {o.proofStatus.replace(/_/g, " ")}{o.proofVersion ? ` (v${o.proofVersion})` : ""}
                        </span>
                        {o.proofUrl && (
                          <a
                            href={o.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            View proof PDF
                          </a>
                        )}
                        {o.proofReviewUrl &&
                          (o.proofStatus === "awaiting_approval" || o.proofStatus === "changes_requested") && (
                            <Button asChild size="sm" className="ml-auto">
                              <a href={o.proofReviewUrl} target="_blank" rel="noopener noreferrer">
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                Review &amp; approve proof
                                <ExternalLink className="h-3 w-3 ml-1.5" />
                              </a>
                            </Button>
                          )}
                      </div>
                    )}
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
      {formOpen && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Submit a new print order</CardTitle>
                <CardDescription>
                  Cartons will ship to the address you enter — that&apos;s YOUR address, not a backer&apos;s. Once the books arrive you&apos;ll fulfill backers from your end.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)} aria-label="Close" disabled={submitting}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                          onValueChange={(v) => updateLineItemProduct(idx, v)}
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
                          onChange={(e) => updateLineItemProduct(idx, e.target.value)}
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

                  {/* Per-product configurator. Pulled live from
                      /catalog/products/:slug so the available options
                      and accepted values exactly match what the
                      storefront accepts. */}
                  {(() => {
                    const cfg = item.productSlug ? productConfig[item.productSlug] : undefined;
                    if (!item.productSlug) return null;
                    if (cfg === "loading") {
                      return (
                        <div className="space-y-2">
                          <Skeleton className="h-10 w-full" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      );
                    }
                    if (cfg === "error" || !cfg) {
                      return (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Couldn&apos;t load this product&apos;s options. Use the Advanced JSON below to set them, or pick a different product.
                        </p>
                      );
                    }
                    if (!Array.isArray(cfg.options) || cfg.options.length === 0) {
                      return (
                        <p className="text-[11px] text-muted-foreground">
                          This product has no extra options to configure.
                        </p>
                      );
                    }

                    const optKeyOf = (o: PCOption) => o.internalKey || o.id;
                    const sorted = [...cfg.options].sort(
                      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                    );
                    // Conditional options only show when the option they depend
                    // on currently holds the matching value.
                    const isVisible = (o: PCOption) => {
                      if (!o.dependsOnOptionId) return true;
                      const parent = cfg.options.find((p) => p.id === o.dependsOnOptionId);
                      if (!parent) return true;
                      const cur = item.options[optKeyOf(parent)];
                      return cur != null && String(cur) === String(o.dependsOnValue ?? "");
                    };
                    const visible = sorted.filter(isVisible);

                    const priceTag = (cents?: number) =>
                      cents ? ` (+$${(cents / 100).toFixed(2)})` : "";

                    const renderOption = (opt: PCOption) => {
                      const key = optKeyOf(opt);
                      const current = item.options[key];
                      const req = opt.required ? " *" : "";
                      const header = (
                        <div>
                          <Label className="text-sm">{opt.name}{req}</Label>
                          {opt.helpText && (
                            <p className="text-[11px] text-muted-foreground">{opt.helpText}</p>
                          )}
                        </div>
                      );
                      const values = opt.values ?? [];

                      // Image tiles / inline radio — pick one value (by label).
                      if ((opt.type === "TILES" || opt.type === "RADIO") && values.length > 0) {
                        return (
                          <div key={key} className="space-y-1.5">
                            {header}
                            <div className={opt.type === "TILES"
                              ? "grid grid-cols-2 sm:grid-cols-3 gap-2"
                              : "flex flex-wrap gap-2"}>
                              {values.map((v) => {
                                const selected = current != null && String(current) === v.label;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() =>
                                      updateLineItemOption(idx, key, selected ? undefined : v.label)
                                    }
                                    className={`relative text-center rounded-lg border-2 transition-all duration-150 ${
                                      opt.type === "TILES" ? "p-3" : "px-4 py-2.5"
                                    } ${
                                      selected
                                        ? "border-primary bg-primary text-primary-foreground font-semibold shadow-[0_0_18px_-2px_hsl(var(--primary)/0.6)]"
                                        : "border-border bg-background hover:border-primary/50 hover:bg-primary/5"
                                    }`}
                                  >
                                    {selected && (
                                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/25">
                                        <Check className="h-3 w-3" />
                                      </span>
                                    )}
                                    {opt.type === "TILES" && v.imageUrl && (
                                      <div
                                        className="mb-1.5 h-16 w-full rounded bg-muted bg-cover bg-center"
                                        style={{ backgroundImage: `url(${v.imageUrl})` }}
                                      />
                                    )}
                                    <span className="block text-sm font-medium leading-tight">{v.label}</span>
                                    {v.subLabel && (
                                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                                        {v.subLabel}
                                      </span>
                                    )}
                                    {v.priceModifierCents ? (
                                      <span className={`block text-[11px] mt-0.5 ${selected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                                        {priceTag(v.priceModifierCents).trim()}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Dropdown
                      if (opt.type === "SELECT" && values.length > 0) {
                        return (
                          <div key={key} className="space-y-1.5">
                            {header}
                            <Select
                              value={current != null ? String(current) : "__default__"}
                              onValueChange={(v) =>
                                updateLineItemOption(idx, key, v === "__default__" ? undefined : v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={opt.required ? "Pick one" : "Product default"} />
                              </SelectTrigger>
                              <SelectContent>
                                {!opt.required && <SelectItem value="__default__">Product default</SelectItem>}
                                {values.map((v) => (
                                  <SelectItem key={v.id} value={v.label}>
                                    {v.label}{v.subLabel ? ` — ${v.subLabel}` : ""}{priceTag(v.priceModifierCents)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      }

                      // Boolean switch
                      if (opt.type === "TOGGLE") {
                        const on = current != null && String(current) === "true";
                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between gap-3 rounded-lg border-2 p-2.5 transition-all duration-150 ${
                              on
                                ? "border-primary bg-primary/5 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)]"
                                : "border-border"
                            }`}
                          >
                            {header}
                            <Switch
                              checked={on}
                              onCheckedChange={(c) => updateLineItemOption(idx, key, c ? "true" : undefined)}
                            />
                          </div>
                        );
                      }

                      // Required acknowledgement checkbox
                      if (opt.type === "CONFIRM") {
                        const on = current != null && String(current) === "true";
                        return (
                          <label
                            key={key}
                            className={`flex items-start gap-2 rounded-lg border-2 p-2.5 cursor-pointer transition-all duration-150 ${
                              on
                                ? "border-primary bg-primary/5 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)]"
                                : "border-border"
                            }`}
                          >
                            <Checkbox
                              checked={on}
                              onCheckedChange={(c) => updateLineItemOption(idx, key, c ? "true" : undefined)}
                              className="mt-0.5"
                            />
                            <div>
                              <span className="text-sm font-medium">{opt.name}{req}</span>
                              {opt.helpText && (
                                <p className="text-[11px] text-muted-foreground">{opt.helpText}</p>
                              )}
                            </div>
                          </label>
                        );
                      }

                      // Numeric
                      if (opt.type === "NUMBER") {
                        return (
                          <div key={key} className="space-y-1.5">
                            {header}
                            <Input
                              type="number"
                              value={current != null ? String(current) : ""}
                              onChange={(e) =>
                                updateLineItemOption(idx, key, e.target.value === "" ? undefined : Number(e.target.value))
                              }
                            />
                          </div>
                        );
                      }

                      // Upload → pick from the creator's uploaded PDFs
                      if (opt.type === "UPLOAD") {
                        return (
                          <div key={key} className="space-y-1.5">
                            {header}
                            <Select
                              value={current != null ? String(current) : "__none__"}
                              onValueChange={(v) => updateLineItemOption(idx, key, v === "__none__" ? undefined : v)}
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
                        );
                      }

                      // TEXT + fallback
                      return (
                        <div key={key} className="space-y-1.5">
                          {header}
                          <Input
                            value={current != null ? String(current) : ""}
                            onChange={(e) =>
                              updateLineItemOption(idx, key, e.target.value === "" ? undefined : e.target.value)
                            }
                          />
                        </div>
                      );
                    };

                    // Group by section, preserving first-seen order.
                    const sectionOrder: (string | null)[] = [];
                    for (const o of visible) {
                      const s = o.section || null;
                      if (!sectionOrder.includes(s)) sectionOrder.push(s);
                    }

                    return (
                      <div className="space-y-5">
                        {sectionOrder.map((section) => (
                          <div
                            key={section ?? "__nosection__"}
                            className={
                              section
                                ? "space-y-3 border-l-2 border-primary/50 pl-3"
                                : "space-y-3"
                            }
                          >
                            {section && (
                              <p className="text-sm font-bold text-foreground">
                                {section}
                              </p>
                            )}
                            {visible
                              .filter((o) => (o.section || null) === section)
                              .map((opt) => renderOption(opt))}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

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

            {/* Live pricing preview from /pricing/quote. Total here is
                what the creator gets charged on PayPal — same pipeline
                the storefront cart uses. */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Estimated cost</p>
                {pricingLoading && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating
                  </span>
                )}
              </div>
              {pricingError ? (
                <div className="p-3 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300">
                  Couldn&apos;t price this order: {pricingError}. You can still submit — Printing Comics will price it on their side and send the PayPal link with the real total.
                </div>
              ) : !pricingQuote ? (
                <p className="text-xs text-muted-foreground">
                  Pick a product, set a quantity, and enter a country to see the estimated total.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Per-line breakdown */}
                  <div className="border rounded-md divide-y text-xs">
                    {pricingQuote.items.map((line, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {line.quantity}× <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-mono">{line.productSlug}</code>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            ${(line.unitPriceCents / 100).toFixed(2)} per unit
                          </p>
                        </div>
                        <p className="font-medium tabular-nums">
                          ${(line.totalCents / 100).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Shipping option picker — populated from quote response */}
                  {pricingQuote.shippingOptions.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs">Shipping method</Label>
                      <Select value={shippingRateId} onValueChange={setShippingRateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a shipping method" />
                        </SelectTrigger>
                        <SelectContent>
                          {pricingQuote.shippingOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.name} — ${(opt.rateCents / 100).toFixed(2)}
                              {opt.estimatedDays ? ` (${opt.estimatedDays} days)` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="text-xs space-y-1 border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">${(pricingQuote.subtotalCents / 100).toFixed(2)}</span>
                    </div>
                    {pricingQuote.discountCents > 0 && (
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                        <span>Discount</span>
                        <span className="tabular-nums">−${(pricingQuote.discountCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {pricingQuote.shippingCents != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="tabular-nums">${(pricingQuote.shippingCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {pricingQuote.taxCents > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="tabular-nums">${(pricingQuote.taxCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1.5 font-semibold text-sm">
                      <span>Total</span>
                      <span className="tabular-nums">
                        ${(pricingQuote.totalCents / 100).toFixed(2)} {pricingQuote.currency || "USD"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-md">
              On submit we send <code>externalRef = {projectId ? "<orderId>" : "—"}</code> to Printing Comics so re-submitting the same order is idempotent. Payment is handled directly between you and Printing Comics through their billing; we just track status here via webhook.
            </div>
          </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 mt-4 border-t">
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Submit print order
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
