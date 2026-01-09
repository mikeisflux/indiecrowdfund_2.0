"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  Loader2,
  CheckCircle,
  Package,
  Trash2,
  Save,
  Store,
  XCircle,
  Info,
  Plus,
  SkipForward,
  Undo2,
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

interface SkippedItem {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
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
  const [skippedItems, setSkippedItems] = useState<SkippedItem[]>([]);
  const [isLoadingSkuMappings, setIsLoadingSkuMappings] = useState(false);
  const [isSavingSkuMapping, setIsSavingSkuMapping] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState<string | null>(null);
  // SKU inputs: key is "sourceType-sourceId-index" for multiple SKUs per item
  const [skuInputs, setSkuInputs] = useState<Record<string, string>>({});
  const [skuValidation, setSkuValidation] = useState<Record<string, SkuValidationState>>({});
  // Track how many additional SKU input fields each item has
  const [additionalSkuCount, setAdditionalSkuCount] = useState<Record<string, number>>({});

  // Track which values we've already validated to prevent infinite loops
  const validatedValuesRef = useRef<Record<string, string>>({});

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

  // Fetch SKU mappings (works regardless of Shopify connection)
  useEffect(() => {
    async function fetchSkuMappings() {
      if (!projectId) {
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
          setSkippedItems(data.skippedItems || []);
        }
      } catch (error) {
        console.error("Failed to fetch SKU mappings:", error);
      } finally {
        setIsLoadingSkuMappings(false);
      }
    }
    fetchSkuMappings();
  }, [projectId]);

  // Validate SKU against Shopify (only when Shopify is connected)
  const validateSku = useCallback(async (key: string, sku: string) => {
    const trimmedSku = sku?.trim();

    if (!trimmedSku || !shopifyStatus.connected) {
      setSkuValidation(prev => ({
        ...prev,
        [key]: { status: "idle" }
      }));
      return;
    }

    // Skip if we've already validated this exact value
    if (validatedValuesRef.current[key] === trimmedSku) {
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
          shopifySku: trimmedSku,
        }),
      });

      const data = await res.json();

      // Mark this value as validated
      validatedValuesRef.current[key] = trimmedSku;

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
  }, [projectId, shopifyStatus.connected]);

  // Debounced validation on input change (only when Shopify is connected)
  useEffect(() => {
    if (!shopifyStatus.connected) return;

    const timers: Record<string, NodeJS.Timeout> = {};

    Object.entries(skuInputs).forEach(([key, value]) => {
      const trimmedValue = value?.trim();
      // Only validate if value exists and hasn't been validated yet
      if (trimmedValue && validatedValuesRef.current[key] !== trimmedValue) {
        timers[key] = setTimeout(() => {
          validateSku(key, value);
        }, 500); // 500ms debounce
      }
    });

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [skuInputs, validateSku, shopifyStatus.connected]);

  // Add an additional SKU field for an item
  const addSkuField = (sourceType: string, sourceId: string) => {
    const baseKey = `${sourceType}-${sourceId}`;
    setAdditionalSkuCount(prev => ({
      ...prev,
      [baseKey]: (prev[baseKey] || 0) + 1,
    }));
  };

  // Remove an additional SKU field
  const removeSkuField = (sourceType: string, sourceId: string, index: number) => {
    const baseKey = `${sourceType}-${sourceId}`;
    const inputKey = `${baseKey}-${index}`;

    // Remove the input value
    setSkuInputs(prev => {
      const next = { ...prev };
      delete next[inputKey];
      return next;
    });

    // Remove validation state
    setSkuValidation(prev => {
      const next = { ...prev };
      delete next[inputKey];
      return next;
    });

    // Clear validated values ref
    delete validatedValuesRef.current[inputKey];
  };

  const handleSaveSkuMapping = async (item: UnmappedItem, inputKey: string) => {
    const sku = skuInputs[inputKey];

    if (!sku?.trim()) {
      toast.error("Please enter a SKU");
      return;
    }

    // Only check validation when Shopify is connected
    if (shopifyStatus.connected) {
      const validation = skuValidation[inputKey];
      if (validation?.status === "invalid") {
        toast.error(validation.error || "Please enter a valid SKU");
        return;
      }
    }

    setIsSavingSkuMapping(inputKey);
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
          skipValidation: !shopifyStatus.connected, // Skip validation when Shopify not connected
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save mapping");
      }

      const data = await res.json();
      setSkuMappings(prev => [...prev, data.mapping]);
      // Don't remove from unmappedItems - item can have multiple SKUs
      // Just clear this input field
      setSkuInputs(prev => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      setSkuValidation(prev => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
      delete validatedValuesRef.current[inputKey];
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
      // Don't add to unmappedItems - items are shown based on ordered rewards/addons
      toast.success(`Removed SKU mapping: ${mapping.shopifySku}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete mapping");
    } finally {
      setIsSavingSkuMapping(null);
    }
  };

  // Check if an item is skipped
  const isItemSkipped = (sourceType: string, sourceId: string) => {
    return skippedItems.some(s => s.sourceType === sourceType && s.sourceId === sourceId);
  };

  // Handle skip/unskip item
  const handleSkipItem = async (item: UnmappedItem) => {
    const key = `${item.sourceType}-${item.sourceId}`;
    setIsSkipping(key);

    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "skip",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceName: item.sourceName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to skip item");
      }

      const data = await res.json();
      setSkippedItems(prev => [...prev, data.skippedItem]);
      toast.success(data.message || `"${item.sourceName}" skipped`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to skip item");
    } finally {
      setIsSkipping(null);
    }
  };

  const handleUnskipItem = async (item: UnmappedItem | SkippedItem) => {
    const key = `${item.sourceType}-${item.sourceId}`;
    setIsSkipping(key);

    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "unskip",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore item");
      }

      setSkippedItems(prev => prev.filter(s => !(s.sourceType === item.sourceType && s.sourceId === item.sourceId)));
      toast.success(`"${item.sourceName}" restored for fulfillment`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore item");
    } finally {
      setIsSkipping(null);
    }
  };

  // Group mappings by source item
  const getMappingsForItem = (sourceType: string, sourceId: string) => {
    return skuMappings.filter(m => m.sourceType === sourceType && m.sourceId === sourceId);
  };

  // Get all unique source items that have at least one mapping or are in unmapped list
  const getAllSourceItems = () => {
    const itemMap = new Map<string, UnmappedItem>();

    // Add all unmapped items
    for (const item of unmappedItems) {
      const key = `${item.sourceType}-${item.sourceId}`;
      itemMap.set(key, item);
    }

    // Add items from mappings that might not be in unmapped list
    for (const mapping of skuMappings) {
      const key = `${mapping.sourceType}-${mapping.sourceId}`;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          sourceType: mapping.sourceType,
          sourceId: mapping.sourceId,
          sourceName: mapping.sourceName,
        });
      }
    }

    return Array.from(itemMap.values());
  };

  const getInputClassName = (key: string) => {
    // No validation styling when Shopify is not connected
    if (!shopifyStatus.connected) return "";

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

  const canSave = (key: string, inputValue: string) => {
    if (!inputValue?.trim()) return false;

    // When Shopify is connected, require validation
    if (shopifyStatus.connected) {
      const validation = skuValidation[key];
      return validation?.status === "valid";
    }

    // When Shopify not connected, allow save as long as there's input
    return true;
  };

  // Show loading state
  if (shopifyStatus.loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-[#95BF47]" />
            <div>
              <h3 className="text-lg font-semibold">SKU Mapping</h3>
              <p className="text-sm text-muted-foreground">
                Map your rewards and add-ons to SKUs for fulfillment
              </p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-[#95BF47]" />
          <div>
            <h3 className="text-lg font-semibold">SKU Mapping</h3>
            <p className="text-sm text-muted-foreground">
              Map your rewards and add-ons to SKUs for fulfillment
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {shopifyStatus.connected ? (
                <>
                  <Store className="h-5 w-5 text-[#95BF47]" />
                  <CardTitle className="text-base">Connected to {shopifyStatus.shopName}</CardTitle>
                </>
              ) : (
                <>
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Manual SKU Mapping</CardTitle>
                </>
              )}
            </div>
            {isLoadingSkuMappings && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CardDescription>
            {shopifyStatus.connected
              ? "Map your rewards, add-ons, and items to Shopify product SKUs. SKUs are validated against your Shopify store."
              : "Map your rewards, add-ons, and items to SKUs for your fulfillment system. Connect Shopify in Settings to enable SKU validation."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info banner for manual mode */}
          {!shopifyStatus.connected && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <Info className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Manual Mode</p>
                <p className="text-sm opacity-80">
                  SKUs are saved without validation. To enable automatic validation against your Shopify inventory,
                  go to Settings → Shopify API Key to connect your store.
                </p>
              </div>
            </div>
          )}

          {isLoadingSkuMappings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* All Items with SKU Mappings */}
              {getAllSourceItems().length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Items ({getAllSourceItems().length}) • SKUs ({skuMappings.length})
                  </h4>
                  <div className="space-y-4">
                    {getAllSourceItems().map((item) => {
                      const baseKey = `${item.sourceType}-${item.sourceId}`;
                      const itemMappings = getMappingsForItem(item.sourceType, item.sourceId);
                      const additionalCount = additionalSkuCount[baseKey] || 0;
                      const hasMappings = itemMappings.length > 0;
                      const isSkipped = isItemSkipped(item.sourceType, item.sourceId);

                      return (
                        <div
                          key={baseKey}
                          className={cn(
                            "p-4 border rounded-lg",
                            isSkipped
                              ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                              : hasMappings
                                ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                                : "border-border"
                          )}
                        >
                          {/* Item Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                              isSkipped
                                ? "bg-amber-100 dark:bg-amber-900/30"
                                : hasMappings
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-muted"
                            )}>
                              {isSkipped ? (
                                <SkipForward className="h-5 w-5 text-amber-600" />
                              ) : (
                                <Package className={cn(
                                  "h-5 w-5",
                                  hasMappings ? "text-green-600" : "text-muted-foreground"
                                )} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("font-medium truncate", isSkipped && "text-amber-700 dark:text-amber-400")}>
                                {item.sourceName}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {item.sourceType === "ADDON" ? "Add-on" :
                                   item.sourceType === "REWARD" ? "Reward" : "Item"}
                                </Badge>
                                {item.amount !== undefined && (
                                  <span className="text-sm text-muted-foreground">
                                    ${(item.amount / 100).toFixed(2)}
                                  </span>
                                )}
                                {isSkipped ? (
                                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                    Skipped
                                  </Badge>
                                ) : hasMappings && (
                                  <span className="text-sm text-green-600">
                                    {itemMappings.length} SKU{itemMappings.length !== 1 ? "s" : ""} mapped
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Skip/Unskip Button */}
                            <Button
                              variant={isSkipped ? "outline" : "ghost"}
                              size="sm"
                              onClick={() => isSkipped ? handleUnskipItem(item) : handleSkipItem(item)}
                              disabled={isSkipping === baseKey}
                              className={cn(
                                "shrink-0",
                                isSkipped && "border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                              )}
                              title={isSkipped ? "Restore for fulfillment" : "Skip from fulfillment"}
                            >
                              {isSkipping === baseKey ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isSkipped ? (
                                <>
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <SkipForward className="h-4 w-4 mr-1" />
                                  Skip
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Existing SKU Mappings (hidden when skipped) */}
                          {!isSkipped && itemMappings.length > 0 && (
                            <div className="space-y-2 mb-3 ml-13 pl-3 border-l-2 border-green-200 dark:border-green-800">
                              {itemMappings.map((mapping) => (
                                <div
                                  key={mapping.id}
                                  className="flex items-center justify-between py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                    <span className="font-mono text-sm">{mapping.shopifySku}</span>
                                    {mapping.shopifyProductName && (
                                      <span className="text-sm text-muted-foreground">
                                        → {mapping.shopifyProductName}
                                      </span>
                                    )}
                                    {mapping.quantity > 1 && (
                                      <Badge variant="secondary" className="text-xs">
                                        ×{mapping.quantity}
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSkuMapping(mapping)}
                                    disabled={isSavingSkuMapping === mapping.id}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    {isSavingSkuMapping === mapping.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* New SKU Input Fields (hidden when skipped) */}
                          {!isSkipped && (
                          <div className="space-y-2 ml-13">
                            {/* Primary input (always shown if no mappings, or as additional) */}
                            {(() => {
                              const inputKey = `${baseKey}-0`;
                              const validation = skuValidation[inputKey];
                              const inputValue = skuInputs[inputKey] || "";

                              return (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1 max-w-[200px]">
                                      <Input
                                        placeholder={shopifyStatus.connected ? "Add SKU" : "Add SKU"}
                                        className={cn(
                                          "h-9",
                                          shopifyStatus.connected && "pr-8",
                                          getInputClassName(inputKey)
                                        )}
                                        value={inputValue}
                                        onChange={(e) => {
                                          const newValue = e.target.value;
                                          setSkuInputs(prev => ({
                                            ...prev,
                                            [inputKey]: newValue
                                          }));
                                          if (shopifyStatus.connected && skuValidation[inputKey]?.status !== "idle") {
                                            setSkuValidation(prev => ({
                                              ...prev,
                                              [inputKey]: { status: "idle" }
                                            }));
                                            delete validatedValuesRef.current[inputKey];
                                          }
                                        }}
                                        onBlur={() => {
                                          if (shopifyStatus.connected && inputValue?.trim()) {
                                            validateSku(inputKey, inputValue);
                                          }
                                        }}
                                      />
                                      {shopifyStatus.connected && (
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
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveSkuMapping(item, inputKey)}
                                      disabled={
                                        isSavingSkuMapping === inputKey ||
                                        !canSave(inputKey, inputValue) ||
                                        (shopifyStatus.connected && validation?.status === "validating")
                                      }
                                      className={cn(
                                        "h-9",
                                        shopifyStatus.connected && validation?.status === "valid"
                                          ? "bg-green-600 hover:bg-green-700"
                                          : "bg-[#95BF47] hover:bg-[#7a9e3a]"
                                      )}
                                    >
                                      {isSavingSkuMapping === inputKey ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addSkuField(item.sourceType, item.sourceId)}
                                      className="h-9"
                                      title="Add another SKU"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {shopifyStatus.connected && validation?.status === "valid" && validation.productName && (
                                    <p className="text-xs text-green-600 truncate">
                                      → {validation.productName}
                                    </p>
                                  )}
                                  {shopifyStatus.connected && validation?.status === "invalid" && (
                                    <p className="text-xs text-red-600">
                                      {validation.error || "SKU not found"}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Additional input fields */}
                            {Array.from({ length: additionalCount }).map((_, idx) => {
                              const inputKey = `${baseKey}-${idx + 1}`;
                              const validation = skuValidation[inputKey];
                              const inputValue = skuInputs[inputKey] || "";

                              return (
                                <div key={inputKey} className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1 max-w-[200px]">
                                      <Input
                                        placeholder={shopifyStatus.connected ? "Add SKU" : "Add SKU"}
                                        className={cn(
                                          "h-9",
                                          shopifyStatus.connected && "pr-8",
                                          getInputClassName(inputKey)
                                        )}
                                        value={inputValue}
                                        onChange={(e) => {
                                          const newValue = e.target.value;
                                          setSkuInputs(prev => ({
                                            ...prev,
                                            [inputKey]: newValue
                                          }));
                                          if (shopifyStatus.connected && skuValidation[inputKey]?.status !== "idle") {
                                            setSkuValidation(prev => ({
                                              ...prev,
                                              [inputKey]: { status: "idle" }
                                            }));
                                            delete validatedValuesRef.current[inputKey];
                                          }
                                        }}
                                        onBlur={() => {
                                          if (shopifyStatus.connected && inputValue?.trim()) {
                                            validateSku(inputKey, inputValue);
                                          }
                                        }}
                                      />
                                      {shopifyStatus.connected && (
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
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveSkuMapping(item, inputKey)}
                                      disabled={
                                        isSavingSkuMapping === inputKey ||
                                        !canSave(inputKey, inputValue) ||
                                        (shopifyStatus.connected && validation?.status === "validating")
                                      }
                                      className={cn(
                                        "h-9",
                                        shopifyStatus.connected && validation?.status === "valid"
                                          ? "bg-green-600 hover:bg-green-700"
                                          : "bg-[#95BF47] hover:bg-[#7a9e3a]"
                                      )}
                                    >
                                      {isSavingSkuMapping === inputKey ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Save className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeSkuField(item.sourceType, item.sourceId, idx + 1)}
                                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                                      title="Remove this field"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  {shopifyStatus.connected && validation?.status === "valid" && validation.productName && (
                                    <p className="text-xs text-green-600 truncate">
                                      → {validation.productName}
                                    </p>
                                  )}
                                  {shopifyStatus.connected && validation?.status === "invalid" && (
                                    <p className="text-xs text-red-600">
                                      {validation.error || "SKU not found"}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          )}
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
                    Only rewards and add-ons that backers have ordered will appear here.
                    Once backers make pledges, their selected items will be available for SKU mapping.
                  </p>
                </div>
              )}

              {/* All mapped success state - show when all items are either mapped OR skipped */}
              {(() => {
                const allItems = getAllSourceItems();
                if (allItems.length === 0) return null;

                const allItemsReady = allItems.every(item => {
                  const hasMappings = getMappingsForItem(item.sourceType, item.sourceId).length > 0;
                  const isSkipped = isItemSkipped(item.sourceType, item.sourceId);
                  return hasMappings || isSkipped;
                });

                const mappedCount = allItems.filter(item =>
                  getMappingsForItem(item.sourceType, item.sourceId).length > 0
                ).length;
                const skippedCount = skippedItems.length;

                if (!allItemsReady) return null;

                return (
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">All Items Ready</p>
                      <p className="text-sm opacity-80">
                        {skippedCount > 0
                          ? `${mappedCount} item${mappedCount !== 1 ? 's' : ''} mapped to SKUs, ${skippedCount} item${skippedCount !== 1 ? 's' : ''} skipped.`
                          : `All your rewards and add-ons have been mapped to SKUs.`
                        }
                      </p>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
