"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Loader2 } from "lucide-react";
import { Step, RewardData, AddonData, ProjectData } from "../types";

interface OrderSummaryProps {
  step: Step;
  isAddItemsMode: boolean;
  isModifyMode?: boolean;
  originalPledgeAmount?: number;
  modifyChargeAmount?: number | null;
  selectedReward: RewardData | null;
  pledgeWithoutReward: boolean;
  customPledgeAmount: number;
  selectedAddons: Record<string, number>;
  addons: AddonData[];
  bonusSupport: number;
  setBonusSupport: (val: number) => void;
  totalShipping: number;
  addonsShipping: number;
  total: number;
  addItemsTotal: number;
  setStep: (step: Step) => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (val: boolean) => void;
  clientSecret: string | null;
  project: ProjectData | null;
  paymentError: string | null;
}

export function OrderSummary({
  step,
  isAddItemsMode,
  isModifyMode = false,
  originalPledgeAmount = 0,
  modifyChargeAmount,
  selectedReward,
  pledgeWithoutReward,
  customPledgeAmount,
  selectedAddons,
  addons,
  bonusSupport,
  setBonusSupport,
  totalShipping,
  addonsShipping,
  total,
  addItemsTotal,
  setStep,
  agreedToTerms,
  setAgreedToTerms,
  clientSecret,
  project,
  paymentError,
}: OrderSummaryProps) {
  // Order Summary for Add-ons step - Add Items Mode
  if (step === "addons" && isAddItemsMode) {
    return (
      <Card className="glass-card rounded-2xl border-border/50">
        <CardContent className="p-6">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Additional Items</p>

          {/* Selected Add-ons */}
          {Object.keys(selectedAddons).length > 0 ? (
            <div className="pb-4 border-b">
              {Object.entries(selectedAddons).map(([id, qty]) => {
                const addon = addons.find(a => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-sm py-1">
                    <span>{addon.title} x{qty}</span>
                    <span>${(Number(addon.amount) * qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pb-4 border-b">
              Select items to add to your pledge
            </p>
          )}

          {/* Shipping */}
          {addonsShipping > 0 && (
            <div className="py-4 border-b">
              <div className="flex justify-between text-sm">
                <span>Shipping from {project?.creator?.location || "creator"}</span>
                <span>${Number(addonsShipping).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">${addItemsTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Continue button */}
          <div className="mt-4">
            <Button
              className="w-full bg-gradient-to-r from-[#028858] to-emerald-600 hover:from-[#026d47] hover:to-emerald-700 text-white font-medium shadow-lg shadow-[#028858]/20"
              size="lg"
              onClick={() => setStep("payment")}
              disabled={Object.keys(selectedAddons).length === 0}
            >
              Continue to Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Order Summary for Add-ons step - Modify Mode
  if (step === "addons" && isModifyMode && (selectedReward || pledgeWithoutReward)) {
    const additionalCharge = Math.max(0, total - originalPledgeAmount);
    return (
      <Card className="glass-card rounded-2xl border-border/50">
        <CardContent className="p-5">
          {/* Previous pledge */}
          <div className="pb-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-1">Previous Pledge</p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Original amount</span>
              <span>${originalPledgeAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Selected reward */}
          <div className="py-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Updated pledge</p>
            {pledgeWithoutReward ? (
              <div className="flex justify-between">
                <span className="font-medium">No reward</span>
                <span className="font-semibold">${Number(customPledgeAmount).toFixed(2)}</span>
              </div>
            ) : selectedReward && (
              <div className="flex justify-between">
                <span className="font-medium">{selectedReward.title}</span>
                <span className="font-semibold">${Number(selectedReward.amount).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Add-ons */}
          {Object.keys(selectedAddons).length > 0 && (
            <div className="py-4 border-b">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Add-ons</p>
              {Object.entries(selectedAddons).map(([id, qty]) => {
                const addon = addons.find(a => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span>{addon.title} x{qty}</span>
                    <span>${(Number(addon.amount) * qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shipping */}
          {totalShipping > 0 && (
            <div className="py-4 border-b">
              <div className="flex justify-between text-sm">
                <span>Shipping from {project?.creator?.location || "creator"}</span>
                <span>${totalShipping.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* New total */}
          <div className="py-3 border-b">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">New total</span>
              <span className="font-medium">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Additional charge */}
          <div className="pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Additional charge</span>
              <span className="text-xl font-bold text-primary">${additionalCharge.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Only the difference will be charged.
            </p>
          </div>

          {/* Continue button */}
          <div className="mt-4">
            <Button
              className="w-full bg-gradient-to-r from-[#028858] to-emerald-600 hover:from-[#026d47] hover:to-emerald-700 text-white font-medium shadow-lg shadow-[#028858]/20"
              size="lg"
              onClick={() => setStep("payment")}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Order Summary for Add-ons step - Normal Mode
  if (step === "addons" && !isAddItemsMode && (selectedReward || pledgeWithoutReward)) {
    return (
      <Card className="glass-card rounded-2xl border-border/50">
        <CardContent className="p-5">
          {/* Selected reward */}
          <div className="pb-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Your pledge</p>
            {pledgeWithoutReward ? (
              <div className="flex justify-between">
                <span className="font-medium">No reward</span>
                <span className="font-semibold">${Number(customPledgeAmount).toFixed(2)}</span>
              </div>
            ) : selectedReward && (
              <div className="flex justify-between">
                <span className="font-medium">{selectedReward.title}</span>
                <span className="font-semibold">${Number(selectedReward.amount).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Add-ons */}
          {Object.keys(selectedAddons).length > 0 && (
            <div className="py-4 border-b">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Add-ons</p>
              {Object.entries(selectedAddons).map(([id, qty]) => {
                const addon = addons.find(a => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span>{addon.title} x{qty}</span>
                    <span>${(Number(addon.amount) * qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bonus support */}
          <div className="py-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Bonus support</p>
              <button className="text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center border rounded-md">
              <span className="px-3 text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                value={bonusSupport || ""}
                onChange={(e) => setBonusSupport(Number(e.target.value) || 0)}
                className="border-0 focus-visible:ring-0"
                placeholder="0"
              />
            </div>
          </div>

          {/* Shipping */}
          {totalShipping > 0 && (
            <div className="py-4 border-b">
              <div className="flex justify-between text-sm">
                <span>Shipping from {project?.creator?.location || "creator"}</span>
                <span>${totalShipping.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Continue button */}
          <div className="mt-4">
            <Button
              className="w-full bg-gradient-to-r from-[#028858] to-emerald-600 hover:from-[#026d47] hover:to-emerald-700 text-white font-medium shadow-lg shadow-[#028858]/20"
              size="lg"
              onClick={() => setStep("payment")}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Payment step sidebar - Add Items Mode
  if (step === "payment" && isAddItemsMode && Object.keys(selectedAddons).length > 0) {
    return (
      <Card className="glass-card rounded-2xl border-border/50">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Additional Items</p>

          {/* Selected Add-ons */}
          <div className="pb-4 border-b">
            {Object.entries(selectedAddons).map(([id, qty]) => {
              const addon = addons.find(a => a.id === id);
              if (!addon) return null;
              return (
                <div key={id} className="flex justify-between text-sm py-1">
                  <span>{addon.title} x{qty}</span>
                  <span>${(Number(addon.amount) * qty).toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          {/* Shipping */}
          {addonsShipping > 0 && (
            <div className="py-4 border-b">
              <div className="flex justify-between text-sm">
                <span>Shipping from {project?.creator?.location || "creator"}</span>
                <span>${addonsShipping.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Total amount */}
          <div className="py-4 border-b">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total amount</span>
              <span className="text-xl font-bold">${addItemsTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              This purchase will be charged immediately to your payment method.
            </p>

            <div className="flex items-start gap-3 mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
              <Checkbox
                id="terms-add-items"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-0.5 h-5 w-5 border-2"
              />
              <Label htmlFor="terms-add-items" className="text-sm leading-relaxed cursor-pointer">
                I understand that rewards or reimbursements aren&apos;t guaranteed by either IndieCrowdfund or the creator.
              </Label>
            </div>

            {/* Status message */}
            {!clientSecret && !paymentError && project?.paymentProcessor !== "PAYPAL" && project?.paymentProcessor !== "WHOP" ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Setting up payment...</span>
              </div>
            ) : (
              <p className="text-xs text-center text-muted-foreground">
                Complete your payment in the form above to finish your purchase.
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              By submitting, you agree to IndieCrowdfund&apos;s{" "}
              <Link href="/terms" className="underline">Terms of Use</Link>
              , and{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>
              , and for our payment processor, Stripe, to charge your payment method.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Payment step sidebar - Modify Mode
  if (step === "payment" && isModifyMode && (selectedReward || pledgeWithoutReward)) {
    const additionalCharge = modifyChargeAmount ?? Math.max(0, total - originalPledgeAmount);
    return (
      <Card className="glass-card rounded-2xl border-border/50">
        <CardContent className="p-5">
          {/* Previous pledge */}
          <div className="pb-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-1">Previous Pledge</p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Original amount</span>
              <span>${originalPledgeAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* New pledge breakdown */}
          <div className="py-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Updated Pledge</p>
            {/* Reward */}
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {pledgeWithoutReward ? "No reward" : selectedReward?.title}
              </span>
              <span>${Number(pledgeWithoutReward ? customPledgeAmount : selectedReward?.amount ?? 0).toFixed(2)}</span>
            </div>

            {/* Add-ons */}
            {Object.keys(selectedAddons).length > 0 && (
              <div className="mt-2">
                {Object.entries(selectedAddons).map(([id, qty]) => {
                  const addon = addons.find(a => a.id === id);
                  if (!addon) return null;
                  return (
                    <div key={id} className="flex justify-between text-sm py-0.5">
                      <span className="text-muted-foreground">{addon.title} x{qty}</span>
                      <span>${(Number(addon.amount) * qty).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shipping */}
          {totalShipping > 0 && (
            <div className="py-4 border-b">
              <div className="flex justify-between text-sm">
                <span>Shipping from {project?.creator?.location || "creator"}</span>
                <span>${totalShipping.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* New total */}
          <div className="py-3 border-b">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">New total</span>
              <span className="font-medium">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Additional charge - this is what will actually be charged */}
          <div className="py-4 border-b">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Additional charge</span>
              <span className="text-xl font-bold text-primary">${additionalCharge.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Only the difference will be charged to your payment method.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="py-4">
            <div className="flex items-start gap-3 mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
              <Checkbox
                id="terms-modify"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-0.5 h-5 w-5 border-2"
              />
              <Label htmlFor="terms-modify" className="text-sm leading-relaxed cursor-pointer">
                I understand that rewards or reimbursements aren&apos;t guaranteed by either IndieCrowdfund or the creator.
              </Label>
            </div>

            {!clientSecret && !paymentError && project?.paymentProcessor !== "PAYPAL" && project?.paymentProcessor !== "WHOP" ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Setting up payment...</span>
              </div>
            ) : (
              <p className="text-xs text-center text-muted-foreground">
                Complete your payment in the form above to finish the modification.
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              By submitting, you agree to IndieCrowdfund&apos;s{" "}
              <Link href="/terms" className="underline">Terms of Use</Link>
              {" "}and{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Payment step sidebar - Normal Mode
  if (step === "payment" && !isAddItemsMode && (selectedReward || pledgeWithoutReward)) {
    return (
      <Card className="glass-card rounded-2xl border-border/50">
        <CardContent className="p-5">
          {/* Reward */}
          <div className="pb-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-1">Reward</p>
            <div className="flex justify-between">
              <span className="font-medium uppercase text-sm">
                {pledgeWithoutReward ? "No reward" : selectedReward?.title}
              </span>
              <span className="font-semibold">${Number(pledgeWithoutReward ? customPledgeAmount : selectedReward?.amount ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Add-ons on payment page */}
          {Object.keys(selectedAddons).length > 0 && (
            <div className="py-4 border-b">
              {Object.entries(selectedAddons).map(([id, qty]) => {
                const addon = addons.find(a => a.id === id);
                if (!addon) return null;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span>{addon.title} x{qty}</span>
                    <span>${(Number(addon.amount) * qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shipping */}
          <div className="py-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-1">Shipping</p>
            <div className="flex justify-between text-sm">
              <span>From {project?.creator?.location || "creator"}</span>
              <span>${totalShipping.toFixed(2)}</span>
            </div>
          </div>

          {/* Total amount */}
          <div className="py-4 border-b">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total amount</span>
              <span className="text-xl font-bold">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {project?.campaignType === "KEEP_IT_ALL"
                ? "Your payment is collected immediately. The creator keeps all pledges regardless of the funding outcome."
                : "Backing means supporting a creative project, regardless of the outcome."
              }
            </p>

            <div className="flex items-start gap-3 mb-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                className="mt-0.5 h-5 w-5 border-2"
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                I understand that rewards or reimbursements aren&apos;t guaranteed by either IndieCrowdfund or the creator.
              </Label>
            </div>

            {/* Status message - show spinner while payment is being set up */}
            {!clientSecret && !paymentError && project?.paymentProcessor !== "PAYPAL" && project?.paymentProcessor !== "WHOP" ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Setting up payment...</span>
              </div>
            ) : (
              <p className="text-xs text-center text-muted-foreground">
                Complete your payment in the form above to finish your pledge.
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              By submitting your pledge, you agree to IndieCrowdfund&apos;s{" "}
              <Link href="/terms" className="underline">Terms of Use</Link>
              {" "}and{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>
              {project?.paymentProcessor === "DIVINITYCOIN"
                ? ", and for Divinity Payments to process your payment."
                : project?.paymentProcessor === "WHOP"
                ? ", and for Whop to process your payment."
                : ", and for PayPal to process your payment."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
