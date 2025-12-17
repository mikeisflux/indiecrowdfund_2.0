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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DigitalFile } from "../../types";

interface DistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  digitalFiles: DigitalFile[];
}

export function DistributionDialog({ open, onOpenChange, digitalFiles }: DistributionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Distribution Rule</DialogTitle>
          <DialogDescription>
            Set up automatic file distribution based on order contents
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input id="rule-name" placeholder="e.g., Digital Art Book Distribution" />
          </div>
          <div className="space-y-2">
            <Label>Trigger Product</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a product..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product1">Digital Art Book</SelectItem>
                <SelectItem value="product2">Soundtrack Album</SelectItem>
                <SelectItem value="product3">E-Book Bundle</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When this product is in the order, the file will be distributed
            </p>
          </div>
          <div className="space-y-2">
            <Label>File to Distribute</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a file..." />
              </SelectTrigger>
              <SelectContent>
                {digitalFiles.map((file) => (
                  <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="require-payment" />
            <Label htmlFor="require-payment" className="text-sm">
              Require payment/lockdown before distribution
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            Create Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
