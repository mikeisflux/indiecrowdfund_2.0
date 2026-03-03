"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Link2,
  Loader2,
  CheckCircle,
  Package,
  Save,
  Store,
  Info,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { SkuItemRow, ModifierCombinationsCard } from "./sku-mapping-sections";
import type {
  SkuMapping,
  UnmappedItem,
  SkuValidationState,
  SkippedItem,
  ModifierAddon,
  TierReward,
  ModifierSkuMapping,
  SkuMappingTabProps,
} from "./sku-mapping-sections";

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
  const [isSavingAll, setIsSavingAll] = useState(false);
  // SKU inputs: key is "sourceType-sourceId-index" for multiple SKUs per item
  const [skuInputs, setSkuInputs] = useState<Record<string, string>>({});
  const [skuValidation, setSkuValidation] = useState<Record<string, SkuValidationState>>({});
  // Track how many additional SKU input fields each item has
  const [additionalSkuCount, setAdditionalSkuCount] = useState<Record<string, number>>({});

  // Track which values we've already validated to prevent infinite loops
  const validatedValuesRef = useRef<Record<string, string>>({});

  // Modifier addon SKU mappings state
  const [modifierAddons, setModifierAddons] = useState<ModifierAddon[]>([]);
  const [tierRewards, setTierRewards] = useState<TierReward[]>([]);
  const [modifierSkuMappings, setModifierSkuMappings] = useState<ModifierSkuMapping[]>([]);
  const [modifierSkuInputs, setModifierSkuInputs] = useState<Record<string, string>>({});
  const [isSavingModifierSku, setIsSavingModifierSku] = useState<string | null>(null);
  const [isLoadingModifiers, setIsLoadingModifiers] = useState(false);
  const [isMarkingAsModifier, setIsMarkingAsModifier] = useState<string | null>(null);
  const [skippedModifierCombos, setSkippedModifierCombos] = useState<Set<string>>(new Set());
  const [isSkippingModifier, setIsSkippingModifier] = useState<string | null>(null);

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
          // Also populate skipped modifier combos from skipped items
          const modifierComboSkips = new Set<string>();
          for (const item of data.skippedItems || []) {
            if (item.sourceType === "MODIFIER_COMBO") {
              modifierComboSkips.add(item.sourceId);
            }
          }
          setSkippedModifierCombos(modifierComboSkips);
        }
      } catch (error) {
        console.error("Failed to fetch SKU mappings:", error);
      } finally {
        setIsLoadingSkuMappings(false);
      }
    }
    fetchSkuMappings();
  }, [projectId]);

  // Fetch modifier addons and their SKU mappings
  useEffect(() => {
    async function fetchModifierData() {
      if (!projectId) {
        setModifierAddons([]);
        setTierRewards([]);
        setModifierSkuMappings([]);
        return;
      }

      setIsLoadingModifiers(true);
      try {
        const response = await fetch(`/api/creator/indiekit/modifiers?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setModifierAddons(data.modifierAddons || []);
          setTierRewards(data.tierRewards || []);
          setModifierSkuMappings(data.modifierSkuMappings || []);
        }
      } catch (error) {
        console.error("Failed to fetch modifier data:", error);
      } finally {
        setIsLoadingModifiers(false);
      }
    }
    fetchModifierData();
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

  // Save all entered SKUs at once
  const handleSaveAllSkuMappings = async () => {
    const allItems = getAllSourceItems();
    const skusToSave: Array<{
      sourceType: string;
      sourceId: string;
      sourceName: string;
      shopifySku: string;
      inputKey: string;
    }> = [];

    // Collect all non-empty SKU inputs
    for (const item of allItems) {
      const baseKey = `${item.sourceType}-${item.sourceId}`;
      const isSkipped = isItemSkipped(item.sourceType, item.sourceId);
      if (isSkipped) continue;

      // Check primary input
      const primaryKey = `${baseKey}-0`;
      const primarySku = skuInputs[primaryKey]?.trim();
      if (primarySku) {
        // When Shopify connected, only save validated SKUs
        if (shopifyStatus.connected) {
          const validation = skuValidation[primaryKey];
          if (validation?.status === "valid") {
            skusToSave.push({
              sourceType: item.sourceType,
              sourceId: item.sourceId,
              sourceName: item.sourceName,
              shopifySku: primarySku,
              inputKey: primaryKey,
            });
          }
        } else {
          skusToSave.push({
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            shopifySku: primarySku,
            inputKey: primaryKey,
          });
        }
      }

      // Check additional inputs
      const addlCount = additionalSkuCount[baseKey] || 0;
      for (let i = 1; i <= addlCount; i++) {
        const inputKey = `${baseKey}-${i}`;
        const sku = skuInputs[inputKey]?.trim();
        if (sku) {
          if (shopifyStatus.connected) {
            const validation = skuValidation[inputKey];
            if (validation?.status === "valid") {
              skusToSave.push({
                sourceType: item.sourceType,
                sourceId: item.sourceId,
                sourceName: item.sourceName,
                shopifySku: sku,
                inputKey,
              });
            }
          } else {
            skusToSave.push({
              sourceType: item.sourceType,
              sourceId: item.sourceId,
              sourceName: item.sourceName,
              shopifySku: sku,
              inputKey,
            });
          }
        }
      }
    }

    if (skusToSave.length === 0) {
      toast.error("No valid SKUs to save. Please enter SKUs in the input fields.");
      return;
    }

    setIsSavingAll(true);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "bulk_save",
          mappings: skusToSave.map(s => ({
            sourceType: s.sourceType,
            sourceId: s.sourceId,
            sourceName: s.sourceName,
            shopifySku: s.shopifySku,
          })),
          skipValidation: !shopifyStatus.connected,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save mappings");
      }

      const data = await res.json();

      // Add new mappings to state
      if (data.mappings && data.mappings.length > 0) {
        setSkuMappings(prev => [...prev, ...data.mappings]);
      }

      // Clear saved inputs
      const savedKeys = skusToSave.map(s => s.inputKey);
      setSkuInputs(prev => {
        const next = { ...prev };
        for (const key of savedKeys) {
          delete next[key];
        }
        return next;
      });
      setSkuValidation(prev => {
        const next = { ...prev };
        for (const key of savedKeys) {
          delete next[key];
        }
        return next;
      });
      for (const key of savedKeys) {
        delete validatedValuesRef.current[key];
      }

      toast.success(data.message || `Saved ${data.mappings?.length || 0} SKU mappings`);

      if (data.errors && data.errors.length > 0) {
        toast.error(`${data.errors.length} SKU(s) failed to save`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mappings");
    } finally {
      setIsSavingAll(false);
    }
  };

  // Count how many SKUs are ready to save
  const getPendingSkuCount = () => {
    let count = 0;
    const allItems = getAllSourceItems();

    for (const item of allItems) {
      const baseKey = `${item.sourceType}-${item.sourceId}`;
      const isSkipped = isItemSkipped(item.sourceType, item.sourceId);
      if (isSkipped) continue;

      // Check primary input
      const primaryKey = `${baseKey}-0`;
      const primarySku = skuInputs[primaryKey]?.trim();
      if (primarySku) {
        if (shopifyStatus.connected) {
          if (skuValidation[primaryKey]?.status === "valid") count++;
        } else {
          count++;
        }
      }

      // Check additional inputs
      const addlCount = additionalSkuCount[baseKey] || 0;
      for (let i = 1; i <= addlCount; i++) {
        const inputKey = `${baseKey}-${i}`;
        const sku = skuInputs[inputKey]?.trim();
        if (sku) {
          if (shopifyStatus.connected) {
            if (skuValidation[inputKey]?.status === "valid") count++;
          } else {
            count++;
          }
        }
      }
    }

    return count;
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

  // Handle marking an addon as a modifier (moves it to Modifier SKU Combinations section)
  const handleMarkAsModifier = async (item: UnmappedItem) => {
    if (item.sourceType !== "ADDON") return;

    const key = item.sourceId;
    setIsMarkingAsModifier(key);

    try {
      const res = await fetch("/api/creator/indiekit/modifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "set_modifier",
          addonId: item.sourceId,
          isModifier: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to mark as modifier");
      }

      // Remove from unmapped items list
      setUnmappedItems(prev => prev.filter(i => i.sourceId !== item.sourceId));

      // Add to modifier addons list
      setModifierAddons(prev => [...prev, { id: item.sourceId, title: item.sourceName }]);

      // Also remove from skipped items if it was skipped
      setSkippedItems(prev => prev.filter(s => s.sourceId !== item.sourceId));

      toast.success(`"${item.sourceName}" is now a modifier addon. Map combinations below.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark as modifier");
    } finally {
      setIsMarkingAsModifier(null);
    }
  };

  // Group mappings by source item
  const getMappingsForItem = (sourceType: string, sourceId: string) => {
    return skuMappings.filter(m => m.sourceType === sourceType && m.sourceId === sourceId);
  };

  // Handle saving modifier SKU mapping
  const handleSaveModifierSku = async (baseRewardId: string, modifierAddonId: string) => {
    const key = `${baseRewardId}-${modifierAddonId}`;
    const sku = modifierSkuInputs[key]?.trim();

    if (!sku) {
      toast.error("Please enter a SKU");
      return;
    }

    setIsSavingModifierSku(key);
    try {
      const baseReward = tierRewards.find(r => r.id === baseRewardId);
      const modifierAddon = modifierAddons.find(a => a.id === modifierAddonId);

      const res = await fetch("/api/creator/indiekit/modifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "save_modifier_sku",
          baseRewardId,
          modifierAddonId,
          shopifySku: sku,
          shopifyProductName: `${baseReward?.title || "Unknown"} + ${modifierAddon?.title || "Unknown"}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save modifier SKU mapping");
      }

      const data = await res.json();
      // Update or add the mapping
      setModifierSkuMappings(prev => {
        const existing = prev.findIndex(m => m.baseRewardId === baseRewardId && m.modifierAddonId === modifierAddonId);
        if (existing >= 0) {
          const newMappings = [...prev];
          newMappings[existing] = data.mapping;
          return newMappings;
        }
        return [...prev, data.mapping];
      });
      setModifierSkuInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[key];
        return newInputs;
      });
      toast.success(`Modifier SKU mapping saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save modifier SKU mapping");
    } finally {
      setIsSavingModifierSku(null);
    }
  };

  // Handle deleting modifier SKU mapping
  const handleDeleteModifierSku = async (mappingId: string) => {
    setIsSavingModifierSku(mappingId);
    try {
      const res = await fetch("/api/creator/indiekit/modifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "delete_modifier_sku",
          mappingId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete modifier SKU mapping");
      }

      setModifierSkuMappings(prev => prev.filter(m => m.id !== mappingId));
      toast.success("Modifier SKU mapping removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete modifier SKU mapping");
    } finally {
      setIsSavingModifierSku(null);
    }
  };

  // Handle skipping a modifier combination (not all rewards can be upgraded)
  const handleSkipModifierCombo = async (baseRewardId: string, modifierAddonId: string, rewardTitle: string, modifierTitle: string) => {
    const comboKey = `${baseRewardId}-${modifierAddonId}`;
    setIsSkippingModifier(comboKey);

    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "skip",
          sourceType: "MODIFIER_COMBO",
          sourceId: comboKey,
          sourceName: `${rewardTitle} + ${modifierTitle}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to skip combination");
      }

      setSkippedModifierCombos(prev => new Set(prev).add(comboKey));
      toast.success(`"${rewardTitle} + ${modifierTitle}" skipped`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to skip combination");
    } finally {
      setIsSkippingModifier(null);
    }
  };

  // Handle unskipping a modifier combination
  const handleUnskipModifierCombo = async (baseRewardId: string, modifierAddonId: string) => {
    const comboKey = `${baseRewardId}-${modifierAddonId}`;
    setIsSkippingModifier(comboKey);

    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "unskip",
          sourceType: "MODIFIER_COMBO",
          sourceId: comboKey,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore combination");
      }

      setSkippedModifierCombos(prev => {
        const newSet = new Set(prev);
        newSet.delete(comboKey);
        return newSet;
      });
      toast.success("Combination restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore combination");
    } finally {
      setIsSkippingModifier(null);
    }
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

  // Handle SKU input change (passed to SkuItemRow)
  const handleSkuInputChange = (key: string, value: string) => {
    setSkuInputs(prev => ({
      ...prev,
      [key]: value
    }));
    if (shopifyStatus.connected && skuValidation[key]?.status !== "idle") {
      setSkuValidation(prev => ({
        ...prev,
        [key]: { status: "idle" }
      }));
      delete validatedValuesRef.current[key];
    }
  };

  // Handle SKU input blur (passed to SkuItemRow)
  const handleSkuInputBlur = (key: string, value: string) => {
    if (shopifyStatus.connected && value?.trim()) {
      validateSku(key, value);
    }
  };

  // Handle modifier input change
  const handleModifierInputChange = (key: string, value: string) => {
    setModifierSkuInputs(prev => ({
      ...prev,
      [key]: value
    }));
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
                  go to Settings &rarr; Shopify API Key to connect your store.
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
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Items ({getAllSourceItems().length}) &bull; SKUs ({skuMappings.length})
                    </h4>
                    {getPendingSkuCount() > 0 && (
                      <Button
                        onClick={handleSaveAllSkuMappings}
                        disabled={isSavingAll}
                        className="bg-[#95BF47] hover:bg-[#7a9e3a]"
                      >
                        {isSavingAll ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save All SKUs ({getPendingSkuCount()})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-4">
                    {getAllSourceItems().map((item) => {
                      const baseKey = `${item.sourceType}-${item.sourceId}`;

                      return (
                        <SkuItemRow
                          key={baseKey}
                          item={item}
                          itemMappings={getMappingsForItem(item.sourceType, item.sourceId)}
                          isSkipped={isItemSkipped(item.sourceType, item.sourceId)}
                          additionalCount={additionalSkuCount[baseKey] || 0}
                          baseKey={baseKey}
                          shopifyConnected={shopifyStatus.connected}
                          skuInputs={skuInputs}
                          skuValidation={skuValidation}
                          isSavingSkuMapping={isSavingSkuMapping}
                          isSkipping={isSkipping}
                          isMarkingAsModifier={isMarkingAsModifier}
                          onSaveSkuMapping={handleSaveSkuMapping}
                          onDeleteSkuMapping={handleDeleteSkuMapping}
                          onSkipItem={handleSkipItem}
                          onUnskipItem={handleUnskipItem}
                          onMarkAsModifier={handleMarkAsModifier}
                          onAddSkuField={addSkuField}
                          onRemoveSkuField={removeSkuField}
                          onInputChange={handleSkuInputChange}
                          onInputBlur={handleSkuInputBlur}
                          canSave={canSave}
                          getInputClassName={getInputClassName}
                        />
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
                  const itemSkipped = isItemSkipped(item.sourceType, item.sourceId);
                  return hasMappings || itemSkipped;
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

      {/* Modifier Addon SKU Combinations */}
      {modifierAddons.length > 0 && tierRewards.length > 0 && (
        <ModifierCombinationsCard
          modifierAddons={modifierAddons}
          tierRewards={tierRewards}
          modifierSkuMappings={modifierSkuMappings}
          modifierSkuInputs={modifierSkuInputs}
          isLoadingModifiers={isLoadingModifiers}
          isSavingModifierSku={isSavingModifierSku}
          isSkippingModifier={isSkippingModifier}
          skippedModifierCombos={skippedModifierCombos}
          onModifierInputChange={handleModifierInputChange}
          onSaveModifierSku={handleSaveModifierSku}
          onDeleteModifierSku={handleDeleteModifierSku}
          onSkipModifierCombo={handleSkipModifierCombo}
          onUnskipModifierCombo={handleUnskipModifierCombo}
        />
      )}
    </div>
  );
}
