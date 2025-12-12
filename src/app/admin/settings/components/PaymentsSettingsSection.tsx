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
              <CardTitle>CCBill Configuration</CardTitle>
              <CardDescription>High-risk payment processor for adult/regulated content</CardDescription>
            </div>
            <Badge variant={settings.ccbillEnabled ? "default" : "secondary"}>
              {settings.ccbillEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable CCBill</Label>
              <p className="text-sm text-zinc-500">Accept payments via CCBill FlexForms</p>
            </div>
            <Switch
              checked={settings.ccbillEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, ccbillEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Sub Account ID</Label>
              <Input
                value={settings.ccbillSubAccount}
                onChange={(e) => onChange({ ...settings, ccbillSubAccount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>FlexForm ID</Label>
              <Input
                value={settings.ccbillFlexId}
                onChange={(e) => onChange({ ...settings, ccbillFlexId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Salt Key</Label>
              <SecureKeyInput
                value={settings.ccbillSalt}
                onChange={(value) => onChange({ ...settings, ccbillSalt: value })}
                onSave={onSave}
                hasExistingValue={settings.ccbillSalt === "••••••••"}
                placeholder="Your CCBill salt..."
              />
            </div>
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
