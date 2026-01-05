"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Loader2 } from "lucide-react";
import { SHIPPING_COUNTRIES } from "@/types";
import { Step, RewardData, AddonData, ProjectData } from "../types";

interface OrderSummaryProps {
  step: Step;
  isAddItemsMode: boolean;
  selectedReward: RewardData | null;
  pledgeWithoutReward: boolean;
  customPledgeAmount: number;
  selectedAddons: Record<string, number>;
  addons: AddonData[];
  bonusSupport: number;
  setBonusSupport: (val: number) => void;
  shippingCountry: string;
  totalShipping: number;
  addonsShipping: number;
  total: number;
  addItemsTotal: number;
  setStep: (step: Step) => void;
  agreedToTerms: boolean;
  setAgreedToTerms: (val: boolean) => void;
  clientSecret: string | null;
  project: ProjectData | null;
}

export function OrderSummary({
  step,
  isAddItemsMode,
  selectedReward,
  pledgeWithoutReward,
  customPledgeAmount,
  selectedAddons,
  addons,
  bonusSupport,
  setBonusSupport,
  shippingCountry,
  totalShipping,
  addonsShipping,
  total,
  addItemsTotal,
  setStep,
  agreedToTerms,
  setAgreedToTerms,
  clientSecret,
  project,
}: OrderSummaryProps) {
  const currentCountry = SHIPPING_COUNTRIES.find((c) => c.code === shippingCountry);

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
                    <span>${Number(addon.amount) * qty}</span>
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
                <span>Shipping to {currentCountry?.name}</span>
                <span>${addonsShipping}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">${addItemsTotal}</span>
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
                <span className="font-semibold">${customPledgeAmount}</span>
              </div>
            ) : selectedReward && (
              <div className="flex justify-between">
                <span className="font-medium">{selectedReward.title}</span>
                <span className="font-semibold">${selectedReward.amount}</span>
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
                    <span>${Number(addon.amount) * qty}</span>
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
                <span>Shipping to {currentCountry?.name}</span>
                <span>${totalShipping}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="pt-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">${total}</span>
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
                  <span>${Number(addon.amount) * qty}.00</span>
                </div>
              );
            })}
          </div>

          {/* Shipping */}
          {addonsShipping > 0 && (
            <div className="py-4 border-b">
              <div className="flex justify-between text-sm">
                <span>Shipping to {currentCountry?.name}</span>
                <span>${addonsShipping}.00</span>
              </div>
            </div>
          )}

          {/* Total amount */}
          <div className="py-4 border-b">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total amount</span>
              <span className="text-xl font-bold">${addItemsTotal}.00</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              This purchase will be charged immediately to your payment method.
            </p>

            <div className="flex items-start gap-3 mb-4">
              <Checkbox
                id="terms-add-items"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <Label htmlFor="terms-add-items" className="text-xs leading-relaxed text-muted-foreground">
                I understand that rewards or reimbursements aren&apos;t guaranteed by either IndieCrowdfund or the creator.
              </Label>
            </div>

            {/* Status message */}
            {!clientSecret ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Setting up payment...</span>
              </div>
            ) : (
              <p className="text-xs text-center text-muted-foreground">
                Enter your card details above to complete your purchase.
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
              <span className="font-semibold">${pledgeWithoutReward ? customPledgeAmount : selectedReward?.amount}.00</span>
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
                    <span>${Number(addon.amount) * qty}.00</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shipping */}
          <div className="py-4 border-b">
            <p className="text-xs font-medium text-muted-foreground mb-1">Shipping</p>
            <div className="flex justify-between text-sm">
              <span>{currentCountry?.name}</span>
              <span>${totalShipping}.00</span>
            </div>
          </div>

          {/* Total amount */}
          <div className="py-4 border-b">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total amount</span>
              <span className="text-xl font-bold">${total}.00</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Backing means supporting a creative project, regardless of the outcome.
            </p>

            <div className="flex items-start gap-3 mb-4">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <Label htmlFor="terms" className="text-xs leading-relaxed text-muted-foreground">
                I understand that rewards or reimbursements aren&apos;t guaranteed by either IndieCrowdfund or the creator.
              </Label>
            </div>

            {/* Status message - different for DivinityCoin vs Stripe */}
            {project?.paymentProcessor === "DIVINITYCOIN" ? (
              <p className="text-xs text-center text-muted-foreground py-2">
                Use DivinityCoin to complete your pledge.
              </p>
            ) : !clientSecret ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Setting up payment...</span>
              </div>
            ) : (
              <p className="text-xs text-center text-muted-foreground">
                Enter your card details above to complete your pledge.
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              By submitting your pledge, you agree to IndieCrowdfund&apos;s{" "}
              <Link href="/terms" className="underline">Terms of Use</Link>
              , and{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>
              {project?.paymentProcessor === "DIVINITYCOIN"
                ? ", and for DivinityCoin to process your payment."
                : ", and for our payment processor, Stripe, to charge your payment method."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
