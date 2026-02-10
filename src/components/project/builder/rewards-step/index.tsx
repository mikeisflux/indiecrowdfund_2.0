"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState } from "react";
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
        const response = await fetch(`/api/projects/${projectId}/items`, {
          method,
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
            id: editingItemId || undefined,
            title: currentItem.title,
            description: currentItem.description,
            imageUrl: currentItem.imageUrl,
          }),
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
        const response = await fetch(
          `/api/projects/${projectId}/items?itemId=${id}`,
          { method: "DELETE", headers: getCSRFHeaders() }
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
      const response = await fetch(
        `/api/projects/${projectId}/items/${id}/end`,
        { method: "POST", headers: getCSRFHeaders() }
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
        const response = await fetch(`/api/projects/${projectId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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
        const response = await fetch(`/api/projects/${projectId}/rewards`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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
            items: reward.items.map(item => ({
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
    setCurrentReward(reward);
    // Use projectItemId if available (from API), otherwise try to match by title, then fall back to id
    const selectedIds = reward.items.map((rewardItem) => {
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

        const response = await fetch(`/api/projects/${projectId}/rewards`, {
          method,
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
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
          }),
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
    if (reward.backerCount && reward.backerCount > 0) {
      toast.error("Cannot delete reward with backers. End the reward instead.");
      return;
    }

    if (projectId && reward.id) {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/rewards?rewardId=${reward.id}`,
          { method: "DELETE", headers: getCSRFHeaders() }
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
    if (!reward.id) {
      toast.error("Reward must be saved before ending");
      return;
    }

    try {
      const res = await fetch(`/api/rewards/${reward.id}/end`, {
        method: "POST",
        headers: getCSRFHeaders(),
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

  // Handler for importing a reward from another project (for Tiers tab)
  const handleImportRewardFromProject = (reward: { title: string; description: string; amount: number }) => {
    addReward({
      ...defaultReward,
      title: reward.title,
      description: reward.description,
      amount: reward.amount,
      type: "TIER",
    });
    toast.success("Reward imported successfully");
  };

  // Handler for importing an addon from another project (for Addons tab)
  const handleImportAddonFromProject = (addon: { title: string; description: string; amount: number }) => {
    addReward({
      ...defaultReward,
      title: addon.title,
      description: addon.description,
      amount: addon.amount,
      type: "ADDON",
    });
    toast.success("Add-on imported successfully");
  };

  // Handler for copying a tier from current project as an addon
  const handleImportFromCurrentProject = (tierIndex: number) => {
    const tier = tiers[tierIndex];
    if (!tier) return;

    // Ensure items have projectItemId set for checkbox persistence
    const itemsWithProjectItemId = tier.items.map(item => ({
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

    toast.success("Reward copied as add-on successfully");
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

  const handleImportItems = (rows: Record<string, string>[]): number => {
    let importedCount = 0;
    for (const row of rows) {
      if (row.title?.trim()) {
        addItem({
          title: row.title.trim(),
          description: row.description?.trim() || "",
          imageUrl: "",
        });
        importedCount++;
      }
    }
    if (importedCount > 0) {
      toast.success(`Imported ${importedCount} items`);
    }
    return importedCount;
  };

  const handleImportRewards = (rows: Record<string, string>[], rewardType: "TIER" | "ADDON"): number => {
    let importedCount = 0;

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

        // Ensure items have projectItemId set for checkbox persistence
        const itemsWithProjectItemId = matchedItems.map(item => ({
          ...item,
          projectItemId: item.id,
        }));

        addReward({
          type: rewardType,
          title: row.title.trim(),
          description: row.description?.trim() || "",
          amount: parseFloat(row.amount) || 1,
          shippingType: (row.shippingType as ShippingType) || "NO_SHIPPING",
          shippingCost,
          shippingCountries: ["US"],
          quantityAvailable: row.quantityAvailable ? parseInt(row.quantityAvailable) : undefined,
          visibility: row.visibility === "SECRET" ? "SECRET" : "PUBLIC",
          estimatedDelivery,
          items: itemsWithProjectItemId,
        });
        importedCount++;
      }
    }
    if (importedCount > 0) {
      toast.success(`Imported ${importedCount} ${rewardType === "TIER" ? "rewards" : "addons"}`);
    }
    return importedCount;
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
              onReorderItems={reorderItems}
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
              onReorderRewards={reorderRewards}
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
              onReorderRewards={reorderRewards}
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
