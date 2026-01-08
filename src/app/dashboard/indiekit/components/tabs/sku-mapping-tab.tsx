"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Link2,
  Loader2,
  CheckCircle,
  Package,
  Trash2,
  Save,
  Store,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SkuMapping {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  shopifySku: string;
  shopifyProductName?: string;
  quantity: number;
}

interface UnmappedItem {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  amount?: number;
  quantityClaimed?: number;
}

interface SkuValidationState {
  status: "idle" | "validating" | "valid" | "invalid";
  productName?: string;
  error?: string;
}

interface SkuMappingTabProps {
  projectId?: string;
}

export function SkuMappingTab({ projectId }: SkuMappingTabProps) {
  const searchParams = useSearchParams();

  // Shopify connection status
  const [shopifyStatus, setShopifyStatus] = useState<{
    connected: boolean;
    loading: boolean;
    shopName: string | null;
  }>({ connected: false, loading: true, shopName: null });

  // SKU Mapping state
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<UnmappedItem[]>([]);
  const [isLoadingSkuMappings, setIsLoadingSkuMappings] = useState(false);
  const [isSavingSkuMapping, setIsSavingSkuMapping] = useState<string | null>(null);
  const [skuInputs, setSkuInputs] = useState<Record<string, string>>({});
  const [skuValidation, setSkuValidation] = useState<Record<string, SkuValidationState>>({});

  // Check Shopify connection status on mount
  useEffect(() => {
    async function checkShopifyStatus() {
      try {
        const response = await fetch("/api/creator/indiekit/shopify/credentials");
        if (response.ok) {
          const data = await response.json();
          if (data.hasConnectedStore && data.shopDomain) {
            setShopifyStatus({
              connected: true,
              loading: false,
              shopName: data.shopDomain,
            });
          } else {
            setShopifyStatus({ connected: false, loading: false, shopName: null });
          }
        } else {
          setShopifyStatus({ connected: false, loading: false, shopName: null });
        }
      } catch {
        setShopifyStatus({ connected: false, loading: false, shopName: null });
      }
    }
    checkShopifyStatus();
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    if (!searchParams) return;

    const shopifyResult = searchParams.get("shopify");
    const shopName = searchParams.get("shop");

    if (shopifyResult === "connected") {
      setShopifyStatus(prev => ({ ...prev, connected: true, shopName: shopName || prev.shopName }));
    }
  }, [searchParams]);

  // Fetch SKU mappings when Shopify is connected
  useEffect(() => {
    async function fetchSkuMappings() {
      if (!projectId || !shopifyStatus.connected) {
        setSkuMappings([]);
        setUnmappedItems([]);
        return;
      }

      setIsLoadingSkuMappings(true);
      try {
        const response = await fetch(`/api/creator/indiekit/shopify/sku-mapping?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setSkuMappings(data.mappings || []);
          setUnmappedItems(data.unmappedItems || []);
        }
      } catch (error) {
        console.error("Failed to fetch SKU mappings:", error);
      } finally {
        setIsLoadingSkuMappings(false);
      }
    }
    fetchSkuMappings();
  }, [projectId, shopifyStatus.connected]);

  // Validate SKU against Shopify
  const validateSku = useCallback(async (key: string, sku: string) => {
    if (!sku?.trim()) {
      setSkuValidation(prev => ({
        ...prev,
        [key]: { status: "idle" }
      }));
      return;
    }

    setSkuValidation(prev => ({
      ...prev,
      [key]: { status: "validating" }
    }));

    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "validate",
          shopifySku: sku.trim(),
        }),
      });

      const data = await res.json();

      if (data.valid) {
        setSkuValidation(prev => ({
          ...prev,
          [key]: {
            status: "valid",
            productName: data.variantTitle
              ? `${data.productName} - ${data.variantTitle}`
              : data.productName,
          }
        }));
      } else {
        setSkuValidation(prev => ({
          ...prev,
          [key]: {
            status: "invalid",
            error: data.error || "SKU not found in Shopify",
          }
        }));
      }
    } catch {
      setSkuValidation(prev => ({
        ...prev,
        [key]: {
          status: "invalid",
          error: "Failed to validate SKU",
        }
      }));
    }
  }, [projectId]);

  // Debounced validation on input change
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};

    Object.entries(skuInputs).forEach(([key, value]) => {
      if (value?.trim() && skuValidation[key]?.status !== "validating") {
        timers[key] = setTimeout(() => {
          validateSku(key, value);
        }, 500); // 500ms debounce
      }
    });

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [skuInputs, validateSku, skuValidation]);

  const handleSaveSkuMapping = async (item: UnmappedItem) => {
    const key = `${item.sourceType}-${item.sourceId}`;
    const sku = skuInputs[key];

    if (!sku?.trim()) {
      toast.error("Please enter a Shopify SKU");
      return;
    }

    // Check if SKU is valid before saving
    const validation = skuValidation[key];
    if (validation?.status === "invalid") {
      toast.error(validation.error || "Please enter a valid SKU");
      return;
    }

    setIsSavingSkuMapping(key);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "save",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceName: item.sourceName,
          shopifySku: sku.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save mapping");
      }

      const data = await res.json();
      setSkuMappings(prev => [...prev, data.mapping]);
      setUnmappedItems(prev => prev.filter(i =>
        !(i.sourceType === item.sourceType && i.sourceId === item.sourceId)
      ));
      setSkuInputs(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSkuValidation(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success(data.message || `Mapped "${item.sourceName}" to SKU: ${sku.trim()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mapping");
    } finally {
      setIsSavingSkuMapping(null);
    }
  };

  const handleDeleteSkuMapping = async (mapping: SkuMapping) => {
    setIsSavingSkuMapping(mapping.id);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "delete",
          mappingId: mapping.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete mapping");
      }

      setSkuMappings(prev => prev.filter(m => m.id !== mapping.id));
      setUnmappedItems(prev => [...prev, {
        sourceType: mapping.sourceType,
        sourceId: mapping.sourceId,
        sourceName: mapping.sourceName,
      }]);
      toast.success(`Removed mapping for "${mapping.sourceName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete mapping");
    } finally {
      setIsSavingSkuMapping(null);
    }
  };

  const getInputClassName = (key: string) => {
    const validation = skuValidation[key];
    if (!validation || validation.status === "idle") {
      return "";
    }
    if (validation.status === "validating") {
      return "border-yellow-400 focus:ring-yellow-400";
    }
    if (validation.status === "valid") {
      return "border-green-500 focus:ring-green-500 bg-green-50 dark:bg-green-900/20";
    }
    if (validation.status === "invalid") {
      return "border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/20";
    }
    return "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-[#95BF47]" />
          <div>
            <h3 className="text-lg font-semibold">SKU Mapping</h3>
            <p className="text-sm text-muted-foreground">
              Map your rewards and add-ons to Shopify SKUs for fulfillment
            </p>
          </div>
        </div>
      </div>

      {shopifyStatus.loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !shopifyStatus.connected ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Store className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Connect Shopify First</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
                  To map your rewards and add-ons to Shopify SKUs, you need to connect your Shopify store first.
                </p>
              </div>
              <Alert className="max-w-lg mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>How to Connect</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                    <li>Go to <strong>Settings</strong> tab in the navigation</li>
                    <li>Click <strong>Shopify API Key</strong> in the left menu</li>
                    <li>Enter your Shopify app credentials</li>
                    <li>Then go to <strong>Integrations</strong> to connect your store</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-[#95BF47]" />
                <CardTitle className="text-base">Connected to {shopifyStatus.shopName}</CardTitle>
              </div>
              {isLoadingSkuMappings && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <CardDescription>
              Map your rewards, add-ons, and items to Shopify product SKUs. SKUs are validated against your Shopify store.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingSkuMappings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Existing Mappings */}
                {skuMappings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Mapped Items ({skuMappings.length})</h4>
                    <div className="space-y-2">
                      {skuMappings.map((mapping) => (
                        <div
                          key={mapping.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <Package className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{mapping.sourceName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {mapping.sourceType === "ADDON" ? "Add-on" :
                                   mapping.sourceType === "REWARD" ? "Reward" : "Item"}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  SKU: <span className="font-mono font-medium">{mapping.shopifySku}</span>
                                </span>
                                {mapping.shopifyProductName && (
                                  <span className="text-sm text-green-600">
                                    → {mapping.shopifyProductName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSkuMapping(mapping)}
                            disabled={isSavingSkuMapping === mapping.id}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {isSavingSkuMapping === mapping.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmapped Items */}
                {unmappedItems.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Unmapped Items ({unmappedItems.length})
                    </h4>
                    <div className="space-y-2">
                      {unmappedItems.map((item) => {
                        const key = `${item.sourceType}-${item.sourceId}`;
                        const validation = skuValidation[key];
                        const inputValue = skuInputs[key] || "";

                        return (
                          <div
                            key={key}
                            className="flex items-center gap-4 p-4 border rounded-lg"
                          >
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.sourceName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.sourceType === "ADDON" ? "Add-on" :
                                   item.sourceType === "REWARD" ? "Reward" : "Item"}
                                </Badge>
                                {item.amount !== undefined && (
                                  <span className="text-sm text-muted-foreground">
                                    ${(item.amount / 100).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <Input
                                    placeholder="Shopify SKU"
                                    className={cn(
                                      "w-44 h-9 pr-8",
                                      getInputClassName(key)
                                    )}
                                    value={inputValue}
                                    onChange={(e) => {
                                      setSkuInputs(prev => ({
                                        ...prev,
                                        [key]: e.target.value
                                      }));
                                      // Reset validation when typing
                                      if (skuValidation[key]?.status !== "idle") {
                                        setSkuValidation(prev => ({
                                          ...prev,
                                          [key]: { status: "idle" }
                                        }));
                                      }
                                    }}
                                    onBlur={() => {
                                      if (inputValue?.trim()) {
                                        validateSku(key, inputValue);
                                      }
                                    }}
                                  />
                                  {/* Validation indicator inside input */}
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                    {validation?.status === "validating" && (
                                      <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                                    )}
                                    {validation?.status === "valid" && (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    )}
                                    {validation?.status === "invalid" && (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveSkuMapping(item)}
                                  disabled={
                                    isSavingSkuMapping === key ||
                                    !inputValue?.trim() ||
                                    validation?.status === "invalid" ||
                                    validation?.status === "validating"
                                  }
                                  className={cn(
                                    "h-9",
                                    validation?.status === "valid"
                                      ? "bg-green-600 hover:bg-green-700"
                                      : "bg-[#95BF47] hover:bg-[#7a9e3a]"
                                  )}
                                >
                                  {isSavingSkuMapping === key ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              {/* Validation message */}
                              {validation?.status === "valid" && validation.productName && (
                                <p className="text-xs text-green-600 truncate max-w-[200px]">
                                  → {validation.productName}
                                </p>
                              )}
                              {validation?.status === "invalid" && (
                                <p className="text-xs text-red-600">
                                  {validation.error || "SKU not found"}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {skuMappings.length === 0 && unmappedItems.length === 0 && (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Package className="h-8 w-8 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="font-semibold mb-2">No Items to Map</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Items will appear here once you have rewards and add-ons set up for your project.
                    </p>
                  </div>
                )}

                {/* All mapped success state */}
                {skuMappings.length > 0 && unmappedItems.length === 0 && (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">All Items Mapped</p>
                      <p className="text-sm opacity-80">All your rewards and add-ons have been mapped to Shopify SKUs.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
