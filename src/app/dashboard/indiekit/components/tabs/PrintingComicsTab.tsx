"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { AlertTriangle, Printer, Loader2, ExternalLink, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";

// PrintingComics integration tab. Backed by:
//   GET  /api/creator/printingcomics/catalog
//   GET  /api/creator/printingcomics/uploads
//   POST /api/creator/printingcomics/uploads   (push R2 PDFs to provider)
//   POST /api/creator/printingcomics/orders    (per-pledge submit)
//
// Webhook receiver at /api/webhooks/printingcomics keeps the
// printingComicsStatus column fresh on each Pledge as orders move
// through PAID → IN_PRODUCTION → SHIPPED → DELIVERED.

interface PCProductSummary {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  priceCents?: number;
  minQuantity?: number;
  image?: string;
}

interface PCUploadSummary {
  id: string;
  filename: string;
  size: number;
  purpose?: string;
  contentHash: string;
  createdAt: string;
}

interface BackerRow {
  id: string;            // pledge id
  name: string;
  email: string;
  rewardTitle: string | null;
  hasShippingAddress: boolean;
  printingComicsStatus: string | null;
  printingComicsOrderNumber: string | null;
  printingComicsTrackingNumber: string | null;
  printingComicsLastSyncedAt: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PAID: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  IN_PRODUCTION: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  SHIPPED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  DELIVERED: "bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200",
  CANCELLED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  REFUNDED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

interface PrintingComicsTabProps {
  projectId?: string;
}

export function PrintingComicsTab({ projectId }: PrintingComicsTabProps) {
  // Catalog state — load lazily when admin expands the catalog card.
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<PCProductSummary[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Backers — only fulfillable pledges (chargedImmediately + shipping
  // address present). Loaded once on mount.
  const [backers, setBackers] = useState<BackerRow[]>([]);
  const [backersLoading, setBackersLoading] = useState(true);
  const [backersError, setBackersError] = useState<string | null>(null);

  // Uploads on the provider key — fetched on demand to populate the
  // file picker in the submit dialog.
  const [uploads, setUploads] = useState<PCUploadSummary[]>([]);
  const [uploadsLoaded, setUploadsLoaded] = useState(false);

  // Submit dialog state. One row at a time.
  const [submitTarget, setSubmitTarget] = useState<BackerRow | null>(null);
  const [submitProductSlug, setSubmitProductSlug] = useState("");
  const [submitQuantity, setSubmitQuantity] = useState("25");
  const [submitOptions, setSubmitOptions] = useState("{}");
  const [submitCoverUploadId, setSubmitCoverUploadId] = useState("");
  const [submitInteriorUploadId, setSubmitInteriorUploadId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const r = await apiFetch("/api/creator/printingcomics/catalog");
      const data = await r.json();
      if (!r.ok) {
        setCatalogError(data?.error || `HTTP ${r.status}`);
        setCatalog(null);
        return;
      }
      setCatalog(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Failed to load catalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadUploads = useCallback(async () => {
    try {
      const r = await apiFetch("/api/creator/printingcomics/uploads?limit=100");
      const data = await r.json();
      if (r.ok && Array.isArray(data?.uploads)) setUploads(data.uploads);
      setUploadsLoaded(true);
    } catch {
      setUploadsLoaded(true);
    }
  }, []);

  const loadBackers = useCallback(async () => {
    if (!projectId) {
      setBackersLoading(false);
      return;
    }
    setBackersLoading(true);
    setBackersError(null);
    try {
      const r = await apiFetch(
        `/api/creator/printingcomics/backers?projectId=${encodeURIComponent(projectId)}`
      );
      const data = await r.json();
      if (!r.ok) {
        setBackersError(data?.error || `HTTP ${r.status}`);
        setBackers([]);
        return;
      }
      setBackers(Array.isArray(data?.backers) ? data.backers : []);
    } catch (err) {
      setBackersError(err instanceof Error ? err.message : "Failed to load backers");
    } finally {
      setBackersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadBackers();
  }, [loadBackers]);

  useEffect(() => {
    if (catalogOpen && catalog === null && !catalogLoading) loadCatalog();
  }, [catalogOpen, catalog, catalogLoading, loadCatalog]);

  const openSubmit = (row: BackerRow) => {
    setSubmitTarget(row);
    setSubmitProductSlug("");
    setSubmitQuantity("25");
    setSubmitOptions("{}");
    setSubmitCoverUploadId("");
    setSubmitInteriorUploadId("");
    if (!uploadsLoaded) loadUploads();
  };

  const handleSubmitOrder = async () => {
    if (!submitTarget) return;
    if (!submitProductSlug.trim()) {
      toast.error("Pick a product slug from the catalog");
      return;
    }
    let parsedOptions: Record<string, string | number> = {};
    try {
      parsedOptions = JSON.parse(submitOptions || "{}");
    } catch {
      toast.error("Options must be valid JSON");
      return;
    }
    const qty = parseInt(submitQuantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      toast.error("Quantity must be a positive number");
      return;
    }
    const files: { uploadId: string; purpose: string }[] = [];
    if (submitCoverUploadId) files.push({ uploadId: submitCoverUploadId, purpose: "cover" });
    if (submitInteriorUploadId) files.push({ uploadId: submitInteriorUploadId, purpose: "interior" });

    setSubmitting(true);
    try {
      const r = await apiFetch("/api/creator/printingcomics/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pledgeId: submitTarget.id,
          items: [
            {
              productSlug: submitProductSlug.trim(),
              quantity: qty,
              options: parsedOptions,
              files: files.length > 0 ? files : undefined,
            },
          ],
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data?.error || `Submit failed (HTTP ${r.status})`);
        return;
      }
      toast.success(
        data.idempotent
          ? `Already submitted as ${data.order?.number}`
          : `Submitted ${data.order?.number}`
      );
      setSubmitTarget(null);
      loadBackers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Beta warning — must be the FIRST thing the creator sees so
          they don't click through into a half-wired flow. */}
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
            . Anything you submit here calls the live API. Use this
            against the sandbox until the integration is verified end-to-end.
          </p>
        </div>
      </div>

      {/* Catalog browser — collapsed by default to keep the page short */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">Browse Printing Comics catalog</p>
              <p className="text-xs text-muted-foreground">
                Pick a product slug and copy it into the submit dialog below.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatalogOpen((o) => !o)}
            >
              {catalogOpen ? "Hide" : "Show"}
            </Button>
          </div>

          {catalogOpen && (
            <div className="mt-4 space-y-2">
              {catalogError && (
                <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
                  {catalogError}
                </div>
              )}
              {catalogLoading && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
                </div>
              )}
              {!catalogLoading && catalog && catalog.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No products returned.</p>
              )}
              {!catalogLoading && catalog && catalog.length > 0 && (
                <div className="border rounded-md divide-y">
                  {catalog.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.shortDescription || p.slug}</p>
                      </div>
                      <code className="text-[10px] px-2 py-0.5 rounded bg-muted font-mono">{p.slug}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(p.slug);
                          toast.success(`Copied ${p.slug}`);
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backers table with status + per-row submit */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="font-semibold text-sm flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Backers ready for printing
              </p>
              <p className="text-xs text-muted-foreground">
                Only completed pledges with a shipping address. Click Submit to send the order to Printing Comics.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadBackers} disabled={backersLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${backersLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {backersError && (
            <div className="p-3 rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 mb-3">
              {backersError}
            </div>
          )}
          {backersLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
            </div>
          ) : backers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No fulfillable pledges yet — backers need a completed pledge with a shipping address.
            </p>
          ) : (
            <div className="border rounded-md divide-y">
              {backers.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.email}{b.rewardTitle ? ` · ${b.rewardTitle}` : ""}</p>
                  </div>
                  {b.printingComicsStatus ? (
                    <div className="flex flex-col items-end shrink-0">
                      <Badge className={STATUS_BADGE[b.printingComicsStatus] || "bg-zinc-200 text-zinc-700"}>
                        {b.printingComicsStatus.replace("_", " ")}
                      </Badge>
                      {b.printingComicsOrderNumber && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">{b.printingComicsOrderNumber}</span>
                      )}
                      {b.printingComicsTrackingNumber && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">Track: {b.printingComicsTrackingNumber}</span>
                      )}
                    </div>
                  ) : !b.hasShippingAddress ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">No address</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Not submitted</span>
                  )}
                  <Button
                    variant={b.printingComicsStatus ? "outline" : "default"}
                    size="sm"
                    disabled={!b.hasShippingAddress}
                    onClick={() => openSubmit(b)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {b.printingComicsStatus ? "Re-submit" : "Submit"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Pledge id is sent as <code>externalRef</code> so re-submits are idempotent — clicking Submit twice returns the original order.
            Status updates land via webhook at{" "}
            <Link href="/admin/settings" className="underline">
              /admin/settings → Fulfillment
            </Link>{" "}
            (configure the webhook URL with Printing Comics support).
          </p>
        </CardContent>
      </Card>

      {/* Submit dialog */}
      <Dialog open={!!submitTarget} onOpenChange={(o) => !o && setSubmitTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit print order</DialogTitle>
            <DialogDescription>
              Pledge will be sent as <code>externalRef</code>; re-submission is idempotent.
            </DialogDescription>
          </DialogHeader>
          {submitTarget && (
            <div className="space-y-4">
              <div className="text-sm bg-muted/40 rounded-md px-3 py-2">
                <p className="font-medium">{submitTarget.name}</p>
                <p className="text-xs text-muted-foreground">{submitTarget.email}</p>
              </div>
              <div className="space-y-1">
                <Label>Product slug</Label>
                <Input
                  value={submitProductSlug}
                  onChange={(e) => setSubmitProductSlug(e.target.value)}
                  placeholder="standard-comic-book"
                />
                <p className="text-[10px] text-muted-foreground">From the catalog browser above.</p>
              </div>
              <div className="space-y-1">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={submitQuantity}
                  onChange={(e) => setSubmitQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Options (JSON)</Label>
                <Input
                  value={submitOptions}
                  onChange={(e) => setSubmitOptions(e.target.value)}
                  placeholder='{"interior_pages":32,"interior_color":"Full Color"}'
                />
                <p className="text-[10px] text-muted-foreground">
                  Per-product configurator values. See provider docs for keys + accepted values.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cover upload</Label>
                  <Select value={submitCoverUploadId} onValueChange={setSubmitCoverUploadId}>
                    <SelectTrigger>
                      <SelectValue placeholder={uploadsLoaded ? "(none)" : "Loading…"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(none)</SelectItem>
                      {uploads.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Interior upload</Label>
                  <Select value={submitInteriorUploadId} onValueChange={setSubmitInteriorUploadId}>
                    <SelectTrigger>
                      <SelectValue placeholder={uploadsLoaded ? "(none)" : "Loading…"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(none)</SelectItem>
                      {uploads.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                To upload a new PDF, POST it to <code>/api/creator/printingcomics/uploads</code> with{" "}
                <code>{`{ r2Key, purpose }`}</code> first. UI for picking from R2 is coming next.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitOrder} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
