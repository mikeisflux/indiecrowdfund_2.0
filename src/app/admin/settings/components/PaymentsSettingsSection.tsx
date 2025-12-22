"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentSettings, SettingsSectionProps } from "./types";

interface PaymentsSettingsSectionProps extends SettingsSectionProps<PaymentSettings> {
  onSave: () => void;
}

export function PaymentsSettingsSection({ settings, onChange, onSave }: PaymentsSettingsSectionProps) {
  return (
    <div className="space-y-6">
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
                onChange({ ...settings, stripeEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Publishable Key</Label>
              <SecureKeyInput
                value={settings.stripePublicKey}
                onChange={(value) => onChange({ ...settings, stripePublicKey: value })}
                onSave={onSave}
                hasExistingValue={settings.stripePublicKey === "••••••••"}
                placeholder="pk_live_..."
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <SecureKeyInput
                value={settings.stripeSecretKey}
                onChange={(value) => onChange({ ...settings, stripeSecretKey: value })}
                onSave={onSave}
                hasExistingValue={settings.stripeSecretKey === "••••••••"}
                placeholder="sk_live_..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Webhook Secret</Label>
            <SecureKeyInput
              value={settings.stripeWebhookSecret}
              onChange={(value) => onChange({ ...settings, stripeWebhookSecret: value })}
              onSave={onSave}
              hasExistingValue={settings.stripeWebhookSecret === "••••••••"}
              placeholder="whsec_..."
            />
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
                onChange({ ...settings, divinityCoinEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.divinityCoinApiKey}
                onChange={(value) => onChange({ ...settings, divinityCoinApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.divinityCoinApiKey === "••••••••"}
                placeholder="Your DivinityCoin API key..."
              />
            </div>
            <div className="space-y-2">
              <Label>Partner ID</Label>
              <Input
                value={settings.divinityCoinPartnerId}
                onChange={(e) => onChange({ ...settings, divinityCoinPartnerId: e.target.value })}
                placeholder="partner_xyz..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <SecureKeyInput
                value={settings.divinityCoinWebhookSecret}
                onChange={(value) => onChange({ ...settings, divinityCoinWebhookSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.divinityCoinWebhookSecret === "••••••••"}
                placeholder="Your webhook secret..."
              />
            </div>
            <div className="space-y-2">
              <Label>Settlement Frequency</Label>
              <Select
                value={settings.divinityCoinSettlementFrequency || "weekly"}
                onValueChange={(v) => onChange({ ...settings, divinityCoinSettlementFrequency: v })}
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
                onChange({ ...settings, autoPayouts: checked })
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
                onChange={(e) => onChange({ ...settings, payoutThreshold: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Payout Schedule</Label>
              <Select
                value={settings.payoutSchedule}
                onValueChange={(v) => onChange({ ...settings, payoutSchedule: v })}
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
    </div>
  );
}
