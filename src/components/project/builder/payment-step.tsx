"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Check,
  ExternalLink,
  Store,
  Info,
  Wallet,
  Building,
  Globe,
  Zap,
  Shield,
  Banknote,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function PaymentStep() {
  const { payment, updatePayment, basics } = useProjectStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const goalAmount = basics.goalAmount || 10000;
  const isNsfw = payment.hasAdultContent || payment.hasRiskyContent;

  // Wise fee calculations (much lower than Stripe/CCBill)
  // Platform fee: 5%
  // Wise fee: ~0.5% domestic, ~1.2% international
  const wiseFeePercent = 0.005; // 0.5% average
  const platformFeePercent = 0.05; // 5%

  const wiseFee = goalAmount * wiseFeePercent;
  const platformFee = goalAmount * platformFeePercent;
  const totalFees = wiseFee + platformFee;
  const netAmount = goalAmount - totalFees;

  // For comparison - what they would pay with old processors
  const stripeFee = goalAmount * 0.029 + (goalAmount / 50) * 0.3;
  const ccbillFee = goalAmount * 0.105;

  const handleConnectWise = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/wise/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileType: payment.projectType === "BUSINESS" ? "business" : "personal",
        }),
      });

      const data = await response.json();

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Wise connection:", error);
    } finally {
      setIsConnecting(false);
    }
  };

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

          {/* Show SFW promo agreement only when adult/risky content is checked */}
          {isNsfw && (
            <div className="mt-4 p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="promo-sfw"
                  checked={payment.promoContentSfw || false}
                  onCheckedChange={(checked) =>
                    updatePayment({ promoContentSfw: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="promo-sfw" className="font-medium cursor-pointer">
                    I agree that no NSFW content will be used in my project&apos;s promotional video, image, or project title
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    This allows your project to be displayed publicly on the platform. Users will need to verify their age before viewing the full project content.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {isNsfw && (
          <Alert>
            <Banknote className="h-4 w-4" />
            <AlertTitle>ACH Payments Only</AlertTitle>
            <AlertDescription>
              Due to your content type, backers will only be able to pay via ACH bank transfer.
              This is required for compliance with payment regulations for age-restricted content.
              Card payments are not available for NSFW campaigns.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Payment Processor - Wise */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Payment Processing</h3>
          <p className="text-sm text-muted-foreground">
            All payments are processed securely through Wise
          </p>
        </div>

        {/* Wise Card */}
        <Card className="border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                Wise Payments
                <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700">
                  Lowest Fees
                </Badge>
              </CardTitle>
            </div>
            <CardDescription>
              Global payments with industry-leading low fees
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Ultra-low fees</span>
                  <p className="text-muted-foreground">~0.5% + platform fee</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Fast payouts</span>
                  <p className="text-muted-foreground">1-2 business days</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Multi-currency</span>
                  <p className="text-muted-foreground">50+ currencies</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Wise Card</span>
                  <p className="text-muted-foreground">Spend earnings instantly</p>
                </div>
              </div>
            </div>

            {/* Fee Calculator */}
            <div className="rounded-lg bg-white/80 dark:bg-gray-900/50 p-4 border">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Fee Breakdown for {formatCurrency(goalAmount)} Goal
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Wise processing fee (~0.5%)</span>
                  <span className="font-medium">{formatCurrency(wiseFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (5%)</span>
                  <span className="font-medium">{formatCurrency(platformFee)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total fees</span>
                  <span className="text-amber-600">{formatCurrency(totalFees)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>You receive</span>
                  <span className="text-emerald-600">{formatCurrency(netAmount)}</span>
                </div>
              </div>

              {/* Comparison */}
              <div className="mt-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                  Savings compared to traditional processors:
                </p>
                <div className="flex gap-4 text-xs">
                  <span className="text-muted-foreground">
                    vs Stripe: <span className="font-medium text-emerald-600">+{formatCurrency(stripeFee - totalFees)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    vs CCBill: <span className="font-medium text-emerald-600">+{formatCurrency(ccbillFee - totalFees)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Available Payment Methods</h4>
              <div className="flex flex-wrap gap-2">
                {!isNsfw && (
                  <>
                    <Badge variant="outline" className="gap-1">
                      <CreditCard className="h-3 w-3" /> Credit/Debit Card
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Wallet className="h-3 w-3" /> Apple Pay
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Wallet className="h-3 w-3" /> Google Pay
                    </Badge>
                  </>
                )}
                <Badge variant="outline" className={`gap-1 ${isNsfw ? "border-amber-500 bg-amber-50" : ""}`}>
                  <Building className="h-3 w-3" /> ACH Bank Transfer
                  {isNsfw && <span className="text-amber-600 ml-1">(Required)</span>}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" /> International Wire
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Connect Wise Account */}
      <div className="space-y-4">
        <h3 className="font-semibold">Connect Your Wise Account</h3>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">Wise Business Account</p>
                  <p className="text-sm text-muted-foreground">
                    Connect or create a Wise account to receive payouts. You&apos;ll complete
                    identity verification through Wise&apos;s secure process.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">
                      Bank-level security &bull; Regulated financial institution
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={handleConnectWise}
                disabled={isConnecting}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {isConnecting ? "Connecting..." : "Connect Wise"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Wise Card Option */}
            <div className="mt-6 p-4 rounded-lg border bg-gradient-to-r from-gray-900 to-gray-800 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-8 w-8" />
                  <div>
                    <p className="font-medium">Get a Wise Debit Card</p>
                    <p className="text-sm text-gray-300">
                      Spend your earnings anywhere Mastercard is accepted
                    </p>
                  </div>
                </div>
                <Badge className="bg-white text-gray-900">Free Virtual Card</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Don&apos;t have a Wise account?{" "}
          <a
            href="https://wise.com/business"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 underline"
          >
            Sign up for free
          </a>
          {" "}&bull; It only takes a few minutes to get started
        </p>
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
