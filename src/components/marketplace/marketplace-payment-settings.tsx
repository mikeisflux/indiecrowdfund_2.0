"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, Lock, Cloud, Wallet, Banknote, ShoppingBag, Loader2 } from "lucide-react";
import { UserChargebackCardSection } from "@/components/payments/user-chargeback-card-section";
import {
  PaymentCloudBankSection,
  type PaymentCloudBankAccountState,
  type PaymentCloudBankAccountStatus,
} from "@/components/project/builder/payment-sections";

// Marketplace creator payment settings (PaymentCloud-only).
//
// PaymentCloud is the only processor offered for new marketplace
// activity. The creator's PaymentCloud payout bank account and
// chargeback card both live at the user level, so saving them in
// project creation, IndieKit Payments tab, or here all flows to the
// same place — saving in one shows the locked / saved state in all.
//
// Any legacy DivinityCoin / PayPal / Whop bank account on the
// creator's record is shown read-only beneath the PaymentCloud
// section so creators with existing payouts in flight can still see
// where their money is going. The legacy "select a processor" UI is
// commented out (not deleted) for back-compat.

interface LegacyBankSummary {
  bankName: string | null;
  lastFour: string | null;
}

export function MarketplacePaymentSettings() {
  const [legacyDc, setLegacyDc] = useState<{ saved: boolean; data: LegacyBankSummary; loading: boolean }>({
    saved: false, data: { bankName: null, lastFour: null }, loading: true,
  });
  const [legacyPaypal, setLegacyPaypal] = useState<{ saved: boolean; data: LegacyBankSummary; loading: boolean }>({
    saved: false, data: { bankName: null, lastFour: null }, loading: true,
  });
  const [legacyWhop, setLegacyWhop] = useState<{ saved: boolean; data: LegacyBankSummary; loading: boolean }>({
    saved: false, data: { bankName: null, lastFour: null }, loading: true,
  });

  // PaymentCloud bank account is user-level. We hand local state into
  // the existing PaymentCloudBankSection (built for the project
  // creation step) and the section keeps it in sync with the API.
  const [pcBank, setPcBank] = useState<PaymentCloudBankAccountState>({
    bankName: "",
    firstName: "",
    lastName: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "US",
    bankCountry: "US",
    payoutPhone: "",
  });
  const [pcBankStatus, setPcBankStatus] = useState<PaymentCloudBankAccountStatus>({
    saved: false, loading: true, lastFour: null,
  });

  // Load PaymentCloud bank + any legacy bank accounts on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // PaymentCloud bank
      try {
        const r = await fetch("/api/creator/paymentcloud-bank-account");
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          setPcBankStatus({
            saved: !!data.exists,
            loading: false,
            lastFour: data.lastFour ?? null,
          });
          if (data.exists) {
            setPcBank((p) => ({
              ...p,
              bankName: data.bankName || "",
              accountType: data.accountType || "checking",
              bankCountry: data.bankCountry === "GB" ? "GB" : "US",
            }));
          }
        } else {
          setPcBankStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        if (!cancelled) setPcBankStatus({ saved: false, loading: false, lastFour: null });
      }

      // Legacy DC
      try {
        const r = await fetch("/api/creator/bank-account");
        if (!cancelled && r.ok) {
          const data = await r.json();
          setLegacyDc({
            saved: !!data.exists,
            data: { bankName: data.bankName || null, lastFour: data.lastFour || null },
            loading: false,
          });
        } else if (!cancelled) {
          setLegacyDc((p) => ({ ...p, loading: false }));
        }
      } catch {
        if (!cancelled) setLegacyDc((p) => ({ ...p, loading: false }));
      }

      // Legacy PayPal
      try {
        const r = await fetch("/api/creator/paypal-bank-account");
        if (!cancelled && r.ok) {
          const data = await r.json();
          setLegacyPaypal({
            saved: !!data.exists,
            data: { bankName: data.bankName || null, lastFour: data.lastFour || null },
            loading: false,
          });
        } else if (!cancelled) {
          setLegacyPaypal((p) => ({ ...p, loading: false }));
        }
      } catch {
        if (!cancelled) setLegacyPaypal((p) => ({ ...p, loading: false }));
      }

      // Legacy Whop
      try {
        const r = await fetch("/api/creator/whop-bank-account");
        if (!cancelled && r.ok) {
          const data = await r.json();
          setLegacyWhop({
            saved: !!data.exists,
            data: { bankName: data.bankName || null, lastFour: data.lastFour || null },
            loading: false,
          });
        } else if (!cancelled) {
          setLegacyWhop((p) => ({ ...p, loading: false }));
        }
      } catch {
        if (!cancelled) setLegacyWhop((p) => ({ ...p, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold">Marketplace Payment Processor</h3>
        <p className="text-sm text-muted-foreground">
          PaymentCloud handles all marketplace transactions. Setting up your
          payout bank or chargeback card here, on a project, or in IndieKit
          all save to the same record — fill it in once and you&apos;re done.
        </p>
      </div>

      {/* PaymentCloud processor card (the only selectable processor) */}
      <Card className="border-2 border-primary">
        <CardContent className="pt-6 pb-5 px-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shrink-0">
              <Cloud className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Mentom Payments</p>
                <Badge variant="default" className="bg-sky-600 text-xs">Recommended</Badge>
                <CheckCircle className="h-4 w-4 text-primary ml-auto" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Universal — supports all content types including NSFW. ~7.5% total fees (4% + $0.38/txn + 3% platform).
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Cards are tokenized in the buyer&apos;s browser by Mentom Payments — your sales data is never stored on our servers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legacy processor cards — DISABLED. Existing creators on
          DC/PayPal/Whop continue to settle through their original
          flows; new marketplace activity goes through PaymentCloud.
          Read-only summaries of any saved legacy accounts render
          below the PaymentCloud sections.

      <div className="grid gap-3 sm:grid-cols-3">
        {PROCESSORS.map((proc) => ( ... ))}
      </div>
      */}

      {/* PaymentCloud payout bank account (user-level — shared across
          project creation, IndieKit, and this page) */}
      <PaymentCloudBankSection
        bankAccount={pcBank}
        setBankAccount={setPcBank}
        status={pcBankStatus}
        setStatus={setPcBankStatus}
        projectId={null}
      />

      {/* Chargeback card (user-level — shared across all surfaces) */}
      <UserChargebackCardSection idPrefix="mkt-cb" />

      {/* Read-only display of any legacy bank accounts so creators can
          see their existing setup. Each row only renders when the
          corresponding API said `exists: true`. */}
      {(legacyDc.saved || legacyPaypal.saved || legacyWhop.saved) && (
        <div className="space-y-3">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Existing legacy payout accounts</AlertTitle>
            <AlertDescription>
              These bank accounts were set up before the PaymentCloud rollout
              and continue to receive payouts for active campaigns/sales they
              were attached to. New marketplace activity routes to your
              PaymentCloud bank above.
            </AlertDescription>
          </Alert>

          {legacyDc.saved && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#0066FF] flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">DivinityCoin — Bank Account Connected</p>
                  <p className="text-xs text-muted-foreground">
                    {legacyDc.data.bankName || "Saved"} • Account ending in {legacyDc.data.lastFour || "????"}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </CardContent>
            </Card>
          )}

          {legacyPaypal.saved && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#003087] flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">PayPal — Bank Account Connected</p>
                  <p className="text-xs text-muted-foreground">
                    {legacyPaypal.data.bankName || "Saved"} • Account ending in {legacyPaypal.data.lastFour || "????"}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </CardContent>
            </Card>
          )}

          {legacyWhop.saved && (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Whop — Bank Account Connected</p>
                  <p className="text-xs text-muted-foreground">
                    {legacyWhop.data.bankName || "Saved"} • Account ending in {legacyWhop.data.lastFour || "????"}
                  </p>
                </div>
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(legacyDc.loading || legacyPaypal.loading || legacyWhop.loading) && (
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-2" />
          Checking for existing payout accounts...
        </div>
      )}
    </div>
  );
}
