"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Wallet, CheckCircle, Loader2, Lock, Mail } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

export function PayPalPayoutSection() {
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function fetchPaypalConfig() {
      try {
        const res = await fetch("/api/creator/paypal");
        if (res.ok) {
          const data = await res.json();
          if (data.config?.paypalEmail) {
            setSavedEmail(data.config.paypalEmail);
            setEmail(data.config.paypalEmail);
          }
        }
      } catch {
        // non-fatal
      } finally {
        setIsLoading(false);
      }
    }
    fetchPaypalConfig();
  }, []);

  const handleSave = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid PayPal email address");
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paypalEmail: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save PayPal email");
      setSavedEmail(trimmed);
      setIsEditing(false);
      toast.success("PayPal payout email saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          PayPal Payout Email
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter the PayPal email address where your campaign earnings will be sent. Payouts are sent automatically after your campaign funds.
        </p>
      </div>

      <Card className={savedEmail && !isEditing ? "border-green-500" : ""}>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : savedEmail && !isEditing ? (
            /* Connected state */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">PayPal Payout Email Connected</p>
                    <p className="text-sm text-muted-foreground">{savedEmail}</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-500">
                  <Lock className="h-3 w-3 mr-1" />
                  Secured
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Update PayPal Email
              </Button>
            </div>
          ) : (
            /* Input state */
            <div className="space-y-4">
              <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <Lock className="h-4 w-4" />
                <AlertTitle>Required for Payouts</AlertTitle>
                <AlertDescription>
                  This email must match an active PayPal account. Your campaign earnings (minus platform and PayPal fees) will be sent here automatically after your campaign funds successfully.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="paypal-email">PayPal Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="paypal-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be a verified PayPal account. This is also used for marketplace PDF sale payouts.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  ) : (
                    <><Lock className="h-4 w-4 mr-2" />Save PayPal Email</>
                  )}
                </Button>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setIsEditing(false); setEmail(savedEmail ?? ""); }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
