"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DollarSign,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backerId: string;
  backerName: string;
  backerEmail: string;
  totalPaid: number;
  onRefund?: (refund: RefundData) => void;
}

interface RefundData {
  type: "full" | "partial";
  amount: number;
  reason: string;
  notifyBacker: boolean;
  cancelOrder: boolean;
}

const refundReasons = [
  { id: "request", label: "Backer requested refund" },
  { id: "unable_fulfill", label: "Unable to fulfill order" },
  { id: "duplicate", label: "Duplicate payment" },
  { id: "overcharge", label: "Overcharged" },
  { id: "shipping_issue", label: "Shipping issue" },
  { id: "quality_issue", label: "Quality issue" },
  { id: "other", label: "Other" },
];

export function RefundDialog({
  open,
  onOpenChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  backerId,
  backerName,
  backerEmail,
  totalPaid,
  onRefund,
}: RefundDialogProps) {
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState(totalPaid.toString());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [notifyBacker, setNotifyBacker] = useState(true);
  const [cancelOrder, setCancelOrder] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const refundAmount = refundType === "full" ? totalPaid : parseFloat(amount) || 0;

  const handleRefund = async () => {
    if (refundAmount <= 0) {
      toast.error("Please enter a valid refund amount");
      return;
    }

    if (refundAmount > totalPaid) {
      toast.error("Refund amount cannot exceed total paid");
      return;
    }

    if (!reason) {
      toast.error("Please select a reason for the refund");
      return;
    }

    setIsProcessing(true);

    // Simulate processing
    await new Promise(r => setTimeout(r, 1500));

    onRefund?.({
      type: refundType,
      amount: refundAmount,
      reason: `${reason}${notes ? `: ${notes}` : ""}`,
      notifyBacker,
      cancelOrder,
    });

    toast.success(`Refund of $${refundAmount.toFixed(2)} processed successfully`);

    setIsProcessing(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-orange-500" />
            Issue Refund
          </DialogTitle>
          <DialogDescription>
            Process a refund for {backerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Backer Info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium">{backerName}</p>
            <p className="text-muted-foreground">{backerEmail}</p>
            <p className="mt-2">
              Total Paid: <span className="font-medium">${totalPaid.toFixed(2)}</span>
            </p>
          </div>

          {/* Refund Type */}
          <div className="space-y-3">
            <Label>Refund Type</Label>
            <RadioGroup value={refundType} onValueChange={(v) => setRefundType(v as "full" | "partial")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="cursor-pointer">
                  Full Refund (${totalPaid.toFixed(2)})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="cursor-pointer">
                  Partial Refund
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Amount (for partial) */}
          {refundType === "partial" && (
            <div className="space-y-2">
              <Label>Refund Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={totalPaid}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason for Refund</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {refundReasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional Notes (optional)</Label>
            <Textarea
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify"
                checked={notifyBacker}
                onCheckedChange={(checked) => setNotifyBacker(checked as boolean)}
              />
              <Label htmlFor="notify" className="text-sm cursor-pointer">
                Send refund notification email to backer
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="cancel"
                checked={cancelOrder}
                onCheckedChange={(checked) => setCancelOrder(checked as boolean)}
              />
              <Label htmlFor="cancel" className="text-sm cursor-pointer">
                Cancel order after refund
              </Label>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <p className="text-amber-800">
              This action cannot be undone. The refund will be processed to the original payment method.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRefund}
            disabled={isProcessing || !reason}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Refund ${refundAmount.toFixed(2)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
