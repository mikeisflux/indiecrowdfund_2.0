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
import { CreditCard, Check, ExternalLink, Store, Info, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function PaymentStep() {
  const { payment, updatePayment, basics } = useProjectStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const goalAmount = basics.goalAmount || 10000;
  const hasAdultContent = payment.hasAdultContent || payment.hasRiskyContent;

  // Stripe fee calculations
  // Stripe: 2.9% + $0.30 per transaction
  // Platform fee: 5%
  const avgPledgeSize = 50; // Assume average pledge
  const numTransactions = goalAmount / avgPledgeSize;
  const stripeFee = goalAmount * 0.029 + numTransactions * 0.30;
  const platformFee = goalAmount * 0.05;
  const totalFees = stripeFee + platformFee;
  const netAmount = goalAmount - totalFees;

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Stripe connection:", error);
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
          {hasAdultContent && (
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

        {hasAdultContent && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Age-Restricted Content</AlertTitle>
            <AlertDescription>
              Projects with adult or high-risk content require additional review before launch.
              Please ensure your promotional materials are safe for work.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Payment Processor - Stripe */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Payment Processing</h3>
          <p className="text-sm text-muted-foreground">
            All payments are processed securely through Stripe
          </p>
        </div>

        {/* Stripe Card */}
        <Card className="border-2 border-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#635BFF] flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                Stripe Payments
                <Badge variant="secondary" className="ml-2">
                  Recommended
                </Badge>
              </CardTitle>
            </div>
            <CardDescription>
              Industry-leading payment processing with low fees
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Low fees</span>
                  <p className="text-muted-foreground">2.9% + $0.30</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Fast payouts</span>
                  <p className="text-muted-foreground">2 business days</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">All major cards</span>
                  <p className="text-muted-foreground">Visa, MC, Amex</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium">Digital wallets</span>
                  <p className="text-muted-foreground">Apple Pay, Google Pay</p>
                </div>
              </div>
            </div>

            {/* Fee Calculator */}
            <div className="rounded-lg bg-muted/50 p-4 border">
              <h4 className="font-medium mb-3">
                Fee Breakdown for {formatCurrency(goalAmount)} Goal
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Stripe processing fee (~2.9% + $0.30/txn)</span>
                  <span className="font-medium">{formatCurrency(stripeFee)}</span>
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
                  <span className="text-green-600">{formatCurrency(netAmount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Connect Stripe Account */}
      <div className="space-y-4">
        <h3 className="font-semibold">Connect Your Stripe Account</h3>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-[#635BFF] flex items-center justify-center shrink-0">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">Stripe Connect</p>
                  <p className="text-sm text-muted-foreground">
                    Connect or create a Stripe account to receive payouts. You&apos;ll complete
                    identity verification through Stripe&apos;s secure process.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleConnectStripe}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect Stripe"}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Don&apos;t have a Stripe account?{" "}
          <a
            href="https://stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
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
    </div>
  );
}
