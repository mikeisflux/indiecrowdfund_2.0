"use client";

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
import { Banknote, CheckCircle, Loader2, Lock, Building2 } from "lucide-react";
import { DivinityCoinBankSectionProps } from "./types";
import { BillingAddressInputs } from "./billing-address-inputs";
import {
  BANK_COUNTRY_OPTIONS,
  BANK_COUNTRY_FIELDS,
  sanitizeBankField,
  type BankCountry,
} from "@/lib/bank-countries";

export function DivinityCoinBankSection({
  bankAccount,
  setBankAccount,
  bankAccountStatus,
  setBankAccountStatus,
  isSavingBank,
  handleSaveBankAccount,
}: DivinityCoinBankSectionProps) {
  const country = bankAccount.bankCountry;
  const isUS = country === "US";
  const fields = BANK_COUNTRY_FIELDS[country];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Divinity Payments Settlement Account
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter your bank account details for Divinity Payments settlements. All data is encrypted and stored securely.
        </p>
      </div>

      <Card className={bankAccountStatus.saved ? "border-green-500" : ""}>
        <CardContent className="pt-6">
          {bankAccountStatus.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bankAccountStatus.saved ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Bank Account Connected</p>
                    <p className="text-sm text-muted-foreground">
                      {bankAccount.bankName} • Account ending in {bankAccountStatus.lastFour}
                    </p>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBankAccountStatus(prev => ({ ...prev, saved: false }))}
              >
                Update Bank Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <Lock className="h-4 w-4" />
                <AlertTitle>Secure & Encrypted</AlertTitle>
                <AlertDescription>
                  Your bank account information is encrypted using AES-256 encryption before storage.
                  We never store unencrypted account numbers.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="bank-country">Bank Country</Label>
                <Select
                  value={bankAccount.bankCountry}
                  onValueChange={(value: BankCountry) =>
                    setBankAccount(prev => ({
                      ...prev,
                      bankCountry: value,
                      // Clear the country-specific routing + account
                      // values when the country changes so a US routing
                      // number doesn't sit stale in a "Sort Code" field.
                      routingNumber: "",
                      accountNumber: "",
                    }))
                  }
                >
                  <SelectTrigger id="bank-country" className="w-full sm:w-[280px]">
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
                  <Label htmlFor="bank-name">Bank Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="bank-name"
                      placeholder={fields.bankNamePlaceholder}
                      value={bankAccount.bankName}
                      onChange={(e) => setBankAccount(prev => ({ ...prev, bankName: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-holder">Account Holder Name</Label>
                  <Input
                    id="account-holder"
                    placeholder="Name as it appears on account"
                    value={bankAccount.accountHolder}
                    onChange={(e) => setBankAccount(prev => ({ ...prev, accountHolder: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="routing-number">{fields.routingLabel}</Label>
                  <Input
                    id="routing-number"
                    type="text"
                    inputMode={fields.inputMode}
                    maxLength={fields.routingMaxLength}
                    placeholder={fields.routingPlaceholder}
                    value={bankAccount.routingNumber}
                    onChange={(e) => {
                      const value = sanitizeBankField(country, e.target.value, fields.routingMaxLength);
                      setBankAccount(prev => ({ ...prev, routingNumber: value }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{fields.routingHelp}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-number">{fields.accountLabel}</Label>
                  <Input
                    id="account-number"
                    type="password"
                    inputMode={fields.inputMode}
                    maxLength={fields.accountMaxLength}
                    placeholder={fields.accountPlaceholder}
                    value={bankAccount.accountNumber}
                    onChange={(e) => {
                      const value = sanitizeBankField(country, e.target.value, fields.accountSliceLength);
                      setBankAccount(prev => ({ ...prev, accountNumber: value }));
                    }}
                  />
                </div>
              </div>

              {country === "US" ? (
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={bankAccount.accountType}
                    onValueChange={(value: "checking" | "savings") =>
                      setBankAccount(prev => ({ ...prev, accountType: value }))
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
                  <Label htmlFor="payout-phone">Phone Number</Label>
                  <Input
                    id="payout-phone"
                    type="tel"
                    placeholder="e.g. 07951 937383"
                    value={bankAccount.payoutPhone}
                    onChange={(e) => setBankAccount(prev => ({ ...prev, payoutPhone: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required by UK banks on the payee record.
                  </p>
                </div>
              ) : null}

              <BillingAddressInputs
                idPrefix="dc"
                value={{
                  billingLine1: bankAccount.billingLine1,
                  billingLine2: bankAccount.billingLine2,
                  billingCity: bankAccount.billingCity,
                  billingState: bankAccount.billingState,
                  billingZip: bankAccount.billingZip,
                  billingCountry: bankAccount.billingCountry,
                }}
                onChange={(addr) =>
                  setBankAccount(prev => ({ ...prev, ...addr }))
                }
              />

              {!isUS && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1">International payment fee</p>
                  <p>
                    Payouts to non-US bank accounts are sent by international
                    wire in your local currency. A <strong>$25 wire fee + 1.50% currency conversion fee</strong>{" "}
                    will be added on top of the standard Divinity Payments
                    processing + platform fees.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSaveBankAccount}
                  disabled={isSavingBank}
                >
                  {isSavingBank ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Encrypting & Saving...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Save Bank Account
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Divinity Payments settlements are processed within 14 business days after your campaign ends.{" "}
                <a
                  href="https://divinitycoin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Learn more about Divinity Payments
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
