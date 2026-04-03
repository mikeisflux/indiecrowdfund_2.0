"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
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
  Wallet,
  Banknote,
  ShoppingBag,
  CheckCircle,
  Loader2,
  Lock,
  Building2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

type Processor = "PAYPAL" | "DIVINITYCOIN" | "WHOP";

interface BankAccountState {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
}

interface BankStatus {
  saved: boolean;
  loading: boolean;
  lastFour: string | null;
  bankName?: string;
}

const EMPTY_BANK: BankAccountState = {
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  routingNumber: "",
  accountType: "checking",
};

const PROCESSORS = [
  {
    id: "PAYPAL" as Processor,
    label: "PayPal",
    description: "PayPal & card payments",
    icon: <Wallet className="h-5 w-5 text-white" />,
    iconBg: "bg-[#003087]",
    fees: "~6.5% total fees",
    detail: "Credit/debit cards + PayPal wallet",
    apiGet: "/api/creator/paypal-bank-account",
    apiPost: "/api/creator/paypal-bank-account",
    settlementNote: "Payouts are processed within 14 business days after your marketplace sale.",
  },
  {
    id: "DIVINITYCOIN" as Processor,
    label: "DivinityCoin",
    description: "Universal — all content types",
    icon: <Banknote className="h-5 w-5 text-white" />,
    iconBg: "bg-[#0066FF]",
    fees: "~6% total fees",
    detail: "3% partner + 3% platform",
    apiGet: "/api/creator/bank-account",
    apiPost: "/api/creator/bank-account",
    settlementNote: "DivinityCoin settlements are processed within 14 business days after your sale.",
  },
  {
    id: "WHOP" as Processor,
    label: "Whop",
    description: "Embedded checkout — all content types",
    icon: <ShoppingBag className="h-5 w-5 text-white" />,
    iconBg: "bg-black",
    fees: "~6% total fees",
    detail: "3% Whop + 3% platform",
    apiGet: "/api/creator/whop-bank-account",
    apiPost: "/api/creator/whop-bank-account",
    settlementNote: "Whop payouts are processed after your marketplace sale.",
  },
];

export function MarketplacePaymentSettings() {
  const [selectedProcessor, setSelectedProcessor] = useState<Processor>("PAYPAL");
  const [bankStatuses, setBankStatuses] = useState<Record<Processor, BankStatus>>({
    PAYPAL: { saved: false, loading: true, lastFour: null },
    DIVINITYCOIN: { saved: false, loading: true, lastFour: null },
    WHOP: { saved: false, loading: true, lastFour: null },
  });
  const [bankForms, setBankForms] = useState<Record<Processor, BankAccountState>>({
    PAYPAL: { ...EMPTY_BANK },
    DIVINITYCOIN: { ...EMPTY_BANK },
    WHOP: { ...EMPTY_BANK },
  });
  const [editingProcessor, setEditingProcessor] = useState<Processor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAllStatuses = useCallback(async () => {
    await Promise.all(
      PROCESSORS.map(async (proc) => {
        try {
          const res = await fetch(proc.apiGet);
          if (res.ok) {
            const data = await res.json();
            if (data.exists) {
              setBankStatuses((prev) => ({
                ...prev,
                [proc.id]: { saved: true, loading: false, lastFour: data.lastFour || null, bankName: data.bankName },
              }));
              setBankForms((prev) => ({
                ...prev,
                [proc.id]: {
                  ...prev[proc.id],
                  bankName: data.bankName || "",
                  accountHolder: data.accountHolder || "",
                  accountType: data.accountType || "checking",
                },
              }));
            } else {
              setBankStatuses((prev) => ({
                ...prev,
                [proc.id]: { saved: false, loading: false, lastFour: null },
              }));
            }
          } else {
            setBankStatuses((prev) => ({
              ...prev,
              [proc.id]: { saved: false, loading: false, lastFour: null },
            }));
          }
        } catch {
          setBankStatuses((prev) => ({
            ...prev,
            [proc.id]: { saved: false, loading: false, lastFour: null },
          }));
        }
      })
    );
  }, []);

  useEffect(() => {
    fetchAllStatuses();
  }, [fetchAllStatuses]);

  // Auto-select whichever processor has a saved bank account (prefer PAYPAL)
  useEffect(() => {
    const allLoaded = PROCESSORS.every((p) => !bankStatuses[p.id].loading);
    if (!allLoaded) return;
    const saved = PROCESSORS.find((p) => bankStatuses[p.id].saved);
    if (saved) setSelectedProcessor(saved.id);
  }, [bankStatuses]);

  const handleSave = async (processorId: Processor) => {
    const proc = PROCESSORS.find((p) => p.id === processorId)!;
    const form = bankForms[processorId];

    if (!form.bankName || !form.accountHolder || !form.accountNumber || !form.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }
    if (form.routingNumber.length !== 9) {
      toast.error("Routing number must be 9 digits");
      return;
    }
    if (form.accountNumber.length < 4 || form.accountNumber.length > 17) {
      toast.error("Please enter a valid account number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch(proc.apiPost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save bank account");
      }
      const data = await res.json();
      setBankStatuses((prev) => ({
        ...prev,
        [processorId]: { saved: true, loading: false, lastFour: data.lastFour, bankName: form.bankName },
      }));
      setBankForms((prev) => ({
        ...prev,
        [processorId]: { ...prev[processorId], accountNumber: "", routingNumber: "" },
      }));
      setEditingProcessor(null);
      toast.success("Bank account saved securely!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setIsSaving(false);
    }
  };

  const updateForm = (processorId: Processor, field: keyof BankAccountState, value: string) => {
    setBankForms((prev) => ({
      ...prev,
      [processorId]: { ...prev[processorId], [field]: value },
    }));
  };

  const activeProc = PROCESSORS.find((p) => p.id === selectedProcessor)!;
  const activeStatus = bankStatuses[selectedProcessor];
  const activeForm = bankForms[selectedProcessor];
  const showForm = editingProcessor === selectedProcessor || !activeStatus.saved;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Marketplace Payment Processor</h3>
        <p className="text-sm text-muted-foreground">
          Select how you want to receive payments from marketplace sales. You can change this at any time.
        </p>
      </div>

      {/* Processor Selection Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PROCESSORS.map((proc) => {
          const status = bankStatuses[proc.id];
          const isSelected = selectedProcessor === proc.id;
          return (
            <Card
              key={proc.id}
              className={`cursor-pointer transition-all ${
                isSelected ? "border-2 border-primary" : "border"
              }`}
              onClick={() => {
                setSelectedProcessor(proc.id);
                setEditingProcessor(null);
              }}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg ${proc.iconBg} flex items-center justify-center shrink-0`}>
                      {proc.icon}
                    </div>
                    {proc.label}
                  </CardTitle>
                  {isSelected && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <CardDescription className="text-xs mt-1">{proc.description}</CardDescription>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    <span>{proc.fees}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    <span>{proc.detail}</span>
                  </div>
                </div>
                {status.saved && (
                  <Badge variant="default" className="mt-2 bg-green-500 text-xs">
                    <Lock className="h-2.5 w-2.5 mr-1" />
                    Account saved
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bank Account Section for Selected Processor */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded ${activeProc.iconBg} flex items-center justify-center`}>
            {activeProc.icon}
          </div>
          <h4 className="font-medium">{activeProc.label} — Payout Account</h4>
        </div>

        <Card className={activeStatus.saved && !showForm ? "border-green-500" : ""}>
          <CardContent className="pt-6">
            {activeStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeStatus.saved && !showForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Bank Account Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {activeStatus.bankName} • Account ending in {activeStatus.lastFour}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activeProc.settlementNote}
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
                  onClick={() => setEditingProcessor(selectedProcessor)}
                >
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mp-bank-name">Bank Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="mp-bank-name"
                        placeholder="e.g., Chase Bank, Bank of America"
                        value={activeForm.bankName}
                        onChange={(e) => updateForm(selectedProcessor, "bankName", e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mp-account-holder">Account Holder Name</Label>
                    <Input
                      id="mp-account-holder"
                      placeholder="Name as it appears on account"
                      value={activeForm.accountHolder}
                      onChange={(e) => updateForm(selectedProcessor, "accountHolder", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mp-routing">Routing Number</Label>
                    <Input
                      id="mp-routing"
                      type="text"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="9-digit routing number"
                      value={activeForm.routingNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                        updateForm(selectedProcessor, "routingNumber", value);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">9 digits — bottom left of your checks</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mp-account-number">Account Number</Label>
                    <Input
                      id="mp-account-number"
                      type="password"
                      inputMode="numeric"
                      maxLength={17}
                      placeholder="Your account number"
                      value={activeForm.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                        updateForm(selectedProcessor, "accountNumber", value);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={activeForm.accountType}
                    onValueChange={(v: "checking" | "savings") =>
                      updateForm(selectedProcessor, "accountType", v)
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

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleSave(selectedProcessor)}
                    disabled={isSaving}
                    className={
                      selectedProcessor === "DIVINITYCOIN"
                        ? "bg-[#0066FF] hover:bg-[#0052CC]"
                        : selectedProcessor === "WHOP"
                        ? "bg-black hover:bg-zinc-800"
                        : ""
                    }
                  >
                    {isSaving ? (
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
                  {editingProcessor === selectedProcessor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProcessor(null)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{activeProc.settlementNote}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
