"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { RewardData, RewardItemData, RewardType, ShippingType, Visibility } from "@/types";
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
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Gift, Package, Box, Image as ImageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const defaultItem: RewardItemData = {
  title: "",
  description: "",
  imageUrl: "",
};

const defaultReward: RewardData = {
  type: "TIER",
  title: "",
  description: "",
  amount: 0,
  shippingType: "NO_SHIPPING",
  shippingCountries: [],
  shippingCost: 0,
  visibility: "PUBLIC",
  items: [],
};

export function RewardsStep() {
  const {
    items,
    rewards,
    addItem,
    updateItem,
    removeItem,
    addReward,
    updateReward,
    removeReward,
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<"items" | "tiers" | "addons">("items");

  // Item dialog state
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<RewardItemData>(defaultItem);

  // Reward dialog state
  const [isRewardDialogOpen, setIsRewardDialogOpen] = useState(false);
  const [editingRewardIndex, setEditingRewardIndex] = useState<number | null>(null);
  const [currentReward, setCurrentReward] = useState<RewardData>(defaultReward);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

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
  const openCreateRewardDialog = (type: RewardType) => {
    setCurrentReward({ ...defaultReward, type });
    setSelectedItemIds([]);
    setEditingRewardIndex(null);
    setIsRewardDialogOpen(true);
  };

  const openEditRewardDialog = (index: number) => {
    const reward = rewards[index];
    setCurrentReward(reward);
    setSelectedItemIds(reward.items.map((i) => i.id || "").filter(Boolean));
    setEditingRewardIndex(index);
    setIsRewardDialogOpen(true);
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

    // Get selected items from the items array
    const selectedItems = items.filter((i) => selectedItemIds.includes(i.id || ""));

    const rewardToSave = {
      ...currentReward,
      items: selectedItems,
    };

    if (editingRewardIndex !== null) {
      updateReward(editingRewardIndex, rewardToSave);
      toast.success("Reward updated");
    } else {
      addReward(rewardToSave);
      toast.success("Reward created");
    }

    setIsRewardDialogOpen(false);
    setCurrentReward(defaultReward);
    setSelectedItemIds([]);
  };

  const handleDeleteReward = (index: number) => {
    removeReward(index);
    toast.success("Reward deleted");
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Create your rewards</h2>
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
                          <img
                            src={item.imageUrl}
                            alt={item.title}
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
          <div className="flex items-start justify-between mb-6">
            <div className="max-w-2xl">
              <p className="text-muted-foreground">
                Reward tiers are the main pledge options for backers. Each backer selects one tier
                when they back your project. Create tiers at different price points to give backers
                options.
              </p>
            </div>
            <Button onClick={() => openCreateRewardDialog("TIER")}>
              <Plus className="h-4 w-4 mr-2" />
              New reward tier
            </Button>
          </div>

          {tiers.length > 0 ? (
            <div className="grid gap-4">
              {tiers.map((tier, idx) => {
                const rewardIndex = rewards.indexOf(tier);
                return (
                  <Card key={idx}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{tier.title}</CardTitle>
                          <p className="text-xl font-bold text-primary">
                            {formatCurrency(tier.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {tier.visibility === "SECRET" && (
                            <Badge variant="secondary">Secret</Badge>
                          )}
                          {tier.quantityAvailable && (
                            <Badge variant="outline">Limited: {tier.quantityAvailable}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {tier.description && (
                        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                          {tier.description}
                        </p>
                      )}
                      {tier.items.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Includes:</p>
                          <div className="flex flex-wrap gap-1">
                            {tier.items.map((item, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {item.title}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRewardDialog(rewardIndex)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteReward(rewardIndex)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="border rounded-lg p-12 text-center">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No reward tiers yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create reward tiers to give backers options when they support your project.
              </p>
              <Button onClick={() => openCreateRewardDialog("TIER")}>
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
                Add-ons are optional extras that backers can add to their pledge. They can select
                multiple add-ons in addition to their reward tier.
              </p>
            </div>
            <Button onClick={() => openCreateRewardDialog("ADDON")}>
              <Plus className="h-4 w-4 mr-2" />
              New add-on
            </Button>
          </div>

          {addons.length > 0 ? (
            <div className="grid gap-4">
              {addons.map((addon, idx) => {
                const rewardIndex = rewards.indexOf(addon);
                return (
                  <Card key={idx}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{addon.title}</CardTitle>
                          <p className="text-xl font-bold text-primary">
                            {formatCurrency(addon.amount)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {addon.quantityAvailable && (
                            <Badge variant="outline">Limited: {addon.quantityAvailable}</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {addon.description && (
                        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                          {addon.description}
                        </p>
                      )}
                      {addon.items.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">Includes:</p>
                          <div className="flex flex-wrap gap-1">
                            {addon.items.map((item, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {item.title}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRewardDialog(rewardIndex)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteReward(rewardIndex)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="border rounded-lg p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No add-ons yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Create add-ons to let backers customize their pledge with optional extras.
              </p>
              <Button onClick={() => openCreateRewardDialog("ADDON")}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first add-on
              </Button>
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
              <Label htmlFor="item-image">Image URL</Label>
              <Input
                id="item-image"
                placeholder="https://..."
                value={currentItem.imageUrl || ""}
                onChange={(e) =>
                  setCurrentItem({ ...currentItem, imageUrl: e.target.value })
                }
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

      {/* Reward/Add-on Dialog */}
      <Dialog open={isRewardDialogOpen} onOpenChange={setIsRewardDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingRewardIndex !== null ? "Edit" : "Create"}{" "}
              {currentReward.type === "TIER" ? "reward tier" : "add-on"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="reward-title">Title *</Label>
              <Input
                id="reward-title"
                placeholder="e.g., Early Bird Special"
                value={currentReward.title}
                onChange={(e) =>
                  setCurrentReward({ ...currentReward, title: e.target.value })
                }
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="reward-amount">Pledge Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="reward-amount"
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

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="reward-description">Description</Label>
              <Textarea
                id="reward-description"
                placeholder="Describe what backers will receive..."
                rows={3}
                value={currentReward.description}
                onChange={(e) =>
                  setCurrentReward({
                    ...currentReward,
                    description: e.target.value,
                  })
                }
              />
            </div>

            {/* Items Selection */}
            {items.length > 0 && (
              <div className="space-y-2">
                <Label>Include items</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={selectedItemIds.includes(item.id || "")}
                        onCheckedChange={() => toggleItemSelection(item.id || "")}
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {item.title}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estimated Delivery */}
            <div className="space-y-2">
              <Label htmlFor="reward-delivery">Estimated Delivery</Label>
              <Input
                id="reward-delivery"
                type="month"
                value={
                  currentReward.estimatedDelivery
                    ? new Date(currentReward.estimatedDelivery)
                        .toISOString()
                        .slice(0, 7)
                    : ""
                }
                onChange={(e) =>
                  setCurrentReward({
                    ...currentReward,
                    estimatedDelivery: new Date(e.target.value + "-01"),
                  })
                }
              />
            </div>

            {/* Shipping Type */}
            <div className="space-y-2">
              <Label>Shipping</Label>
              <Select
                value={currentReward.shippingType}
                onValueChange={(value) =>
                  setCurrentReward({
                    ...currentReward,
                    shippingType: value as ShippingType,
                  })
                }
              >
                <SelectTrigger>
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
            </div>

            {currentReward.shippingType !== "NO_SHIPPING" && (
              <div className="space-y-2">
                <Label htmlFor="shipping-cost">Shipping Cost</Label>
                <div className="relative">
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

            {/* Quantity Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="limited-quantity">Limited Quantity</Label>
                <Switch
                  id="limited-quantity"
                  checked={currentReward.quantityAvailable !== undefined}
                  onCheckedChange={(checked) =>
                    setCurrentReward({
                      ...currentReward,
                      quantityAvailable: checked ? 100 : undefined,
                    })
                  }
                />
              </div>
              {currentReward.quantityAvailable !== undefined && (
                <Input
                  type="number"
                  placeholder="Available quantity"
                  value={currentReward.quantityAvailable || ""}
                  onChange={(e) =>
                    setCurrentReward({
                      ...currentReward,
                      quantityAvailable: parseInt(e.target.value) || undefined,
                    })
                  }
                />
              )}
            </div>

            {/* Visibility (only for tiers) */}
            {currentReward.type === "TIER" && (
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select
                  value={currentReward.visibility}
                  onValueChange={(value) =>
                    setCurrentReward({
                      ...currentReward,
                      visibility: value as Visibility,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Available to all backers</SelectItem>
                    <SelectItem value="SECRET">
                      Secret (only via direct link)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRewardDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReward}>
              {editingRewardIndex !== null ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
