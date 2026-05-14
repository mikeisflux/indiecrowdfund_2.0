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
  Wallet,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentsSectionProps {
  projectId?: string;
}

type Processor = "PAYPAL" | "DIVINITYCOIN" | "WHOP" | "STRIPE";

interface BankAccountState {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
  // ISO 3166-1 alpha-2 of the bank's country. Drives routing-format
  // labels + validation (US 9-digit routing vs UK 6-digit Sort Code)
  // and whether the payout phone field is required. Defaults to "US".
  bankCountry: "US" | "GB";
  payoutPhone: string;
}

interface BankStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
  bankName?: string;
}

const PROCESSOR_META: Record<string, {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  apiGet: string;
  apiPost: string;
  settlementNote: string;
  accentColor: string;
}> = {
  PAYPAL: {
    label: "PayPal",
    icon: <Wallet className="h-5 w-5 text-white" />,
    iconBg: "bg-[#003087]",
    apiGet: "/api/creator/paypal-bank-account",
    apiPost: "/api/creator/paypal-bank-account",
    settlementNote: "Payouts are processed within 14 business days after your campaign funds successfully.",
    accentColor: "",
  },
  DIVINITYCOIN: {
    label: "Divinity Payments",
    icon: <Banknote className="h-5 w-5 text-white" />,
    iconBg: "bg-[#0066FF]",
    apiGet: "/api/creator/bank-account",
    apiPost: "/api/creator/bank-account",
    settlementNote: "Divinity Payments settlements are processed within 14 business days after your campaign ends.",
    accentColor: "bg-[#0066FF] hover:bg-[#0052CC]",
  },
  WHOP: {
    label: "Whop",
    icon: <ShoppingBag className="h-5 w-5 text-white" />,
    iconBg: "bg-black",
    apiGet: "/api/creator/whop-bank-account",
    apiPost: "/api/creator/whop-bank-account",
    settlementNote: "Whop payouts are processed after your campaign funds successfully.",
    accentColor: "bg-black hover:bg-zinc-800",
  },
};

export function PaymentsSection({ projectId }: PaymentsSectionProps) {
  const [projectProcessor, setProjectProcessor] = useState<Processor | null>(null);
  const [processorLoading, setProcessorLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  const [bankAccount, setBankAccount] = useState<BankAccountState>({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
    bankCountry: "US",
    payoutPhone: "",
  });
  const [bankStatus, setBankStatus] = useState<BankStatus>({
    saved: false,
    loading: true,
    lastFour: null,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    autoRetry: true,
    sendReceipts: true,
    failedNotifications: true,
  });

  // Fetch project processor
  useEffect(() => {
    if (!projectId) { setProcessorLoading(false); return; }
    async function fetchProcessor() {
      try {
        const res = await fetch(`/api/projects/${projectId}/payment`);
        if (res.ok) {
          const data = await res.json();
          setProjectProcessor(data.paymentProcessor || null);
        }
      } catch {
        // non-fatal
      } finally {
        setProcessorLoading(false);
      }
    }
    fetchProcessor();
  }, [projectId]);

  // Fetch bank account status once we know the processor
  useEffect(() => {
    if (!projectProcessor || projectProcessor === "STRIPE") {
      setBankStatus({ saved: false, loading: false, lastFour: null });
      return;
    }
    const meta = PROCESSOR_META[projectProcessor];
    if (!meta) { setBankStatus({ saved: false, loading: false, lastFour: null }); return; }

    async function fetchBankStatus() {
      try {
        const res = await fetch(meta.apiGet);
        if (res.ok) {
          const data = await res.json();
          if (data.exists) {
            setBankStatus({ saved: true, loading: false, lastFour: data.lastFour || null, bankName: data.bankName });
            setBankAccount((prev) => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
              bankCountry: data.bankCountry === "GB" ? "GB" : "US",
            }));
          } else {
            setBankStatus({ saved: false, loading: false, lastFour: null });
          }
        } else {
          setBankStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        setBankStatus({ saved: false, loading: false, lastFour: null });
      }
    }
    fetchBankStatus();
  }, [projectProcessor]);

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

  const handleSaveBankAccount = async () => {
    if (!projectProcessor) return;
    const meta = PROCESSOR_META[projectProcessor];
    if (!meta) return;

    if (!bankAccount.bankName || !bankAccount.accountHolder ||
        !bankAccount.accountNumber || !bankAccount.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }

    // Country-specific validation — US 9-digit ABA routing number vs
    // UK 6-digit Sort Code, and UK requires a payout phone on file.
    const isUKSubmit = bankAccount.bankCountry === "GB";
    if (isUKSubmit) {
      if (!/^\d{6}$/.test(bankAccount.routingNumber)) {
        toast.error("UK sort code must be 6 digits (e.g. 60-06-39)");
        return;
      }
      if (!/^\d{8}$/.test(bankAccount.accountNumber)) {
        toast.error("UK account number must be 8 digits");
        return;
      }
      if (!bankAccount.payoutPhone || bankAccount.payoutPhone.trim().length < 7) {
        toast.error("Phone number is required for UK bank accounts");
        return;
      }
    } else {
      if (bankAccount.routingNumber.length !== 9) {
        toast.error("Routing number must be 9 digits");
        return;
      }
      if (bankAccount.accountNumber.length < 4 || bankAccount.accountNumber.length > 17) {
        toast.error("Please enter a valid account number");
        return;
      }
    }

    setIsSavingBank(true);
    try {
      const res = await apiFetch(meta.apiPost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bankAccount, projectId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save bank account");
      }
      const data = await res.json();
      setBankStatus({ saved: true, loading: false, lastFour: data.lastFour, bankName: bankAccount.bankName });
      setBankAccount((prev) => ({ ...prev, accountNumber: "", routingNumber: "", payoutPhone: "" }));
      setIsEditing(false);
      toast.success("Bank account saved securely!");
    } catch (error) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, section: "payments", settings: paymentSettings }),
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

  if (processorLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const procMeta = projectProcessor ? PROCESSOR_META[projectProcessor] : null;
  const showForm = isEditing || !bankStatus.saved;
  const isUK = bankAccount.bankCountry === "GB";

  return (
    <div className="space-y-6">
      {/* Legacy Stripe migration banner */}
      {projectProcessor === "STRIPE" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Your campaign is using Stripe (legacy processor)
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
              IndieCrowdfund has switched to PayPal as the primary payment processor. Switch your live campaign now — existing pledges are unaffected, and new pledges will use PayPal checkout immediately.
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

      {procMeta && projectProcessor !== "STRIPE" && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <div className={`h-8 w-8 rounded-lg ${procMeta.iconBg} flex items-center justify-center shrink-0`}>
            {procMeta.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Payment Processor: {procMeta.label}</p>
            <p className="text-xs text-muted-foreground">
              Set at campaign creation — cannot be changed after launch.
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        </div>
      )}

      {/* Bank account section — for non-Stripe processors */}
      {procMeta && projectProcessor !== "STRIPE" && (
        <Card className={bankStatus.saved && !showForm ? "border-green-500" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded ${procMeta.iconBg} flex items-center justify-center shrink-0`}>
                {procMeta.icon}
              </div>
              {procMeta.label} — Payout Account
            </CardTitle>
            <CardDescription>
              Your bank account for {procMeta.label} settlements. All data is AES-256 encrypted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bankStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bankStatus.saved && !showForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg border-green-500">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Bank Account Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {bankStatus.bankName} • Account ending in {bankStatus.lastFour}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {procMeta.settlementNote}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500">
                    <Lock className="h-3 w-3 mr-1" />
                    Secured
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Update Bank Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Secure &amp; Encrypted</AlertTitle>
                  <AlertDescription>
                    Your bank account information is encrypted using AES-256 before storage.
                    We never store unencrypted account numbers.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="ik-bank-country">Bank Country</Label>
                  <Select
                    value={bankAccount.bankCountry}
                    onValueChange={(v: "US" | "GB") =>
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
                    <SelectTrigger id="ik-bank-country" className="w-full sm:w-[280px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ik-bank-name">Bank Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="ik-bank-name"
                        placeholder={isUK ? "e.g., Barclays, HSBC, Lloyds" : "e.g., Chase Bank, Bank of America"}
                        value={bankAccount.bankName}
                        onChange={(e) => setBankAccount((prev) => ({ ...prev, bankName: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ik-account-holder">Account Holder Name</Label>
                    <Input
                      id="ik-account-holder"
                      placeholder="Name as it appears on account"
                      value={bankAccount.accountHolder}
                      onChange={(e) => setBankAccount((prev) => ({ ...prev, accountHolder: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ik-routing">{isUK ? "Sort Code" : "Routing Number"}</Label>
                    <Input
                      id="ik-routing"
                      type="text"
                      inputMode="numeric"
                      maxLength={isUK ? 6 : 9}
                      placeholder={isUK ? "6 digits (e.g. 600639)" : "9-digit routing number"}
                      value={bankAccount.routingNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, isUK ? 6 : 9);
                        setBankAccount((prev) => ({ ...prev, routingNumber: value }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {isUK ? "6 digits — your bank's sort code" : "9 digits — bottom left of your checks"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ik-account-number">Account Number</Label>
                    <Input
                      id="ik-account-number"
                      type="password"
                      inputMode="numeric"
                      maxLength={isUK ? 8 : 17}
                      placeholder={isUK ? "8 digits" : "Your account number"}
                      value={bankAccount.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, isUK ? 8 : 17);
                        setBankAccount((prev) => ({ ...prev, accountNumber: value }));
                      }}
                    />
                  </div>
                </div>

                {isUK ? (
                  <div className="space-y-2">
                    <Label htmlFor="ik-payout-phone">Phone Number</Label>
                    <Input
                      id="ik-payout-phone"
                      type="tel"
                      placeholder="e.g. 07951 937383"
                      value={bankAccount.payoutPhone}
                      onChange={(e) => setBankAccount((prev) => ({ ...prev, payoutPhone: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required by UK banks on the payee record.
                    </p>
                  </div>
                ) : (
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
                )}

                {isUK && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                    <p className="font-semibold mb-1">International payment fee</p>
                    <p>
                      Payouts to non-US bank accounts are sent by international
                      wire in your local currency. A <strong>$25 wire fee + 1.50% currency conversion fee</strong>{" "}
                      will be added on top of the standard{" "}
                      {procMeta.label} processing + platform fees.
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveBankAccount}
                    disabled={isSavingBank}
                    className={procMeta.accentColor || undefined}
                  >
                    {isSavingBank ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Encrypting &amp; Saving...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Save Bank Account
                      </>
                    )}
                  </Button>
                  {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{procMeta.settlementNote}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
