"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { BookFormData } from "./types";

interface StepPricingProps {
  formData: BookFormData;
  canEdit: boolean;
  isLive: boolean;
  bookId: string;
  updateForm: (field: keyof BookFormData, value: string | boolean | string[] | number | null) => void;
}

export function StepPricing({ formData, canEdit, isLive, bookId, updateForm }: StepPricingProps) {
  const [savingProcessor, setSavingProcessor] = useState(false);

  const handleSaveProcessor = async () => {
    setSavingProcessor(true);
    try {
      const res = await apiFetch(
        `/api/creator/marketplace/books/${bookId}/payment-processor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentProcessor: formData.paymentProcessor }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to update payment processor");
        return;
      }
      toast.success(
        data.unchanged
          ? "Payment processor already set"
          : "Payment processor updated"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingProcessor(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <DollarSign className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          Pricing & Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Price *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0.99"
                placeholder="9.99"
                value={formData.price}
                onChange={(e) => updateForm("price", e.target.value)}
                disabled={!canEdit && !isLive}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={formData.currency}
              onValueChange={(value) => updateForm("currency", value)}
              disabled={!canEdit && !isLive}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Payment Processor</Label>
          <div className="flex gap-2">
            <Select
              value={formData.paymentProcessor}
              onValueChange={(value: "PAYPAL" | "DIVINITYCOIN" | "WHOP") => updateForm("paymentProcessor", value)}
              disabled={formData.isNsfw}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAYPAL">PayPal (Card + PayPal Wallet)</SelectItem>
                <SelectItem value="DIVINITYCOIN">Divinity Payments</SelectItem>
                <SelectItem value="WHOP">Whop</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveProcessor}
              disabled={savingProcessor || formData.isNsfw}
              className="shrink-0"
            >
              {savingProcessor ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="ml-2">Save</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Switch processors anytime — saved immediately, no re-review needed.
          </p>
          {formData.isNsfw && (
            <p className="text-xs text-amber-500 dark:text-amber-400">
              NSFW content requires Divinity Payments
            </p>
          )}
        </div>

        {/* Fee Breakdown */}
        {(() => {
          const price = parseFloat(formData.price || "0");
          const platformFee = price * 0.03;
          // Per-processor effective rate on a single sale.
          //   PayPal:    3.49% + $0.49
          //   Divinity:  3% + $0.30
          //   Whop:      3.5% + $0.37 (US cards; 2.7% payment processing
          //              + 0.8% orchestration + $0.30 fixed + $0.07 Radar)
          const processor = formData.paymentProcessor;
          const processorPct =
            processor === "PAYPAL" ? 0.0349
            : processor === "WHOP" ? 0.035
            : 0.03;
          const processorFlat =
            processor === "PAYPAL" ? 0.49
            : processor === "WHOP" ? 0.37
            : 0.30;
          const processorLabel =
            processor === "PAYPAL" ? "PayPal Fee (3.49% + $0.49)"
            : processor === "WHOP" ? "Whop Fee (3.5% + $0.37)"
            : "Divinity Payments Fee (3% + $0.30)";
          const processorFee = price * processorPct + processorFlat;
          const youReceive = Math.max(0, price - platformFee - processorFee);
          return (
            <div className="p-4 rounded-xl bg-muted space-y-3">
              <h4 className="font-medium text-foreground">Fee Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Your Price</span>
                  <span>${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform Fee (3%)</span>
                  <span>-${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>{processorLabel}</span>
                  <span>-${processorFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold text-emerald-500 dark:text-emerald-400">
                  <span>You Receive</span>
                  <span>${youReceive.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
