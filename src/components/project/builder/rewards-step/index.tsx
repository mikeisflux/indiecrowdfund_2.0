"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useCallback, useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { RewardData, RewardItemData, RewardType, ShippingType } from "@/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { defaultItem, defaultReward, MONTHS } from "./constants";
import { CSVImportScreen } from "./csv-import-screen";
import { RewardForm } from "./reward-form";
import { ItemDialog } from "./item-dialog";
import { ImportRewardDialog } from "./import-reward-dialog";
import { ImportAddonDialog } from "./import-addon-dialog";
import { ItemsTab } from "./items-tab";
import { TiersTab } from "./tiers-tab";
import { AddonsTab } from "./addons-tab";
import type {
  ImportableReward,
  ImportableRewardItem,
} from "./use-importable-projects";

interface RewardsStepProps {
  onFormOpenChange?: (isOpen: boolean) => void;
}

export function RewardsStep({ onFormOpenChange }: RewardsStepProps) {
  const {
    items,
    rewards,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    addReward,
    updateReward,
    removeReward,
    reorderRewards,
    projectStatus,
    projectId,
    projectSlug,
    endReward,
  } = useProjectStore();

  // Check if campaign is live (can't edit rewards with backers)
  const isLive = projectStatus === "LIVE" || projectStatus === "FUNDED";

  // Reorder handler: update the local store immediately, then persist the
  // creator's chosen display order for any already-saved rewards. New/unsaved
  // rewards (no id) keep their local position and get their displayOrder when
  // saved / re-ordered again.
  const handleReorderRewards = async (newRewards: RewardData[]) => {
    reorderRewards(newRewards);
    if (!projectId) return;
    const orderedIds = newRewards.map((r) => r.id).filter((id): id is string => !!id);
    if (orderedIds.length === 0) return;
    try {
      await apiFetch(`/api/projects/${projectId}/rewards/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardIds: orderedIds }),
      });
    } catch {
      // Non-fatal — the local order is already applied; it re-syncs on save.
    }
  };

  // Persist item order the same way rewards do. reorderItems alone only
  // updates the store, so a drag (or a chosen sort written through) was lost
  // on reload.
  const handleReorderItems = async (newItems: RewardItemData[]) => {
    reorderItems(newItems);
    if (!projectId) return;
    const orderedIds = newItems.map((i) => i.id).filter((id): id is string => !!id);
    if (orderedIds.length === 0) return;
    try {
      await apiFetch(`/api/projects/${projectId}/items/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: orderedIds }),
      });
    } catch {
      // Non-fatal — local order already applied; re-syncs on next save.
    }
  };

  const [activeTab, setActiveTab] = useState<"items" | "tiers" | "addons">("items");
  const [isSaving, setIsSaving] = useState(false);

  // Item dialog state
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<RewardItemData>(defaultItem);

  // Reward form state (replaces dialog - now shows full page form)
  const [isRewardFormOpen, setIsRewardFormOpen] = useState(false);
  const [editingRewardIndex, setEditingRewardIndex] = useState<number | null>(null);
  const [currentReward, setCurrentReward] = useState<RewardData>(defaultReward);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [quantityType, setQuantityType] = useState<"unlimited" | "limited">("unlimited");
  const [audienceType, setAudienceType] = useState<"all" | "secret">("all");
  const [timeLimitType, setTimeLimitType] = useState<"none" | "specified">("none");
  const [deliveryMonth, setDeliveryMonth] = useState<string>("");
  const [deliveryYear, setDeliveryYear] = useState<string>("");
  const [secretToken, setSecretToken] = useState<string>("");

  // Import dialog states (separate for rewards and addons)
  const [isImportRewardDialogOpen, setIsImportRewardDialogOpen] = useState(false);
  const [isImportAddonDialogOpen, setIsImportAddonDialogOpen] = useState(false);

  // CSV Import state
  const [isImportScreenOpen, setIsImportScreenOpen] = useState(false);

  const tiers = rewards.filter((r) => r.type === "TIER");
  const addons = rewards.filter((r) => r.type === "ADDON");

  // Item handlers
  const openCreateItemDialog = () => {
    setCurrentItem(defaultItem);
    setEditingItemId(null);
    setIsItemDialogOpen(true);
  };

  const openEditItemDialog = (item: RewardItemData) => {
    setCurrentItem(item);
    setEditingItemId(item.id || null);
    setIsItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!currentItem.title.trim()) {
      toast.error("Please enter an item title");
      return;
    }

    if (projectId) {
      setIsSaving(true);
      try {
        const method = editingItemId ? "PATCH" : "POST";
        const response = await apiFetch(`/api/projects/${projectId}/items`, {
          method,
          json: {
            id: editingItemId || undefined,
            title: currentItem.title,
            description: currentItem.description,
            imageUrl: currentItem.imageUrl,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || "Failed to save item");
          setIsSaving(false);
          return;
        }

        if (editingItemId) {
          updateItem(editingItemId, { ...currentItem, id: result.item.id });
          toast.success("Item saved");
        } else {
          addItem({ ...currentItem, id: result.item.id });
          toast.success("Item saved");
        }
      } catch (error) {
        console.error("Save item error:", error);
        toast.error("Failed to save item");
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    } else {
      if (editingItemId) {
        updateItem(editingItemId, currentItem);
        toast.success("Item updated (save project to persist)");
      } else {
        addItem(currentItem);
        toast.success("Item added (save project to persist)");
      }
    }

    setIsItemDialogOpen(false);
    setCurrentItem(defaultItem);
  };

  const handleDeleteItem = async (id: string) => {
    if (projectId) {
      try {
        const response = await apiFetch(
          `/api/projects/${projectId}/items?itemId=${id}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const result = await response.json();
          toast.error(result.error || "Failed to delete item");
          return;
        }
      } catch (error) {
        console.error("Delete item error:", error);
        toast.error("Failed to delete item");
        return;
      }
    }

    removeItem(id);
    toast.success("Item deleted");
  };

  const handleEndItem = async (id: string) => {
    if (!projectId) {
      toast.error("Project must be saved before ending items");
      return;
    }

    try {
      const response = await apiFetch(
        `/api/projects/${projectId}/items/${id}/end`,
        { method: "POST" }
      );

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || "Failed to end item");
        return;
      }

      // Update the item's isEnded status in local state
      const item = items.find(i => i.id === id);
      if (item) {
        updateItem(id, { ...item, isEnded: true });
      }
      toast.success("Item ended - no longer available for new pledges");
    } catch (error) {
      console.error("End item error:", error);
      toast.error("Failed to end item");
    }
  };

  // Auto-save image handlers for drag-drop in list view
  const handleItemImageChange = async (itemId: string, imageUrl: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    updateItem(itemId, { ...item, imageUrl });

    if (projectId) {
      try {
        const response = await apiFetch(`/api/projects/${projectId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            id: itemId,
            title: item.title,
            description: item.description,
            imageUrl,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to save");
        }
      } catch (error) {
        console.error("Save item image error:", error);
        throw error;
      }
    }
  };

  const handleRewardImageChange = async (rewardIndex: number, imageUrl: string) => {
    const reward = rewards[rewardIndex];
    if (!reward) return;

    updateReward(rewardIndex, { ...reward, imageUrl });

    if (projectId && reward.id) {
      try {
        const response = await apiFetch(`/api/projects/${projectId}/rewards`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            id: reward.id,
            type: reward.type,
            title: reward.title,
            description: reward.description,
            amount: reward.amount,
            imageUrl,
            estimatedDelivery: reward.estimatedDelivery ? new Date(reward.estimatedDelivery).toISOString() : undefined,
            shippingType: reward.shippingType,
            shippingCountries: reward.shippingCountries,
            shippingCost: reward.shippingCost,
            quantityAvailable: reward.quantityAvailable,
            visibility: reward.visibility,
            isEnded: reward.isEnded,
            items: (reward.items ?? []).map(item => ({
              projectItemId: item.id,
              title: item.title,
              description: item.description,
              imageUrl: item.imageUrl,
            })),
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to save");
        }
      } catch (error) {
        console.error("Save reward image error:", error);
        throw error;
      }
    }
  };

  // Reward handlers
  const openCreateRewardForm = (type: RewardType) => {
    setCurrentReward({ ...defaultReward, type });
    setSelectedItemIds([]);
    setEditingRewardIndex(null);
    setQuantityType("unlimited");
    setAudienceType("all");
    setSecretToken("");
    setTimeLimitType("none");
    setDeliveryMonth("");
    setDeliveryYear("");
    setIsRewardFormOpen(true);
    onFormOpenChange?.(true);
  };

  const openEditRewardForm = (index: number) => {
    const reward = rewards[index];
    if (!reward) return;
    setCurrentReward(reward);
    // Use projectItemId if available (from API), otherwise try to match by title, then fall back to id.
    // Older reward records loaded from the API may have items as undefined rather than an empty array;
    // default to [] so clicking Edit on a no-items tier doesn't throw.
    const selectedIds = (reward.items ?? []).map((rewardItem) => {
      // First try projectItemId
      if (rewardItem.projectItemId) {
        return rewardItem.projectItemId;
      }
      // Then try to find matching global item by title (case-insensitive)
      const matchingGlobalItem = items.find(
        globalItem => globalItem.title.toLowerCase() === rewardItem.title.toLowerCase()
      );
      if (matchingGlobalItem?.id) {
        return matchingGlobalItem.id;
      }
      // Fall back to the item's own id
      return rewardItem.id || "";
    }).filter(Boolean);
    setSelectedItemIds(selectedIds);
    setEditingRewardIndex(index);
    setQuantityType(reward.quantityAvailable ? "limited" : "unlimited");
    setAudienceType(reward.visibility === "SECRET" ? "secret" : "all");
    setSecretToken(reward.secretToken || "");
    setTimeLimitType("none");
    if (reward.estimatedDelivery) {
      const date = new Date(reward.estimatedDelivery);
      setDeliveryMonth(MONTHS[date.getMonth()]);
      setDeliveryYear(String(date.getFullYear()));
    } else {
      setDeliveryMonth("");
      setDeliveryYear("");
    }
    setIsRewardFormOpen(true);
    onFormOpenChange?.(true);
  };

  const handleSaveReward = async () => {
    if (!currentReward.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (currentReward.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (selectedItemIds.length === 0) {
      toast.error("Please add at least one item to this reward");
      return;
    }

    const selectedItems = items.filter((i) => i.id && selectedItemIds.includes(i.id));

    if (selectedItems.length === 0) {
      toast.error("Selected items could not be found. Please try selecting again.");
      return;
    }

    let estimatedDelivery: Date | undefined;
    if (deliveryMonth && deliveryYear) {
      const monthIndex = MONTHS.indexOf(deliveryMonth);
      estimatedDelivery = new Date(parseInt(deliveryYear), monthIndex, 1);
    }

    // Ensure items have projectItemId set for proper checkbox state persistence
    const itemsWithProjectItemId = selectedItems.map(item => ({
      ...item,
      projectItemId: item.id, // Ensure projectItemId is always set to match global item id
    }));

    const rewardToSave: RewardData = {
      ...currentReward,
      items: itemsWithProjectItemId,
      quantityAvailable: quantityType === "limited" ? currentReward.quantityAvailable : undefined,
      visibility: audienceType === "secret" ? "SECRET" : "PUBLIC",
      secretToken: audienceType === "secret" ? (secretToken || currentReward.secretToken) : undefined,
      estimatedDelivery,
    };

    if (projectId) {
      setIsSaving(true);
      try {
        const isEditing = editingRewardIndex !== null && currentReward.id;
        const method = isEditing ? "PATCH" : "POST";

        const response = await apiFetch(`/api/projects/${projectId}/rewards`, {
          method,
          json: {
            id: isEditing ? currentReward.id : undefined,
            type: rewardToSave.type,
            title: rewardToSave.title,
            description: rewardToSave.description,
            amount: rewardToSave.amount,
            imageUrl: rewardToSave.imageUrl,
            estimatedDelivery: rewardToSave.estimatedDelivery?.toISOString(),
            shippingType: rewardToSave.shippingType,
            shippingCountries: rewardToSave.shippingCountries,
            shippingCost: rewardToSave.shippingCost,
            quantityAvailable: rewardToSave.quantityAvailable,
            visibility: rewardToSave.visibility,
            secretToken: rewardToSave.secretToken,
            isEnded: rewardToSave.isEnded,
            items: selectedItems.map(item => ({
              projectItemId: item.id,
              title: item.title,
              description: item.description,
              imageUrl: item.imageUrl,
            })),
          },
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || "Failed to save reward");
          setIsSaving(false);
          return;
        }

        const savedReward = {
          ...rewardToSave,
          id: result.reward.id,
          secretToken: result.reward.secretToken,
        };
        if (editingRewardIndex !== null) {
          updateReward(editingRewardIndex, savedReward);
          toast.success("Reward saved");
        } else {
          addReward(savedReward);
          toast.success("Reward saved");
        }
      } catch (error) {
        console.error("Save reward error:", error);
        toast.error("Failed to save reward");
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    } else {
      if (editingRewardIndex !== null) {
        updateReward(editingRewardIndex, rewardToSave);
        toast.success("Reward updated");
      } else {
        addReward(rewardToSave);
        toast.success("Reward created");
      }
    }

    setActiveTab(rewardToSave.type === "ADDON" ? "addons" : "tiers");
    setIsRewardFormOpen(false);
    onFormOpenChange?.(false);
    setCurrentReward(defaultReward);
    setSelectedItemIds([]);
  };

  const handleCancelRewardForm = () => {
    setActiveTab(currentReward.type === "ADDON" ? "addons" : "tiers");
    setIsRewardFormOpen(false);
    onFormOpenChange?.(false);
    setCurrentReward(defaultReward);
    setSelectedItemIds([]);
  };

  const handleDeleteReward = async (index: number) => {
    const reward = rewards[index];
    if (!reward) return;
    if (reward.backerCount && reward.backerCount > 0) {
      toast.error("Cannot delete reward with backers. End the reward instead.");
      return;
    }

    if (projectId && reward.id) {
      try {
        const response = await apiFetch(
          `/api/projects/${projectId}/rewards?rewardId=${reward.id}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          const result = await response.json();
          toast.error(result.error || "Failed to delete reward");
          return;
        }
      } catch (error) {
        console.error("Delete reward error:", error);
        toast.error("Failed to delete reward");
        return;
      }
    }

    removeReward(index);
    toast.success("Reward deleted");
  };

  const handleEndReward = async (index: number) => {
    const reward = rewards[index];
    if (!reward) return;
    if (!reward.id) {
      toast.error("Reward must be saved before ending");
      return;
    }

    try {
      const res = await apiFetch(`/api/rewards/${reward.id}/end`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to end reward");
        return;
      }

      endReward(index);
      toast.success(`${reward.type === "TIER" ? "Reward" : "Add-on"} has been ended`);
    } catch {
      toast.error("Failed to end reward");
    }
  };

  const handleDuplicateReward = (index: number) => {
    const reward = rewards[index];
    if (!reward) return;
    addReward({ ...reward, id: undefined, title: `${reward.title} (Copy)` });
    toast.success("Reward duplicated");
  };

  const toggleItemSelection = (itemId: string | undefined) => {
    if (!itemId) return;
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  // The source reward's items belong to the source project, so their
  // ProjectItem ids are meaningless here. Re-resolve each one against this
  // project by title: reuse a matching item if the creator already has one
  // (keeping the image they attached), otherwise create it. Without this
  // step an imported reward arrives with no items and nothing in the Items
  // tab, which is exactly what creators were reporting.
  // Takes the whole selection at once rather than one reward at a time.
  // Two rewards in the same import commonly share an item ("Poster", "Vinyl
  // sticker"), and resolving them independently would create a duplicate
  // ProjectItem for each — the store's `items` can't have updated between
  // two calls in the same tick. `resolvedByTitle` is the batch-local map
  // that keeps the second reward pointing at the item the first one made.
  const importRewardsFromProject = useCallback(
    async (sources: ImportableReward[], type: "TIER" | "ADDON") => {
      const resolvedByTitle = new Map<string, RewardItemData>();
      for (const existing of items) {
        if (existing.id) {
          resolvedByTitle.set(existing.title.trim().toLowerCase(), {
            ...existing,
            projectItemId: existing.id,
          });
        }
      }

      const resolveItem = async (
        sourceItem: ImportableRewardItem
      ): Promise<RewardItemData | null> => {
        const title = sourceItem.title.trim();
        if (!title) return null;
        const key = title.toLowerCase();

        const existing = resolvedByTitle.get(key);
        if (existing) {
          // Don't overwrite an image the creator already attached here;
          // only fill one in if this project's item has none.
          return { ...existing, imageUrl: existing.imageUrl || sourceItem.imageUrl };
        }

        const draft: RewardItemData = {
          title,
          description: sourceItem.description,
          imageUrl: sourceItem.imageUrl,
        };

        // Saved projects persist the item immediately so it gets a real id
        // and appears in the Items tab. Unsaved drafts keep it local and the
        // project save creates it.
        if (projectId) {
          try {
            const res = await apiFetch(`/api/projects/${projectId}/items`, {
              method: "POST",
              json: {
                title: draft.title,
                description: draft.description,
                imageUrl: draft.imageUrl,
              },
            });
            const body = await res.json();
            if (res.ok && body.item?.id) {
              const created = { ...draft, id: body.item.id, projectItemId: body.item.id };
              addItem(created);
              resolvedByTitle.set(key, created);
              return created;
            }
          } catch {
            // Fall through to the local-only path below.
          }
        }

        addItem(draft);
        resolvedByTitle.set(key, draft);
        return draft;
      };

      for (const source of sources) {
        const resolvedItems: RewardItemData[] = [];
        for (const sourceItem of source.items) {
          const resolved = await resolveItem(sourceItem);
          if (resolved) resolvedItems.push(resolved);
        }

        addReward({
          ...defaultReward,
          type,
          title: source.title,
          description: source.description,
          amount: source.amount,
          imageUrl: source.imageUrl || undefined,
          shippingType: source.shippingType ?? defaultReward.shippingType,
          shippingCountries: source.shippingCountries ?? defaultReward.shippingCountries,
          shippingCost: source.shippingCost ?? defaultReward.shippingCost,
          quantityAvailable: source.quantityAvailable,
          visibility: source.visibility ?? defaultReward.visibility,
          estimatedDelivery: source.estimatedDelivery
            ? new Date(source.estimatedDelivery)
            : undefined,
          items: resolvedItems,
        });
      }
    },
    [items, projectId, addItem, addReward]
  );

  // Handler for importing rewards from another project (for Tiers tab)
  const handleImportRewardFromProject = async (sources: ImportableReward[]) => {
    await importRewardsFromProject(sources, "TIER");
    toast.success("Reward imported successfully");
  };

  // Handler for importing addons from another project (for Addons tab)
  const handleImportAddonFromProject = async (sources: ImportableReward[]) => {
    await importRewardsFromProject(sources, "ADDON");
    // Success toast is shown once by ImportAddonDialog after a (possibly bulk) import.
  };

  // Handler for copying a tier from current project as an addon
  const handleImportFromCurrentProject = (tierIndex: number) => {
    const tier = tiers[tierIndex];
    if (!tier) return;

    // Ensure items have projectItemId set for checkbox persistence
    const itemsWithProjectItemId = (tier.items ?? []).map(item => ({
      ...item,
      projectItemId: item.projectItemId || item.id,
    }));

    addReward({
      ...tier,
      id: undefined,
      type: "ADDON",
      title: `${tier.title} (Add-on)`,
      items: itemsWithProjectItemId,
    });
    // Success toast is shown once by ImportAddonDialog after a (possibly bulk) import.
  };

  // CSV Import handlers
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || "";
      });
      rows.push(row);
    }

    return rows;
  };

  // Re-importing the same sheet updates the rows it already knows instead of
  // appending duplicates. Title is the natural key (it's the SKU-style code
  // creators use: PG1-01, PG1-GIA…), matched case-insensitively.
  //
  // Images are deliberately NOT part of the import: they're uploaded by hand
  // after the fact and the CSV has no image column, so an update must leave
  // the existing imageUrl alone. Otherwise re-importing to fix a price would
  // wipe every image the creator attached.
  const handleImportItems = (rows: Record<string, string>[]): number => {
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const title = row.title?.trim();
      if (!title) continue;

      const existingIndex = items.findIndex(
        (i) => i.title.trim().toLowerCase() === title.toLowerCase()
      );

      if (existingIndex >= 0 && items[existingIndex].id) {
        const existing = items[existingIndex];
        updateItem(existing.id as string, {
          ...existing,
          title,
          description: row.description?.trim() || existing.description || "",
          // Keep whatever image is already attached.
          imageUrl: existing.imageUrl,
        });
        updated++;
      } else {
        addItem({
          title,
          description: row.description?.trim() || "",
          imageUrl: "",
        });
        created++;
      }
    }
    if (created || updated) {
      toast.success(
        `Items: ${created} added, ${updated} updated${updated ? " (images kept)" : ""}`
      );
    }
    return created + updated;
  };

  const handleImportRewards = (rows: Record<string, string>[], rewardType: "TIER" | "ADDON"): number => {
    let importedCount = 0;
    let updatedCount = 0;

    for (const row of rows) {
      if (row.title?.trim() && row.amount) {
        const itemTitles = row.itemTitles?.split(",").map(t => t.trim()).filter(Boolean) || [];
        const matchedItems = items.filter(item =>
          itemTitles.some(title => item.title.toLowerCase() === title.toLowerCase())
        );

        let estimatedDelivery: Date | undefined;
        if (row.estimatedDeliveryMonth && row.estimatedDeliveryYear) {
          const monthIndex = MONTHS.findIndex(
            m => m.toLowerCase() === row.estimatedDeliveryMonth.toLowerCase()
          );
          if (monthIndex >= 0) {
            estimatedDelivery = new Date(parseInt(row.estimatedDeliveryYear), monthIndex, 1);
          }
        }

        let shippingCost: Record<string, number> = {};
        if (row.shippingCost) {
          try {
            shippingCost = JSON.parse(row.shippingCost);
          } catch {
            const cost = parseFloat(row.shippingCost) || 0;
            if ((row.shippingType as ShippingType) === "WORLDWIDE") {
              shippingCost = { WORLDWIDE: cost };
            } else {
              shippingCost = { US: cost };
            }
          }
        }

        // Derive the country list from the rate map the creator actually
        // supplied. This was hardcoded to ["US"], so importing a
        // SELECTED_COUNTRIES reward priced for, say, US + CA + rest-of-world
        // came in claiming it only ships to the US. "WW" is the
        // rest-of-world fallback key getShippingCost() looks for, not a
        // country, so it's excluded from the list.
        const countryKeys = Object.keys(shippingCost).filter(
          (k) => k !== "WW" && k !== "WORLDWIDE"
        );

        // Ensure items have projectItemId set for checkbox persistence
        const itemsWithProjectItemId = matchedItems.map(item => ({
          ...item,
          projectItemId: item.id,
        }));

        const title = row.title.trim();
        const payload: Omit<RewardData, "id"> = {
          type: rewardType,
          title,
          description: row.description?.trim() || "",
          amount: parseFloat(row.amount) || 1,
          shippingType: (row.shippingType as ShippingType) || "NO_SHIPPING",
          shippingCost,
          // Digital rows get no country list at all — falling back to ["US"]
          // here is what labelled imported digital rewards "Ships to: US".
          shippingCountries:
            (row.shippingType as ShippingType) === "NO_SHIPPING"
              ? []
              : countryKeys.length > 0
                ? countryKeys
                : ["US"],
          quantityAvailable: row.quantityAvailable ? parseInt(row.quantityAvailable) : undefined,
          visibility: row.visibility === "SECRET" ? "SECRET" : "PUBLIC",
          estimatedDelivery,
          items: itemsWithProjectItemId,
        };

        // Re-import updates in place rather than duplicating. Matched on
        // title within the same type, so a TIER and an ADDON may share a
        // title without colliding.
        const existingIndex = rewards.findIndex(
          (r) =>
            (r.type || "TIER") === rewardType &&
            r.title.trim().toLowerCase() === title.toLowerCase()
        );

        if (existingIndex >= 0) {
          const existing = rewards[existingIndex];
          updateReward(existingIndex, {
            ...existing,
            ...payload,
            // Keep the database id so this updates the row instead of
            // creating a second one on save...
            id: existing.id,
            // ...and keep the artwork, which is uploaded by hand and has no
            // column in the CSV. Without this, re-importing to correct a
            // price would clear every reward image.
            imageUrl: existing.imageUrl,
          });
          updatedCount++;
        } else {
          addReward(payload);
          importedCount++;
        }
      }
    }
    if (importedCount || updatedCount) {
      const label = rewardType === "TIER" ? "rewards" : "add-ons";
      toast.success(
        `${label}: ${importedCount} added, ${updatedCount} updated${updatedCount ? " (images kept)" : ""}`
      );
    }
    return importedCount + updatedCount;
  };

  // Determine which main content to render
  const renderMainContent = () => {
    // If import screen is open, show import interface
    if (isImportScreenOpen) {
      return (
        <CSVImportScreen
          onClose={() => {
            setIsImportScreenOpen(false);
            onFormOpenChange?.(false);
          }}
          onImportComplete={(type) => setActiveTab(type)}
          parseCSV={parseCSV}
          onImportItems={handleImportItems}
          onImportRewards={handleImportRewards}
        />
      );
    }

    // If reward form is open, show full-page form
    if (isRewardFormOpen) {
      return (
        <RewardForm
          currentReward={currentReward}
          onRewardChange={setCurrentReward}
          allRewards={rewards}
          selectedItemIds={selectedItemIds}
          onToggleItemSelection={toggleItemSelection}
          items={items}
          quantityType={quantityType}
          onQuantityTypeChange={setQuantityType}
          audienceType={audienceType}
          onAudienceTypeChange={setAudienceType}
          timeLimitType={timeLimitType}
          onTimeLimitTypeChange={setTimeLimitType}
          deliveryMonth={deliveryMonth}
          onDeliveryMonthChange={setDeliveryMonth}
          deliveryYear={deliveryYear}
          onDeliveryYearChange={setDeliveryYear}
          secretToken={secretToken}
          onSecretTokenChange={setSecretToken}
          isSaving={isSaving}
          isEditing={editingRewardIndex !== null}
          projectId={projectId}
          projectSlug={projectSlug}
          onSave={handleSaveReward}
          onCancel={handleCancelRewardForm}
          onCreateItem={openCreateItemDialog}
        />
      );
    }

    // Default: show main tabs view
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Create your rewards</h2>
          <Button variant="outline" onClick={() => {
            setIsImportScreenOpen(true);
            onFormOpenChange?.(true);
          }}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
            <TabsTrigger
              value="items"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
            >
              Items
            </TabsTrigger>
            <TabsTrigger
              value="tiers"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
            >
              Reward tiers
            </TabsTrigger>
            <TabsTrigger
              value="addons"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
            >
              Add-ons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <ItemsTab
              items={items}
              rewards={rewards}
              projectId={projectId}
              isLive={isLive}
              onCreateItem={openCreateItemDialog}
              onEditItem={openEditItemDialog}
              onDeleteItem={handleDeleteItem}
              onEndItem={handleEndItem}
              onItemImageChange={handleItemImageChange}
              onReorderItems={handleReorderItems}
            />
          </TabsContent>

          <TabsContent value="tiers">
            <TiersTab
              tiers={tiers}
              rewards={rewards}
              isLive={isLive}
              projectId={projectId}
              onCreateReward={() => openCreateRewardForm("TIER")}
              onEditReward={openEditRewardForm}
              onDuplicateReward={handleDuplicateReward}
              onDeleteReward={handleDeleteReward}
              onEndReward={handleEndReward}
              onRewardImageChange={handleRewardImageChange}
              onOpenImportDialog={() => setIsImportRewardDialogOpen(true)}
              onReorderRewards={handleReorderRewards}
            />
          </TabsContent>

          <TabsContent value="addons">
            <AddonsTab
              addons={addons}
              rewards={rewards}
              isLive={isLive}
              projectId={projectId}
              onCreateAddon={() => openCreateRewardForm("ADDON")}
              onEditReward={openEditRewardForm}
              onDuplicateReward={handleDuplicateReward}
              onDeleteReward={handleDeleteReward}
              onEndReward={handleEndReward}
              onRewardImageChange={handleRewardImageChange}
              onOpenImportDialog={() => setIsImportAddonDialogOpen(true)}
              onReorderRewards={handleReorderRewards}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <>
      {renderMainContent()}

      {/* Item Dialog - Always rendered so it's available from RewardForm */}
      <ItemDialog
        isOpen={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        currentItem={currentItem}
        onItemChange={setCurrentItem}
        onSave={handleSaveItem}
        isSaving={isSaving}
        isEditing={!!editingItemId}
        projectId={projectId || undefined}
      />

      {/* Import Reward Dialog (for Tiers tab) */}
      <ImportRewardDialog
        isOpen={isImportRewardDialogOpen}
        onOpenChange={setIsImportRewardDialogOpen}
        projectId={projectId}
        onImportReward={handleImportRewardFromProject}
      />

      {/* Import Addon Dialog (for Addons tab) */}
      <ImportAddonDialog
        isOpen={isImportAddonDialogOpen}
        onOpenChange={setIsImportAddonDialogOpen}
        projectId={projectId}
        currentProjectTiers={tiers}
        onImportFromCurrentProject={handleImportFromCurrentProject}
        onImportAddon={handleImportAddonFromProject}
      />
    </>
  );
}
