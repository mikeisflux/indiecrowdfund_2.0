"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AddonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddonDialog({ open, onOpenChange }: AddonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Survey Add-on</DialogTitle>
          <DialogDescription>
            Add a product that backers can purchase during their survey
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="addon-name">Add-on Name</Label>
            <Input id="addon-name" placeholder="e.g., Extra Sticker Pack" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addon-description">Description</Label>
            <Input id="addon-description" placeholder="Brief description of the add-on" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addon-price">Price ($)</Label>
              <Input id="addon-price" type="number" placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-limit">Quantity Limit (optional)</Label>
              <Input id="addon-limit" type="number" placeholder="Unlimited" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="addon-active" defaultChecked />
            <Label htmlFor="addon-active" className="text-sm">Make available immediately</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            Create Add-on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
