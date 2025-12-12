"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailSettings, SettingsSectionProps } from "./types";

interface EmailSettingsSectionProps extends SettingsSectionProps<EmailSettings> {
  onSave: () => void;
}

export function EmailSettingsSection({ settings, onChange, onSave }: EmailSettingsSectionProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Provider</CardTitle>
          <CardDescription>Configure SendGrid for transactional emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(v) => onChange({ ...settings, provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="ses">Amazon SES</SelectItem>
                  <SelectItem value="mailgun">Mailgun</SelectItem>
                  <SelectItem value="postmark">Postmark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.sendgridApiKey}
                onChange={(value) => onChange({ ...settings, sendgridApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.sendgridApiKey === "••••••••"}
                placeholder="SG.xxx..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                type="email"
                value={settings.fromEmail}
                onChange={(e) => onChange({ ...settings, fromEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={settings.fromName}
                onChange={(e) => onChange({ ...settings, fromName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reply-To Email</Label>
              <Input
                type="email"
                value={settings.replyToEmail}
                onChange={(e) => onChange({ ...settings, replyToEmail: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Configure automated email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Email Verification Required</Label>
              <p className="text-sm text-zinc-500">Require users to verify email before pledging</p>
            </div>
            <Switch
              checked={settings.emailVerificationRequired}
              onCheckedChange={(checked) =>
                onChange({ ...settings, emailVerificationRequired: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Welcome Email</Label>
              <p className="text-sm text-zinc-500">Send welcome email to new users</p>
            </div>
            <Switch
              checked={settings.welcomeEmailEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, welcomeEmailEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Pledge Confirmation</Label>
              <p className="text-sm text-zinc-500">Send confirmation emails for pledges</p>
            </div>
            <Switch
              checked={settings.pledgeConfirmationEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, pledgeConfirmationEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Project Update Notifications</Label>
              <p className="text-sm text-zinc-500">Notify backers when creators post updates</p>
            </div>
            <Switch
              checked={settings.projectUpdateNotifications}
              onCheckedChange={(checked) =>
                onChange({ ...settings, projectUpdateNotifications: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
