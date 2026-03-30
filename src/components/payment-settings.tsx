"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

interface StripeStatus {
  connected: boolean;
  onboarded: boolean;
  accountId?: string;
  loading: boolean;
  error: string | null;
}

interface BankAccountStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
  bankName?: string;
  accountHolder?: string;
  accountType?: "checking" | "savings";
}

interface PaymentSettingsProps {
  /** Optional project ID for project-specific settings */
  projectId?: string;
  /** Whether to show the DivinityCoin bank account section */
  showDivinityCoin?: boolean;
  /** Custom title for the component */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom class name */
  className?: string;
  /** Callback when Stripe status changes */
  onStripeStatusChange?: (status: StripeStatus) => void;
  /** Use compact layout */
  compact?: boolean;
}

export function PaymentSettings({
  projectId,
  showDivinityCoin = true,
  title = "Payment Settings",
  description = "Connect your Stripe account to receive payments",
  className,
  onStripeStatusChange,
  compact = false,
}: PaymentSettingsProps) {
  // Stripe Connect state
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus>({
    connected: false,
    onboarded: false,
    loading: true,
    error: null,
  });
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
  const [bankAccountStatus, setBankAccountStatus] = useState<BankAccountStatus>({
    saved: false,
    loading: true,
    lastFour: null,
  });
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Check Stripe connection status
  const checkStripeStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/connect");
      const data = await response.json();

      if (!response.ok) {
        const newStatus = {
          connected: false,
          onboarded: false,
          loading: false,
          error: data.error || "Failed to check status",
        };
        setStripeStatus(newStatus);
        onStripeStatusChange?.(newStatus);
        return;
      }

      const newStatus = {
        connected: data.connected || false,
        onboarded: data.onboarded || false,
        accountId: data.accountId,
        loading: false,
        error: null,
      };
      setStripeStatus(newStatus);
      onStripeStatusChange?.(newStatus);
    } catch (error) {
      console.error("Failed to check Stripe status:", error);
      const newStatus = {
        connected: false,
        onboarded: false,
        loading: false,
        error: "Network error checking status",
      };
      setStripeStatus(newStatus);
      onStripeStatusChange?.(newStatus);
    }
  }, [onStripeStatusChange]);

  // Check DivinityCoin bank account status
  const checkBankAccountStatus = useCallback(async () => {
    if (!showDivinityCoin) return;

    try {
      const response = await fetch("/api/creator/bank-account");
      if (response.ok) {
        const data = await response.json();
        setBankAccountStatus({
          saved: data.exists,
          loading: false,
          lastFour: data.lastFour || null,
          bankName: data.bankName,
          accountHolder: data.accountHolder,
          accountType: data.accountType,
        });
        if (data.exists) {
          setBankAccount((prev) => ({
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
  }, [showDivinityCoin]);

  useEffect(() => {
    checkStripeStatus();
    checkBankAccountStatus();
  }, [checkStripeStatus, checkBankAccountStatus]);

  // Stripe Connect handlers
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
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to reset Stripe");
        return;
      }

      const newStatus = {
        connected: false,
        onboarded: false,
        loading: false,
        error: null,
      };
      setStripeStatus(newStatus);
      onStripeStatusChange?.(newStatus);
      setShowResetConfirm(false);
      toast.success("Stripe account disconnected");
    } catch (error) {
      console.error("Failed to reset Stripe connection:", error);
      setConnectError("Network error resetting Stripe");
    } finally {
      setIsResettingStripe(false);
    }
  };

  // DivinityCoin bank account handler
  const handleSaveBankAccount = async () => {
    if (
      !bankAccount.bankName ||
      !bankAccount.accountHolder ||
      !bankAccount.accountNumber ||
      !bankAccount.routingNumber
    ) {
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
        bankName: bankAccount.bankName,
        accountHolder: bankAccount.accountHolder,
        accountType: bankAccount.accountType,
      });
      setBankAccount((prev) => ({
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

  return (
    <div className={cn("space-y-6", className)}>
      {/* Stripe Connect Section */}
      <Card className={compact ? "bg-white/5 backdrop-blur-md border-white/10" : ""}>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", compact && "text-white")}>
            <CreditCard className="h-5 w-5 text-[#635BFF]" />
            {title}
          </CardTitle>
          <CardDescription className={compact ? "text-white/60" : ""}>
            {description}
          </CardDescription>
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

          <div
            className={cn(
              "p-4 border rounded-lg",
              stripeStatus.onboarded && "border-green-500",
              compact && "bg-white/5 border-white/20"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                    stripeStatus.onboarded ? "bg-green-500" : "bg-[#635BFF]"
                  )}
                >
                  {stripeStatus.onboarded ? (
                    <CheckCircle className="h-6 w-6 text-white" />
                  ) : (
                    <CreditCard className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <p className={cn("font-medium", compact && "text-white")}>
                    {stripeStatus.onboarded ? "Stripe Connected" : "Stripe Connect"}
                  </p>
                  <p className={cn("text-sm", compact ? "text-white/60" : "text-muted-foreground")}>
                    {stripeStatus.loading ? (
                      "Checking connection status..."
                    ) : stripeStatus.onboarded ? (
                      <>Your Stripe account is connected and ready to receive payments.</>
                    ) : stripeStatus.connected ? (
                      "Your Stripe account is connected but onboarding is incomplete. Click to continue setup."
                    ) : (
                      "Connect or create a Stripe account to receive payouts."
                    )}
                  </p>
                  {stripeStatus.onboarded && stripeStatus.accountId && (
                    <p className={cn("text-xs mt-1", compact ? "text-white/40" : "text-muted-foreground")}>
                      Account ID: {stripeStatus.accountId}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stripeStatus.onboarded ? (
                  <>
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowResetConfirm(true)}
                      disabled={isResettingStripe}
                      className={cn(
                        "hover:text-destructive",
                        compact ? "text-white/60" : "text-muted-foreground"
                      )}
                    >
                      {isResettingStripe ? "..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleConnectStripe}
                    disabled={isConnectingStripe || stripeStatus.loading}
                    className="bg-[#635BFF] hover:bg-[#5851ea]"
                  >
                    {stripeStatus.loading
                      ? "Checking..."
                      : isConnectingStripe
                        ? "Connecting..."
                        : stripeStatus.connected
                          ? "Complete Setup"
                          : "Connect Stripe"}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {stripeStatus.onboarded && (
            <Button variant="outline" size="sm" asChild className={compact ? "border-white/20 text-white hover:bg-white/10" : ""}>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                Open Stripe Dashboard
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}

          {!stripeStatus.onboarded && (
            <p className={cn("text-xs", compact ? "text-white/40" : "text-muted-foreground")}>
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
      {showDivinityCoin && (
        <Card className={compact ? "bg-white/5 backdrop-blur-md border-white/10" : ""}>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", compact && "text-white")}>
              <Banknote className="h-5 w-5" />
              DivinityCoin Settlement Account
            </CardTitle>
            <CardDescription className={compact ? "text-white/60" : ""}>
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
                <div
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-lg border-green-500",
                    compact && "bg-white/5"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className={cn("font-medium", compact && "text-white")}>Bank Account Connected</p>
                      <p className={cn("text-sm", compact ? "text-white/60" : "text-muted-foreground")}>
                        {bankAccountStatus.bankName} • Account ending in {bankAccountStatus.lastFour}
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
                  onClick={() => setBankAccountStatus((prev) => ({ ...prev, saved: false }))}
                  className={compact ? "border-white/20 text-white hover:bg-white/10" : ""}
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
                    Your bank account information is encrypted using AES-256 encryption before storage. We never
                    store unencrypted account numbers.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name" className={compact ? "text-white" : ""}>
                      Bank Name
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="bank-name"
                        placeholder="e.g., Chase Bank"
                        value={bankAccount.bankName}
                        onChange={(e) => setBankAccount((prev) => ({ ...prev, bankName: e.target.value }))}
                        className={cn("pl-10", compact && "bg-white/10 border-white/20 text-white placeholder:text-white/40")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-holder" className={compact ? "text-white" : ""}>
                      Account Holder Name
                    </Label>
                    <Input
                      id="account-holder"
                      placeholder="Name as it appears on account"
                      value={bankAccount.accountHolder}
                      onChange={(e) => setBankAccount((prev) => ({ ...prev, accountHolder: e.target.value }))}
                      className={compact ? "bg-white/10 border-white/20 text-white placeholder:text-white/40" : ""}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="routing-number" className={compact ? "text-white" : ""}>
                      Routing Number
                    </Label>
                    <Input
                      id="routing-number"
                      type="text"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="9-digit routing number"
                      value={bankAccount.routingNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                        setBankAccount((prev) => ({ ...prev, routingNumber: value }));
                      }}
                      className={compact ? "bg-white/10 border-white/20 text-white placeholder:text-white/40" : ""}
                    />
                    <p className={cn("text-xs", compact ? "text-white/40" : "text-muted-foreground")}>
                      9 digits, found on the bottom left of your checks
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number" className={compact ? "text-white" : ""}>
                      Account Number
                    </Label>
                    <Input
                      id="account-number"
                      type="password"
                      inputMode="numeric"
                      maxLength={17}
                      placeholder="Your account number"
                      value={bankAccount.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                        setBankAccount((prev) => ({ ...prev, accountNumber: value }));
                      }}
                      className={compact ? "bg-white/10 border-white/20 text-white placeholder:text-white/40" : ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={compact ? "text-white" : ""}>Account Type</Label>
                  <Select
                    value={bankAccount.accountType}
                    onValueChange={(value: "checking" | "savings") =>
                      setBankAccount((prev) => ({ ...prev, accountType: value }))
                    }
                  >
                    <SelectTrigger className={cn("w-full sm:w-[200px]", compact && "bg-white/10 border-white/20 text-white")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={handleSaveBankAccount} disabled={isSavingBank} className="bg-[#0066FF] hover:bg-[#0052CC]">
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

                <p className={cn("text-xs", compact ? "text-white/40" : "text-muted-foreground")}>
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
      )}

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

/**
 * Hook to check Stripe connection status
 */
export function useStripeStatus() {
  const [status, setStatus] = useState<StripeStatus>({
    connected: false,
    onboarded: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch("/api/stripe/connect");
        const data = await response.json();

        if (!response.ok) {
          setStatus({
            connected: false,
            onboarded: false,
            loading: false,
            error: data.error || "Failed to check status",
          });
          return;
        }

        setStatus({
          connected: data.connected || false,
          onboarded: data.onboarded || false,
          accountId: data.accountId,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to check Stripe status:", error);
        setStatus({
          connected: false,
          onboarded: false,
          loading: false,
          error: "Network error checking status",
        });
      }
    }

    checkStatus();
  }, []);

  const refresh = async () => {
    setStatus((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch("/api/stripe/connect");
      const data = await response.json();

      setStatus({
        connected: data.connected || false,
        onboarded: data.onboarded || false,
        accountId: data.accountId,
        loading: false,
        error: response.ok ? null : data.error,
      });
    } catch {
      setStatus((prev) => ({ ...prev, loading: false, error: "Network error" }));
    }
  };

  return { ...status, refresh };
}
