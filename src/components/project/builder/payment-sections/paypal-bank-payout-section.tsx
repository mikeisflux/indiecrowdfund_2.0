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
import { Banknote, CheckCircle, Loader2, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";

interface BankAccountState {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
}

export function PayPalBankPayoutSection() {
  const [bankAccount, setBankAccount] = useState<BankAccountState>({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastFour, setLastFour] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchBankAccount() {
      try {
        const res = await fetch("/api/creator/paypal-bank-account");
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
    if (bankAccount.routingNumber.length !== 9) {
      toast.error("Routing number must be 9 digits");
      return;
    }
    if (bankAccount.accountNumber.length < 4 || bankAccount.accountNumber.length > 17) {
      toast.error("Please enter a valid account number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/paypal-bank-account", {
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
      setBankAccount((prev) => ({ ...prev, accountNumber: "", routingNumber: "" }));
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
          <Banknote className="h-5 w-5" />
          Direct Bank Payout Account
        </h3>
        <p className="text-sm text-muted-foreground">
          IndieCrowdfund collects all PayPal payments and deposits your net campaign earnings directly to your bank account — no PayPal account required for payouts.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pp-bank-name">Bank Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pp-bank-name"
                      placeholder="e.g., Chase Bank, Bank of America"
                      value={bankAccount.bankName}
                      onChange={(e) => setBankAccount((prev) => ({ ...prev, bankName: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-account-holder">Account Holder Name</Label>
                  <Input
                    id="pp-account-holder"
                    placeholder="Name as it appears on account"
                    value={bankAccount.accountHolder}
                    onChange={(e) => setBankAccount((prev) => ({ ...prev, accountHolder: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pp-routing">Routing Number</Label>
                  <Input
                    id="pp-routing"
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="9-digit routing number"
                    value={bankAccount.routingNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setBankAccount((prev) => ({ ...prev, routingNumber: value }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">9 digits — bottom left of your checks</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-account-number">Account Number</Label>
                  <Input
                    id="pp-account-number"
                    type="password"
                    inputMode="numeric"
                    maxLength={17}
                    placeholder="Your account number"
                    value={bankAccount.accountNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                      setBankAccount((prev) => ({ ...prev, accountNumber: value }));
                    }}
                  />
                </div>
              </div>

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
