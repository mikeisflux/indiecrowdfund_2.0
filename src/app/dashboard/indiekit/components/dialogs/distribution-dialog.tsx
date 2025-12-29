"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { DigitalFile } from "../../types";

interface DistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  digitalFiles: DigitalFile[];
  projectId?: string;
  products?: { id: string; name: string }[];
  onCreated?: () => void;
}

export function DistributionDialog({
  open,
  onOpenChange,
  digitalFiles,
  projectId,
  products = [],
  onCreated,
}: DistributionDialogProps) {
  const [ruleName, setRuleName] = useState("");
  const [triggerProduct, setTriggerProduct] = useState("");
  const [fileToDistribute, setFileToDistribute] = useState("");
  const [requirePayment, setRequirePayment] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form
      setRuleName("");
      setTriggerProduct("");
      setFileToDistribute("");
      setRequirePayment(true);
    }
    onOpenChange(isOpen);
  };

  const handleCreate = async () => {
    if (!ruleName.trim()) {
      toast.error("Please enter a rule name");
      return;
    }
    if (!triggerProduct) {
      toast.error("Please select a trigger product");
      return;
    }
    if (!fileToDistribute) {
      toast.error("Please select a file to distribute");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/creator/indiekit/digital", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "create_distribution_rule",
          ruleName,
          triggerProduct,
          fileId: fileToDistribute,
          requirePayment,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create distribution rule");
      }

      toast.success("Distribution rule created");
      handleClose(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create rule");
    } finally {
      setIsCreating(false);
    }
  };

  // Use provided products or default to sample data
  const availableProducts = products.length > 0 ? products : [
    { id: "product1", name: "Digital Art Book" },
    { id: "product2", name: "Soundtrack Album" },
    { id: "product3", name: "E-Book Bundle" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
            <Input
              id="rule-name"
              placeholder="e.g., Digital Art Book Distribution"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Trigger Product</Label>
            <Select value={triggerProduct} onValueChange={setTriggerProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product..." />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When this product is in the order, the file will be distributed
            </p>
          </div>
          <div className="space-y-2">
            <Label>File to Distribute</Label>
            <Select value={fileToDistribute} onValueChange={setFileToDistribute}>
              <SelectTrigger>
                <SelectValue placeholder="Select a file..." />
              </SelectTrigger>
              <SelectContent>
                {digitalFiles.length > 0 ? (
                  digitalFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No files uploaded yet</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="require-payment"
              checked={requirePayment}
              onCheckedChange={(checked) => setRequirePayment(checked as boolean)}
            />
            <Label htmlFor="require-payment" className="text-sm cursor-pointer">
              Require payment/lockdown before distribution
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleCreate}
            disabled={isCreating || !ruleName.trim() || !triggerProduct || !fileToDistribute}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Rule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
