"use client";

import { useState } from "react";
import { Loader2, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/fetch-utils";
import {
  BANK_COUNTRY_OPTIONS,
  BANK_COUNTRY_FIELDS,
  parseBankCountry,
  sanitizeBankField,
  validateBankFields,
  type BankCountry,
} from "@/lib/bank-countries";
import {
  BillingAddressInputs,
  EMPTY_BILLING_ADDRESS,
  isBillingAddressComplete,
  type BillingAddress,
} from "@/components/project/builder/payment-sections/billing-address-inputs";

/**
 * One payout bank account form, posted to the processor's creator route.
 *
 * Used by the dashboard gate for creators whose saved account is missing
 * required fields. When an account already exists, the account and routing
 * numbers may be left blank to keep the ones on file: the creator only has to
 * add what is missing (usually the billing address) instead of re-typing a
 * number they'd have to go look up.
 */
export interface PayoutBankFormProps {
  idPrefix: string;
  saveUrl: string;
  /** An account exists; blank account/routing keeps the stored numbers. */
  hasExisting: boolean;
  prefill?: { bankName?: string | null; accountType?: string | null; bankCountry?: string | null; lastFour?: string | null };
  accentClassName?: string;
  onSaved: () => void;
}

export function PayoutBankForm({ idPrefix, saveUrl, hasExisting, prefill, accentClassName, onSaved }: PayoutBankFormProps) {
  const [saving, setSaving] = useState(false);
  const [bankCountry, setBankCountry] = useState<BankCountry>(parseBankCountry(prefill?.bankCountry || "US"));
  const [bankName, setBankName] = useState(prefill?.bankName || "");
  const [accountHolder, setAccountHolder] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings">(prefill?.accountType === "savings" ? "savings" : "checking");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [billing, setBilling] = useState<BillingAddress>({ ...EMPTY_BILLING_ADDRESS, billingCountry: parseBankCountry(prefill?.bankCountry || "US") });

  const fields = BANK_COUNTRY_FIELDS[bankCountry];
  const keepingNumbers = hasExisting && !accountNumber && !routingNumber;

  const save = async () => {
    if (!bankName.trim() || !accountHolder.trim()) {
      toast.error("Bank name and account holder name are required");
      return;
    }
    if (!keepingNumbers) {
      if (!accountNumber || !routingNumber) {
        toast.error(hasExisting ? "Enter both numbers, or leave both blank to keep the ones on file" : "Account and routing numbers are required");
        return;
      }
      const err = validateBankFields(bankCountry, { routingNumber, accountNumber, payoutPhone });
      if (err) {
        toast.error(err);
        return;
      }
    }
    if (!isBillingAddressComplete(billing)) {
      toast.error("Billing address is required (street, city, ZIP/postal code, country)");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(saveUrl, {
        method: "POST",
        json: {
          bankName: bankName.trim(),
          accountHolder: accountHolder.trim(),
          accountNumber: keepingNumbers ? "" : accountNumber,
          routingNumber: keepingNumbers ? "" : routingNumber,
          accountType,
          bankCountry,
          payoutPhone: payoutPhone || undefined,
          ...billing,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save bank account");
      toast.success("Payout account saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-country`}>Bank Country</Label>
        <Select
          value={bankCountry}
          onValueChange={(v: BankCountry) => {
            setBankCountry(v);
            setRoutingNumber("");
            setAccountNumber("");
            setBilling((b) => ({ ...b, billingCountry: v }));
          }}
        >
          <SelectTrigger id={`${idPrefix}-country`} className="w-full sm:w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BANK_COUNTRY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-bank-name`}>Bank Name</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id={`${idPrefix}-bank-name`} className="pl-10" placeholder={fields.bankNamePlaceholder} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-holder`}>Account Holder Name</Label>
          <Input id={`${idPrefix}-holder`} placeholder="Name as it appears on the account" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-routing`}>{fields.routingLabel}</Label>
          <Input
            id={`${idPrefix}-routing`}
            inputMode={fields.inputMode}
            maxLength={fields.routingMaxLength}
            placeholder={hasExisting ? "Leave blank to keep current" : fields.routingPlaceholder}
            value={routingNumber}
            onChange={(e) => setRoutingNumber(sanitizeBankField(bankCountry, e.target.value, fields.routingMaxLength))}
          />
          <p className="text-xs text-muted-foreground">{fields.routingHelp}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-account`}>{fields.accountLabel}</Label>
          <Input
            id={`${idPrefix}-account`}
            type="password"
            inputMode={fields.inputMode}
            maxLength={fields.accountMaxLength}
            placeholder={hasExisting && prefill?.lastFour ? `Leave blank to keep ••••${prefill.lastFour}` : hasExisting ? "Leave blank to keep current" : fields.accountPlaceholder}
            value={accountNumber}
            onChange={(e) => setAccountNumber(sanitizeBankField(bankCountry, e.target.value, fields.accountSliceLength))}
          />
        </div>
      </div>

      {bankCountry === "US" ? (
        <div className="space-y-2">
          <Label>Account Type</Label>
          <Select value={accountType} onValueChange={(v: "checking" | "savings") => setAccountType(v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Checking</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : bankCountry === "GB" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-phone`}>Phone Number</Label>
          <Input id={`${idPrefix}-phone`} type="tel" placeholder="e.g. 07951 937383" value={payoutPhone} onChange={(e) => setPayoutPhone(e.target.value)} />
          <p className="text-xs text-muted-foreground">Required by UK banks on the payee record.</p>
        </div>
      ) : null}

      <BillingAddressInputs idPrefix={idPrefix} value={billing} onChange={setBilling} />

      <Button onClick={save} disabled={saving} className={accentClassName}>
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Encrypting &amp; Saving...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Save Payout Account
          </>
        )}
      </Button>
    </div>
  );
}
