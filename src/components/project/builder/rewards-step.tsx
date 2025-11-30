"use client";

import { useState } from "react";
import Image from "next/image";
import { useProjectStore } from "@/lib/stores/project-store";
import { RewardData, RewardItemData, RewardType, ShippingType, SHIPPING_COUNTRIES } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Gift,
  Box,
  Image as ImageIcon,
  ChevronDown,
  ChevronLeft,
  Info,
  AlertCircle,
  Copy,
  Download,
  Ban,
  Lock,
  Users,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";

const defaultItem: RewardItemData = {
  title: "",
  description: "",
  imageUrl: "",
};

const defaultReward: RewardData = {
  type: "TIER",
  title: "",
  description: "",
  amount: 1,
  shippingType: "NO_SHIPPING",
  shippingCountries: ["US"], // Default to United States
  shippingCost: 0,
  visibility: "PUBLIC",
  items: [],
};

// Mock previous projects for import feature
const mockPreviousProjects = [
  {
    id: "1",
    title: "Comics project",
    rewards: [
      { title: "Digital Copy", amount: 10, description: "Digital download" },
      { title: "Physical Copy", amount: 25, description: "Printed edition" },
    ],
  },
  {
    id: "2",
    title: "Art Book Campaign",
    rewards: [
      { title: "PDF Edition", amount: 15, description: "High-res PDF" },
      { title: "Hardcover", amount: 50, description: "Limited hardcover" },
    ],
  },
];

// Generate month options
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Generate year options (current year + 5 years)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear + i);

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
    addReward,
    updateReward,
    removeReward,
    projectStatus,
    endReward,
  } = useProjectStore();

  // Check if campaign is live (can't edit rewards with backers)
  const isLive = projectStatus === "LIVE" || projectStatus === "FUNDED";

  const [activeTab, setActiveTab] = useState<"items" | "tiers" | "addons">("items");

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

  // Import reward dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // CSV Import state
  const [isImportScreenOpen, setIsImportScreenOpen] = useState(false);
  const [importType, setImportType] = useState<"items" | "rewards" | "addons" | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const tiers = rewards.filter((r) => r.type === "TIER");
  const addons = rewards.filter((r) => r.type === "ADDON");

  // Get which rewards/addons include a specific item
  const getItemIncludedIn = (itemId: string) => {
    const includedIn: { rewards: string[]; addons: string[] } = { rewards: [], addons: [] };
    rewards.forEach((r) => {
      if (r.items.some((i) => i.id === itemId)) {
        if (r.type === "TIER") {
          includedIn.rewards.push(r.title);
        } else {
          includedIn.addons.push(r.title);
        }
      }
    });
    return includedIn;
  };

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

  const handleSaveItem = () => {
    if (!currentItem.title.trim()) {
      toast.error("Please enter an item title");
      return;
    }

    if (editingItemId) {
      updateItem(editingItemId, currentItem);
      toast.success("Item updated");
    } else {
      addItem(currentItem);
      toast.success("Item created");
    }

    setIsItemDialogOpen(false);
    setCurrentItem(defaultItem);
  };

  const handleDeleteItem = (id: string) => {
    removeItem(id);
    toast.success("Item deleted");
  };

  // Reward handlers
  const openCreateRewardForm = (type: RewardType) => {
    setCurrentReward({ ...defaultReward, type });
    setSelectedItemIds([]);
    setEditingRewardIndex(null);
    setQuantityType("unlimited");
    setAudienceType("all");
    setTimeLimitType("none");
    setDeliveryMonth("");
    setDeliveryYear("");
    setIsRewardFormOpen(true);
    onFormOpenChange?.(true);
  };

  const openEditRewardForm = (index: number) => {
    const reward = rewards[index];
    setCurrentReward(reward);
    setSelectedItemIds(reward.items.map((i) => i.id || "").filter(Boolean));
    setEditingRewardIndex(index);
    setQuantityType(reward.quantityAvailable ? "limited" : "unlimited");
    setAudienceType(reward.visibility === "SECRET" ? "secret" : "all");
    setTimeLimitType("none"); // Time limit not stored yet
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

  const handleSaveReward = () => {
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

    // Get selected items from the items array (ensure IDs match)
    const selectedItems = items.filter((i) => i.id && selectedItemIds.includes(i.id));

    if (selectedItems.length === 0) {
      toast.error("Selected items could not be found. Please try selecting again.");
      return;
    }

    // Build estimated delivery date
    let estimatedDelivery: Date | undefined;
    if (deliveryMonth && deliveryYear) {
      const monthIndex = MONTHS.indexOf(deliveryMonth);
      estimatedDelivery = new Date(parseInt(deliveryYear), monthIndex, 1);
    }

    const rewardToSave: RewardData = {
      ...currentReward,
      items: selectedItems,
      quantityAvailable: quantityType === "limited" ? currentReward.quantityAvailable : undefined,
      visibility: audienceType === "secret" ? "SECRET" : "PUBLIC",
      estimatedDelivery,
    };

    if (editingRewardIndex !== null) {
      updateReward(editingRewardIndex, rewardToSave);
      toast.success("Reward updated");
    } else {
      addReward(rewardToSave);
      toast.success("Reward created");
    }

    // Navigate back to the correct tab based on reward type
    setActiveTab(rewardToSave.type === "ADDON" ? "addons" : "tiers");
    setIsRewardFormOpen(false);
    onFormOpenChange?.(false);
    setCurrentReward(defaultReward);
    setSelectedItemIds([]);
  };

  const handleCancelRewardForm = () => {
    // Navigate back to the correct tab based on reward type
    setActiveTab(currentReward.type === "ADDON" ? "addons" : "tiers");
    setIsRewardFormOpen(false);
    onFormOpenChange?.(false);
    setCurrentReward(defaultReward);
    setSelectedItemIds([]);
  };

  const handleDeleteReward = (index: number) => {
    const reward = rewards[index];
    // If reward has backers, show error
    if (reward.backerCount && reward.backerCount > 0) {
      toast.error("Cannot delete reward with backers. End the reward instead.");
      return;
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
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to end reward");
        return;
      }

      // Update local state
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
    if (!itemId) return; // Don't toggle items without IDs
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleImportReward = (projectId: string, rewardIndex: number) => {
    const project = mockPreviousProjects.find((p) => p.id === projectId);
    if (!project) return;

    const reward = project.rewards[rewardIndex];
    if (!reward) return;

    addReward({
      ...defaultReward,
      title: reward.title,
      description: reward.description,
      amount: reward.amount,
      type: activeTab === "addons" ? "ADDON" : "TIER",
    });

    setIsImportDialogOpen(false);
    toast.success("Reward imported successfully");
  };

  // Import a tier from current project as an add-on
  const handleImportFromCurrentProject = (tierIndex: number) => {
    const tier = tiers[tierIndex];
    if (!tier) return;

    addReward({
      ...tier,
      id: undefined,
      type: "ADDON",
      title: `${tier.title} (Add-on)`,
    });

    setIsImportDialogOpen(false);
    toast.success("Reward copied as add-on successfully");
  };

  // CSV Import handlers
  const openImportScreen = () => {
    setIsImportScreenOpen(true);
    onFormOpenChange?.(true);
  };

  const closeImportScreen = () => {
    setIsImportScreenOpen(false);
    setImportType(null);
    setImportFile(null);
    onFormOpenChange?.(false);
  };

  const downloadCSV = (type: "items" | "rewards" | "addons") => {
    // Use static template files from the public directory
    const filename = `${type}_template.csv`;
    const link = document.createElement("a");
    link.href = `/templates/${filename}`;
    link.download = filename;
    link.click();
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportCSV = async () => {
    if (!importFile || !importType) return;

    setIsImporting(true);

    try {
      const text = await importFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error("CSV file is empty or invalid");
        return;
      }

      let importedCount = 0;

      if (importType === "items") {
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
        toast.success(`Imported ${importedCount} items`);
        setActiveTab("items");
      } else {
        // For rewards and addons
        const rewardType = importType === "rewards" ? "TIER" : "ADDON";

        for (const row of rows) {
          if (row.title?.trim() && row.amount) {
            // Parse item titles and find matching items
            const itemTitles = row.itemTitles?.split(",").map(t => t.trim()).filter(Boolean) || [];
            const matchedItems = items.filter(item =>
              itemTitles.some(title => item.title.toLowerCase() === title.toLowerCase())
            );

            // Parse estimated delivery
            let estimatedDelivery: Date | undefined;
            if (row.estimatedDeliveryMonth && row.estimatedDeliveryYear) {
              const monthIndex = MONTHS.findIndex(
                m => m.toLowerCase() === row.estimatedDeliveryMonth.toLowerCase()
              );
              if (monthIndex >= 0) {
                estimatedDelivery = new Date(parseInt(row.estimatedDeliveryYear), monthIndex, 1);
              }
            }

            addReward({
              type: rewardType,
              title: row.title.trim(),
              description: row.description?.trim() || "",
              amount: parseFloat(row.amount) || 1,
              shippingType: (row.shippingType as ShippingType) || "NO_SHIPPING",
              shippingCost: parseFloat(row.shippingCost) || 0,
              shippingCountries: ["US"],
              quantityAvailable: row.quantityAvailable ? parseInt(row.quantityAvailable) : undefined,
              visibility: row.visibility === "SECRET" ? "SECRET" : "PUBLIC",
              estimatedDelivery,
              items: matchedItems,
            });
            importedCount++;
          }
        }
        toast.success(`Imported ${importedCount} ${importType}`);
        setActiveTab(importType === "rewards" ? "tiers" : "addons");
      }

      closeImportScreen();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import CSV. Please check the file format.");
    } finally {
      setIsImporting(false);
    }
  };

  // If import screen is open, show import interface
  if (isImportScreenOpen) {
    return (
      <div className="space-y-6">
        {/* Header with Back */}
        <div className="flex items-center justify-between border-b pb-4">
          <Button variant="outline" onClick={closeImportScreen}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Import from CSV</h2>
          <p className="text-muted-foreground">
            Import multiple items, rewards, or add-ons at once using a CSV file.
            Download the template to see the expected format.
          </p>
        </div>

        {!importType ? (
          // Show import type selection
          <div className="grid gap-6 md:grid-cols-3">
            {/* Import Items Card */}
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setImportType("items")}>
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Box className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Import Items</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import items that can be included in rewards and add-ons
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCSV("items");
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardContent>
            </Card>

            {/* Import Rewards Card */}
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setImportType("rewards")}>
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Import Rewards</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import reward tiers for backers to choose from
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCSV("rewards");
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardContent>
            </Card>

            {/* Import Add-ons Card */}
            <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setImportType("addons")}>
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Import Add-ons</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Import optional add-ons backers can add to their pledge
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadCSV("addons");
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Show file upload interface
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setImportType(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h3 className="font-semibold text-lg">
                    Import {importType === "items" ? "Items" : importType === "rewards" ? "Rewards" : "Add-ons"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file with your {importType}
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                    </div>
                    {importFile ? (
                      <div>
                        <p className="font-medium">{importFile.name}</p>
                        <p className="text-sm text-muted-foreground">Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Click to upload CSV</p>
                        <p className="text-sm text-muted-foreground">or drag and drop</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => downloadCSV(importType)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button onClick={handleImportCSV} disabled={!importFile || isImporting}>
                  {isImporting ? (
                    <>
                      <span className="animate-spin mr-2">...</span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import {importType === "items" ? "Items" : importType === "rewards" ? "Rewards" : "Add-ons"}
                    </>
                  )}
                </Button>
              </div>

              {importType !== "items" && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Important: Import items first</p>
                      <p className="mt-1">
                        {importType === "rewards" ? "Rewards" : "Add-ons"} reference items by title. Make sure you&apos;ve
                        imported or created your items before importing {importType}. Any unmatched item titles will be skipped.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // If reward form is open, show full-page form instead
  if (isRewardFormOpen) {
    return (
      <div className="space-y-6">
        {/* Header with Back/Save */}
        <div className="flex items-center justify-between border-b pb-4">
          <Button variant="outline" onClick={handleCancelRewardForm}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button onClick={handleSaveReward}>
            Save reward
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                {editingRewardIndex !== null ? "Edit reward" : "Add a reward"}
              </h2>
              <p className="text-muted-foreground">
                Offer tangible or intangible things that bring backers closer to your project.
              </p>
            </div>

            {/* Basics Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Basics</h3>

                <div className="space-y-2">
                  <Label htmlFor="reward-title">Title</Label>
                  <Input
                    id="reward-title"
                    placeholder="Signed limited-edition"
                    value={currentReward.title}
                    onChange={(e) =>
                      setCurrentReward({ ...currentReward, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward-description">
                    Description <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="reward-description"
                    placeholder="Get an early copy — hot off the presses!"
                    rows={4}
                    value={currentReward.description}
                    onChange={(e) =>
                      setCurrentReward({ ...currentReward, description: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Describe what makes this reward stand out from your other offerings. Avoid re-listing items as this will look repetitive to backers.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Image Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Image</h3>
                <p className="text-sm text-muted-foreground">
                  Show your backers what they&apos;ll receive for their support. Images should be honest, and should avoid banners, badges, and overlaid text.
                </p>

                <ImageUpload
                  value={currentReward.imageUrl}
                  onChange={(url) => setCurrentReward({ ...currentReward, imageUrl: url })}
                  aspectRatio="aspect-[3/2]"
                  recommendedSize="348 x 232 px (3:2 ratio)"
                  maxSizeMB={10}
                />
              </CardContent>
            </Card>

            {/* Pricing Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Pricing</h3>

                <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Tax collected in Pledge Manager</p>
                      <p className="text-sm text-muted-foreground">
                        To use the Pledge Manager, the price set for each reward must not include tax. We will calculate and collect any applicable tax from each backer, based on their location, after your campaign ends.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pledge-amount">Pledge amount</Label>
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      id="pledge-amount"
                      type="number"
                      className="pl-8"
                      value={currentReward.amount || ""}
                      onChange={(e) =>
                        setCurrentReward({
                          ...currentReward,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Availability Section */}
            <Card>
              <CardContent className="p-6 space-y-6">
                <h3 className="font-semibold text-lg">Availability</h3>

                {/* Project Quantity */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-medium">Project quantity</Label>
                    <p className="text-sm text-muted-foreground">
                      Limit the amount available to all backers if mass production or shipping is impractical. You can only increase a set amount after launch.
                    </p>
                  </div>
                  <RadioGroup
                    value={quantityType}
                    onValueChange={(v) => setQuantityType(v as "unlimited" | "limited")}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="unlimited" id="unlimited" />
                      <Label htmlFor="unlimited" className="cursor-pointer font-normal">
                        Unlimited
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="limited" id="limited" />
                      <Label htmlFor="limited" className="cursor-pointer font-normal">
                        Limited
                      </Label>
                    </div>
                  </RadioGroup>
                  {quantityType === "limited" && (
                    <div className="ml-8">
                      <Input
                        type="number"
                        placeholder="Enter quantity"
                        className="max-w-xs"
                        value={currentReward.quantityAvailable || ""}
                        onChange={(e) =>
                          setCurrentReward({
                            ...currentReward,
                            quantityAvailable: parseInt(e.target.value) || undefined,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {/* Audience */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Audience</Label>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">New</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Who can view and pledge to this reward?
                  </p>
                  <RadioGroup
                    value={audienceType}
                    onValueChange={(v) => setAudienceType(v as "all" | "secret")}
                    className="space-y-2"
                  >
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="all" id="all-backers" className="mt-0.5" />
                      <div>
                        <Label htmlFor="all-backers" className="cursor-pointer font-normal">
                          All backers
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          This reward will be available to all backers.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="secret" id="secret-reward" className="mt-0.5" />
                      <div>
                        <Label htmlFor="secret-reward" className="cursor-pointer font-normal">
                          Select backers only (Secret Reward)
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* Time limit */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-base font-medium">Time limit</Label>
                    <p className="text-sm text-muted-foreground">
                      Garner excitement about limited editions or special offerings.
                    </p>
                  </div>
                  <RadioGroup
                    value={timeLimitType}
                    onValueChange={(v) => setTimeLimitType(v as "none" | "specified")}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="none" id="no-limit" />
                      <Label htmlFor="no-limit" className="cursor-pointer font-normal">
                        No limit
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border p-4">
                      <RadioGroupItem value="specified" id="specify-time" />
                      <Label htmlFor="specify-time" className="cursor-pointer font-normal">
                        Specify start and end
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Items Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Items*</h3>
                    <p className="text-sm text-muted-foreground">
                      Including items in your rewards and add-ons makes it easy for backers to understand and compare your offerings. An item can be anything you plan to offer your backers. Some examples include playing cards, a digital copy of a book, a ticket to a play, or even a thank-you in your documentary.
                    </p>
                  </div>
                  <Button variant="outline" onClick={openCreateItemDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    New item
                  </Button>
                </div>

                {selectedItemIds.length === 0 && (
                  <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-sm">Add all items included in this reward</p>
                  </div>
                )}

                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors",
                          selectedItemIds.includes(item.id || "")
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => toggleItemSelection(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center",
                              selectedItemIds.includes(item.id || "")
                                ? "border-primary bg-primary text-white"
                                : "border-muted-foreground"
                            )}
                          >
                            {selectedItemIds.includes(item.id || "") && (
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="font-medium">{item.title}</span>
                        </div>
                        {item.imageUrl && (
                          <Image src={item.imageUrl} alt={item.title} width={40} height={40} className="w-10 h-10 object-cover rounded" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Estimated Delivery Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Estimated delivery</h3>
                  <p className="text-sm text-muted-foreground">
                    Give yourself plenty of time. It&apos;s better to deliver to backers ahead of schedule than behind.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={deliveryMonth} onValueChange={setDeliveryMonth}>
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month} value={month}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={deliveryYear} onValueChange={setDeliveryYear}>
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Section */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Shipping</h3>

                <Select
                  value={currentReward.shippingType}
                  onValueChange={(value) =>
                    setCurrentReward({
                      ...currentReward,
                      shippingType: value as ShippingType,
                    })
                  }
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_SHIPPING">
                      Digital / No shipping required
                    </SelectItem>
                    <SelectItem value="WORLDWIDE">Ships worldwide</SelectItem>
                    <SelectItem value="SELECTED_COUNTRIES">
                      Ships to selected countries
                    </SelectItem>
                  </SelectContent>
                </Select>

                {currentReward.shippingType === "SELECTED_COUNTRIES" && (
                  <div className="space-y-2">
                    <Label>Select Countries</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose which countries you can ship to
                    </p>
                    <ScrollArea className="h-[200px] rounded-md border p-4">
                      <div className="space-y-2">
                        {SHIPPING_COUNTRIES.map((country) => (
                          <div key={country.code} className="flex items-center space-x-2">
                            <Checkbox
                              id={`country-${country.code}`}
                              checked={currentReward.shippingCountries.includes(country.code)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setCurrentReward({
                                    ...currentReward,
                                    shippingCountries: [...currentReward.shippingCountries, country.code],
                                  });
                                } else {
                                  setCurrentReward({
                                    ...currentReward,
                                    shippingCountries: currentReward.shippingCountries.filter(
                                      (c) => c !== country.code
                                    ),
                                  });
                                }
                              }}
                            />
                            <Label
                              htmlFor={`country-${country.code}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {country.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    {currentReward.shippingCountries.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {currentReward.shippingCountries.length} countries selected
                      </p>
                    )}
                  </div>
                )}

                {currentReward.shippingType !== "NO_SHIPPING" && (
                  <div className="space-y-2">
                    <Label htmlFor="shipping-cost">Shipping Cost</Label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="shipping-cost"
                        type="number"
                        className="pl-8"
                        value={currentReward.shippingCost || ""}
                        onChange={(e) =>
                          setCurrentReward({
                            ...currentReward,
                            shippingCost: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <h3 className="font-semibold mb-4">Reward preview</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get a glimpse of how your reward will look on your project page.
              </p>

              <Card>
                <CardContent className="p-0">
                  {/* Image */}
                  <div className="aspect-[3/2] bg-muted flex items-center justify-center border-b relative overflow-hidden">
                    {currentReward.imageUrl ? (
                      <Image
                        src={currentReward.imageUrl}
                        alt={currentReward.title || "Reward image"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>

                  {/* Preview content */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {currentReward.title || "Reward title"}
                      </span>
                      <span className="font-bold">${currentReward.amount || 1}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div>
                        <span className="block">Backers</span>
                        <span className="font-medium text-foreground">0</span>
                      </div>
                      <div className="text-right">
                        <span className="block">Estimated delivery</span>
                        <span className="font-medium text-foreground">
                          {deliveryMonth && deliveryYear
                            ? `${deliveryMonth} ${deliveryYear}`
                            : "Month Year"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Create your rewards</h2>
        <Button variant="outline" onClick={openImportScreen}>
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

        {/* Items Tab */}
        <TabsContent value="items" className="pt-6">
          <div className="flex items-start justify-between mb-6">
            <div className="max-w-2xl">
              <p className="text-muted-foreground">
                Including items in your rewards and add-ons makes it easy for backers to understand and
                compare your offerings. An item can be anything you plan to offer your backers. Some
                examples include playing cards, a digital copy of a book, a ticket to a play, or even a
                thank-you in your documentary.
              </p>
              <a href="#" className="text-primary text-sm mt-2 inline-block hover:underline">
                Learn about creating items
              </a>
            </div>
            <Button onClick={openCreateItemDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New item
            </Button>
          </div>

          {items.length > 0 ? (
            <div className="border rounded-lg">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
                <div className="col-span-4">Details</div>
                <div className="col-span-5">Included in</div>
                <div className="col-span-3">Image</div>
              </div>

              {/* Table Body */}
              {items.map((item) => {
                const includedIn = getItemIncludedIn(item.id || "");
                return (
                  <div key={item.id} className="border-b last:border-b-0">
                    <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
                      {/* Details */}
                      <div className="col-span-4">
                        <p className="font-medium">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Included in */}
                      <div className="col-span-5 text-sm">
                        {includedIn.rewards.length > 0 && (
                          <div className="mb-2">
                            <p className="text-muted-foreground">Rewards</p>
                            <ul className="list-disc list-inside">
                              {includedIn.rewards.map((name, i) => (
                                <li key={i}>{name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {includedIn.addons.length > 0 && (
                          <div>
                            <p className="text-muted-foreground">Add-ons</p>
                            <ul className="list-disc list-inside">
                              {includedIn.addons.map((name, i) => (
                                <li key={i}>{name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {includedIn.rewards.length === 0 && includedIn.addons.length === 0 && (
                          <span className="text-muted-foreground italic">Not included in any rewards</span>
                        )}
                      </div>

                      {/* Image */}
                      <div className="col-span-3">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 pb-4 flex justify-end gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditItemDialog(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteItem(item.id || "")}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border rounded-lg p-12 text-center">
              <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No items yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create items to include in your reward tiers and add-ons.
              </p>
              <Button onClick={openCreateItemDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first item
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Reward Tiers Tab */}
        <TabsContent value="tiers" className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="max-w-2xl">
              <p className="text-muted-foreground">
                Most creators offer 3-10 reward tiers, which can be physical items or special experiences.
                Make sure to <a href="#" className="text-primary hover:underline">set reasonable backer expectations</a>.
              </p>
              <a href="#" className="text-primary text-sm mt-2 inline-block hover:underline">
                Learn about creating and managing rewards
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Import reward
              </Button>
              <Button onClick={() => openCreateRewardForm("TIER")}>
                <Plus className="h-4 w-4 mr-2" />
                New reward
              </Button>
            </div>
          </div>

          {tiers.length > 0 ? (
            <div className="border rounded-lg">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
                <div className="col-span-2">Pledge amount</div>
                <div className="col-span-4">Details</div>
                <div className="col-span-3">Includes</div>
                <div className="col-span-3">Image</div>
              </div>

              {/* Table Body */}
              {tiers.map((tier, idx) => {
                const rewardIndex = rewards.indexOf(tier);
                return (
                  <div key={idx} className="border-b last:border-b-0">
                    <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
                      {/* Pledge amount */}
                      <div className="col-span-2">
                        <p className="font-bold text-lg">${tier.amount}</p>
                      </div>

                      {/* Details */}
                      <div className="col-span-4">
                        <p className="font-medium">{tier.title}</p>
                        {tier.estimatedDelivery && (
                          <p className="text-sm text-muted-foreground">
                            Estimated delivery: {new Date(tier.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                        )}
                        {tier.shippingType === "NO_SHIPPING" && (
                          <p className="text-sm text-muted-foreground">Digital reward</p>
                        )}
                      </div>

                      {/* Includes */}
                      <div className="col-span-3">
                        {tier.items.length > 0 ? (
                          <ul className="list-disc list-inside text-sm">
                            {tier.items.map((item, i) => (
                              <li key={i}>{item.title}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No items</span>
                        )}
                      </div>

                      {/* Image */}
                      <div className="col-span-3">
                        {tier.imageUrl ? (
                          <Image
                            src={tier.imageUrl}
                            alt={tier.title}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="px-4 pb-3 flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {tier.backerCount || 0} backers
                        </span>
                        {tier.isEnded && (
                          <Badge variant="secondary" className="text-xs">Ended</Badge>
                        )}
                        {isLive && tier.backerCount && tier.backerCount > 0 && !tier.isEnded && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {!tier.isEnded && (
                          <>
                            <Button variant="ghost" size="sm">Feature</Button>
                            {isLive && tier.backerCount && tier.backerCount > 0 ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-orange-600">
                                    <Ban className="h-4 w-4 mr-1" />
                                    End Reward
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>End this reward?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This reward has {tier.backerCount} backer(s). Ending it will:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Keep the reward for existing backers</li>
                                        <li>Prevent new backers from selecting it</li>
                                        <li>This action cannot be undone</li>
                                      </ul>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleEndReward(rewardIndex)}
                                      className="bg-orange-600 hover:bg-orange-700"
                                    >
                                      End Reward
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditRewardForm(rewardIndex)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDuplicateReward(rewardIndex)}
                                >
                                  Duplicate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteReward(rewardIndex)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Example prompt */}
              <div className="border-t p-8 text-center">
                <button
                  className="text-primary hover:underline text-sm"
                  onClick={() => openCreateRewardForm("TIER")}
                >
                  + Example: a copy of what you&apos;re making
                </button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-12 text-center">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No reward tiers yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create reward tiers to give backers options when they support your project.
              </p>
              <Button onClick={() => openCreateRewardForm("TIER")}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first tier
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Add-ons Tab */}
        <TabsContent value="addons" className="pt-6">
          <div className="flex items-start justify-between mb-6">
            <div className="max-w-2xl">
              <p className="text-muted-foreground">
                Add-ons are optional rewards backers can add to their pledges—accessories, game expansion packs,
                movie posters, copies of an earlier publication—that complement their chosen reward tier.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                <Download className="h-4 w-4 mr-2" />
                Import add-on
              </Button>
              <Button onClick={() => openCreateRewardForm("ADDON")}>
                <Plus className="h-4 w-4 mr-2" />
                New add-on
              </Button>
            </div>
          </div>

          {addons.length > 0 ? (
            <div className="border rounded-lg">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
                <div className="col-span-2">Pledge amount</div>
                <div className="col-span-4">Details</div>
                <div className="col-span-3">Includes</div>
                <div className="col-span-3">Image</div>
              </div>

              {/* Table Body */}
              {addons.map((addon, idx) => {
                const rewardIndex = rewards.indexOf(addon);
                return (
                  <div key={idx} className="border-b last:border-b-0">
                    <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
                      {/* Pledge amount */}
                      <div className="col-span-2">
                        <p className="font-bold text-lg">${addon.amount}</p>
                      </div>

                      {/* Details */}
                      <div className="col-span-4">
                        <p className="font-medium">{addon.title}</p>
                        {addon.estimatedDelivery && (
                          <p className="text-sm text-muted-foreground">
                            Estimated delivery: {new Date(addon.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>

                      {/* Includes */}
                      <div className="col-span-3">
                        {addon.items.length > 0 ? (
                          <ul className="list-disc list-inside text-sm">
                            {addon.items.map((item, i) => (
                              <li key={i}>{item.title}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No items</span>
                        )}
                      </div>

                      {/* Image */}
                      <div className="col-span-3">
                        {addon.imageUrl ? (
                          <Image
                            src={addon.imageUrl}
                            alt={addon.title}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="px-4 pb-3 flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {addon.backerCount || 0} backers
                        </span>
                        {addon.isEnded && (
                          <Badge variant="secondary" className="text-xs">Ended</Badge>
                        )}
                        {isLive && addon.backerCount && addon.backerCount > 0 && !addon.isEnded && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {!addon.isEnded && (
                          <>
                            {isLive && addon.backerCount && addon.backerCount > 0 ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-orange-600">
                                    <Ban className="h-4 w-4 mr-1" />
                                    End Add-on
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>End this add-on?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This add-on has {addon.backerCount} backer(s). Ending it will:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>Keep the add-on for existing backers</li>
                                        <li>Prevent new backers from selecting it</li>
                                        <li>This action cannot be undone</li>
                                      </ul>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleEndReward(rewardIndex)}
                                      className="bg-orange-600 hover:bg-orange-700"
                                    >
                                      End Add-on
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditRewardForm(rewardIndex)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDuplicateReward(rewardIndex)}
                                >
                                  Duplicate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteReward(rewardIndex)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Example prompt cards */}
              <button
                onClick={() => openCreateRewardForm("ADDON")}
                className="w-full p-4 border border-dashed rounded-lg hover:bg-muted/50 text-left transition-colors group"
              >
                <span className="text-primary group-hover:underline">
                  + Example: a copy of what you&apos;re making
                </span>
              </button>
              <button
                onClick={() => openCreateRewardForm("ADDON")}
                className="w-full p-4 border border-dashed rounded-lg hover:bg-muted/50 text-left transition-colors group"
              >
                <span className="text-primary group-hover:underline">
                  + Example: a behind-the-scenes peek in writing, photos, or video
                </span>
              </button>
              <button
                onClick={() => openCreateRewardForm("ADDON")}
                className="w-full p-4 border border-dashed rounded-lg hover:bg-muted/50 text-left transition-colors group"
              >
                <span className="text-primary group-hover:underline">
                  + Example: an exclusive experience or object
                </span>
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItemId ? "Edit item" : "Create new item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-title">Title *</Label>
              <Input
                id="item-title"
                placeholder="e.g., Digital Download, Physical Copy"
                value={currentItem.title}
                onChange={(e) =>
                  setCurrentItem({ ...currentItem, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                placeholder="Describe this item..."
                rows={3}
                value={currentItem.description || ""}
                onChange={(e) =>
                  setCurrentItem({ ...currentItem, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Item Image</Label>
              <ImageUpload
                value={currentItem.imageUrl}
                onChange={(url) => setCurrentItem({ ...currentItem, imageUrl: url })}
                aspectRatio="aspect-square"
                recommendedSize="400 x 400 px"
                maxSizeMB={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>
              {editingItemId ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Reward Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {activeTab === "addons" ? "Copy add-on from project" : "Copy reward from other project"}
            </DialogTitle>
            <DialogDescription>
              {activeTab === "addons"
                ? "Copy a reward tier from this project as an add-on, or import from another project."
                : "Select a reward from another project of yours to copy into this project. Copying rewards will also copy included items."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-2">
              {/* Current Project - only show when on add-ons tab */}
              {activeTab === "addons" && (
                <Collapsible
                  open={expandedProject === "current"}
                  onOpenChange={(open) => setExpandedProject(open ? "current" : null)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50">
                    <span className="font-medium">Current Project</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedProject === "current" && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 ml-4 space-y-2">
                    {tiers.length > 0 ? (
                      tiers.map((tier, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                          onClick={() => handleImportFromCurrentProject(idx)}
                        >
                          <div>
                            <p className="font-medium">{tier.title}</p>
                            <p className="text-sm text-muted-foreground">${tier.amount}</p>
                          </div>
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-3">
                        No reward tiers to copy. Create reward tiers first.
                      </p>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Previous Projects */}
              {mockPreviousProjects.map((project) => (
                <Collapsible
                  key={project.id}
                  open={expandedProject === project.id}
                  onOpenChange={(open) => setExpandedProject(open ? project.id : null)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50">
                    <span className="font-medium">{project.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedProject === project.id && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 ml-4 space-y-2">
                    {project.rewards.map((reward, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => handleImportReward(project.id, idx)}
                      >
                        <div>
                          <p className="font-medium">{reward.title}</p>
                          <p className="text-sm text-muted-foreground">${reward.amount}</p>
                        </div>
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {mockPreviousProjects.length === 0 && activeTab !== "addons" && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No previous projects found.</p>
                  <p className="text-sm">Create rewards in other projects first to import them here.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
