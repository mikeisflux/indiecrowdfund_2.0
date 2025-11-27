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
import { CreditCard, AlertTriangle, Check, ExternalLink } from "lucide-react";
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
            updatePayment({ projectType: value as any })
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
            updatePayment({ paymentProcessor: value as any })
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
    </div>
  );
}
