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
          <CardDescription>Configure your email provider for transactional emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Email Provider</Label>
            <Select
              value={settings.provider}
              onValueChange={(v) => onChange({ ...settings, provider: v })}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ses">Amazon SES (Recommended)</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="mailgun">Mailgun</SelectItem>
                <SelectItem value="postmark">Postmark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AWS SES Settings */}
          {settings.provider === "ses" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
              <div className="text-sm font-medium text-amber-800">Amazon SES Configuration</div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>AWS Access Key ID</Label>
                  <SecureKeyInput
                    value={settings.awsAccessKeyId}
                    onChange={(value) => onChange({ ...settings, awsAccessKeyId: value })}
                    onSave={onSave}
                    hasExistingValue={settings.awsAccessKeyId === "••••••••"}
                    placeholder="AKIA..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>AWS Secret Access Key</Label>
                  <SecureKeyInput
                    value={settings.awsSecretAccessKey}
                    onChange={(value) => onChange({ ...settings, awsSecretAccessKey: value })}
                    onSave={onSave}
                    hasExistingValue={settings.awsSecretAccessKey === "••••••••"}
                    placeholder="Your secret key..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>AWS Region</Label>
                  <Select
                    value={settings.awsSesRegion || "us-east-1"}
                    onValueChange={(v) => onChange({ ...settings, awsSesRegion: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                      <SelectItem value="us-east-2">US East (Ohio)</SelectItem>
                      <SelectItem value="us-west-1">US West (N. California)</SelectItem>
                      <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                      <SelectItem value="eu-west-1">EU (Ireland)</SelectItem>
                      <SelectItem value="eu-west-2">EU (London)</SelectItem>
                      <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                      <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                      <SelectItem value="ap-southeast-2">Asia Pacific (Sydney)</SelectItem>
                      <SelectItem value="ap-northeast-1">Asia Pacific (Tokyo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* SendGrid Settings */}
          {settings.provider === "sendgrid" && (
            <div className="space-y-2">
              <Label>SendGrid API Key</Label>
              <SecureKeyInput
                value={settings.sendgridApiKey}
                onChange={(value) => onChange({ ...settings, sendgridApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.sendgridApiKey === "••••••••"}
                placeholder="SG.xxx..."
              />
            </div>
          )}

          {/* Mailgun Settings */}
          {settings.provider === "mailgun" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mailgun API Key</Label>
                <SecureKeyInput
                  value={settings.mailgunApiKey}
                  onChange={(value) => onChange({ ...settings, mailgunApiKey: value })}
                  onSave={onSave}
                  hasExistingValue={settings.mailgunApiKey === "••••••••"}
                  placeholder="key-xxx..."
                />
              </div>
              <div className="space-y-2">
                <Label>Mailgun Domain</Label>
                <Input
                  value={settings.mailgunDomain}
                  onChange={(e) => onChange({ ...settings, mailgunDomain: e.target.value })}
                  placeholder="mg.yourdomain.com"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                type="email"
                value={settings.fromEmail}
                onChange={(e) => onChange({ ...settings, fromEmail: e.target.value })}
                placeholder="noreply@yourdomain.com"
              />
              <p className="text-xs text-zinc-500">Must be verified in your email provider</p>
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={settings.fromName}
                onChange={(e) => onChange({ ...settings, fromName: e.target.value })}
                placeholder="IndieCrowdfund"
              />
            </div>
            <div className="space-y-2">
              <Label>Reply-To Email</Label>
              <Input
                type="email"
                value={settings.replyToEmail}
                onChange={(e) => onChange({ ...settings, replyToEmail: e.target.value })}
                placeholder="support@yourdomain.com"
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
