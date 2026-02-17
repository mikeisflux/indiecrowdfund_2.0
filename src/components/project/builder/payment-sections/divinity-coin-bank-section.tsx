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

export function DivinityCoinBankSection({
  bankAccount,
  setBankAccount,
  bankAccountStatus,
  setBankAccountStatus,
  isSavingBank,
  handleSaveBankAccount,
}: DivinityCoinBankSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          DivinityCoin Settlement Account
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter your bank account details for DivinityCoin settlements. All data is encrypted and stored securely.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank-name">Bank Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="bank-name"
                      placeholder="e.g., Chase Bank, Bank of America"
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
                  <Label htmlFor="routing-number">Routing Number</Label>
                  <Input
                    id="routing-number"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={9}
                    placeholder="9-digit routing number"
                    value={bankAccount.routingNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setBankAccount(prev => ({ ...prev, routingNumber: value }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    9 digits, found on the bottom left of your checks
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-number">Account Number</Label>
                  <Input
                    id="account-number"
                    type="password"
                    inputMode="numeric"
                    maxLength={17}
                    placeholder="Your account number"
                    value={bankAccount.accountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                      setBankAccount(prev => ({ ...prev, accountNumber: value }));
                    }}
                  />
                </div>
              </div>

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
                DivinityCoin settlements are processed within 14 business days after your campaign ends.{" "}
                <a
                  href="https://divinitycoin.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Learn more about DivinityCoin
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
