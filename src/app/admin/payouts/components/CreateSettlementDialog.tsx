"use client";

import { DollarSign, Loader2, Send } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreatorProject } from "./types";

interface CreateSettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProject: CreatorProject | null;
  settlementAmount: string;
  setSettlementAmount: (val: string) => void;
  adminNotes: string;
  setAdminNotes: (val: string) => void;
  processing: boolean;
  onCreateSettlement: () => void;
  formatCurrency: (amount: number) => string;
}

export function CreateSettlementDialog({
  open,
  onOpenChange,
  selectedProject,
  settlementAmount,
  setSettlementAmount,
  adminNotes,
  setAdminNotes,
  processing,
  onCreateSettlement,
  formatCurrency,
}: CreateSettlementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Settlement</DialogTitle>
          <DialogDescription>
            Create a wire transfer settlement for {selectedProject?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Settlement Amount</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                className="pl-10"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Max: {formatCurrency(selectedProject?.remainingAmount || 0)}
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Admin Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes about this settlement..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCreateSettlement}
            disabled={processing || !settlementAmount || parseFloat(settlementAmount) <= 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Create Settlement
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
