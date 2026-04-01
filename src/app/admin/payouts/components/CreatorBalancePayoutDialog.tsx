"use client";

import { Building, CheckCircle, Loader2, Send } from "lucide-react";
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
import { CreatorBalance } from "./types";

interface CreatorBalancePayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCreator: CreatorBalance | null;
  settlementAmount: string;
  setSettlementAmount: (val: string) => void;
  adminNotes: string;
  setAdminNotes: (val: string) => void;
  processing: boolean;
  onCreatePayout: () => void;
  formatCurrency: (amount: number) => string;
}

export function CreatorBalancePayoutDialog({
  open,
  onOpenChange,
  selectedCreator,
  settlementAmount,
  setSettlementAmount,
  adminNotes,
  setAdminNotes,
  processing,
  onCreatePayout,
  formatCurrency,
}: CreatorBalancePayoutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Balance Payout</DialogTitle>
          <DialogDescription>
            Pay out balance to creator&apos;s bank account
          </DialogDescription>
        </DialogHeader>
        {selectedCreator && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-zinc-50">
              <p className="text-sm text-zinc-500">Creator</p>
              <p className="font-medium">{selectedCreator.name || selectedCreator.email}</p>
              <p className="text-xs text-zinc-500">{selectedCreator.email}</p>
            </div>

            <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
              <p className="text-sm text-teal-600">Available Balance</p>
              <p className="text-2xl font-bold text-teal-700">{formatCurrency(selectedCreator.balance)}</p>
              <p className="text-xs text-teal-500 mt-1">
                From {selectedCreator.marketplaceSales.count} marketplace sales
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payout Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                max={selectedCreator.balance}
              />
              <p className="text-xs text-zinc-500">
                Max: {formatCurrency(selectedCreator.balance)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes about this payout..."
                rows={3}
              />
            </div>

            {selectedCreator.bankAccount && (
              <div className="p-4 rounded-lg bg-zinc-50 border">
                <p className="text-sm text-zinc-500 mb-2">Bank Account</p>
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-zinc-500" />
                  <span className="font-medium">{selectedCreator.bankAccount.bankName}</span>
                  <span className="text-zinc-500">****{selectedCreator.bankAccount.accountLastFour}</span>
                  {selectedCreator.bankAccount.isVerified && (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCreatePayout}
            disabled={processing || !settlementAmount || parseFloat(settlementAmount) <= 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Create Payout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
