"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, CheckCircle, ExternalLink, Shield, Webhook } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmailSettingsProps {
  settings: {
    provider: string;
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
    sendgridApiKey: string;
    sendgridWebhookVerificationKey: string;
    mailgunApiKey: string;
    mailgunDomain: string;
    mailgunWebhookSigningKey: string;
    replyToEmail: string;
    emailVerificationRequired: boolean;
    welcomeEmailEnabled: boolean;
    pledgeConfirmationEnabled: boolean;
    projectUpdateNotifications: boolean;
  };
  onSettingsChange: (settings: EmailSettingsProps["settings"]) => void;
  onSave: () => void;
}

export function EmailSettings({ settings, onSettingsChange, onSave }: EmailSettingsProps) {
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/email/events`
    : "/api/webhooks/email/events";

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <TabsContent value="email" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Provider</CardTitle>
          <CardDescription>Configure your email provider for transactional emails (Mailgun recommended)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(v) => onSettingsChange({ ...settings, provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="mailgun">Mailgun</SelectItem>
                  <SelectItem value="postmark">Postmark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.provider === "sendgrid" && (
              <div className="space-y-2">
                <Label>SendGrid API Key</Label>
                <SecureKeyInput
                  value={settings.sendgridApiKey}
                  onChange={(value) => onSettingsChange({ ...settings, sendgridApiKey: value })}
                  onSave={onSave}
                  hasExistingValue={settings.sendgridApiKey === "••••••••"}
                  placeholder="SG.xxx..."
                />
              </div>
            )}

            {settings.provider === "mailgun" && (
              <>
                <div className="space-y-2">
                  <Label>Mailgun API Key</Label>
                  <SecureKeyInput
                    value={settings.mailgunApiKey}
                    onChange={(value) => onSettingsChange({ ...settings, mailgunApiKey: value })}
                    onSave={onSave}
                    hasExistingValue={settings.mailgunApiKey === "••••••••"}
                    placeholder="key-xxx..."
                  />
                </div>
              </>
            )}
          </div>

          {settings.provider === "mailgun" && (
            <div className="space-y-2">
              <Label>Mailgun Domain</Label>
              <Input
                value={settings.mailgunDomain}
                onChange={(e) => onSettingsChange({ ...settings, mailgunDomain: e.target.value })}
                placeholder="indiecrowdfund.com"
              />
              <p className="text-xs text-muted-foreground">
                Your verified sending domain in Mailgun (e.g., indiecrowdfund.com or mg.indiecrowdfund.com)
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                type="email"
                value={settings.fromEmail}
                onChange={(e) => onSettingsChange({ ...settings, fromEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={settings.fromName}
                onChange={(e) => onSettingsChange({ ...settings, fromName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reply-To Email</Label>
              <Input
                type="email"
                value={settings.replyToEmail}
                onChange={(e) => onSettingsChange({ ...settings, replyToEmail: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mailgun Webhook Security */}
      {settings.provider === "mailgun" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Mailgun Event Webhook
            </CardTitle>
            <CardDescription>
              Configure webhook to track email delivery, opens, clicks, bounces, and spam reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center rounded-md border bg-muted px-3 py-2">
                  <Webhook className="h-4 w-4 text-muted-foreground mr-2" />
                  <code className="text-sm flex-1 truncate">{webhookUrl}</code>
                </div>
                <Button variant="outline" size="icon" onClick={copyWebhookUrl} aria-label="Copy webhook URL">
                  {copiedWebhook ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add this URL in Mailgun under Sending → Webhooks for your domain
              </p>
            </div>

            {/* Webhook Signing Key */}
            <div className="space-y-2">
              <Label>Webhook Signing Key</Label>
              <SecureKeyInput
                value={settings.mailgunWebhookSigningKey}
                onChange={(value) => onSettingsChange({ ...settings, mailgunWebhookSigningKey: value })}
                onSave={onSave}
                hasExistingValue={settings.mailgunWebhookSigningKey === "••••••••"}
                placeholder="key-xxx..."
              />
              <p className="text-xs text-muted-foreground">
                Find this in Mailgun → Settings → API Keys → HTTP Webhook Signing Key (starts with &quot;key-&quot;)
              </p>
            </div>

            {/* Tracked Events */}
            <div className="space-y-2">
              <Label>Tracked Events</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Delivered</Badge>
                <Badge variant="secondary">Opened</Badge>
                <Badge variant="secondary">Clicked</Badge>
                <Badge variant="secondary">Permanent Fail</Badge>
                <Badge variant="secondary">Temporary Fail</Badge>
                <Badge variant="secondary">Complained</Badge>
                <Badge variant="secondary">Unsubscribed</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable these events in Mailgun when configuring your webhooks
              </p>
            </div>

            {/* Setup Instructions */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Security:</strong> The webhook signing key ensures requests are genuinely from Mailgun.
                Without it, your webhook endpoint could be vulnerable to spoofed requests.
                <Button
                  variant="link"
                  className="p-0 h-auto ml-1"
                  onClick={() => window.open("https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#webhooks", "_blank")}
                >
                  Learn more <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* SendGrid Webhook Security */}
      {settings.provider === "sendgrid" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              SendGrid Event Webhook
            </CardTitle>
            <CardDescription>
              Configure webhook to track email delivery, opens, clicks, bounces, and spam reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Webhook URL */}
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center rounded-md border bg-muted px-3 py-2">
                  <Webhook className="h-4 w-4 text-muted-foreground mr-2" />
                  <code className="text-sm flex-1 truncate">{webhookUrl}</code>
                </div>
                <Button variant="outline" size="icon" onClick={copyWebhookUrl} aria-label="Copy webhook URL">
                  {copiedWebhook ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add this URL in SendGrid under Settings → Mail Settings → Event Webhook
              </p>
            </div>

            {/* Verification Key */}
            <div className="space-y-2">
              <Label>Webhook Verification Key (ECDSA Public Key)</Label>
              <SecureKeyInput
                value={settings.sendgridWebhookVerificationKey}
                onChange={(value) => onSettingsChange({ ...settings, sendgridWebhookVerificationKey: value })}
                onSave={onSave}
                hasExistingValue={settings.sendgridWebhookVerificationKey === "••••••••"}
                placeholder="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..."
              />
              <p className="text-xs text-muted-foreground">
                Find this in SendGrid → Settings → Mail Settings → Event Webhook → Edit → Show Verification Key
              </p>
            </div>

            {/* Tracked Events */}
            <div className="space-y-2">
              <Label>Tracked Events</Label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Delivered</Badge>
                <Badge variant="secondary">Opened</Badge>
                <Badge variant="secondary">Clicked</Badge>
                <Badge variant="secondary">Bounced</Badge>
                <Badge variant="secondary">Dropped</Badge>
                <Badge variant="secondary">Spam Reports</Badge>
                <Badge variant="secondary">Unsubscribe</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Enable these events in SendGrid when configuring your Event Webhook
              </p>
            </div>

            {/* Setup Instructions */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Security:</strong> The verification key ensures webhook requests are genuinely from SendGrid.
                Without it, your webhook endpoint could be vulnerable to spoofed requests.
                <Button
                  variant="link"
                  className="p-0 h-auto ml-1"
                  onClick={() => window.open("https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features", "_blank")}
                >
                  Learn more <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Configure automated email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Email Verification Required</Label>
              <p className="text-sm text-muted-foreground">Require users to verify email before pledging</p>
            </div>
            <Switch
              checked={settings.emailVerificationRequired}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, emailVerificationRequired: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Welcome Email</Label>
              <p className="text-sm text-muted-foreground">Send welcome email to new users</p>
            </div>
            <Switch
              checked={settings.welcomeEmailEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, welcomeEmailEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Pledge Confirmation</Label>
              <p className="text-sm text-muted-foreground">Send confirmation emails for pledges</p>
            </div>
            <Switch
              checked={settings.pledgeConfirmationEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, pledgeConfirmationEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Project Update Notifications</Label>
              <p className="text-sm text-muted-foreground">Notify backers when creators post updates</p>
            </div>
            <Switch
              checked={settings.projectUpdateNotifications}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, projectUpdateNotifications: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
