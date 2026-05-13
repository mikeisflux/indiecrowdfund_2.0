"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock, Wallet, Banknote, ShoppingBag, Loader2 } from "lucide-react";

// Marketplace creator payment settings.
//
// Active processors: DivinityCoin, PayPal, and Whop. Each creator's
// payout bank account lives at the user level, so saving it in project
// creation, IndieKit Payments tab, or here all flows to the same record.

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
          DivinityCoin, PayPal, and Whop handle marketplace transactions.
          Set up your payout bank account in IndieKit Payments — the same
          bank record is shared across projects and the marketplace.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#0066FF] flex items-center justify-center shrink-0">
                <Banknote className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">DivinityCoin</p>
                <p className="text-xs text-muted-foreground">~6% total fees</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  NSFW-friendly card processing via DC wallet/gift card.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#003087] flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">PayPal</p>
                <p className="text-xs text-muted-foreground">~6.5% total fees</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  PayPal Advanced Checkout. Cards + PayPal balances.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-black flex items-center justify-center shrink-0">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Whop</p>
                <p className="text-xs text-muted-foreground">~6% total fees</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  NSFW-friendly. Embedded checkout with broad payment support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(legacyDc.saved || legacyPaypal.saved || legacyWhop.saved) && (
        <div className="space-y-3">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Connected payout accounts</AlertTitle>
            <AlertDescription>
              These bank accounts are connected to your IndieCrowdfund profile
              and receive payouts for marketplace sales and campaigns on the
              matching processor.
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
