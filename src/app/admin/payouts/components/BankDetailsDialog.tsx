"use client";

import { useEffect, useState } from "react";
import { Building, AlertCircle, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  bankAccountType?: "divinitycoin" | "paypal" | "whop";
  onSaved?: () => void;
}

export function BankDetailsDialog({
  open,
  onOpenChange,
  bankDetails,
  loadingBankDetails,
  bankAccountType = "divinitycoin",
  onSaved,
}: BankDetailsDialogProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    accountHolder: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
  });

  useEffect(() => {
    if (bankDetails) {
      setForm({
        accountHolder: bankDetails.accountHolder || "",
        bankName: bankDetails.bankName || "",
        routingNumber: bankDetails.routingNumber || "",
        accountNumber: bankDetails.accountNumber || "",
        accountType: bankDetails.accountType || "checking",
      });
    }
    if (!open) setEditing(false);
  }, [bankDetails, open]);

  const handleSave = async () => {
    if (!bankDetails) return;
    setSaving(true);
    try {
      const changed: Record<string, string> = {};
      if (form.accountHolder !== bankDetails.accountHolder) changed.accountHolder = form.accountHolder;
      if (form.bankName !== bankDetails.bankName) changed.bankName = form.bankName;
      if (form.routingNumber !== bankDetails.routingNumber) changed.routingNumber = form.routingNumber;
      if (form.accountNumber !== bankDetails.accountNumber) changed.accountNumber = form.accountNumber;
      if (form.accountType !== bankDetails.accountType) changed.accountType = form.accountType;

      if (Object.keys(changed).length === 0) {
        setEditing(false);
        setSaving(false);
        return;
      }

      // apiFetch attaches the x-csrf-token header from the csrf_token cookie.
      // Plain fetch() skips CSRF protection and the proxy rejects the PATCH
      // with 403 "CSRF validation failed".
      const res = await apiFetch(
        `/api/admin/bank-accounts/${bankDetails.id}?type=${bankAccountType}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changed),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update bank account");

      toast.success("Bank account updated. Verification cleared — creator must re-verify.");
      setEditing(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bank account");
    } finally {
      setSaving(false);
    }
  };

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
                {editing
                  ? "Editing will re-encrypt the record and clear verification. Use only to correct creator-entered errors."
                  : "This information is encrypted and should only be used for processing payouts."}
              </AlertDescription>
            </Alert>

            <div className="space-y-3 bg-muted/50 dark:bg-zinc-800 rounded-lg p-4">
              <div>
                <Label className="text-xs text-muted-foreground">Account Holder</Label>
                {editing ? (
                  <Input
                    value={form.accountHolder}
                    onChange={(e) => setForm((f) => ({ ...f, accountHolder: e.target.value }))}
                  />
                ) : (
                  <p className="font-medium">{bankDetails.accountHolder}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Bank Name</Label>
                {editing ? (
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  />
                ) : (
                  <p className="font-medium">{bankDetails.bankName}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Routing Number</Label>
                {editing ? (
                  <Input
                    value={form.routingNumber}
                    onChange={(e) => setForm((f) => ({ ...f, routingNumber: e.target.value.replace(/\D/g, "") }))}
                    maxLength={9}
                    inputMode="numeric"
                    className="font-mono"
                  />
                ) : (
                  <p className="font-mono font-medium">{bankDetails.routingNumber}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account Number</Label>
                {editing ? (
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                    maxLength={17}
                    inputMode="numeric"
                    className="font-mono"
                  />
                ) : (
                  <p className="font-mono font-medium">{bankDetails.accountNumber}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account Type</Label>
                {editing ? (
                  <Select
                    value={form.accountType}
                    onValueChange={(v) => setForm((f) => ({ ...f, accountType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium capitalize">{bankDetails.accountType}</p>
                )}
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
          {bankDetails && !editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save changes
              </Button>
            </>
          )}
          {!editing && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
