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
              <p className="text-sm text-zinc-500">Accept payments via Stripe</p>
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
              <p className="text-xs text-zinc-500">For regular Stripe events (payments, etc.)</p>
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
              <p className="text-xs text-zinc-500">For Connect events (account updates, etc.)</p>
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
              <p className="text-sm text-zinc-500">Accept payments via DivinityCoin credits (6% total partner fee)</p>
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

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-sm space-y-2">
            <p className="font-medium">DivinityCoin Fee Structure:</p>
            <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>6% total partner fee (includes Stripe processing ~2.9% + $0.30)</li>
              <li>Platform fee to creator: 3% (configurable)</li>
              <li>Settlements processed via wire transfer to your bank</li>
            </ul>
            <a href="https://divinitycoin.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Learn more about DivinityCoin →
            </a>
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
              <p className="text-sm text-zinc-500">Automatically process creator payouts</p>
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
              <p className="text-sm text-zinc-500">Show CAPTCHA on registration to prevent bots</p>
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
              <p className="text-xs text-zinc-500">Public key shown on your website</p>
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
              <p className="text-xs text-zinc-500">Private key for server-side verification</p>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 text-sm space-y-2">
            <p className="font-medium">How to get reCAPTCHA keys:</p>
            <ol className="list-decimal list-inside text-zinc-600 dark:text-zinc-400 space-y-1">
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
