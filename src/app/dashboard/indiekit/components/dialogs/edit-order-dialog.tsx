"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Edit,
  Package,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Truck,
  Save,
  Loader2,
  AlertTriangle,
  DollarSign,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface AddonEntry {
  id: string;
  name: string;
  quantity: number;
  amount: number;
  isModifier?: boolean;
}

interface AvailableAddon {
  id: string;
  name: string;
  price: number;
}

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pledgeId: string;
  projectId: string;
  backerName: string;
  reward: { name: string; amount: number } | null;
  currentAddons: AddonEntry[];
  availableAddons: AvailableAddon[];
  shippingAmount: number;
  onSaved?: () => void;
  onRefundNeeded?: (amount: number) => void;
}

export function EditOrderDialog({
  open,
  onOpenChange,
  pledgeId,
  projectId,
  backerName,
  reward,
  currentAddons,
  availableAddons,
  shippingAmount: initialShipping,
  onSaved,
  onRefundNeeded,
}: EditOrderDialogProps) {
  const [addons, setAddons] = useState<AddonEntry[]>([]);
  const [shippingAmount, setShippingAmount] = useState(initialShipping);
  const [addonToAdd, setAddonToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [showRefundPrompt, setShowRefundPrompt] = useState(false);
  const [refundOwed, setRefundOwed] = useState(0);

  // Reset state when dialog opens with new data
  const resetState = useCallback(() => {
    setAddons(currentAddons.map(a => ({ ...a })));
    setShippingAmount(initialShipping);
    setAddonToAdd("");
    setShowRefundPrompt(false);
    setRefundOwed(0);
  }, [currentAddons, initialShipping]);

  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, resetState]);

  const rewardAmount = reward?.amount || 0;
  const addonsTotal = addons.reduce((sum, a) => sum + (a.amount * a.quantity), 0);
  const orderTotal = rewardAmount + addonsTotal + shippingAmount;

  // Addons not already in the order
  const addableAddons = availableAddons.filter(
    aa => !addons.some(a => a.id === aa.id)
  );

  const updateAddonQuantity = (addonId: string, delta: number) => {
    setAddons(prev => prev.map(a => {
      if (a.id === addonId) {
        const newQty = Math.max(0, a.quantity + delta);
        return { ...a, quantity: newQty };
      }
      return a;
    }).filter(a => a.quantity > 0));
  };

  const removeAddon = (addonId: string) => {
    setAddons(prev => prev.filter(a => a.id !== addonId));
  };

  const addAddon = () => {
    if (!addonToAdd) return;

    const addon = availableAddons.find(a => a.id === addonToAdd);
    if (!addon) return;

    const existing = addons.find(a => a.id === addon.id);
    if (existing) {
      updateAddonQuantity(addon.id, 1);
    } else {
      setAddons(prev => [...prev, {
        id: addon.id,
        name: addon.name,
        quantity: 1,
        amount: addon.price,
      }]);
    }

    setAddonToAdd("");
    toast.success(`Added ${addon.name} to order`);
  };

  const hasChanges = () => {
    if (shippingAmount !== initialShipping) return true;
    if (addons.length !== currentAddons.length) return true;
    for (const addon of addons) {
      const original = currentAddons.find(a => a.id === addon.id);
      if (!original || original.quantity !== addon.quantity) return true;
    }
    return false;
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      toast.info("No changes to save");
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      // Build the full addon list including removed ones (qty 0)
      const addonUpdates: { addonId: string; quantity: number }[] = [];

      // Include current addons with their new quantities
      for (const addon of addons) {
        addonUpdates.push({ addonId: addon.id, quantity: addon.quantity });
      }

      // Mark removed addons as quantity 0
      for (const original of currentAddons) {
        if (!addons.some(a => a.id === original.id)) {
          addonUpdates.push({ addonId: original.id, quantity: 0 });
        }
      }

      const res = await fetch("/api/creator/indiekit/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          pledgeId,
          projectId,
          addons: addonUpdates,
          shippingAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update order");
      }

      const data = await res.json();
      toast.success("Order updated successfully");
      onSaved?.();

      // Check if items were removed resulting in a credit owed to the backer
      if (data.balanceChange < 0) {
        const creditAmount = Math.abs(data.balanceChange);
        setRefundOwed(creditAmount);
        setShowRefundPrompt(true);
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Save order error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setSaving(false);
    }
  };

  const handleIssueRefund = () => {
    setShowRefundPrompt(false);
    onOpenChange(false);
    onRefundNeeded?.(refundOwed);
  };

  const handleSkipRefund = () => {
    setShowRefundPrompt(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-teal-600" />
            Edit Order
          </DialogTitle>
          <DialogDescription>
            Modify add-ons and shipping for {backerName}&apos;s order
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="items" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="items">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Items & Add-ons
            </TabsTrigger>
            <TabsTrigger value="shipping">
              <Truck className="h-4 w-4 mr-2" />
              Shipping
            </TabsTrigger>
          </TabsList>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            {/* Main Reward (read-only) */}
            {reward && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Pledge Level</Label>
                <div className="p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{reward.name}</p>
                      <p className="text-xs text-muted-foreground">Main reward (not editable here)</p>
                    </div>
                    <p className="font-medium">${rewardAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Current Add-ons */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Add-ons ({addons.length})
              </Label>
              {addons.length === 0 ? (
                <div className="text-center py-6 border rounded-lg">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No add-ons in this order</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {addons.map((addon) => (
                    <div key={addon.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {addon.name}
                          {addon.isModifier && (
                            <Badge variant="secondary" className="text-xs">Modifier</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">${addon.amount.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateAddonQuantity(addon.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{addon.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateAddonQuantity(addon.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-right w-20">
                        <p className="font-medium">${(addon.amount * addon.quantity).toFixed(2)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeAddon(addon.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Addon */}
            {addableAddons.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Add an Add-on</Label>
                <div className="flex gap-2">
                  <Select value={addonToAdd} onValueChange={setAddonToAdd}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an add-on to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {addableAddons.map((addon) => (
                        <SelectItem key={addon.id} value={addon.id}>
                          {addon.name} - ${addon.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={addAddon}
                    disabled={!addonToAdd}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Shipping Tab */}
          <TabsContent value="shipping" className="space-y-4">
            <div className="space-y-2">
              <Label>Shipping Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingAmount}
                  onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Adjust shipping costs for this order. Original: ${initialShipping.toFixed(2)}
              </p>
            </div>

            {/* Quick shipping options */}
            <div className="space-y-2">
              <Label className="text-sm">Quick Set</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(0)}>
                  Free Shipping
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(5)}>
                  $5.00
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(10)}>
                  $10.00
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(15)}>
                  $15.00
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(25)}>
                  $25.00 (International)
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Order Summary */}
        <div className="rounded-lg border p-4 mt-4">
          <h4 className="font-medium mb-3">Order Summary</h4>
          <div className="space-y-2 text-sm">
            {reward && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pledge Level</span>
                <span>${rewardAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Add-ons ({addons.reduce((s, a) => s + a.quantity, 0)})
              </span>
              <span>${addonsTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>${shippingAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-medium">
              <span>Total</span>
              <span className="text-teal-600">${orderTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Refund Prompt - shown after save when items were removed */}
        {showRefundPrompt && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 mt-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Credit Owed to Backer
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This order change results in a <strong>${refundOwed.toFixed(2)}</strong> credit owed to {backerName}. Would you like to issue a refund now?
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleSkipRefund}>
                Skip for Now
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleIssueRefund}
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Issue Refund (${refundOwed.toFixed(2)})
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {showRefundPrompt ? null : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleSave}
                disabled={saving || !hasChanges()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
