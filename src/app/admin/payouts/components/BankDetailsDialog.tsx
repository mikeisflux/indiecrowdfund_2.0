"use client";

import { Building, AlertCircle, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BankAccountDetails } from "./types";

interface BankDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankDetails: BankAccountDetails | null;
  loadingBankDetails: boolean;
}

export function BankDetailsDialog({
  open,
  onOpenChange,
  bankDetails,
  loadingBankDetails,
}: BankDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Bank Account Details
          </DialogTitle>
          <DialogDescription>
            Secure bank account information for wire transfer
          </DialogDescription>
        </DialogHeader>

        {loadingBankDetails ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : bankDetails ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sensitive Information</AlertTitle>
              <AlertDescription>
                This information is encrypted and should only be used for processing payouts.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 bg-muted/50 dark:bg-zinc-800 rounded-lg p-4">
              <div>
                <Label className="text-xs text-muted-foreground">Account Holder</Label>
                <p className="font-medium">{bankDetails.accountHolder}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Bank Name</Label>
                <p className="font-medium">{bankDetails.bankName}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Routing Number</Label>
                <p className="font-mono font-medium">{bankDetails.routingNumber}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account Number</Label>
                <p className="font-mono font-medium">{bankDetails.accountNumber}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account Type</Label>
                <p className="font-medium capitalize">{bankDetails.accountType}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Verification Status</Label>
                <p className="font-medium">{bankDetails.isVerified ? "Verified" : "Unverified"}</p>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Creator: {bankDetails.user.name || "Unknown"} ({bankDetails.user.email})
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Failed to load bank account details
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
