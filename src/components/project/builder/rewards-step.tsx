"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { RewardData, RewardType, ShippingType, Visibility } from "@/types";
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
import { Plus, Copy, Trash2, Edit, Gift, Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

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
  const { rewards, addReward, updateReward, removeReward, copyRewardToAddon } =
    useProjectStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentReward, setCurrentReward] = useState<RewardData>(defaultReward);
  const [activeTab, setActiveTab] = useState<"tiers" | "addons">("tiers");

  const tiers = rewards.filter((r) => r.type === "TIER");
  const addons = rewards.filter((r) => r.type === "ADDON");

  const openCreateDialog = (type: RewardType) => {
    setCurrentReward({ ...defaultReward, type });
    setEditingIndex(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setCurrentReward(rewards[index]);
    setEditingIndex(index);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!currentReward.title || !currentReward.amount) {
      toast.error("Please fill in title and amount");
      return;
    }

    if (editingIndex !== null) {
      updateReward(editingIndex, currentReward);
      toast.success("Reward updated");
    } else {
      addReward(currentReward);
      toast.success("Reward added");
    }

    setIsDialogOpen(false);
    setCurrentReward(defaultReward);
  };

  const handleCopyToAddon = (index: number) => {
    copyRewardToAddon(index);
    toast.success("Reward copied to Add-ons");
    setActiveTab("addons");
  };

  const handleDelete = (index: number) => {
    removeReward(index);
    toast.success("Reward removed");
  };

  const renderRewardCard = (reward: RewardData, index: number) => (
    <Card key={index} className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{reward.title}</CardTitle>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(reward.amount)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reward.visibility === "SECRET" && (
              <Badge variant="secondary">Secret</Badge>
            )}
            {reward.quantityAvailable && (
              <Badge variant="outline">Limited: {reward.quantityAvailable}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
          {reward.description}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(rewards.indexOf(reward))}
          >
            <Edit className="mr-1 h-3 w-3" />
            Edit
          </Button>
          {reward.type === "TIER" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyToAddon(rewards.indexOf(reward))}
            >
              <Copy className="mr-1 h-3 w-3" />
              Copy to Add-ons
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(rewards.indexOf(reward))}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tiers" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Reward Tiers ({tiers.length})
          </TabsTrigger>
          <TabsTrigger value="addons" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Add-ons ({addons.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Reward tiers are the main pledge options for backers. Each backer selects one tier.
          </p>
          <div className="grid gap-4">
            {tiers.map((reward) => renderRewardCard(reward, rewards.indexOf(reward)))}
          </div>
          <Button onClick={() => openCreateDialog("TIER")} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Reward Tier
          </Button>
        </TabsContent>

        <TabsContent value="addons" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Add-ons are optional extras that backers can add to their pledge. They can select multiple add-ons.
          </p>
          <div className="grid gap-4">
            {addons.map((reward) => renderRewardCard(reward, rewards.indexOf(reward)))}
          </div>
          <Button onClick={() => openCreateDialog("ADDON")} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Optional Add-on
          </Button>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit" : "Create"}{" "}
              {currentReward.type === "TIER" ? "Reward Tier" : "Add-on"}
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

            {/* Visibility */}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingIndex !== null ? "Save Changes" : "Add Reward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
