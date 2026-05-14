"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingBag, CheckCircle, Loader2, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  BANK_COUNTRY_OPTIONS,
  BANK_COUNTRY_FIELDS,
  sanitizeBankField,
  validateBankFields,
  parseBankCountry,
  type BankCountry,
} from "@/lib/bank-countries";

interface BankAccountState {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
  // ISO 3166-1 alpha-2 of the bank's country (US / GB / IT). Drives
  // routing-format labels + validation and whether the payout phone
  // field shows. Defaults to "US". See @/lib/bank-countries.
  bankCountry: BankCountry;
  payoutPhone: string;
}

export function WhopBankPayoutSection() {
  const [bankAccount, setBankAccount] = useState<BankAccountState>({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
    bankCountry: "US",
    payoutPhone: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastFour, setLastFour] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const country = bankAccount.bankCountry;
  const isUS = country === "US";
  const fields = BANK_COUNTRY_FIELDS[country];

  useEffect(() => {
    async function fetchBankAccount() {
      try {
        const res = await fetch("/api/creator/whop-bank-account");
        if (res.ok) {
          const data = await res.json();
          if (data.exists) {
            setSaved(true);
            setLastFour(data.lastFour || null);
            setBankAccount((prev) => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
              bankCountry: parseBankCountry(data.bankCountry),
            }));
          }
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    }
    fetchBankAccount();
  }, []);

  const handleSave = async () => {
    if (!bankAccount.bankName || !bankAccount.accountHolder ||
        !bankAccount.accountNumber || !bankAccount.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }
    const validationError = validateBankFields(country, bankAccount);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/whop-bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankAccount),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save bank account");
      }
      const data = await res.json();
      setSaved(true);
      setLastFour(data.lastFour);
      setBankAccount((prev) => ({ ...prev, accountNumber: "", routingNumber: "", payoutPhone: "" }));
      toast.success("Bank account saved securely!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Direct Bank Payout Account
        </h3>
        <p className="text-sm text-muted-foreground">
          IndieCrowdfund collects all Whop payments and deposits your net campaign earnings directly to your bank account — no Whop account required for payouts.
        </p>
      </div>

      <Card className={saved ? "border-green-500" : ""}>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : saved ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Bank Account Connected</p>
                    <p className="text-sm text-muted-foreground">
                      {bankAccount.bankName} • Account ending in {lastFour}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Payouts sent here after your campaign funds successfully.
                    </p>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSaved(false)}>
                Update Bank Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <Lock className="h-4 w-4" />
                <AlertTitle>Secure & Encrypted</AlertTitle>
                <AlertDescription>
                  Your bank account information is encrypted using AES-256 before storage.
                  We never store unencrypted account numbers.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="whop-bank-country">Bank Country</Label>
                <Select
                  value={bankAccount.bankCountry}
                  onValueChange={(v: BankCountry) =>
                    setBankAccount((prev) => ({
                      ...prev,
                      bankCountry: v,
                      // Clear the country-specific routing + account
                      // values when the country changes so a US routing
                      // number doesn't sit stale in a "Sort Code" field.
                      routingNumber: "",
                      accountNumber: "",
                    }))
                  }
                >
                  <SelectTrigger id="whop-bank-country" className="w-full sm:w-[280px]">
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
                  <Label htmlFor="whop-bank-name">Bank Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="whop-bank-name"
                      placeholder={fields.bankNamePlaceholder}
                      value={bankAccount.bankName}
                      onChange={(e) => setBankAccount((prev) => ({ ...prev, bankName: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whop-account-holder">Account Holder Name</Label>
                  <Input
                    id="whop-account-holder"
                    placeholder="Name as it appears on account"
                    value={bankAccount.accountHolder}
                    onChange={(e) => setBankAccount((prev) => ({ ...prev, accountHolder: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="whop-routing">{fields.routingLabel}</Label>
                  <Input
                    id="whop-routing"
                    type="text"
                    inputMode={fields.inputMode}
                    maxLength={fields.routingMaxLength}
                    placeholder={fields.routingPlaceholder}
                    value={bankAccount.routingNumber}
                    onChange={(e) => {
                      const value = sanitizeBankField(country, e.target.value, fields.routingMaxLength);
                      setBankAccount((prev) => ({ ...prev, routingNumber: value }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{fields.routingHelp}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whop-account-number">{fields.accountLabel}</Label>
                  <Input
                    id="whop-account-number"
                    type="password"
                    inputMode={fields.inputMode}
                    maxLength={fields.accountMaxLength}
                    placeholder={fields.accountPlaceholder}
                    value={bankAccount.accountNumber}
                    onChange={(e) => {
                      const value = sanitizeBankField(country, e.target.value, fields.accountSliceLength);
                      setBankAccount((prev) => ({ ...prev, accountNumber: value }));
                    }}
                  />
                </div>
              </div>

              {country === "US" ? (
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={bankAccount.accountType}
                    onValueChange={(v: "checking" | "savings") =>
                      setBankAccount((prev) => ({ ...prev, accountType: v }))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : country === "GB" ? (
                <div className="space-y-2">
                  <Label htmlFor="whop-payout-phone">Phone Number</Label>
                  <Input
                    id="whop-payout-phone"
                    type="tel"
                    placeholder="e.g. 07951 937383"
                    value={bankAccount.payoutPhone}
                    onChange={(e) => setBankAccount((prev) => ({ ...prev, payoutPhone: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required by UK banks on the payee record.
                  </p>
                </div>
              ) : null}

              {!isUS && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1">International payment fee</p>
                  <p>
                    Payouts to non-US bank accounts are sent by international
                    wire in your local currency. A <strong>$25 wire fee + 1.50% currency conversion fee</strong>{" "}
                    will be added on top of the standard Whop
                    processing + platform fees.
                  </p>
                </div>
              )}

              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Encrypting & Saving...</>
                ) : (
                  <><Lock className="h-4 w-4 mr-2" />Save Bank Account</>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Payouts are processed within 14 business days after your campaign funds successfully.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
