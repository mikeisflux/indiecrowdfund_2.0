"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { RewardItemData } from "@/types";

interface ItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentItem: RewardItemData;
  onItemChange: (item: RewardItemData) => void;
  onSave: () => void;
  isSaving: boolean;
  isEditing: boolean;
  projectId?: string;
}

export function ItemDialog({
  isOpen,
  onOpenChange,
  currentItem,
  onItemChange,
  onSave,
  isSaving,
  isEditing,
  projectId,
}: ItemDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-[500px] z-[200]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit item" : "Create new item"}
          </DialogTitle>
          <DialogDescription>
            Items can be included in rewards or add-ons. Define the item details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-title">Title *</Label>
            <Input
              id="item-title"
              placeholder="e.g., Digital Download, Physical Copy"
              value={currentItem.title}
              onChange={(e) =>
                onItemChange({ ...currentItem, title: e.target.value })
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
                onItemChange({ ...currentItem, description: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Item Image</Label>
            <ImageUpload
              value={currentItem.imageUrl}
              onChange={(url) => onItemChange({ ...currentItem, imageUrl: url })}
              projectId={projectId}
              uploadType="item"
              aspectRatio="aspect-[933/621]"
              recommendedSize="933 x 621 px (required size)"
              maxSizeMB={10}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSaving ? "Saving..." : (isEditing ? "Save changes" : "Create item")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
