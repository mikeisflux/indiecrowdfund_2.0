"use client";

import { useProjectStore } from "@/lib/stores/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, AlertTriangle, Check, ExternalLink, Store, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function PaymentStep() {
  const { payment, updatePayment, basics } = useProjectStore();

  const goalAmount = basics.goalAmount || 10000;
  const mustUseCCBill = payment.hasAdultContent || payment.hasRiskyContent;

  // Fee calculations
  const stripeFee = goalAmount * 0.029 + 0.3 * (goalAmount / 50); // Rough estimate
  const stripeNet = goalAmount - stripeFee;
  const ccbillFee = goalAmount * 0.105;
  const ccbillNet = goalAmount - ccbillFee;

  return (
    <div className="space-y-8">
      {/* Contact Email */}
      <div className="space-y-2">
        <Label htmlFor="contactEmail">
          Contact Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="contactEmail"
          type="email"
          placeholder="your@email.com"
          value={payment.contactEmail || ""}
          onChange={(e) => updatePayment({ contactEmail: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          This email will be verified before launch
        </p>
      </div>

      {/* Project Type */}
      <div className="space-y-2">
        <Label>Project Type</Label>
        <Select
          value={payment.projectType || "INDIVIDUAL"}
          onValueChange={(value) =>
            updatePayment({ projectType: value as "INDIVIDUAL" | "BUSINESS" | "NONPROFIT" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INDIVIDUAL">
              Individual (raising funds in your own name)
            </SelectItem>
            <SelectItem value="BUSINESS">
              Business (raising on behalf of a company)
            </SelectItem>
            <SelectItem value="NONPROFIT">
              Nonprofit (raising for a nonprofit organization)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Content Declaration */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Content Declaration</h3>
          <p className="text-sm text-muted-foreground">
            Please indicate if your project contains sensitive content
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="adult-content"
              checked={payment.hasAdultContent || false}
              onCheckedChange={(checked) =>
                updatePayment({ hasAdultContent: checked as boolean })
              }
            />
            <Label htmlFor="adult-content" className="font-normal">
              My project contains adult content or age-restricted materials
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="risky-content"
              checked={payment.hasRiskyContent || false}
              onCheckedChange={(checked) =>
                updatePayment({ hasRiskyContent: checked as boolean })
              }
            />
            <Label htmlFor="risky-content" className="font-normal">
              My project contains high-risk or controversial content
            </Label>
          </div>
        </div>

        {mustUseCCBill && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>CCBill Required</AlertTitle>
            <AlertDescription>
              Due to your content type, you must use CCBill as your payment
              processor. CCBill specializes in processing payments for
              age-restricted and high-risk content.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Payment Processor Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Payment Processor</h3>
          <p className="text-sm text-muted-foreground">
            Choose how you want to receive payments from backers
          </p>
        </div>

        <RadioGroup
          value={mustUseCCBill ? "CCBILL" : payment.paymentProcessor || "STRIPE"}
          onValueChange={(value) =>
            updatePayment({ paymentProcessor: value as "STRIPE" | "CCBILL" })
          }
          disabled={mustUseCCBill}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* Stripe Option */}
            <Card
              className={`cursor-pointer transition-colors ${
                payment.paymentProcessor === "STRIPE" && !mustUseCCBill
                  ? "border-primary"
                  : ""
              } ${mustUseCCBill ? "opacity-50" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Stripe
                  </CardTitle>
                  <RadioGroupItem value="STRIPE" disabled={mustUseCCBill} />
                </div>
                <CardDescription>Recommended for most projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Lower fees (2.9% + $0.30)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Faster payouts (2 days)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    More payment methods
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Better international support
                  </li>
                </ul>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm">
                    Estimated fees: {formatCurrency(stripeFee)}
                  </p>
                  <p className="text-lg font-semibold text-green-600">
                    Net: {formatCurrency(stripeNet)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CCBill Option */}
            <Card
              className={`cursor-pointer transition-colors ${
                payment.paymentProcessor === "CCBILL" || mustUseCCBill
                  ? "border-primary"
                  : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    CCBill
                  </CardTitle>
                  <RadioGroupItem value="CCBILL" />
                </div>
                <CardDescription>
                  {mustUseCCBill
                    ? "Required for your content type"
                    : "For adult/high-risk content"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Accepts adult content
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    High-risk merchant friendly
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Chargeback protection
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Established industry leader
                  </li>
                </ul>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm">
                    Estimated fees: {formatCurrency(ccbillFee)}
                  </p>
                  <p className="text-lg font-semibold text-green-600">
                    Net: {formatCurrency(ccbillNet)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      {/* Payment Processor Setup */}
      <div className="space-y-4">
        <h3 className="font-semibold">Connect Your Account</h3>

        {(payment.paymentProcessor === "STRIPE" && !mustUseCCBill) ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Stripe Connect</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account to receive payments
                  </p>
                </div>
                <Button>
                  Connect Stripe
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter your CCBill merchant account details
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ccbill-account">Account Number</Label>
                    <Input
                      id="ccbill-account"
                      placeholder="000000"
                      value={payment.ccbillAccountNumber || ""}
                      onChange={(e) =>
                        updatePayment({ ccbillAccountNumber: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ccbill-subaccount">Subaccount Number</Label>
                    <Input
                      id="ccbill-subaccount"
                      placeholder="0000"
                      value={payment.ccbillSubaccount || ""}
                      onChange={(e) =>
                        updatePayment({ ccbillSubaccount: e.target.value })
                      }
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Don&apos;t have a CCBill account?{" "}
                  <a
                    href="https://www.ccbill.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Sign up here
                  </a>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Separator />

      {/* Retailer Access */}
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

        <Card className={payment.allowRetailerPledges ? "border-emerald-500" : ""}>
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
                <Alert className="bg-emerald-50 border-emerald-200">
                  <Info className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
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
                      <span className="font-medium text-emerald-600">
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
    </div>
  );
}
