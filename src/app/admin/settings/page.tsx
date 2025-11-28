"use client";

import { useState, useEffect, useCallback } from "react";
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
  Bot,
  Sparkles,
  ShieldCheck,
  TestTube,
  Share2,
  Facebook,
  Youtube,
  Twitter,
} from "lucide-react";

// API keys and webhooks (these would come from a separate API in production)
const apiKeys = [
  { id: "1", name: "Production API", key: "sk_live_xxxx...xxxx", created: "2024-01-15", lastUsed: "2 hours ago", status: "active" },
  { id: "2", name: "Development API", key: "sk_test_xxxx...xxxx", created: "2024-02-20", lastUsed: "5 days ago", status: "active" },
  { id: "3", name: "Mobile App", key: "sk_live_yyyy...yyyy", created: "2024-03-10", lastUsed: "1 hour ago", status: "active" },
];

const webhooks = [
  { id: "1", url: "https://api.example.com/webhooks/payments", events: ["payment.success", "payment.failed"], status: "active" },
  { id: "2", url: "https://analytics.example.com/events", events: ["project.created", "pledge.created"], status: "active" },
];

interface PlatformSettings {
  siteName: string;
  siteDescription: string | null;
  supportEmail: string;
  timezone: string;
  currency: string;
  platformFee: number;
  maintenanceMode: boolean;
  googlePlacesApiKey: string | null;
  stripeEnabled: boolean;
  stripePublishableKey: string | null;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  ccbillEnabled: boolean;
  ccbillClientAccountNo: string | null;
  ccbillSubaccount: string | null;
  ccbillFormName: string | null;
  ccbillSalt: string | null;
  emailProvider: string;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  sendgridApiKey: string | null;
  mailgunApiKey: string | null;
  mailgunDomain: string | null;
  twitterHandle: string | null;
  facebookUrl: string | null;
  instagramHandle: string | null;
  youtubeUrl: string | null;
  discordUrl: string | null;
  aiProvider: string;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  aiAutoModeration: boolean;
  aiAutoTagging: boolean;
  aiContentGeneration: boolean;
  twoFactorRequired: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  requireSpecialChars: boolean;
  ipRateLimitEnabled: boolean;
  ipRateLimitRequests: number;
  ipRateLimitWindow: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form states
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "IndieCrowdfund",
    siteDescription: "The independent crowdfunding platform for creators",
    supportEmail: "support@indiecrowdfund.com",
    timezone: "America/New_York",
    currency: "USD",
    platformFee: "5",
    maintenanceMode: false,
    googlePlacesApiKey: "",
  });

  const [paymentSettings, setPaymentSettings] = useState({
    stripeEnabled: false,
    stripePublicKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    ccbillEnabled: false,
    ccbillSubAccount: "",
    ccbillFlexId: "",
    ccbillSalt: "",
    autoPayouts: true,
    payoutThreshold: "100",
    payoutSchedule: "weekly",
  });

  const [emailSettings, setEmailSettings] = useState({
    provider: "smtp",
    sendgridApiKey: "",
    fromEmail: "",
    fromName: "",
    replyToEmail: "",
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

  const [aiSettings, setAiSettings] = useState({
    openaiEnabled: false,
    openaiApiKey: "",
    openaiModel: "gpt-4o",
    anthropicEnabled: false,
    anthropicApiKey: "",
    anthropicModel: "claude-sonnet-4-20250514",
    autoTagging: false,
    marketingCopy: false,
    contentModeration: false,
    fraudDetection: false,
    moderationThreshold: "0.7",
  });

  const [socialSettings, setSocialSettings] = useState({
    // Facebook/Instagram (Meta)
    facebookEnabled: false,
    facebookAppId: "",
    facebookAppSecret: "",
    facebookPageAccessToken: "",
    instagramEnabled: false,
    // YouTube
    youtubeEnabled: false,
    youtubeClientId: "",
    youtubeClientSecret: "",
    youtubeApiKey: "",
    // Twitter/X
    twitterEnabled: false,
    twitterApiKey: "",
    twitterApiSecret: "",
    twitterBearerToken: "",
    twitterAccessToken: "",
    twitterAccessSecret: "",
    // Content Generation
    dalleEnabled: false,
    dalleApiKey: "",
    stabilityEnabled: false,
    stabilityApiKey: "",
    // General Settings
    autoPostEnabled: false,
    defaultHashtags: "#crowdfunding #indiecrowdfund",
    postApprovalRequired: true,
  });

  // Fetch settings from API
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/settings");

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError("You don't have permission to access admin settings");
          return;
        }
        throw new Error("Failed to fetch settings");
      }

      const data = await response.json();
      const settings: PlatformSettings = data.settings;

      // Update form states with fetched data
      setGeneralSettings({
        siteName: settings.siteName || "IndieCrowdfund",
        siteDescription: settings.siteDescription || "",
        supportEmail: settings.supportEmail || "",
        timezone: settings.timezone || "America/New_York",
        currency: settings.currency || "USD",
        platformFee: String(settings.platformFee || 5),
        maintenanceMode: settings.maintenanceMode || false,
        googlePlacesApiKey: settings.googlePlacesApiKey || "",
      });

      setPaymentSettings((prev) => ({
        ...prev,
        stripeEnabled: settings.stripeEnabled || false,
        stripePublicKey: settings.stripePublishableKey || "",
        stripeSecretKey: settings.stripeSecretKey || "",
        stripeWebhookSecret: settings.stripeWebhookSecret || "",
        ccbillEnabled: settings.ccbillEnabled || false,
        ccbillSubAccount: settings.ccbillSubaccount || "",
        ccbillFlexId: settings.ccbillFormName || "",
        ccbillSalt: settings.ccbillSalt || "",
      }));

      setEmailSettings((prev) => ({
        ...prev,
        provider: settings.emailProvider || "smtp",
        sendgridApiKey: settings.sendgridApiKey || "",
        fromEmail: settings.smtpFromEmail || "",
        fromName: settings.smtpFromName || "",
      }));

      setSecuritySettings((prev) => ({
        ...prev,
        require2FA: settings.twoFactorRequired || false,
        sessionDuration: String(settings.sessionTimeout || 7),
        maxLoginAttempts: String(settings.maxLoginAttempts || 5),
        passwordMinLength: String(settings.passwordMinLength || 8),
        requireSpecialChar: settings.requireSpecialChars || true,
        rateLimit: String(settings.ipRateLimitRequests || 100),
      }));

      setAiSettings((prev) => ({
        ...prev,
        openaiEnabled: !!settings.openaiApiKey,
        openaiApiKey: settings.openaiApiKey || "",
        anthropicEnabled: !!settings.anthropicApiKey,
        anthropicApiKey: settings.anthropicApiKey || "",
        autoTagging: settings.aiAutoTagging || false,
        contentModeration: settings.aiAutoModeration || false,
        marketingCopy: settings.aiContentGeneration || false,
      }));

      setSocialSettings((prev) => ({
        ...prev,
        twitterApiKey: settings.twitterHandle || "",
        facebookAppId: settings.facebookUrl || "",
        youtubeClientId: settings.youtubeUrl || "",
      }));
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load settings. Using default values.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const [socialTestResults, setSocialTestResults] = useState<{
    facebook: "idle" | "testing" | "success" | "error";
    youtube: "idle" | "testing" | "success" | "error";
    twitter: "idle" | "testing" | "success" | "error";
  }>({
    facebook: "idle",
    youtube: "idle",
    twitter: "idle",
  });

  const testFacebook = async () => {
    setSocialTestResults((prev) => ({ ...prev, facebook: "testing" }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSocialTestResults((prev) => ({
      ...prev,
      facebook: socialSettings.facebookAppId && socialSettings.facebookAppSecret ? "success" : "error",
    }));
  };

  const testYoutube = async () => {
    setSocialTestResults((prev) => ({ ...prev, youtube: "testing" }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSocialTestResults((prev) => ({
      ...prev,
      youtube: socialSettings.youtubeClientId && socialSettings.youtubeClientSecret ? "success" : "error",
    }));
  };

  const testTwitter = async () => {
    setSocialTestResults((prev) => ({ ...prev, twitter: "testing" }));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSocialTestResults((prev) => ({
      ...prev,
      twitter: socialSettings.twitterApiKey && socialSettings.twitterApiSecret ? "success" : "error",
    }));
  };

  const [aiTestResults, setAiTestResults] = useState<{
    openai: "idle" | "testing" | "success" | "error";
    anthropic: "idle" | "testing" | "success" | "error";
  }>({
    openai: "idle",
    anthropic: "idle",
  });

  const testOpenAI = async () => {
    setAiTestResults((prev) => ({ ...prev, openai: "testing" }));
    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setAiTestResults((prev) => ({
      ...prev,
      openai: aiSettings.openaiApiKey ? "success" : "error",
    }));
  };

  const testAnthropic = async () => {
    setAiTestResults((prev) => ({ ...prev, anthropic: "testing" }));
    // Simulate API test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setAiTestResults((prev) => ({
      ...prev,
      anthropic: aiSettings.anthropicApiKey ? "success" : "error",
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      // Save based on active tab
      let section = "";
      let data: Record<string, unknown> = {};

      switch (activeTab) {
        case "general":
          section = "general";
          data = {
            siteName: generalSettings.siteName,
            siteDescription: generalSettings.siteDescription,
            supportEmail: generalSettings.supportEmail,
            timezone: generalSettings.timezone,
            currency: generalSettings.currency,
            platformFee: parseFloat(generalSettings.platformFee),
            maintenanceMode: generalSettings.maintenanceMode,
            googlePlacesApiKey: generalSettings.googlePlacesApiKey,
          };
          break;
        case "payments":
          section = "payments";
          data = {
            stripeEnabled: paymentSettings.stripeEnabled,
            stripePublishableKey: paymentSettings.stripePublicKey,
            stripeSecretKey: paymentSettings.stripeSecretKey,
            stripeWebhookSecret: paymentSettings.stripeWebhookSecret,
            ccbillEnabled: paymentSettings.ccbillEnabled,
            ccbillSubaccount: paymentSettings.ccbillSubAccount,
            ccbillFormName: paymentSettings.ccbillFlexId,
            ccbillSalt: paymentSettings.ccbillSalt,
          };
          break;
        case "email":
          section = "email";
          data = {
            emailProvider: emailSettings.provider,
            sendgridApiKey: emailSettings.sendgridApiKey,
            smtpFromEmail: emailSettings.fromEmail,
            smtpFromName: emailSettings.fromName,
          };
          break;
        case "social":
          section = "social";
          data = {
            twitterHandle: socialSettings.twitterApiKey,
            facebookUrl: socialSettings.facebookAppId,
            youtubeUrl: socialSettings.youtubeClientId,
          };
          break;
        case "ai":
          section = "ai";
          data = {
            aiProvider: aiSettings.openaiEnabled ? "openai" : aiSettings.anthropicEnabled ? "anthropic" : "openai",
            openaiApiKey: aiSettings.openaiApiKey,
            anthropicApiKey: aiSettings.anthropicApiKey,
            aiAutoModeration: aiSettings.contentModeration,
            aiAutoTagging: aiSettings.autoTagging,
            aiContentGeneration: aiSettings.marketingCopy,
          };
          break;
        case "security":
          section = "security";
          data = {
            twoFactorRequired: securitySettings.require2FA,
            sessionTimeout: parseInt(securitySettings.sessionDuration),
            maxLoginAttempts: parseInt(securitySettings.maxLoginAttempts),
            passwordMinLength: parseInt(securitySettings.passwordMinLength),
            requireSpecialChars: securitySettings.requireSpecialChar,
            ipRateLimitEnabled: true,
            ipRateLimitRequests: parseInt(securitySettings.rateLimit),
          };
          break;
        default:
          // For tabs without database storage (API, Database)
          setSaveMessage("Settings saved successfully");
          setIsSaving(false);
          return;
      }

      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      setSaveMessage("Settings saved successfully");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Error saving settings:", err);
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>
          <p className="text-zinc-500">Configure platform settings and integrations</p>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && (
            <span className="text-sm text-emerald-600">{saveMessage}</span>
          )}
          {error && (
            <span className="text-sm text-red-600">{error}</span>
          )}
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 lg:w-auto lg:inline-grid">
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
          <TabsTrigger value="social">
            <Share2 className="mr-2 h-4 w-4" />
            Social
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Bot className="mr-2 h-4 w-4" />
            AI
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

          <Card>
            <CardHeader>
              <CardTitle>Google Maps & Location Services</CardTitle>
              <CardDescription>Configure Google Places API for location autocomplete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="googlePlacesApiKey">Google Places API Key</Label>
                <Input
                  id="googlePlacesApiKey"
                  type="password"
                  placeholder="AIza..."
                  value={generalSettings.googlePlacesApiKey}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, googlePlacesApiKey: e.target.value })}
                />
                <p className="text-xs text-zinc-500">
                  Used for location autocomplete in project creation. Get your API key from{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Google Cloud Console
                  </a>
                  . Enable the Places API and Maps JavaScript API.
                </p>
              </div>
              <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
                <p><span className="text-blue-400">GOOGLE_PLACES_API_KEY</span>=<span className="text-zinc-400">your-api-key</span></p>
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

        {/* Social Media Settings */}
        <TabsContent value="social" className="mt-6 space-y-6">
          {/* Social Media Status Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className={socialSettings.facebookEnabled && socialSettings.facebookAppId ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-3 ${socialSettings.facebookEnabled && socialSettings.facebookAppId ? "bg-blue-100" : "bg-zinc-100"}`}>
                    <Facebook className={`h-6 w-6 ${socialSettings.facebookEnabled && socialSettings.facebookAppId ? "text-blue-600" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Facebook / Instagram</p>
                    <p className="text-sm text-zinc-500">Meta Graph API</p>
                  </div>
                  <Badge variant={socialSettings.facebookEnabled && socialSettings.facebookAppId ? "default" : "secondary"}>
                    {socialSettings.facebookEnabled && socialSettings.facebookAppId ? "Connected" : "Not Configured"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className={socialSettings.youtubeEnabled && socialSettings.youtubeClientId ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-3 ${socialSettings.youtubeEnabled && socialSettings.youtubeClientId ? "bg-red-100" : "bg-zinc-100"}`}>
                    <Youtube className={`h-6 w-6 ${socialSettings.youtubeEnabled && socialSettings.youtubeClientId ? "text-red-600" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">YouTube</p>
                    <p className="text-sm text-zinc-500">Community Posts</p>
                  </div>
                  <Badge variant={socialSettings.youtubeEnabled && socialSettings.youtubeClientId ? "default" : "secondary"}>
                    {socialSettings.youtubeEnabled && socialSettings.youtubeClientId ? "Connected" : "Not Configured"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className={socialSettings.twitterEnabled && socialSettings.twitterApiKey ? "border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-3 ${socialSettings.twitterEnabled && socialSettings.twitterApiKey ? "bg-sky-100" : "bg-zinc-100"}`}>
                    <Twitter className={`h-6 w-6 ${socialSettings.twitterEnabled && socialSettings.twitterApiKey ? "text-sky-500" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Twitter / X</p>
                    <p className="text-sm text-zinc-500">Posts & Threads</p>
                  </div>
                  <Badge variant={socialSettings.twitterEnabled && socialSettings.twitterApiKey ? "default" : "secondary"}>
                    {socialSettings.twitterEnabled && socialSettings.twitterApiKey ? "Connected" : "Not Configured"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Facebook/Instagram (Meta) Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Facebook className="h-5 w-5 text-blue-600" />
                    Facebook / Instagram (Meta)
                  </CardTitle>
                  <CardDescription>Connect Meta Graph API for Facebook and Instagram posting</CardDescription>
                </div>
                <Badge variant={socialSettings.facebookEnabled ? "default" : "secondary"}>
                  {socialSettings.facebookEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Enable Facebook/Instagram</Label>
                  <p className="text-sm text-zinc-500">Allow creators to connect their Facebook Pages and Instagram accounts</p>
                </div>
                <Switch
                  checked={socialSettings.facebookEnabled}
                  onCheckedChange={(checked) =>
                    setSocialSettings({ ...socialSettings, facebookEnabled: checked, instagramEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>App ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Your Facebook App ID"
                      value={socialSettings.facebookAppId}
                      onChange={(e) => setSocialSettings({ ...socialSettings, facebookAppId: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={testFacebook}
                      disabled={socialTestResults.facebook === "testing"}
                    >
                      {socialTestResults.facebook === "testing" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : socialTestResults.facebook === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : socialTestResults.facebook === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>App Secret</Label>
                  <Input
                    type="password"
                    placeholder="Your Facebook App Secret"
                    value={socialSettings.facebookAppSecret}
                    onChange={(e) => setSocialSettings({ ...socialSettings, facebookAppSecret: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>System User Access Token (optional)</Label>
                <Input
                  type="password"
                  placeholder="For server-to-server API calls"
                  value={socialSettings.facebookPageAccessToken}
                  onChange={(e) => setSocialSettings({ ...socialSettings, facebookPageAccessToken: e.target.value })}
                />
                <p className="text-xs text-zinc-500">
                  Create an app at <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developers.facebook.com</a>. Required scopes: pages_manage_posts, instagram_basic, instagram_content_publish
                </p>
              </div>
            </CardContent>
          </Card>

          {/* YouTube Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Youtube className="h-5 w-5 text-red-600" />
                    YouTube
                  </CardTitle>
                  <CardDescription>Connect YouTube Data API for community posts</CardDescription>
                </div>
                <Badge variant={socialSettings.youtubeEnabled ? "default" : "secondary"}>
                  {socialSettings.youtubeEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Enable YouTube</Label>
                  <p className="text-sm text-zinc-500">Allow creators to post community updates to their YouTube channel</p>
                </div>
                <Switch
                  checked={socialSettings.youtubeEnabled}
                  onCheckedChange={(checked) =>
                    setSocialSettings({ ...socialSettings, youtubeEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>OAuth Client ID</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Your Google OAuth Client ID"
                      value={socialSettings.youtubeClientId}
                      onChange={(e) => setSocialSettings({ ...socialSettings, youtubeClientId: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={testYoutube}
                      disabled={socialTestResults.youtube === "testing"}
                    >
                      {socialTestResults.youtube === "testing" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : socialTestResults.youtube === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : socialTestResults.youtube === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>OAuth Client Secret</Label>
                  <Input
                    type="password"
                    placeholder="Your Google OAuth Client Secret"
                    value={socialSettings.youtubeClientSecret}
                    onChange={(e) => setSocialSettings({ ...socialSettings, youtubeClientSecret: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Key (optional)</Label>
                <Input
                  type="password"
                  placeholder="For public data access"
                  value={socialSettings.youtubeApiKey}
                  onChange={(e) => setSocialSettings({ ...socialSettings, youtubeApiKey: e.target.value })}
                />
                <p className="text-xs text-zinc-500">
                  Create credentials at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Google Cloud Console</a>. Enable YouTube Data API v3.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Twitter/X Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Twitter className="h-5 w-5 text-sky-500" />
                    Twitter / X
                  </CardTitle>
                  <CardDescription>Connect Twitter API v2 for posting and threads</CardDescription>
                </div>
                <Badge variant={socialSettings.twitterEnabled ? "default" : "secondary"}>
                  {socialSettings.twitterEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Enable Twitter/X</Label>
                  <p className="text-sm text-zinc-500">Allow creators to post tweets and threads about their campaigns</p>
                </div>
                <Switch
                  checked={socialSettings.twitterEnabled}
                  onCheckedChange={(checked) =>
                    setSocialSettings({ ...socialSettings, twitterEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key (Consumer Key)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Your Twitter API Key"
                      value={socialSettings.twitterApiKey}
                      onChange={(e) => setSocialSettings({ ...socialSettings, twitterApiKey: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={testTwitter}
                      disabled={socialTestResults.twitter === "testing"}
                    >
                      {socialTestResults.twitter === "testing" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : socialTestResults.twitter === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : socialTestResults.twitter === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>API Secret (Consumer Secret)</Label>
                  <Input
                    type="password"
                    placeholder="Your Twitter API Secret"
                    value={socialSettings.twitterApiSecret}
                    onChange={(e) => setSocialSettings({ ...socialSettings, twitterApiSecret: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bearer Token</Label>
                <Input
                  type="password"
                  placeholder="For app-only authentication"
                  value={socialSettings.twitterBearerToken}
                  onChange={(e) => setSocialSettings({ ...socialSettings, twitterBearerToken: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Access Token (optional)</Label>
                  <Input
                    type="password"
                    placeholder="For user-context requests"
                    value={socialSettings.twitterAccessToken}
                    onChange={(e) => setSocialSettings({ ...socialSettings, twitterAccessToken: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Access Token Secret (optional)</Label>
                  <Input
                    type="password"
                    placeholder="Paired with access token"
                    value={socialSettings.twitterAccessSecret}
                    onChange={(e) => setSocialSettings({ ...socialSettings, twitterAccessSecret: e.target.value })}
                  />
                </div>
              </div>

              <p className="text-xs text-zinc-500">
                Create an app at <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">developer.twitter.com</a>. Requires at least Basic tier for posting.
              </p>
            </CardContent>
          </Card>

          {/* Image Generation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Image Generation
              </CardTitle>
              <CardDescription>Enable AI-powered image creation for social media posts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>DALL-E (OpenAI)</Label>
                      <p className="text-sm text-zinc-500">Generate images with DALL-E 3</p>
                    </div>
                    <Switch
                      checked={socialSettings.dalleEnabled}
                      onCheckedChange={(checked) =>
                        setSocialSettings({ ...socialSettings, dalleEnabled: checked })
                      }
                    />
                  </div>
                  {socialSettings.dalleEnabled && (
                    <div className="space-y-2">
                      <Label className="text-xs">API Key (uses OpenAI key from AI settings if empty)</Label>
                      <Input
                        type="password"
                        placeholder="Optional separate key"
                        value={socialSettings.dalleApiKey}
                        onChange={(e) => setSocialSettings({ ...socialSettings, dalleApiKey: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Stability AI</Label>
                      <p className="text-sm text-zinc-500">Generate images with Stable Diffusion</p>
                    </div>
                    <Switch
                      checked={socialSettings.stabilityEnabled}
                      onCheckedChange={(checked) =>
                        setSocialSettings({ ...socialSettings, stabilityEnabled: checked })
                      }
                    />
                  </div>
                  {socialSettings.stabilityEnabled && (
                    <div className="space-y-2">
                      <Label className="text-xs">API Key</Label>
                      <Input
                        type="password"
                        placeholder="Your Stability AI API key"
                        value={socialSettings.stabilityApiKey}
                        onChange={(e) => setSocialSettings({ ...socialSettings, stabilityApiKey: e.target.value })}
                      />
                      <p className="text-xs text-zinc-500">
                        Get your key from <a href="https://platform.stability.ai" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">platform.stability.ai</a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Social Posting Settings */}
          <Card>
            <CardHeader>
              <CardTitle>General Social Settings</CardTitle>
              <CardDescription>Configure default behavior for social media features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Auto-Post on Project Launch</Label>
                  <p className="text-sm text-zinc-500">Automatically post to connected accounts when a project goes live</p>
                </div>
                <Switch
                  checked={socialSettings.autoPostEnabled}
                  onCheckedChange={(checked) =>
                    setSocialSettings({ ...socialSettings, autoPostEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Require Post Approval</Label>
                  <p className="text-sm text-zinc-500">AI-generated content must be reviewed before posting</p>
                </div>
                <Switch
                  checked={socialSettings.postApprovalRequired}
                  onCheckedChange={(checked) =>
                    setSocialSettings({ ...socialSettings, postApprovalRequired: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Default Hashtags</Label>
                <Textarea
                  placeholder="#crowdfunding #indiecrowdfund #supportcreators"
                  value={socialSettings.defaultHashtags}
                  onChange={(e) => setSocialSettings({ ...socialSettings, defaultHashtags: e.target.value })}
                  rows={2}
                />
                <p className="text-xs text-zinc-500">
                  These hashtags will be suggested for all social posts. Creators can modify them per post.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Environment Variables Info */}
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                For production deployments, set these environment variables on your server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
                <div className="space-y-1">
                  <p className="text-zinc-500"># Facebook/Instagram</p>
                  <p><span className="text-blue-400">FACEBOOK_APP_ID</span>=<span className="text-zinc-400">your-app-id</span></p>
                  <p><span className="text-blue-400">FACEBOOK_APP_SECRET</span>=<span className="text-zinc-400">your-app-secret</span></p>
                  <p className="text-zinc-500 mt-2"># YouTube</p>
                  <p><span className="text-red-400">YOUTUBE_CLIENT_ID</span>=<span className="text-zinc-400">your-client-id</span></p>
                  <p><span className="text-red-400">YOUTUBE_CLIENT_SECRET</span>=<span className="text-zinc-400">your-client-secret</span></p>
                  <p className="text-zinc-500 mt-2"># Twitter/X</p>
                  <p><span className="text-sky-400">TWITTER_API_KEY</span>=<span className="text-zinc-400">your-api-key</span></p>
                  <p><span className="text-sky-400">TWITTER_API_SECRET</span>=<span className="text-zinc-400">your-api-secret</span></p>
                  <p><span className="text-sky-400">TWITTER_BEARER_TOKEN</span>=<span className="text-zinc-400">your-bearer-token</span></p>
                  <p className="text-zinc-500 mt-2"># Image Generation</p>
                  <p><span className="text-purple-400">STABILITY_API_KEY</span>=<span className="text-zinc-400">your-stability-key</span></p>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                API keys entered in this admin panel are stored in the database and will override environment variables.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="mt-6 space-y-6">
          {/* AI Status Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className={aiSettings.openaiEnabled && aiSettings.openaiApiKey ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-3 ${aiSettings.openaiEnabled && aiSettings.openaiApiKey ? "bg-emerald-100" : "bg-zinc-100"}`}>
                    <Sparkles className={`h-6 w-6 ${aiSettings.openaiEnabled && aiSettings.openaiApiKey ? "text-emerald-600" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">OpenAI</p>
                    <p className="text-sm text-zinc-500">Auto-tagging, Marketing Copy</p>
                  </div>
                  <Badge variant={aiSettings.openaiEnabled && aiSettings.openaiApiKey ? "default" : "secondary"}>
                    {aiSettings.openaiEnabled && aiSettings.openaiApiKey ? "Connected" : "Not Configured"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className={aiSettings.anthropicEnabled && aiSettings.anthropicApiKey ? "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20" : ""}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`rounded-full p-3 ${aiSettings.anthropicEnabled && aiSettings.anthropicApiKey ? "bg-violet-100" : "bg-zinc-100"}`}>
                    <ShieldCheck className={`h-6 w-6 ${aiSettings.anthropicEnabled && aiSettings.anthropicApiKey ? "text-violet-600" : "text-zinc-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Anthropic Claude</p>
                    <p className="text-sm text-zinc-500">Moderation, Fraud Detection</p>
                  </div>
                  <Badge variant={aiSettings.anthropicEnabled && aiSettings.anthropicApiKey ? "default" : "secondary"}>
                    {aiSettings.anthropicEnabled && aiSettings.anthropicApiKey ? "Connected" : "Not Configured"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* OpenAI Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    OpenAI Configuration
                  </CardTitle>
                  <CardDescription>Powers auto-tagging and marketing copy generation</CardDescription>
                </div>
                <Badge variant={aiSettings.openaiEnabled ? "default" : "secondary"}>
                  {aiSettings.openaiEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Enable OpenAI</Label>
                  <p className="text-sm text-zinc-500">Use OpenAI for content generation features</p>
                </div>
                <Switch
                  checked={aiSettings.openaiEnabled}
                  onCheckedChange={(checked) =>
                    setAiSettings({ ...aiSettings, openaiEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={aiSettings.openaiApiKey}
                      onChange={(e) => setAiSettings({ ...aiSettings, openaiApiKey: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={testOpenAI}
                      disabled={aiTestResults.openai === "testing"}
                    >
                      {aiTestResults.openai === "testing" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : aiTestResults.openai === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : aiTestResults.openai === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">platform.openai.com</a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={aiSettings.openaiModel}
                    onValueChange={(v) => setAiSettings({ ...aiSettings, openaiModel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster/Cheaper)</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">OpenAI Features</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Auto-Tagging</Label>
                      <p className="text-sm text-zinc-500">Automatically suggest categories and tags for projects</p>
                    </div>
                    <Switch
                      checked={aiSettings.autoTagging}
                      onCheckedChange={(checked) =>
                        setAiSettings({ ...aiSettings, autoTagging: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Marketing Copy</Label>
                      <p className="text-sm text-zinc-500">Generate social posts and promotional content</p>
                    </div>
                    <Switch
                      checked={aiSettings.marketingCopy}
                      onCheckedChange={(checked) =>
                        setAiSettings({ ...aiSettings, marketingCopy: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Anthropic Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-violet-600" />
                    Anthropic Claude Configuration
                  </CardTitle>
                  <CardDescription>Powers content moderation and fraud detection</CardDescription>
                </div>
                <Badge variant={aiSettings.anthropicEnabled ? "default" : "secondary"}>
                  {aiSettings.anthropicEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Enable Anthropic</Label>
                  <p className="text-sm text-zinc-500">Use Claude for moderation and safety features</p>
                </div>
                <Switch
                  checked={aiSettings.anthropicEnabled}
                  onCheckedChange={(checked) =>
                    setAiSettings({ ...aiSettings, anthropicEnabled: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="sk-ant-..."
                      value={aiSettings.anthropicApiKey}
                      onChange={(e) => setAiSettings({ ...aiSettings, anthropicApiKey: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={testAnthropic}
                      disabled={aiTestResults.anthropic === "testing"}
                    >
                      {aiTestResults.anthropic === "testing" ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : aiTestResults.anthropic === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : aiTestResults.anthropic === "error" ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Get your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">console.anthropic.com</a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={aiSettings.anthropicModel}
                    onValueChange={(v) => setAiSettings({ ...aiSettings, anthropicModel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</SelectItem>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku (Faster/Cheaper)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Anthropic Features</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Content Moderation</Label>
                      <p className="text-sm text-zinc-500">Automatically review project content for policy violations</p>
                    </div>
                    <Switch
                      checked={aiSettings.contentModeration}
                      onCheckedChange={(checked) =>
                        setAiSettings({ ...aiSettings, contentModeration: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Fraud Detection</Label>
                      <p className="text-sm text-zinc-500">Analyze projects for potential scams</p>
                    </div>
                    <Switch
                      checked={aiSettings.fraudDetection}
                      onCheckedChange={(checked) =>
                        setAiSettings({ ...aiSettings, fraudDetection: checked })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Moderation Sensitivity</Label>
                  <p className="text-sm text-zinc-500 mb-2">
                    Projects with a risk score above this threshold will be flagged for manual review
                  </p>
                  <div className="flex items-center gap-4">
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={aiSettings.moderationThreshold}
                      onChange={(e) => setAiSettings({ ...aiSettings, moderationThreshold: e.target.value })}
                      className="flex-1"
                    />
                    <span className="w-12 text-center font-mono text-sm">
                      {(parseFloat(aiSettings.moderationThreshold) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Lower = more strict (more projects flagged), Higher = more lenient
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Environment Variables Info */}
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                For production deployments, set these environment variables on your server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
                <div className="space-y-1">
                  <p><span className="text-emerald-400">OPENAI_API_KEY</span>=<span className="text-zinc-400">your-openai-api-key</span></p>
                  <p><span className="text-violet-400">ANTHROPIC_API_KEY</span>=<span className="text-zinc-400">your-anthropic-api-key</span></p>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-500">
                API keys entered in this admin panel are stored in the database and will override environment variables.
              </p>
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
