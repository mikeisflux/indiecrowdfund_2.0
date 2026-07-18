"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BillingAddress {
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
}

interface Props {
  idPrefix: string;
  value: BillingAddress;
  onChange: (next: BillingAddress) => void;
}

export function BillingAddressInputs({ idPrefix, value, onChange }: Props) {
  const set = (patch: Partial<BillingAddress>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 pt-2">
      <Label className="text-sm font-medium text-muted-foreground">Billing Address</Label>
      <p className="text-xs text-muted-foreground -mt-2">
        Required for KYC + chargeback reconciliation. Must match the address on the bank account.
      </p>
      <div className="grid gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-billing-line1`}>Address Line 1</Label>
          <Input
            id={`${idPrefix}-billing-line1`}
            placeholder="Street address"
            value={value.billingLine1}
            onChange={(e) => set({ billingLine1: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-billing-line2`}>Address Line 2 (optional)</Label>
          <Input
            id={`${idPrefix}-billing-line2`}
            placeholder="Apt, suite, etc."
            value={value.billingLine2}
            onChange={(e) => set({ billingLine2: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${idPrefix}-billing-city`}>City</Label>
            <Input
              id={`${idPrefix}-billing-city`}
              placeholder="City"
              value={value.billingCity}
              onChange={(e) => set({ billingCity: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-billing-state`}>State / County</Label>
            <Input
              id={`${idPrefix}-billing-state`}
              placeholder="State"
              value={value.billingState}
              onChange={(e) => set({ billingState: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${idPrefix}-billing-zip`}>ZIP / Postal Code</Label>
            <Input
              id={`${idPrefix}-billing-zip`}
              placeholder="12345"
              value={value.billingZip}
              onChange={(e) => set({ billingZip: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-billing-country`}>Country</Label>
            <Select
              value={value.billingCountry}
              onValueChange={(v) => set({ billingCountry: v })}
            >
              <SelectTrigger id={`${idPrefix}-billing-country`}>
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="AU">Australia</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="FR">France</SelectItem>
                <SelectItem value="IT">Italy</SelectItem>
                <SelectItem value="CH">Switzerland</SelectItem>
                <SelectItem value="JP">Japan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export const EMPTY_BILLING_ADDRESS: BillingAddress = {
  billingLine1: "",
  billingLine2: "",
  billingCity: "",
  billingState: "",
  billingZip: "",
  billingCountry: "US",
};

export function isBillingAddressComplete(addr: BillingAddress): boolean {
  return (
    addr.billingLine1.trim().length > 0 &&
    addr.billingCity.trim().length > 0 &&
    addr.billingZip.trim().length > 0 &&
    addr.billingCountry.trim().length > 0
  );
}
