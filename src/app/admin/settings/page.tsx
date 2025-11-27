"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings,
  Globe,
  CreditCard,
  Mail,
  Shield,
  Key,
  Database,
  Server,
  Webhook,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Save,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
} from "lucide-react";

// Mock data
const apiKeys = [
  { id: "1", name: "Production API", key: "sk_live_xxxx...xxxx", created: "2024-01-15", lastUsed: "2 hours ago", status: "active" },
  { id: "2", name: "Development API", key: "sk_test_xxxx...xxxx", created: "2024-02-20", lastUsed: "5 days ago", status: "active" },
  { id: "3", name: "Mobile App", key: "sk_live_yyyy...yyyy", created: "2024-03-10", lastUsed: "1 hour ago", status: "active" },
];

const webhooks = [
  { id: "1", url: "https://api.example.com/webhooks/payments", events: ["payment.success", "payment.failed"], status: "active" },
  { id: "2", url: "https://analytics.example.com/events", events: ["project.created", "pledge.created"], status: "active" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "IndieCrowdfund",
    siteDescription: "The independent crowdfunding platform for creators",
    supportEmail: "support@indiecrowdfund.com",
    timezone: "America/New_York",
    currency: "USD",
    platformFee: "5",
    maintenanceMode: false,
  });

  const [paymentSettings, setPaymentSettings] = useState({
    stripeEnabled: true,
    stripePublicKey: "pk_live_xxxxxxxxxxxxxx",
    stripeSecretKey: "sk_live_xxxxxxxxxxxxxx",
    stripeWebhookSecret: "whsec_xxxxxxxxxxxxxx",
    ccbillEnabled: true,
    ccbillSubAccount: "1234567",
    ccbillFlexId: "abcdefgh",
    ccbillSalt: "xxxxxxxxxx",
    autoPayouts: true,
    payoutThreshold: "100",
    payoutSchedule: "weekly",
  });

  const [emailSettings, setEmailSettings] = useState({
    provider: "sendgrid",
    sendgridApiKey: "SG.xxxxxxxxxxxxxx",
    fromEmail: "noreply@indiecrowdfund.com",
    fromName: "IndieCrowdfund",
    replyToEmail: "support@indiecrowdfund.com",
    emailVerificationRequired: true,
    welcomeEmailEnabled: true,
    pledgeConfirmationEnabled: true,
    projectUpdateNotifications: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    require2FA: false,
    sessionDuration: "7",
    maxLoginAttempts: "5",
    lockoutDuration: "30",
    passwordMinLength: "8",
    requireSpecialChar: true,
    ipWhitelist: "",
    rateLimit: "100",
    csrfProtection: true,
    contentSecurityPolicy: true,
  });

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-zinc-500">Configure platform settings and integrations</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="general">
            <Settings className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="mr-2 h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="mr-2 h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="mr-2 h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="mr-2 h-4 w-4" />
            Database
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Site Configuration</CardTitle>
              <CardDescription>Basic platform settings and branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={generalSettings.siteName}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={generalSettings.supportEmail}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteDescription">Site Description</Label>
                <Textarea
                  id="siteDescription"
                  value={generalSettings.siteDescription}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, siteDescription: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={generalSettings.timezone}
                    onValueChange={(v) => setGeneralSettings({ ...generalSettings, timezone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select
                    value={generalSettings.currency}
                    onValueChange={(v) => setGeneralSettings({ ...generalSettings, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                      <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                      <SelectItem value="CAD">CAD (C$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platformFee">Platform Fee (%)</Label>
                  <Input
                    id="platformFee"
                    type="number"
                    min="0"
                    max="20"
                    value={generalSettings.platformFee}
                    onChange={(e) => setGeneralSettings({ ...generalSettings, platformFee: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-zinc-500">
                    Temporarily disable the site for maintenance
                  </p>
                </div>
                <Switch
                  checked={generalSettings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setGeneralSettings({ ...generalSettings, maintenanceMode: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo & Branding</CardTitle>
              <CardDescription>Upload your site logo and favicon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <Label>Site Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-24 w-48 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50">
                      <span className="text-2xl font-bold text-zinc-400">Logo</span>
                    </div>
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label>Favicon</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50">
                      <Globe className="h-6 w-6 text-zinc-400" />
                    </div>
                    <Button variant="outline">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stripe Configuration</CardTitle>
                  <CardDescription>Primary payment processor settings</CardDescription>
                </div>
                <Badge variant={paymentSettings.stripeEnabled ? "default" : "secondary"}>
                  {paymentSettings.stripeEnabled ? "Enabled" : "Disabled"}
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
                  checked={paymentSettings.stripeEnabled}
                  onCheckedChange={(checked) =>
                    setPaymentSettings({ ...paymentSettings, stripeEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Publishable Key</Label>
                  <Input
                    type="password"
                    value={paymentSettings.stripePublicKey}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, stripePublicKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input
                    type="password"
                    value={paymentSettings.stripeSecretKey}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeSecretKey: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <Input
                  type="password"
                  value={paymentSettings.stripeWebhookSecret}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, stripeWebhookSecret: e.target.value })}
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
                <Badge variant={paymentSettings.ccbillEnabled ? "default" : "secondary"}>
                  {paymentSettings.ccbillEnabled ? "Enabled" : "Disabled"}
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
                  checked={paymentSettings.ccbillEnabled}
                  onCheckedChange={(checked) =>
                    setPaymentSettings({ ...paymentSettings, ccbillEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Sub Account ID</Label>
                  <Input
                    value={paymentSettings.ccbillSubAccount}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, ccbillSubAccount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>FlexForm ID</Label>
                  <Input
                    value={paymentSettings.ccbillFlexId}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, ccbillFlexId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Salt Key</Label>
                  <Input
                    type="password"
                    value={paymentSettings.ccbillSalt}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, ccbillSalt: e.target.value })}
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
                  checked={paymentSettings.autoPayouts}
                  onCheckedChange={(checked) =>
                    setPaymentSettings({ ...paymentSettings, autoPayouts: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Payout Amount ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={paymentSettings.payoutThreshold}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, payoutThreshold: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payout Schedule</Label>
                  <Select
                    value={paymentSettings.payoutSchedule}
                    onValueChange={(v) => setPaymentSettings({ ...paymentSettings, payoutSchedule: v })}
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
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="mt-6 space-y-6">
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
                    value={emailSettings.provider}
                    onValueChange={(v) => setEmailSettings({ ...emailSettings, provider: v })}
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
                  <Input
                    type="password"
                    value={emailSettings.sendgridApiKey}
                    onChange={(e) => setEmailSettings({ ...emailSettings, sendgridApiKey: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={emailSettings.fromEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={emailSettings.fromName}
                    onChange={(e) => setEmailSettings({ ...emailSettings, fromName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-To Email</Label>
                  <Input
                    type="email"
                    value={emailSettings.replyToEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, replyToEmail: e.target.value })}
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
                  checked={emailSettings.emailVerificationRequired}
                  onCheckedChange={(checked) =>
                    setEmailSettings({ ...emailSettings, emailVerificationRequired: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Welcome Email</Label>
                  <p className="text-sm text-zinc-500">Send welcome email to new users</p>
                </div>
                <Switch
                  checked={emailSettings.welcomeEmailEnabled}
                  onCheckedChange={(checked) =>
                    setEmailSettings({ ...emailSettings, welcomeEmailEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Pledge Confirmation</Label>
                  <p className="text-sm text-zinc-500">Send confirmation emails for pledges</p>
                </div>
                <Switch
                  checked={emailSettings.pledgeConfirmationEnabled}
                  onCheckedChange={(checked) =>
                    setEmailSettings({ ...emailSettings, pledgeConfirmationEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Project Update Notifications</Label>
                  <p className="text-sm text-zinc-500">Notify backers when creators post updates</p>
                </div>
                <Switch
                  checked={emailSettings.projectUpdateNotifications}
                  onCheckedChange={(checked) =>
                    setEmailSettings({ ...emailSettings, projectUpdateNotifications: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>Configure user authentication security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Require Two-Factor Authentication</Label>
                  <p className="text-sm text-zinc-500">Require 2FA for all admin users</p>
                </div>
                <Switch
                  checked={securitySettings.require2FA}
                  onCheckedChange={(checked) =>
                    setSecuritySettings({ ...securitySettings, require2FA: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Session Duration (days)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={securitySettings.sessionDuration}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, sessionDuration: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Login Attempts</Label>
                  <Input
                    type="number"
                    min="3"
                    max="10"
                    value={securitySettings.maxLoginAttempts}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, maxLoginAttempts: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lockout Duration (minutes)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="60"
                    value={securitySettings.lockoutDuration}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, lockoutDuration: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Minimum Password Length</Label>
                  <Input
                    type="number"
                    min="6"
                    max="32"
                    value={securitySettings.passwordMinLength}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, passwordMinLength: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={securitySettings.requireSpecialChar}
                    onCheckedChange={(checked) =>
                      setSecuritySettings({ ...securitySettings, requireSpecialChar: checked })
                    }
                  />
                  <Label>Require Special Character</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting & Protection</CardTitle>
              <CardDescription>Configure security protections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rate Limit (requests/minute)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="1000"
                    value={securitySettings.rateLimit}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, rateLimit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IP Whitelist (comma separated)</Label>
                  <Input
                    placeholder="192.168.1.1, 10.0.0.1"
                    value={securitySettings.ipWhitelist}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, ipWhitelist: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>CSRF Protection</Label>
                  <p className="text-sm text-zinc-500">Enable cross-site request forgery protection</p>
                </div>
                <Switch
                  checked={securitySettings.csrfProtection}
                  onCheckedChange={(checked) =>
                    setSecuritySettings({ ...securitySettings, csrfProtection: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Content Security Policy</Label>
                  <p className="text-sm text-zinc-500">Enable strict CSP headers</p>
                </div>
                <Switch
                  checked={securitySettings.contentSecurityPolicy}
                  onCheckedChange={(checked) =>
                    setSecuritySettings({ ...securitySettings, contentSecurityPolicy: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Settings */}
        <TabsContent value="api" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>Manage API keys for external integrations</CardDescription>
                </div>
                <Dialog open={isCreatingKey} onOpenChange={setIsCreatingKey}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create API Key</DialogTitle>
                      <DialogDescription>
                        Generate a new API key for external integrations
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Key Name</Label>
                        <Input placeholder="e.g., Production API" />
                      </div>
                      <div className="space-y-2">
                        <Label>Environment</Label>
                        <Select defaultValue="production">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreatingKey(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => setIsCreatingKey(false)}>Create Key</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {key.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
                        <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                          {showApiKey === key.id ? "sk_live_1234567890abcdef" : key.key}
                        </code>
                        <button
                          onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                          className="text-zinc-400 hover:text-zinc-600"
                        >
                          {showApiKey === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button className="text-zinc-400 hover:text-zinc-600">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right text-sm text-zinc-500">
                      <p>Created: {key.created}</p>
                      <p>Last used: {key.lastUsed}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Webhooks</CardTitle>
                  <CardDescription>Configure webhook endpoints for event notifications</CardDescription>
                </div>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <Webhook className="h-5 w-5 text-zinc-400" />
                    <div className="flex-1">
                      <p className="font-medium">{webhook.url}</p>
                      <div className="mt-1 flex gap-2">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={webhook.status === "active" ? "default" : "secondary"}>
                      {webhook.status}
                    </Badge>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Settings */}
        <TabsContent value="database" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-emerald-100 p-3">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Status</p>
                    <p className="text-lg font-semibold text-emerald-600">Connected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Database className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Size</p>
                    <p className="text-lg font-semibold">2.4 GB</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-violet-100 p-3">
                    <Clock className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Last Backup</p>
                    <p className="text-lg font-semibold">2 hours ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Database Operations</CardTitle>
              <CardDescription>Manage database backups and maintenance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-auto flex-col gap-2 p-6">
                  <Database className="h-6 w-6" />
                  <span>Create Backup</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-6">
                  <RefreshCw className="h-6 w-6" />
                  <span>Restore Backup</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-6">
                  <Zap className="h-6 w-6" />
                  <span>Run Migrations</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col gap-2 p-6 text-red-500 hover:text-red-700">
                  <AlertTriangle className="h-6 w-6" />
                  <span>Clear Cache</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Backups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4 text-zinc-400" />
                      <span className="font-medium">backup_2024_03_{20 - i}.sql.gz</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span>{156 - i * 10} MB</span>
                      <span>{i === 1 ? "2 hours ago" : `${i} days ago`}</span>
                      <Button variant="ghost" size="sm">
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
