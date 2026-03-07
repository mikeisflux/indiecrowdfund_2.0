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
  CreditCard,
  Loader2,
  CheckCircle,
  RefreshCw,
  Banknote,
  Lock,
  Building2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PaymentsSectionProps {
  projectId?: string;
}

export function PaymentsSection({ projectId }: PaymentsSectionProps) {
  // Stripe Connect state
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboarded: boolean;
    loading: boolean;
    error: string | null;
  }>({ connected: false, onboarded: false, loading: true, error: null });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isResettingStripe, setIsResettingStripe] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  // Check Stripe connection status on mount
  useEffect(() => {
    async function checkStripeStatus() {
      try {
        const response = await fetch("/api/stripe/connect");
        const data = await response.json();

        if (!response.ok) {
          setStripeStatus({
            connected: false,
            onboarded: false,
            loading: false,
            error: data.error || "Failed to check status",
          });
          return;
        }

        setStripeStatus({
          connected: data.connected || false,
          onboarded: data.onboarded || false,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to check Stripe status:", error);
        setStripeStatus({
          connected: false,
          onboarded: false,
          loading: false,
          error: "Network error checking status"
        });
      }
    }
    checkStripeStatus();
  }, []);

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

  const handleConnectStripe = async () => {
    setIsConnectingStripe(true);
    setConnectError(null);
    try {
      const response = await apiFetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to connect Stripe");
        return;
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Stripe connection:", error);
      setConnectError("Network error connecting to Stripe");
    } finally {
      setIsConnectingStripe(false);
    }
  };

  const handleResetStripe = async () => {
    setIsResettingStripe(true);
    setConnectError(null);
    try {
      const response = await apiFetch("/api/stripe/connect/reset", {
        method: "DELETE",
,
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to reset Stripe");
        return;
      }

      setStripeStatus({
        connected: false,
        onboarded: false,
        loading: false,
        error: null,
      });
      setShowResetConfirm(false);
    } catch (error) {
      console.error("Failed to reset Stripe connection:", error);
      setConnectError("Network error resetting Stripe");
    } finally {
      setIsResettingStripe(false);
    }
  };

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
      {/* Stripe Connect Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connect Your Stripe Account</CardTitle>
          <CardDescription>Connect or create a Stripe account to receive payouts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show errors if any */}
          {(stripeStatus.error || connectError) && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Stripe Connection Issue</AlertTitle>
              <AlertDescription className="space-y-3">
                <span>{stripeStatus.error || connectError}</span>
                {connectError?.includes("already connected") && (
                  <div className="flex flex-col gap-2">
                    <span>
                      If you previously connected a Stripe account but never completed onboarding,
                      you can reset your connection and try again.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={isResettingStripe}
                      className="w-fit"
                    >
                      {isResettingStripe ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reset Stripe Connection
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className={`p-4 border rounded-lg ${stripeStatus.onboarded ? "border-green-500" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                  stripeStatus.onboarded ? "bg-green-500" : "bg-[#635BFF]"
                }`}>
                  {stripeStatus.onboarded ? (
                    <CheckCircle className="h-6 w-6 text-white" />
                  ) : (
                    <CreditCard className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {stripeStatus.onboarded ? "Stripe Connected" : "Stripe Connect"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stripeStatus.loading ? (
                      "Checking connection status..."
                    ) : stripeStatus.onboarded ? (
                      "Your Stripe account is connected and ready to receive payments."
                    ) : stripeStatus.connected ? (
                      "Your Stripe account is connected but onboarding is incomplete. Click to continue setup."
                    ) : (
                      "Connect or create a Stripe account to receive payouts. You'll complete identity verification through Stripe's secure process."
                    )}
                  </p>
                </div>
              </div>
              {stripeStatus.onboarded ? (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isResettingStripe}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {isResettingStripe ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleConnectStripe}
                  disabled={isConnectingStripe || stripeStatus.loading}
                  className="bg-[#635BFF] hover:bg-[#5851ea]"
                >
                  {stripeStatus.loading ? "Checking..." : isConnectingStripe ? "Connecting..." : stripeStatus.connected ? "Complete Setup" : "Connect Stripe"}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {!stripeStatus.onboarded && (
            <p className="text-xs text-muted-foreground">
              Don&apos;t have a Stripe account?{" "}
              <a
                href="https://stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Sign up for free
              </a>
              {" "}&bull; It only takes a few minutes to get started
            </p>
          )}
        </CardContent>
      </Card>

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

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Disconnect Stripe Account?"
        description="Are you sure you want to disconnect your Stripe account? You will need to reconnect it to accept payments."
        confirmText="Disconnect"
        variant="destructive"
        onConfirm={handleResetStripe}
        loading={isResettingStripe}
      />
    </div>
  );
}
