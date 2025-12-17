"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DollarSign,
  Plus,
  Minus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface BalanceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backerId: string;
  backerName: string;
  currentBalance: number;
  onSave?: (adjustment: { type: string; amount: number; reason: string }) => void;
}

export function BalanceEditorDialog({
  open,
  onOpenChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  backerId,
  backerName,
  currentBalance,
  onSave,
}: BalanceEditorDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "charge">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("");

  const newBalance = currentBalance + (
    adjustmentType === "credit"
      ? -parseFloat(amount || "0")
      : parseFloat(amount || "0")
  );

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    onSave?.({
      type: adjustmentType,
      amount: parsedAmount,
      reason: `${category ? `[${category}] ` : ""}${reason}`,
    });

    toast.success(`Balance ${adjustmentType === "credit" ? "credit" : "charge"} of $${parsedAmount.toFixed(2)} applied`);

    // Reset and close
    setAmount("");
    setReason("");
    setCategory("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-teal-600" />
            Adjust Balance
          </DialogTitle>
          <DialogDescription>
            Add a credit or charge to {backerName}&apos;s account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Balance */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Balance Due</span>
              <span className={`text-lg font-bold ${currentBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                ${currentBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={adjustmentType === "credit" ? "default" : "outline"}
              onClick={() => setAdjustmentType("credit")}
              className={adjustmentType === "credit" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Minus className="h-4 w-4 mr-2" />
              Apply Credit
            </Button>
            <Button
              variant={adjustmentType === "charge" ? "default" : "outline"}
              onClick={() => setAdjustmentType("charge")}
              className={adjustmentType === "charge" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Charge
            </Button>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shipping">Shipping Adjustment</SelectItem>
                <SelectItem value="addon">Add-on Adjustment</SelectItem>
                <SelectItem value="refund">Partial Refund</SelectItem>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="fee">Additional Fee</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason / Notes</Label>
            <Textarea
              placeholder="Describe the reason for this adjustment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* New Balance Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg border p-4">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-muted-foreground">Current Balance</span>
                <span>${currentBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-muted-foreground">
                  {adjustmentType === "credit" ? "Credit" : "Charge"}
                </span>
                <span className={adjustmentType === "credit" ? "text-green-600" : "text-red-600"}>
                  {adjustmentType === "credit" ? "-" : "+"}${parseFloat(amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t font-medium">
                <span>New Balance</span>
                <span className={newBalance > 0 ? "text-red-600" : "text-green-600"}>
                  ${newBalance.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Warning for credits */}
          {adjustmentType === "credit" && parseFloat(amount || "0") > currentBalance && currentBalance > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-amber-800">
                This credit exceeds the balance due. The backer will have a credit of ${(parseFloat(amount) - currentBalance).toFixed(2)} on their account.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSave}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Apply {adjustmentType === "credit" ? "Credit" : "Charge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
