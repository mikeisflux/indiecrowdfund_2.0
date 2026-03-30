"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, CheckCircle, Package, Sparkles, Download, Check, X } from "lucide-react";
import { CircularProgress } from "./CircularProgress";
import { toast } from "sonner";
import type { ProductionOrderStats } from "../types";

interface ProductionOrderViewProps {
  productionOrderStats: ProductionOrderStats | null;
  projectId?: string;
}

function escapeCSV(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ProductionOrderView({ productionOrderStats, projectId }: ProductionOrderViewProps) {
  const [skuEdits, setSkuEdits] = useState<Record<string, string>>({});
  const [savingSkus, setSavingSkus] = useState<Record<string, boolean>>({});
  // Local inStock state to allow optimistic toggling
  const [stockOverrides, setStockOverrides] = useState<Record<string, boolean>>({});
  const [savingStock, setSavingStock] = useState<Record<string, boolean>>({});

  const getDisplaySku = useCallback((item: { name: string; sku: string | null; projectItemId: string | null }) => {
    if (item.projectItemId && skuEdits[item.projectItemId] !== undefined) {
      return skuEdits[item.projectItemId];
    }
    return item.sku || item.name;
  }, [skuEdits]);

  const getInStock = useCallback((item: { projectItemId: string | null; inStock: boolean }) => {
    if (item.projectItemId && stockOverrides[item.projectItemId] !== undefined) {
      return stockOverrides[item.projectItemId];
    }
    return item.inStock;
  }, [stockOverrides]);

  // Calculate local production progress accounting for overrides
  const getProductionProgress = useCallback(() => {
    if (!productionOrderStats || productionOrderStats.items.length === 0) return { percentage: 0, inStockCount: 0, total: 0 };
    const items = productionOrderStats.items;
    const total = items.length;
    const inStockCount = items.filter((item) => getInStock(item)).length;
    return { percentage: Math.round((inStockCount / total) * 100), inStockCount, total };
  }, [productionOrderStats, getInStock]);

  const handleSkuChange = (projectItemId: string, value: string) => {
    setSkuEdits((prev) => ({ ...prev, [projectItemId]: value }));
  };

  const handleSkuSave = async (item: { name: string; projectItemId: string | null }) => {
    if (!item.projectItemId || !projectId) return;
    const newSku = skuEdits[item.projectItemId];
    if (newSku === undefined) return;

    setSavingSkus((prev) => ({ ...prev, [item.projectItemId!]: true }));
    try {
      const response = await apiFetch(`/api/projects/${projectId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          id: item.projectItemId,
          title: item.name,
          sku: newSku === item.name ? null : newSku || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save SKU");
      }
      setSkuEdits((prev) => {
        const next = { ...prev };
        delete next[item.projectItemId!];
        return next;
      });
      toast.success(`SKU updated for ${item.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save SKU");
    } finally {
      setSavingSkus((prev) => ({ ...prev, [item.projectItemId!]: false }));
    }
  };

  const handleStockToggle = async (item: { name: string; projectItemId: string | null; inStock: boolean }, newValue: boolean) => {
    if (!item.projectItemId || !projectId) return;

    // Optimistic update
    setStockOverrides((prev) => ({ ...prev, [item.projectItemId!]: newValue }));
    setSavingStock((prev) => ({ ...prev, [item.projectItemId!]: true }));

    try {
      const response = await apiFetch(`/api/projects/${projectId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          id: item.projectItemId,
          title: item.name,
          inStock: newValue,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update stock status");
      }
      toast.success(newValue ? `${item.name} marked as in stock` : `${item.name} marked as not in stock`);
    } catch (error) {
      // Revert on failure
      setStockOverrides((prev) => {
        const next = { ...prev };
        delete next[item.projectItemId!];
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Failed to update stock status");
    } finally {
      setSavingStock((prev) => ({ ...prev, [item.projectItemId!]: false }));
    }
  };

  const handleExportCSV = () => {
    if (!productionOrderStats || productionOrderStats.items.length === 0) {
      toast.error("No production order data to export");
      return;
    }

    const lines: string[] = [];
    const progress = getProductionProgress();

    lines.push("Production Order Summary");
    lines.push(`Total Backers,${productionOrderStats.totalBackers}`);
    lines.push(`Shipped/Delivered,${productionOrderStats.shippedBackers}`);
    lines.push(`Production Progress,${progress.percentage}%`);
    lines.push(`Items In Stock,${progress.inStockCount} of ${progress.total}`);
    lines.push("");

    lines.push("Status Breakdown");
    lines.push("Status,Count");
    lines.push(`Not Started,${productionOrderStats.statusBreakdown.notStarted}`);
    lines.push(`In Progress,${productionOrderStats.statusBreakdown.inProgress}`);
    lines.push(`Shipped,${productionOrderStats.statusBreakdown.shipped}`);
    lines.push(`Delivered,${productionOrderStats.statusBreakdown.delivered}`);
    lines.push("");

    lines.push("Items to Produce");
    lines.push("Item Name,SKU,Quantity Needed,In Stock");
    for (const item of productionOrderStats.items) {
      const sku = getDisplaySku(item);
      const inStock = getInStock(item) ? "Yes" : "No";
      lines.push(`${escapeCSV(item.name)},${escapeCSV(sku)},${item.count},${inStock}`);
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-order-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success("Production order data exported");
  };

  if (!productionOrderStats || productionOrderStats.totalBackers === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
            <Truck className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mb-2 font-semibold text-lg">Production order available after funding</h3>
          <p className="mb-4 text-center text-sm text-muted-foreground max-w-md">
            Once your campaign ends successfully, you&apos;ll be able to manage
            your production order and item quantities here
          </p>
        </CardContent>
      </Card>
    );
  }

  const progress = getProductionProgress();

  return (
    <div className="space-y-4">
      {/* Production Progress + Status Breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Circular Progress - now tied to inStock */}
        <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-center flex items-center justify-center gap-2 text-base">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              Production Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-4">
            <CircularProgress
              value={progress.percentage}
              size={160}
              strokeWidth={12}
              color="green"
            />
            <div className="mt-3 text-center">
              <p className="text-base font-semibold">
                {progress.inStockCount} of {progress.total} items
              </p>
              <p className="text-xs text-muted-foreground">marked as received &amp; in stock</p>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <Truck className="h-4 w-4 text-blue-500" />
              </div>
              Fulfillment Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-3 h-3 rounded-full bg-gray-400 mx-auto mb-1.5" />
                <p className="text-xl font-bold">{productionOrderStats.statusBreakdown.notStarted}</p>
                <p className="text-xs text-muted-foreground">Not Started</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="w-3 h-3 rounded-full bg-blue-500 mx-auto mb-1.5" />
                <p className="text-xl font-bold text-blue-500">{productionOrderStats.statusBreakdown.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="w-3 h-3 rounded-full bg-amber-500 mx-auto mb-1.5" />
                <p className="text-xl font-bold text-amber-500">{productionOrderStats.statusBreakdown.shipped}</p>
                <p className="text-xs text-muted-foreground">Shipped</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mx-auto mb-1.5" />
                <p className="text-xl font-bold text-emerald-500">{productionOrderStats.statusBreakdown.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex h-3 rounded-full overflow-hidden bg-muted/30">
                {productionOrderStats.statusBreakdown.delivered > 0 && (
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(productionOrderStats.statusBreakdown.delivered / productionOrderStats.totalBackers) * 100}%` }}
                  />
                )}
                {productionOrderStats.statusBreakdown.shipped > 0 && (
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{ width: `${(productionOrderStats.statusBreakdown.shipped / productionOrderStats.totalBackers) * 100}%` }}
                  />
                )}
                {productionOrderStats.statusBreakdown.inProgress > 0 && (
                  <div
                    className="bg-blue-500 transition-all duration-500"
                    style={{ width: `${(productionOrderStats.statusBreakdown.inProgress / productionOrderStats.totalBackers) * 100}%` }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items to Produce */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-purple-500/20">
                  <Package className="h-4 w-4 text-purple-500" />
                </div>
                Items to Produce
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Track production status and quantities for your campaign
              </p>
            </div>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-500"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {productionOrderStats.items.length > 0 ? (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <div>Item Name</div>
                <div>SKU</div>
                <div className="w-20 text-center">Qty</div>
                <div className="w-24 text-center">In Stock</div>
              </div>
              {/* Rows */}
              {productionOrderStats.items.map((item, index) => {
                const displaySku = getDisplaySku(item);
                const hasUnsavedEdit = item.projectItemId && skuEdits[item.projectItemId] !== undefined;
                const isSavingSku = item.projectItemId ? savingSkus[item.projectItemId] : false;
                const isInStock = getInStock(item);
                const isSavingStockItem = item.projectItemId ? savingStock[item.projectItemId] : false;

                return (
                  <div
                    key={item.projectItemId || index}
                    className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 py-2 text-sm border-t border-border/50 items-center hover:bg-muted/10 transition-colors"
                  >
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.projectItemId ? (
                        <>
                          <Input
                            value={displaySku}
                            onChange={(e) => handleSkuChange(item.projectItemId!, e.target.value)}
                            onBlur={() => { if (hasUnsavedEdit) handleSkuSave(item); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && hasUnsavedEdit) handleSkuSave(item); }}
                            className="h-7 text-xs"
                            disabled={isSavingSku}
                          />
                          {isSavingSku && <span className="text-[10px] text-muted-foreground whitespace-nowrap">...</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs truncate">{item.name}</span>
                      )}
                    </div>
                    <div className="w-20 text-center">
                      <span className="font-bold">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="w-24 flex items-center justify-center gap-1.5">
                      {item.projectItemId ? (
                        <>
                          {/* Green check = In Stock */}
                          <button
                            onClick={() => handleStockToggle(item, true)}
                            disabled={isSavingStockItem}
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                              isInStock
                                ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                                : "bg-muted/40 text-muted-foreground/40 hover:bg-muted/60"
                            }`}
                            title="Mark as in stock"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          {/* Red X = Not In Stock */}
                          <button
                            onClick={() => handleStockToggle(item, false)}
                            disabled={isSavingStockItem}
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                              !isInStock
                                ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                                : "bg-muted/40 text-muted-foreground/40 hover:bg-muted/60"
                            }`}
                            title="Mark as not in stock"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center">
              <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No items to produce yet. Reward items will appear here once backers pledge.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link to IndieKit */}
      <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm">Need more fulfillment tools?</h4>
              <p className="text-xs text-muted-foreground">
                Use IndieKit for advanced fulfillment management, backer surveys, shipping integration, and more.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/indiekit">
                <Button size="sm" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  Open IndieKit
                </Button>
              </Link>
              <Link href="/dashboard/indiekit-v2">
                <Button size="sm" className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  IndieKit 2.0
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
