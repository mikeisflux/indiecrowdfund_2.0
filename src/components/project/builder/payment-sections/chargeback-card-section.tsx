"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, AlertTriangle, CheckCircle, Loader2, Save, Lock } from "lucide-react";
import { ChargebackCardSectionProps } from "./types";

export function ChargebackCardSection({
  chargebackCard,
  setChargebackCard,
  chargebackCardStatus,
  setChargebackCardStatus,
  isSavingCard,
  handleSaveChargebackCard,
  projectId,
}: ChargebackCardSectionProps) {
  return (
    <div className="space-y-4 pt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Chargeback Protection Card
          </CardTitle>
          <CardDescription>
            A valid credit or debit card is required for each project. This card will be kept on file and may be
            charged in the event of chargebacks, fraud, or disputes related to this campaign. This is a standard
            requirement for all creators on our platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {chargebackCardStatus.loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking card status...</span>
            </div>
          ) : chargebackCardStatus.saved ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-700 dark:text-green-400">Card on file</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-500">
                  {chargebackCardStatus.brand} ending in {chargebackCardStatus.lastFour}
                  {chargebackCardStatus.expMonth && chargebackCardStatus.expYear && (
                    <> &middot; Expires {String(chargebackCardStatus.expMonth).padStart(2, "0")}/{chargebackCardStatus.expYear}</>
                  )}
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChargebackCardStatus(prev => ({ ...prev, saved: false }))}
              >
                Update Card
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700 dark:text-amber-400">Required</AlertTitle>
                <AlertDescription className="text-amber-600 dark:text-amber-500">
                  A chargeback protection card must be on file before your project can be launched.
                </AlertDescription>
              </Alert>

              {/* Card Details */}
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="cb-card-number">Card Number</Label>
                  <Input
                    id="cb-card-number"
                    placeholder="1234 5678 9012 3456"
                    value={chargebackCard.cardNumber}
                    onChange={(e) => {
                      // Format with spaces every 4 digits
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 19);
                      const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                      setChargebackCard(prev => ({ ...prev, cardNumber: formatted }));
                    }}
                    maxLength={23}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="cb-exp-month">Exp Month</Label>
                    <Select
                      value={chargebackCard.expMonth}
                      onValueChange={(v) => setChargebackCard(prev => ({ ...prev, expMonth: v }))}
                    >
                      <SelectTrigger id="cb-exp-month">
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {String(i + 1).padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cb-exp-year">Exp Year</Label>
                    <Select
                      value={chargebackCard.expYear}
                      onValueChange={(v) => setChargebackCard(prev => ({ ...prev, expYear: v }))}
                    >
                      <SelectTrigger id="cb-exp-year">
                        <SelectValue placeholder="YYYY" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() + i;
                          return (
                            <SelectItem key={year} value={String(year)}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cb-cvc">CVC</Label>
                    <Input
                      id="cb-cvc"
                      placeholder="123"
                      value={chargebackCard.cvc}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setChargebackCard(prev => ({ ...prev, cvc: v }));
                      }}
                      maxLength={4}
                    />
                  </div>
                </div>
              </div>

              {/* Billing Address */}
              <div className="space-y-3 pt-2">
                <Label className="text-sm font-medium text-muted-foreground">Billing Address</Label>
                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="cb-billing-name">Name on Card</Label>
                    <Input
                      id="cb-billing-name"
                      placeholder="Full name as it appears on card"
                      value={chargebackCard.billingName}
                      onChange={(e) => setChargebackCard(prev => ({ ...prev, billingName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cb-billing-line1">Address Line 1</Label>
                    <Input
                      id="cb-billing-line1"
                      placeholder="Street address"
                      value={chargebackCard.billingLine1}
                      onChange={(e) => setChargebackCard(prev => ({ ...prev, billingLine1: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cb-billing-line2">Address Line 2 (optional)</Label>
                    <Input
                      id="cb-billing-line2"
                      placeholder="Apt, suite, etc."
                      value={chargebackCard.billingLine2}
                      onChange={(e) => setChargebackCard(prev => ({ ...prev, billingLine2: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cb-billing-city">City</Label>
                      <Input
                        id="cb-billing-city"
                        placeholder="City"
                        value={chargebackCard.billingCity}
                        onChange={(e) => setChargebackCard(prev => ({ ...prev, billingCity: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cb-billing-state">State</Label>
                      <Input
                        id="cb-billing-state"
                        placeholder="State"
                        value={chargebackCard.billingState}
                        onChange={(e) => setChargebackCard(prev => ({ ...prev, billingState: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="cb-billing-zip">ZIP / Postal Code</Label>
                      <Input
                        id="cb-billing-zip"
                        placeholder="12345"
                        value={chargebackCard.billingZip}
                        onChange={(e) => setChargebackCard(prev => ({ ...prev, billingZip: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cb-billing-country">Country</Label>
                      <Select
                        value={chargebackCard.billingCountry}
                        onValueChange={(v) => setChargebackCard(prev => ({ ...prev, billingCountry: v }))}
                      >
                        <SelectTrigger id="cb-billing-country">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="AU">Australia</SelectItem>
                          <SelectItem value="DE">Germany</SelectItem>
                          <SelectItem value="FR">France</SelectItem>
                          <SelectItem value="IT">Italy</SelectItem>
                          <SelectItem value="JP">Japan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Card details are encrypted with AES-256 and stored securely.</span>
              </div>

              <Button
                onClick={handleSaveChargebackCard}
                disabled={isSavingCard || !projectId}
                className="w-full"
              >
                {isSavingCard ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving card...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Chargeback Protection Card
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
