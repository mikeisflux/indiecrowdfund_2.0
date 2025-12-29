"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  rewards?: { id: string; name: string; amount: number }[];
  addons?: { id: string; name: string; price: number }[];
  onCreated?: () => void;
}

export function DistributionDialog({
  open,
  onOpenChange,
  digitalFiles,
  projectId,
  rewards = [],
  addons = [],
  onCreated,
}: DistributionDialogProps) {
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState<"all" | "rewards" | "addons">("all");
  const [triggerProduct, setTriggerProduct] = useState("");
  const [fileToDistribute, setFileToDistribute] = useState("");
  const [requirePayment, setRequirePayment] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form
      setRuleName("");
      setTriggerType("all");
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
    if (triggerType !== "all" && !triggerProduct) {
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
          triggerType,
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

  // Get available products based on trigger type selection
  const availableProducts = useMemo(() => {
    switch (triggerType) {
      case "rewards":
        return rewards.map(r => ({
          id: `reward:${r.id}`,
          name: `${r.name} ($${r.amount})`,
          type: "reward" as const
        }));
      case "addons":
        return addons.map(a => ({
          id: `addon:${a.id}`,
          name: `${a.name} ($${a.price})`,
          type: "addon" as const
        }));
      case "all":
      default:
        return [
          ...rewards.map(r => ({
            id: `reward:${r.id}`,
            name: `${r.name} ($${r.amount})`,
            type: "reward" as const
          })),
          ...addons.map(a => ({
            id: `addon:${a.id}`,
            name: `${a.name} ($${a.price})`,
            type: "addon" as const
          })),
        ];
    }
  }, [triggerType, rewards, addons]);

  // Reset product selection when trigger type changes
  const handleTriggerTypeChange = (value: string) => {
    setTriggerType(value as "all" | "rewards" | "addons");
    setTriggerProduct(""); // Reset selection
  };

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

          <div className="space-y-3">
            <Label>Distribution Target</Label>
            <RadioGroup value={triggerType} onValueChange={handleTriggerTypeChange} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="trigger-all" />
                <Label htmlFor="trigger-all" className="cursor-pointer font-normal">All</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rewards" id="trigger-rewards" />
                <Label htmlFor="trigger-rewards" className="cursor-pointer font-normal">Rewards Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="addons" id="trigger-addons" />
                <Label htmlFor="trigger-addons" className="cursor-pointer font-normal">Add-ons Only</Label>
              </div>
            </RadioGroup>
          </div>

          {triggerType !== "all" && (
            <div className="space-y-2">
              <Label>Trigger Product</Label>
              <Select value={triggerProduct} onValueChange={setTriggerProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {availableProducts.length > 0 ? (
                    availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <span className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            product.type === "reward"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {product.type === "reward" ? "Reward" : "Add-on"}
                          </span>
                          {product.name}
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      {triggerType === "rewards" ? "No rewards found" : "No add-ons found"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When this product is in the order, the file will be distributed
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>File to Distribute</Label>
            <Select value={fileToDistribute} onValueChange={setFileToDistribute}>
              <SelectTrigger>
                <SelectValue placeholder="Select a file..." />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
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
            disabled={isCreating || !ruleName.trim() || (triggerType !== "all" && !triggerProduct) || !fileToDistribute}
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
