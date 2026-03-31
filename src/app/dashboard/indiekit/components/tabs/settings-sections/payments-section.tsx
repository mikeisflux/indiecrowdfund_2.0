"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  CheckCircle,
  Banknote,
  Lock,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PayPalBankPayoutSection } from "@/components/project/builder/payment-sections/paypal-bank-payout-section";

interface PaymentsSectionProps {
  projectId?: string;
}

export function PaymentsSection({ projectId }: PaymentsSectionProps) {
  // Stripe Connect state - DISABLED: Stripe replaced by PayPal
  // const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  // const [stripeStatus, setStripeStatus] = useState<{...}>({...});
  // const [connectError, setConnectError] = useState<string | null>(null);
  // const [isResettingStripe, setIsResettingStripe] = useState(false);
  // const [showResetConfirm, setShowResetConfirm] = useState(false);

  // PayPal migration state
  const [projectProcessor, setProjectProcessor] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    async function fetchProcessor() {
      try {
        const res = await fetch(`/api/projects/${projectId}/payment`);
        if (res.ok) {
          const data = await res.json();
          setProjectProcessor(data.paymentProcessor || null);
        }
      } catch {
        // non-fatal
      }
    }
    fetchProcessor();
  }, [projectId]);

  const handleMigrateToPayPal = async () => {
    if (!projectId) return;
    setIsMigrating(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentProcessor: "PAYPAL" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to switch processor");
      }
      setProjectProcessor("PAYPAL");
      toast.success("Switched to PayPal! New pledges will now use PayPal checkout.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch to PayPal");
    } finally {
      setIsMigrating(false);
    }
  };

  // DivinityCoin bank account state
  const [bankAccount, setBankAccount] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking" as "checking" | "savings",
  });
  const [bankAccountStatus, setBankAccountStatus] = useState<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  }>({ saved: false, loading: true, lastFour: null });
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Payment collection settings
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    autoRetry: true,
    sendReceipts: true,
    failedNotifications: true,
  });

  // Check Stripe connection status - DISABLED: Stripe replaced by PayPal
  // useEffect(() => { async function checkStripeStatus() { ... } checkStripeStatus(); }, []);

  // Check DivinityCoin bank account status on mount
  useEffect(() => {
    async function checkBankAccountStatus() {
      try {
        const response = await fetch("/api/creator/bank-account");
        if (response.ok) {
          const data = await response.json();
          setBankAccountStatus({
            saved: data.exists,
            loading: false,
            lastFour: data.lastFour || null,
          });
          if (data.exists) {
            setBankAccount(prev => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
            }));
          }
        } else {
          setBankAccountStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        setBankAccountStatus({ saved: false, loading: false, lastFour: null });
      }
    }
    checkBankAccountStatus();
  }, []);

  // handleConnectStripe - DISABLED: Stripe replaced by PayPal
  // handleResetStripe - DISABLED: Stripe replaced by PayPal

  const handleSaveBankAccount = async () => {
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

    setIsSavingBank(true);
    try {
      const response = await apiFetch("/api/creator/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ ...bankAccount, projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save bank account");
      }

      const data = await response.json();
      setBankAccountStatus({
        saved: true,
        loading: false,
        lastFour: data.lastFour,
      });
      setBankAccount(prev => ({
        ...prev,
        accountNumber: "",
        routingNumber: "",
      }));
      toast.success("Bank account saved securely!");
    } catch (error) {
      console.error("Failed to save bank account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save bank account");
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleSavePayments = async () => {
    if (!projectId) return;

    setIsSavingPayments(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          section: "payments",
          settings: paymentSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Payment settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingPayments(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PayPal Migration Banner — shown when project is still on Stripe */}
      {projectId && projectProcessor === "STRIPE" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Your campaign is using Stripe (legacy processor)
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
              IndieCrowdfund has switched to PayPal as the primary payment processor. Switch your live campaign now — existing pledges are unaffected, and new pledges will use PayPal checkout immediately. Make sure your PayPal payout email is set below before switching.
            </p>
          </div>
          <Button
            onClick={handleMigrateToPayPal}
            disabled={isMigrating}
            className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap flex-shrink-0"
          >
            {isMigrating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Switching...</>
            ) : (
              "Switch to PayPal"
            )}
          </Button>
        </div>
      )}

      {/* Stripe Connect Section - DISABLED: Stripe replaced by PayPal */}
      {/* <Card>...</Card> */}

      {/* PayPal Bank Payout Account Section */}
      <PayPalBankPayoutSection />

      {/* DivinityCoin Bank Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            DivinityCoin Settlement Account
          </CardTitle>
          <CardDescription>
            Enter your bank account details for DivinityCoin settlements. All data is encrypted and stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bankAccountStatus.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bankAccountStatus.saved ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg border-green-500">
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
                  className="bg-[#0066FF] hover:bg-[#0052CC]"
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

      <Separator />

      {/* Payment Collection Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Collection Settings</CardTitle>
          <CardDescription>Configure payment collection options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Auto-Retry Failed Payments</p>
              <p className="text-sm text-muted-foreground">Automatically retry failed charges after 3 days</p>
            </div>
            <Switch
              checked={paymentSettings.autoRetry}
              onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, autoRetry: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Send Payment Receipts</p>
              <p className="text-sm text-muted-foreground">Email receipts for successful charges</p>
            </div>
            <Switch
              checked={paymentSettings.sendReceipts}
              onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, sendReceipts: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Failed Payment Notifications</p>
              <p className="text-sm text-muted-foreground">Notify backers when their payment fails</p>
            </div>
            <Switch
              checked={paymentSettings.failedNotifications}
              onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, failedNotifications: checked })}
            />
          </div>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSavePayments} disabled={isSavingPayments}>
            {isSavingPayments ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Stripe Disconnect ConfirmDialog - DISABLED: Stripe replaced by PayPal */}
      {/* <ConfirmDialog ... /> */}
    </div>
  );
}
