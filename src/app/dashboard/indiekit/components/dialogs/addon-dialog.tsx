"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { SurveyAddon } from "../../types";

interface AddonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAddon?: SurveyAddon | null;
  projectId?: string;
  onSave?: () => void;
}

export function AddonDialog({
  open,
  onOpenChange,
  editingAddon,
  projectId,
  onSave,
}: AddonDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantityLimit, setQuantityLimit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = !!editingAddon;

  // Populate form when editing
  useEffect(() => {
    if (editingAddon) {
      setName(editingAddon.name);
      setDescription(editingAddon.description);
      setPrice(editingAddon.price.toString());
      setQuantityLimit(editingAddon.quantityLimit?.toString() || "");
      setIsActive(editingAddon.available);
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setQuantityLimit("");
      setIsActive(true);
    }
  }, [editingAddon, open]);

  const handleSubmit = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    if (!name.trim()) {
      toast.error("Please enter an add-on name");
      return;
    }

    if (!price || parseFloat(price) < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/addons", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          ...(isEditing && { addonId: editingAddon.id }),
          name: name.trim(),
          description: description.trim(),
          price: parseFloat(price),
          quantityLimit: quantityLimit ? parseInt(quantityLimit) : null,
          available: isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} add-on`);
      }

      toast.success(`Add-on ${isEditing ? "updated" : "created"} successfully`);
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Add-on" : "Create Survey Add-on"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this add-on"
              : "Add a product that backers can purchase during their survey"
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="addon-name">Add-on Name *</Label>
            <Input
              id="addon-name"
              placeholder="e.g., Extra Sticker Pack"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addon-description">Description</Label>
            <Textarea
              id="addon-description"
              placeholder="Brief description of the add-on"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addon-price">Price ($) *</Label>
              <Input
                id="addon-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-limit">Quantity Limit (optional)</Label>
              <Input
                id="addon-limit"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={quantityLimit}
                onChange={(e) => setQuantityLimit(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="addon-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="addon-active" className="text-sm">
              {isEditing ? "Available for purchase" : "Make available immediately"}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? "Saving..." : "Creating..."}
              </>
            ) : (
              isEditing ? "Save Changes" : "Create Add-on"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
