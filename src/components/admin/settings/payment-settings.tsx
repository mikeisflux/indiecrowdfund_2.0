"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import { Eye, EyeOff } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentSettingsProps {
  settings: {
    stripeEnabled: boolean;
    stripePublicKey: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    stripeConnectWebhookSecret: string;
    // DivinityCoin - Credit redemption payment solution
    divinityCoinEnabled: boolean;
    divinityCoinApiKey: string;
    divinityCoinWebhookSecret: string;
    divinityCoinPartnerId: string;
    divinityCoinSettlementFrequency: string;
    divinityCoinStripePublishableKey: string;
    // PayPal settings
    paypalEnabled: boolean;
    paypalClientId: string;
    paypalClientSecret: string;
    paypalWebhookId: string;
    paypalMode: string;
    // Whop settings
    whopEnabled: boolean;
    whopApiKey: string;
    whopPlanId: string;
    whopCompanyId: string;
    whopWebhookSecret: string;
    whopEnvironment: string;
    // reCAPTCHA settings
    recaptchaEnabled: boolean;
    recaptchaSiteKey: string;
    recaptchaSecretKey: string;
    autoPayouts: boolean;
    payoutThreshold: string;
    payoutSchedule: string;
  };
  onSettingsChange: (settings: PaymentSettingsProps["settings"]) => void;
  onSave: () => void;
}

export function PaymentSettings({ settings, onSettingsChange, onSave }: PaymentSettingsProps) {
  const [showAllKeys, setShowAllKeys] = useState(false);

  return (
    <TabsContent value="payments" className="mt-6 space-y-6">
      {/* Show All Keys Toggle */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAllKeys(!showAllKeys)}
          className="gap-2"
        >
          {showAllKeys ? (
            <>
              <EyeOff className="h-4 w-4" />
              Hide All Keys
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Show All Keys
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Stripe Configuration</CardTitle>
              <CardDescription>Primary payment processor settings</CardDescription>
            </div>
            <Badge variant={settings.stripeEnabled ? "default" : "secondary"}>
              {settings.stripeEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Stripe</Label>
              <p className="text-sm text-muted-foreground">Accept payments via Stripe</p>
            </div>
            <Switch
              checked={settings.stripeEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, stripeEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Publishable Key</Label>
              <SecureKeyInput
                value={settings.stripePublicKey}
                onChange={(value) => onSettingsChange({ ...settings, stripePublicKey: value })}
                onSave={onSave}
                hasExistingValue={settings.stripePublicKey === "••••••••"}
                placeholder="pk_live_..."
                forceShowValue={showAllKeys}
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <SecureKeyInput
                value={settings.stripeSecretKey}
                onChange={(value) => onSettingsChange({ ...settings, stripeSecretKey: value })}
                onSave={onSave}
                hasExistingValue={settings.stripeSecretKey === "••••••••"}
                placeholder="sk_live_..."
                forceShowValue={showAllKeys}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <SecureKeyInput
                value={settings.stripeWebhookSecret}
                onChange={(value) => onSettingsChange({ ...settings, stripeWebhookSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.stripeWebhookSecret === "••••••••"}
                placeholder="whsec_..."
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">For regular Stripe events (payments, etc.)</p>
            </div>
            <div className="space-y-2">
              <Label>Connect Webhook Secret</Label>
              <SecureKeyInput
                value={settings.stripeConnectWebhookSecret}
                onChange={(value) => onSettingsChange({ ...settings, stripeConnectWebhookSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.stripeConnectWebhookSecret === "••••••••"}
                placeholder="whsec_..."
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">For Connect events (account updates, etc.)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>DivinityCoin Configuration</CardTitle>
              <CardDescription>Universal credit redemption system for supporting creators</CardDescription>
            </div>
            <Badge variant={settings.divinityCoinEnabled ? "default" : "secondary"}>
              {settings.divinityCoinEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable DivinityCoin</Label>
              <p className="text-sm text-muted-foreground">Accept payments via DivinityCoin credits (3% partner fee + 3% platform = ~6% total)</p>
            </div>
            <Switch
              checked={settings.divinityCoinEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, divinityCoinEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.divinityCoinApiKey}
                onChange={(value) => onSettingsChange({ ...settings, divinityCoinApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.divinityCoinApiKey === "••••••••"}
                placeholder="Your DivinityCoin API key..."
                forceShowValue={showAllKeys}
              />
            </div>
            <div className="space-y-2">
              <Label>Partner ID</Label>
              <Input
                value={settings.divinityCoinPartnerId}
                onChange={(e) => onSettingsChange({ ...settings, divinityCoinPartnerId: e.target.value })}
                placeholder="partner_xyz..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <SecureKeyInput
                value={settings.divinityCoinWebhookSecret}
                onChange={(value) => onSettingsChange({ ...settings, divinityCoinWebhookSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.divinityCoinWebhookSecret === "••••••••"}
                placeholder="Your webhook secret..."
                forceShowValue={showAllKeys}
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement Frequency</Label>
              <Select
                value={settings.divinityCoinSettlementFrequency || "weekly"}
                onValueChange={(v) => onSettingsChange({ ...settings, divinityCoinSettlementFrequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly (1st)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>DC Stripe Publishable Key</Label>
            <SecureKeyInput
              value={settings.divinityCoinStripePublishableKey}
              onChange={(value) => onSettingsChange({ ...settings, divinityCoinStripePublishableKey: value })}
              onSave={onSave}
              hasExistingValue={settings.divinityCoinStripePublishableKey === "••••••••"}
              placeholder="pk_live_... (DivinityCoin's Stripe key for card form)"
              forceShowValue={showAllKeys}
            />
            <p className="text-xs text-muted-foreground">DivinityCoin&apos;s Stripe publishable key used to render the card form on the pledge page. Card data goes directly to Stripe on DC&apos;s account.</p>
          </div>

          <div className="rounded-lg bg-muted/50 dark:bg-zinc-900 p-4 text-sm space-y-2">
            <p className="font-medium">DivinityCoin Fee Structure:</p>
            <ul className="list-disc list-inside text-muted-foreground dark:text-muted-foreground space-y-1">
              <li>3% partner fee (DivinityCoin processing)</li>
              <li>Platform fee to creator: 3% (configurable) = ~6% total</li>
              <li>Settlements processed via wire transfer to your bank</li>
            </ul>
            <a href="https://divinitycoin.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Learn more about DivinityCoin →
            </a>
          </div>
        </CardContent>
      </Card>

      {/* PayPal Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PayPal Configuration</CardTitle>
              <CardDescription>Advanced Checkout with inline card fields + PayPal wallet. Payouts API for creator settlements.</CardDescription>
            </div>
            <Badge variant={settings.paypalEnabled ? "default" : "secondary"}>
              {settings.paypalEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable PayPal</Label>
              <p className="text-sm text-muted-foreground">Allow creators to use PayPal as their payment processor</p>
            </div>
            <Switch
              checked={settings.paypalEnabled}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, paypalEnabled: checked })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <SecureKeyInput
                value={settings.paypalClientId}
                onChange={(value) => onSettingsChange({ ...settings, paypalClientId: value })}
                onSave={onSave}
                hasExistingValue={settings.paypalClientId === "••••••••"}
                placeholder="AXxxxx..."
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">Public client ID from PayPal Developer Dashboard</p>
            </div>
            <div className="space-y-2">
              <Label>Client Secret</Label>
              <SecureKeyInput
                value={settings.paypalClientSecret}
                onChange={(value) => onSettingsChange({ ...settings, paypalClientSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.paypalClientSecret === "••••••••"}
                placeholder="EHxxxx..."
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">Private secret — never expose to clients</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Webhook ID</Label>
              <Input
                value={settings.paypalWebhookId}
                onChange={(e) => onSettingsChange({ ...settings, paypalWebhookId: e.target.value })}
                placeholder="From PayPal Dashboard → Webhooks"
              />
              <p className="text-xs text-muted-foreground">Webhook URL: <code className="bg-muted px-1 rounded">https://indiecrowdfund.com/api/webhooks/paypal</code></p>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select
                value={settings.paypalMode}
                onValueChange={(v) => onSettingsChange({ ...settings, paypalMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 dark:bg-zinc-900 p-4 text-sm space-y-2">
            <p className="font-medium">PayPal Setup:</p>
            <ul className="list-disc list-inside text-muted-foreground dark:text-muted-foreground space-y-1">
              <li>Advanced Checkout: inline card fields + PayPal wallet button on pledge page</li>
              <li>Payouts API: creators add their PayPal email, platform pays out on campaign end</li>
              <li>Enable &quot;Payouts&quot; in your PayPal app permissions (Apps &amp; Credentials)</li>
              <li>~2.9% + $0.30 processing fee + 3% platform fee</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Whop Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Whop Configuration</CardTitle>
              <CardDescription>Embedded checkout with card-to-USDC settlement. Seamless in-page payment flow.</CardDescription>
            </div>
            <Badge variant={settings.whopEnabled ? "default" : "secondary"}>
              {settings.whopEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Whop</Label>
              <p className="text-sm text-muted-foreground">Allow creators to use Whop as their payment processor</p>
            </div>
            <Switch
              checked={settings.whopEnabled}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, whopEnabled: checked })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.whopApiKey}
                onChange={(value) => onSettingsChange({ ...settings, whopApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.whopApiKey === "••••••••"}
                placeholder="Company API key from Whop dashboard"
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">From Whop Dashboard → Developer → Company API keys</p>
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <SecureKeyInput
                value={settings.whopWebhookSecret}
                onChange={(value) => onSettingsChange({ ...settings, whopWebhookSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.whopWebhookSecret === "••••••••"}
                placeholder="Webhook signing secret"
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">Webhook URL: <code className="bg-muted px-1 rounded">https://indiecrowdfund.com/api/webhooks/whop</code></p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Plan ID</Label>
              <Input
                value={settings.whopPlanId}
                onChange={(e) => onSettingsChange({ ...settings, whopPlanId: e.target.value })}
                placeholder="plan_xxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">Base plan from Whop Dashboard → Checkout links</p>
            </div>
            <div className="space-y-2">
              <Label>Company ID</Label>
              <Input
                value={settings.whopCompanyId}
                onChange={(e) => onSettingsChange({ ...settings, whopCompanyId: e.target.value })}
                placeholder="biz_xxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">Your platform company ID (visible in Whop dashboard URL)</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Environment</Label>
            <Select
              value={settings.whopEnvironment}
              onValueChange={(v) => onSettingsChange({ ...settings, whopEnvironment: v })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted/50 dark:bg-zinc-900 p-4 text-sm space-y-2">
            <p className="font-medium">Whop Setup:</p>
            <ul className="list-disc list-inside text-muted-foreground dark:text-muted-foreground space-y-1">
              <li>Embedded in-page checkout — no redirect, no popup</li>
              <li>Card payments settle to USDC automatically</li>
              <li>Create a Plan in Checkout links (base template — price is overridden per pledge)</li>
              <li>Subscribe to all webhook events at <code className="bg-muted px-1 rounded">Dashboard → Developer → Webhooks</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout Settings</CardTitle>
          <CardDescription>Configure automatic creator payouts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Automatic Payouts</Label>
              <p className="text-sm text-muted-foreground">Automatically process creator payouts</p>
            </div>
            <Switch
              checked={settings.autoPayouts}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, autoPayouts: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Minimum Payout Amount ($)</Label>
              <Input
                type="number"
                min="0"
                value={settings.payoutThreshold}
                onChange={(e) => onSettingsChange({ ...settings, payoutThreshold: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payout Schedule</Label>
              <Select
                value={settings.payoutSchedule}
                onValueChange={(v) => onSettingsChange({ ...settings, payoutSchedule: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>reCAPTCHA Bot Protection</CardTitle>
              <CardDescription>Protect registration and forms from automated bots</CardDescription>
            </div>
            <Badge variant={settings.recaptchaEnabled ? "default" : "secondary"}>
              {settings.recaptchaEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable reCAPTCHA</Label>
              <p className="text-sm text-muted-foreground">Show CAPTCHA on registration to prevent bots</p>
            </div>
            <Switch
              checked={settings.recaptchaEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, recaptchaEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Site Key</Label>
              <SecureKeyInput
                value={settings.recaptchaSiteKey}
                onChange={(value) => onSettingsChange({ ...settings, recaptchaSiteKey: value })}
                onSave={onSave}
                hasExistingValue={settings.recaptchaSiteKey === "••••••••"}
                placeholder="6Le..."
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">Public key shown on your website</p>
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <SecureKeyInput
                value={settings.recaptchaSecretKey}
                onChange={(value) => onSettingsChange({ ...settings, recaptchaSecretKey: value })}
                onSave={onSave}
                hasExistingValue={settings.recaptchaSecretKey === "••••••••"}
                placeholder="6Le..."
                forceShowValue={showAllKeys}
              />
              <p className="text-xs text-muted-foreground">Private key for server-side verification</p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 dark:bg-zinc-900 p-4 text-sm space-y-2">
            <p className="font-medium">How to get reCAPTCHA keys:</p>
            <ol className="list-decimal list-inside text-muted-foreground dark:text-muted-foreground space-y-1">
              <li>Go to the Google reCAPTCHA Admin Console</li>
              <li>Register a new site with reCAPTCHA v2 &quot;I&apos;m not a robot&quot;</li>
              <li>Add your domain(s) to the allowed list</li>
              <li>Copy the Site Key and Secret Key here</li>
            </ol>
            <a href="https://www.google.com/recaptcha/admin" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Get reCAPTCHA keys →
            </a>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
