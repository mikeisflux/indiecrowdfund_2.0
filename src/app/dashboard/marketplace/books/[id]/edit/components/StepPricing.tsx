"use client";

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
import { DollarSign } from "lucide-react";
import { BookFormData } from "./types";

interface StepPricingProps {
  formData: BookFormData;
  canEdit: boolean;
  isLive: boolean;
  updateForm: (field: keyof BookFormData, value: string | boolean | string[] | number | null) => void;
}

export function StepPricing({ formData, canEdit, isLive, updateForm }: StepPricingProps) {
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
          <Select
            value={formData.paymentProcessor}
            onValueChange={(value: "PAYPAL" | "DIVINITYCOIN" | "WHOP") => updateForm("paymentProcessor", value)}
            disabled={formData.isNsfw || (!canEdit && !isLive)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PAYPAL">PayPal (Card + PayPal Wallet)</SelectItem>
              <SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem>
              <SelectItem value="WHOP">Whop</SelectItem>
            </SelectContent>
          </Select>
          {formData.isNsfw && (
            <p className="text-xs text-amber-500 dark:text-amber-400">
              NSFW content requires DivinityCoin payment
            </p>
          )}
        </div>

        {/* Fee Breakdown */}
        <div className="p-4 rounded-xl bg-muted space-y-3">
          <h4 className="font-medium text-foreground">Fee Breakdown</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Your Price</span>
              <span>${parseFloat(formData.price || "0").toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Fee (3%)</span>
              <span>-${(parseFloat(formData.price || "0") * 0.03).toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold text-emerald-500 dark:text-emerald-400">
              <span>You Receive</span>
              <span>${(parseFloat(formData.price || "0") * 0.97).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
