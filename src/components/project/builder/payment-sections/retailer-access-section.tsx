"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { RetailerAccessSectionProps } from "./types";

export function RetailerAccessSection({ payment, updatePayment }: RetailerAccessSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Store className="h-5 w-5" />
          Retailer Access (LCS Program)
        </h3>
        <p className="text-sm text-muted-foreground">
          Allow certified retailers to purchase your products at wholesale pricing
        </p>
      </div>

      <Card className={payment.allowRetailerPledges ? "border-primary" : ""}>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="allow-retailers"
              checked={payment.allowRetailerPledges || false}
              onCheckedChange={(checked) =>
                updatePayment({ allowRetailerPledges: checked as boolean })
              }
            />
            <div className="flex-1">
              <Label htmlFor="allow-retailers" className="font-medium">
                Enable retailer wholesale orders
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Certified retailers (comic shops, bookstores, etc.) will be able to place bulk orders
                at a discounted wholesale price. This can help increase your project&apos;s reach and
                get your product into physical stores.
              </p>
            </div>
          </div>

          {payment.allowRetailerPledges && (
            <div className="mt-6 space-y-4 border-t pt-4">
              <Alert className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your project will be visible to all certified retailers in our LCS Program.
                  Retailers must place orders that meet your minimum quantity requirement.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="retailer-discount">Wholesale Discount (%)</Label>
                  <Select
                    value={String(payment.retailerDiscount || 50)}
                    onValueChange={(value) =>
                      updatePayment({ retailerDiscount: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="retailer-discount">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="40">40% off retail</SelectItem>
                      <SelectItem value="45">45% off retail</SelectItem>
                      <SelectItem value="50">50% off retail (recommended)</SelectItem>
                      <SelectItem value="55">55% off retail</SelectItem>
                      <SelectItem value="60">60% off retail</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Industry standard is 50% wholesale discount
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-quantity">Minimum Order Quantity</Label>
                  <Input
                    id="min-quantity"
                    type="number"
                    min={1}
                    value={payment.retailerMinQuantity || 5}
                    onChange={(e) =>
                      updatePayment({ retailerMinQuantity: parseInt(e.target.value) || 5 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum units per wholesale order
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-quantity">Maximum Order Quantity</Label>
                  <Input
                    id="max-quantity"
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={payment.retailerMaxQuantity || ""}
                    onChange={(e) =>
                      updatePayment({
                        retailerMaxQuantity: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for no limit
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-medium mb-2">Retailer Pricing Preview</h4>
                <div className="text-sm space-y-1">
                  <p>
                    If your reward tier is priced at <span className="font-medium">{formatCurrency(25)}</span>,
                    retailers will pay{" "}
                    <span className="font-medium text-green-600">
                      {formatCurrency(25 * (1 - (payment.retailerDiscount || 50) / 100))}
                    </span>{" "}
                    per unit ({payment.retailerDiscount || 50}% discount)
                  </p>
                  <p className="text-muted-foreground">
                    For a minimum order of {payment.retailerMinQuantity || 5} units, that&apos;s{" "}
                    {formatCurrency(
                      25 * (1 - (payment.retailerDiscount || 50) / 100) * (payment.retailerMinQuantity || 5)
                    )}{" "}
                    wholesale
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
