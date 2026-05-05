"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Banknote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";

interface PaymentCloudBankAccountState {
  bankName: string;
  firstName: string;
  lastName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
}

interface PaymentCloudBankAccountStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
}

interface PaymentCloudBankSectionProps {
  bankAccount: PaymentCloudBankAccountState;
  setBankAccount: React.Dispatch<React.SetStateAction<PaymentCloudBankAccountState>>;
  status: PaymentCloudBankAccountStatus;
  setStatus: React.Dispatch<React.SetStateAction<PaymentCloudBankAccountStatus>>;
  projectId: string | null;
}

// PaymentCloud creator payout bank account. Mirrors the DivinityCoin
// bank account UX but with the schema corrections we needed:
//   - first name + last name as separate fields (was a single "account
//     holder" string that creators were misusing — emails, partial
//     names, etc.)
//   - billing address captured here so we have a full KYC profile
export function PaymentCloudBankSection({
  bankAccount,
  setBankAccount,
  status,
  setStatus,
  projectId,
}: PaymentCloudBankSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  // Default to closed so the saved-bank card shows up when the parent's
  // GET resolves. Initializing this from `!status.saved` was the bug:
  // useState only reads its argument on the first render, so when the
  // parent's status flipped from { saved: false, loading: true } (the
  // pre-fetch default) to { saved: true } after the GET, this stayed
  // pinned at `showForm=true` and the form kept rendering on top of
  // the already-saved account. Looked exactly like "fields aren't
  // saving" to the creator since their entries appeared blank again
  // on every reload.
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !bankAccount.bankName ||
      !bankAccount.firstName ||
      !bankAccount.lastName ||
      !bankAccount.accountNumber ||
      !bankAccount.routingNumber
    ) {
      toast.error("Please fill in all bank account fields.");
      return;
    }
    if (!/^\d{9}$/.test(bankAccount.routingNumber)) {
      toast.error("Routing number must be exactly 9 digits.");
      return;
    }
    if (!/^\d{4,17}$/.test(bankAccount.accountNumber)) {
      toast.error("Account number must be 4–17 digits.");
      return;
    }
    if (
      !bankAccount.billingLine1 ||
      !bankAccount.billingCity ||
      !bankAccount.billingState ||
      !bankAccount.billingZip ||
      !bankAccount.billingCountry
    ) {
      toast.error("Please enter the full billing address.");
      return;
    }

    setIsSaving(true);
    try {
      const r = await apiFetch("/api/creator/paymentcloud-bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: bankAccount.bankName,
          accountHolderFirstName: bankAccount.firstName,
          accountHolderLastName: bankAccount.lastName,
          accountNumber: bankAccount.accountNumber,
          routingNumber: bankAccount.routingNumber,
          accountType: bankAccount.accountType,
          billingLine1: bankAccount.billingLine1,
          billingLine2: bankAccount.billingLine2 || undefined,
          billingCity: bankAccount.billingCity,
          billingState: bankAccount.billingState,
          billingZip: bankAccount.billingZip,
          billingCountry: bankAccount.billingCountry,
          projectId,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to save bank account");
      setStatus({ saved: true, loading: false, lastFour: data.lastFour ?? null });
      setShowForm(false);
      // Wipe sensitive fields from local state so they don't sit in memory.
      setBankAccount((prev) => ({ ...prev, accountNumber: "", routingNumber: "" }));
      toast.success("Bank account saved securely.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Banknote className="h-4 w-4 text-sky-600" />
        <h3 className="font-semibold">PaymentCloud Payout Bank Account</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        IndieCrowdfund collects all pledges into the platform&apos;s PaymentCloud
        merchant account, then deposits your net earnings to the bank account
        below at settlement. Your bank details are AES-256 encrypted at rest.
      </p>

      {status.loading && (
        <Card>
          <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking saved bank account…
          </CardContent>
        </Card>
      )}

      {!status.loading && status.saved && !showForm && (
        <Card>
          <CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  {bankAccount.bankName || "Bank account"} ending in {status.lastFour || "????"}
                </p>
                <p className="text-muted-foreground capitalize">
                  {bankAccount.accountType} account · stored securely
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              Replace
            </Button>
          </CardContent>
        </Card>
      )}

      {!status.loading && (!status.saved || showForm) && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pc-firstName">Account holder first name</Label>
              <Input
                id="pc-firstName"
                value={bankAccount.firstName}
                onChange={(e) => setBankAccount((p) => ({ ...p, firstName: e.target.value }))}
                placeholder="First name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-lastName">Account holder last name</Label>
              <Input
                id="pc-lastName"
                value={bankAccount.lastName}
                onChange={(e) => setBankAccount((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="Last name"
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pc-bankName">Bank name</Label>
              <Input
                id="pc-bankName"
                value={bankAccount.bankName}
                onChange={(e) => setBankAccount((p) => ({ ...p, bankName: e.target.value }))}
                placeholder="e.g. Chase Bank"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-routingNumber">Routing number</Label>
              <Input
                id="pc-routingNumber"
                value={bankAccount.routingNumber}
                onChange={(e) => setBankAccount((p) => ({ ...p, routingNumber: e.target.value.replace(/\D/g, "") }))}
                inputMode="numeric"
                maxLength={9}
                placeholder="9 digits"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-accountNumber">Account number</Label>
              <Input
                id="pc-accountNumber"
                value={bankAccount.accountNumber}
                onChange={(e) => setBankAccount((p) => ({ ...p, accountNumber: e.target.value.replace(/\D/g, "") }))}
                inputMode="numeric"
                maxLength={17}
                placeholder="4–17 digits"
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pc-accountType">Account type</Label>
              <select
                id="pc-accountType"
                value={bankAccount.accountType}
                onChange={(e) => setBankAccount((p) => ({ ...p, accountType: e.target.value as "checking" | "savings" }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pc-line1">Billing address</Label>
              <Input
                id="pc-line1"
                value={bankAccount.billingLine1}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingLine1: e.target.value }))}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pc-line2">Address line 2 (optional)</Label>
              <Input
                id="pc-line2"
                value={bankAccount.billingLine2}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingLine2: e.target.value }))}
                placeholder="Apt, suite, etc."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-city">City</Label>
              <Input
                id="pc-city"
                value={bankAccount.billingCity}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingCity: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-state">State / region</Label>
              <Input
                id="pc-state"
                value={bankAccount.billingState}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingState: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-zip">ZIP / postal code</Label>
              <Input
                id="pc-zip"
                value={bankAccount.billingZip}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingZip: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-country">Country</Label>
              <Input
                id="pc-country"
                value={bankAccount.billingCountry}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingCountry: e.target.value }))}
                placeholder="US"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={isSaving || !projectId} className="w-full">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : status.saved ? "Replace Bank Account" : "Save Bank Account"}
          </Button>
          {status.saved && showForm && (
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          )}
        </form>
      )}
    </div>
  );
}

export type { PaymentCloudBankAccountState, PaymentCloudBankAccountStatus };
