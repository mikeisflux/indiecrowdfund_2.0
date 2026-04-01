"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Loader2, Save } from "lucide-react";

interface PaypalCardProps {
  paypalEmail: string;
  paypalEmailSaved: string | null;
  paypalEmailSaving: boolean;
  paypalEmailMessage: { type: "success" | "error"; text: string } | null;
  onPaypalEmailChange: (value: string) => void;
  onSave: () => void;
}

export function PaypalCard({
  paypalEmail,
  paypalEmailSaved,
  paypalEmailSaving,
  paypalEmailMessage,
  onPaypalEmailChange,
  onSave,
}: PaypalCardProps) {
  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '380ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" />
          PayPal Payout Email
        </CardTitle>
        <CardDescription>
          Add your PayPal email to receive payouts from crowdfunding campaigns and marketplace sales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paypalEmailSaved && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <Check className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-sm text-green-600 dark:text-green-400">
              Connected: <span className="font-medium">{paypalEmailSaved}</span>
            </span>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="paypalEmail">PayPal Email Address</Label>
          <div className="flex gap-2">
            <Input
              id="paypalEmail"
              type="email"
              value={paypalEmail}
              onChange={(e) => onPaypalEmailChange(e.target.value)}
              placeholder="your@paypal.com"
              className="flex-1"
            />
            <Button
              onClick={onSave}
              disabled={paypalEmailSaving}
            >
              {paypalEmailSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="ml-2">Save</span>
            </Button>
          </div>
          {paypalEmailMessage && (
            <p className={`text-xs ${paypalEmailMessage.type === "success" ? "text-green-500" : "text-destructive"}`}>
              {paypalEmailMessage.text}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            This email will be used to send your payouts via PayPal. Make sure it matches your PayPal account.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
