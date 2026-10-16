"use client";

import { apiFetch } from "@/lib/fetch-utils";
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
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
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
  // One rule per file: the first select is required, "+ Add another file"
  // appends more. Each file becomes its own rule with the same trigger so
  // the rules table still reads "If X is in the order, distribute Y".
  const [filesToDistribute, setFilesToDistribute] = useState<string[]>([""]);
  const [requirePayment, setRequirePayment] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form
      setRuleName("");
      setTriggerType("all");
      setTriggerProduct("");
      setFilesToDistribute([""]);
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
    const fileIds = Array.from(new Set(filesToDistribute.filter(Boolean)));
    if (fileIds.length === 0) {
      toast.error("Please select a file to distribute");
      return;
    }

    setIsCreating(true);
    let created = 0;
    try {
      for (const fileId of fileIds) {
        const fileName = digitalFiles.find((f) => f.id === fileId)?.name;
        const res = await apiFetch("/api/creator/indiekit/digital", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            action: "create_distribution_rule",
            // Several files under one name get the file name appended so
            // the rules list tells them apart.
            ruleName: fileIds.length > 1 && fileName ? `${ruleName.trim()} — ${fileName}` : ruleName.trim(),
            triggerProduct,
            triggerType,
            fileId,
            requirePayment,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create distribution rule");
        }
        created++;
      }

      toast.success(created === 1 ? "Distribution rule created" : `${created} distribution rules created`);
      handleClose(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create rule");
      if (created > 0) {
        // Some rules landed before the failure; show them.
        onCreated?.();
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Only files that are actually in storage. A row still uploading (or a
  // failed one) has nothing to hand out and must not be pickable.
  const readyFiles = digitalFiles.filter((f) => (f.uploadStatus ?? "READY") === "READY");
  const hasFileSelected = filesToDistribute.some(Boolean);
  const canAddAnother =
    filesToDistribute.every(Boolean) && filesToDistribute.length < readyFiles.length;

  // Get available products based on trigger type selection
  const availableProducts = useMemo(() => {
    switch (triggerType) {
      case "rewards":
        return rewards.map(r => ({
          id: `reward:${r.id}`,
          name: `${r.name} ($${Number(r.amount).toFixed(2)})`,
          type: "reward" as const
        }));
      case "addons":
        return addons.map(a => ({
          id: `addon:${a.id}`,
          name: `${a.name} ($${Number(a.price).toFixed(2)})`,
          type: "addon" as const
        }));
      case "all":
      default:
        return [
          ...rewards.map(r => ({
            id: `reward:${r.id}`,
            name: `${r.name} ($${Number(r.amount).toFixed(2)})`,
            type: "reward" as const
          })),
          ...addons.map(a => ({
            id: `addon:${a.id}`,
            name: `${a.name} ($${Number(a.price).toFixed(2)})`,
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
                <SelectContent className="max-h-[320px]">
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
            <Label>{filesToDistribute.length > 1 ? "Files to Distribute" : "File to Distribute"}</Label>
            {filesToDistribute.map((selected, index) => {
              // A file already chosen in another row can't be chosen twice.
              const takenElsewhere = new Set(filesToDistribute.filter((id, i) => id && i !== index));
              return (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={selected}
                    onValueChange={(value) =>
                      setFilesToDistribute((prev) => prev.map((id, i) => (i === index ? value : id)))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={index === 0 ? "Select a file..." : "Select another file..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px]">
                      {readyFiles.length > 0 ? (
                        readyFiles.map((file) => (
                          <SelectItem key={file.id} value={file.id} disabled={takenElsewhere.has(file.id)}>
                            {file.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No files uploaded yet</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {filesToDistribute.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      title="Remove this file"
                      onClick={() => setFilesToDistribute((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              disabled={!canAddAnother}
              onClick={() => setFilesToDistribute((prev) => [...prev, ""])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add another file
            </Button>
            {filesToDistribute.length > 1 && (
              <p className="text-xs text-muted-foreground">
                One rule is created per file, all with this trigger.
              </p>
            )}
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
            disabled={isCreating || !ruleName.trim() || (triggerType !== "all" && !triggerProduct) || !hasFileSelected}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : filesToDistribute.filter(Boolean).length > 1 ? (
              `Create ${filesToDistribute.filter(Boolean).length} Rules`
            ) : (
              "Create Rule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
