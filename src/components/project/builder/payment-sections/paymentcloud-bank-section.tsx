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
  // ISO 3166-1 alpha-2 of the BANK's country. Drives routing-format
  // labels + validation (US 9-digit ABA vs UK 6-digit Sort Code) and
  // whether the phone field is required. Defaults to "US".
  bankCountry: "US" | "GB";
  payoutPhone: string;
}

const COUNTRY_OPTIONS: { value: "US" | "GB"; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
];

interface PaymentCloudBankAccountStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
  // false = caller is a collaborator viewing the project creator's
  // bank account. We hide the Replace button + form so collaborators
  // can confirm the bank is set up without being able to mutate it.
  canEdit?: boolean;
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

  const country = bankAccount.bankCountry || "US";
  const isUK = country === "GB";

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
    if (isUK) {
      if (!/^\d{6}$/.test(bankAccount.routingNumber)) {
        toast.error("UK sort code must be 6 digits (e.g. 60-06-39).");
        return;
      }
      if (!/^\d{8}$/.test(bankAccount.accountNumber)) {
        toast.error("UK account number must be 8 digits.");
        return;
      }
      if (!bankAccount.payoutPhone || bankAccount.payoutPhone.trim().length < 7) {
        toast.error("Phone number is required for UK bank accounts.");
        return;
      }
    } else {
      if (!/^\d{9}$/.test(bankAccount.routingNumber)) {
        toast.error("Routing number must be exactly 9 digits.");
        return;
      }
      if (!/^\d{4,17}$/.test(bankAccount.accountNumber)) {
        toast.error("Account number must be 4–17 digits.");
        return;
      }
    }
    if (
      !bankAccount.billingLine1 ||
      !bankAccount.billingCity ||
      !bankAccount.billingZip ||
      !bankAccount.billingCountry
    ) {
      toast.error("Please enter the full billing address.");
      return;
    }
    if (!isUK && !bankAccount.billingState) {
      toast.error("State is required for US accounts.");
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
          billingState: bankAccount.billingState || undefined,
          billingZip: bankAccount.billingZip,
          billingCountry: bankAccount.billingCountry,
          bankCountry: country,
          payoutPhone: bankAccount.payoutPhone || undefined,
          projectId,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to save bank account");
      setStatus({ saved: true, loading: false, lastFour: data.lastFour ?? null, canEdit: true });
      setShowForm(false);
      // Wipe sensitive fields from local state so they don't sit in memory.
      setBankAccount((prev) => ({ ...prev, accountNumber: "", routingNumber: "", payoutPhone: "" }));
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
        <h3 className="font-semibold">Mentom Payments Payout Bank Account</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        IndieCrowdfund collects all pledges into the platform&apos;s Mentom Payments
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
                  {status.canEdit === false && " · saved by the project creator"}
                </p>
              </div>
            </div>
            {status.canEdit !== false && (
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                Replace
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!status.loading && !status.saved && status.canEdit === false && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            The project creator hasn&apos;t set up a payout bank account yet. They&apos;ll need to add one before launch.
          </CardContent>
        </Card>
      )}

      {!status.loading && status.canEdit !== false && (!status.saved || showForm) && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/*
              Bank country selector at the top of the form drives the
              labels + validation for routing/account, whether the
              phone field is required (UK banks need it on the payee
              record), and whether state is mandatory. Keeping it
              first means creators set country once and the rest of
              the form reshapes around the choice instead of fighting
              US-only validation when entering a UK Sort Code.
            */}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pc-bankCountry">Bank country</Label>
              <select
                id="pc-bankCountry"
                value={country}
                onChange={(e) => {
                  const next = e.target.value as "US" | "GB";
                  setBankAccount((p) => ({
                    ...p,
                    bankCountry: next,
                    // Reset the country-specific routing + account
                    // values when the country changes so a US
                    // routing number doesn't sit stale in the field
                    // labeled "Sort code".
                    routingNumber: "",
                    accountNumber: "",
                    // Auto-fill the address country code so the
                    // billing-country field doesn't disagree with
                    // the bank country in the common case.
                    billingCountry:
                      p.billingCountry && p.billingCountry !== "US" && p.billingCountry !== "GB"
                        ? p.billingCountry
                        : next,
                  }));
                }}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {COUNTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
                placeholder={isUK ? "e.g. Barclays" : "e.g. Chase Bank"}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-routingNumber">
                {isUK ? "Sort code" : "Routing number"}
              </Label>
              <Input
                id="pc-routingNumber"
                value={bankAccount.routingNumber}
                onChange={(e) => setBankAccount((p) => ({ ...p, routingNumber: e.target.value.replace(/\D/g, "") }))}
                inputMode="numeric"
                maxLength={isUK ? 6 : 9}
                placeholder={isUK ? "6 digits (e.g. 600639)" : "9 digits"}
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
                maxLength={isUK ? 8 : 17}
                placeholder={isUK ? "8 digits" : "4–17 digits"}
                required
              />
            </div>
            {!isUK && (
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
            )}
            {isUK && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="pc-payoutPhone">Phone number</Label>
                <Input
                  id="pc-payoutPhone"
                  type="tel"
                  value={bankAccount.payoutPhone}
                  onChange={(e) => setBankAccount((p) => ({ ...p, payoutPhone: e.target.value }))}
                  placeholder="e.g. 07951937383"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Required by UK banks on the payee record.
                </p>
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pc-line1">Billing address</Label>
              <Input
                id="pc-line1"
                value={bankAccount.billingLine1}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingLine1: e.target.value }))}
                placeholder={isUK ? "32 Woodfield Way" : "123 Main St"}
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
            {!isUK && (
              <div className="space-y-1">
                <Label htmlFor="pc-state">State</Label>
                <Input
                  id="pc-state"
                  value={bankAccount.billingState}
                  onChange={(e) => setBankAccount((p) => ({ ...p, billingState: e.target.value }))}
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="pc-zip">{isUK ? "Postcode" : "ZIP / postal code"}</Label>
              <Input
                id="pc-zip"
                value={bankAccount.billingZip}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingZip: e.target.value }))}
                placeholder={isUK ? "DN4 8FE" : ""}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pc-country">Country</Label>
              <Input
                id="pc-country"
                value={bankAccount.billingCountry}
                onChange={(e) => setBankAccount((p) => ({ ...p, billingCountry: e.target.value }))}
                placeholder={isUK ? "GB" : "US"}
                required
              />
            </div>
          </div>

          {/*
            UK / international payout notice. Mentom Payments settles
            into a US merchant account, so non-US payouts are sent by
            international wire — that carries a $25 flat wire fee +
            1.50% currency conversion on the converted amount. Shown
            here only when the creator picks UK so it's impossible to
            save the form without seeing the cost. Mirrors the row on
            the public Fees page.
          */}
          {isUK && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              <p className="font-semibold mb-1">International payment fee</p>
              <p>
                Payouts to non-US bank accounts are sent by international
                wire in your local currency. A <strong>$25 wire fee + 1.50% currency conversion fee</strong>{" "}
                will be added on top of the standard Mentom Payments
                processing + platform fees.
              </p>
            </div>
          )}

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
