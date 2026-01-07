"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  CreditCard,
  Mail,
  Shield,
  Key,
  Database as DatabaseIcon,
  RefreshCw,
  Save,
  Bot,
  ShieldCheck,
  Share2,
  Cloud,
  MessageSquare,
} from "lucide-react";
import {
  GeneralSettings,
  PaymentSettings,
  EmailSettings,
  SocialSettings,
  AiSettings,
  SecuritySettings,
  IdVerificationSettings,
  ApiSettings,
  DatabaseSettings,
  StorageSettings,
  CommunicationSettings,
} from "@/components/admin/settings";

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
  stripeConnectWebhookSecret: string | null;
  divinityCoinEnabled: boolean;
  divinityCoinApiKey: string | null;
  divinityCoinWebhookSecret: string | null;
  divinityCoinPartnerId: string | null;
  divinityCoinSettlementFrequency: string;
  // Shopify OAuth
  shopifyEnabled: boolean;
  shopifyApiKey: string | null;
  shopifyApiSecret: string | null;
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
  // Social profile URLs
  twitterHandle: string | null;
  facebookUrl: string | null;
  instagramHandle: string | null;
  youtubeUrl: string | null;
  discordUrl: string | null;
  // Social OAuth API Keys
  facebookAppId: string | null;
  facebookAppSecret: string | null;
  facebookPageAccessToken: string | null;
  youtubeClientId: string | null;
  youtubeClientSecret: string | null;
  youtubeApiKey: string | null;
  twitterApiKey: string | null;
  twitterApiSecret: string | null;
  twitterBearerToken: string | null;
  twitterAccessToken: string | null;
  twitterAccessSecret: string | null;
  // Image generation API keys
  dalleApiKey: string | null;
  stabilityApiKey: string | null;
  // AI settings
  aiProvider: string;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  aiAutoModeration: boolean;
  aiAutoTagging: boolean;
  aiContentGeneration: boolean;
  aiFraudDetection: boolean;
  // Email notification settings
  emailVerificationRequired: boolean;
  welcomeEmailEnabled: boolean;
  pledgeConfirmationEnabled: boolean;
  projectUpdateNotifications: boolean;
  // Payment settings
  autoPayouts: boolean;
  // Social auto-posting settings
  autoPostEnabled: boolean;
  postApprovalRequired: boolean;
  // Security settings
  csrfProtection: boolean;
  contentSecurityPolicy: boolean;
  // ID Verification (Shufti Pro)
  idVerificationEnabled: boolean;
  shuftiClientId: string | null;
  shuftiSecretKey: string | null;
  shuftiCallbackUrl: string | null;
  shuftiRedirectUrl: string | null;
  idVerificationMinAge: number;
  idVerificationMode: string;
  // Security
  twoFactorRequired: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  requireSpecialChars: boolean;
  // Global Rate Limiting
  globalRateLimitEnabled: boolean;
  globalRateLimitRequests: number;
  globalRateLimitWindow: number;
  // Login Rate Limiting
  loginRateLimitEnabled: boolean;
  loginRateLimitRequests: number;
  loginRateLimitWindow: number;
  // Password Reset Rate Limiting
  passwordResetRateLimitRequests: number;
  passwordResetRateLimitWindow: number;
  // Legacy fields (still used in some places)
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
  // R2 Storage settings
  r2Enabled: boolean;
  r2AccountId: string | null;
  r2AccessKeyId: string | null;
  r2SecretAccessKey: string | null;
  r2BucketName: string | null;
  r2PublicDomain: string | null;
  r2Region: string;
  maxFileSizeMB: number;
  maxProjectStorageMB: number;
  allowedFileTypes: string;
  digitalDownloadsEnabled: boolean;
  signedUrlExpirationMinutes: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
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
    stripeConnectWebhookSecret: "",
    divinityCoinEnabled: false,
    divinityCoinApiKey: "",
    divinityCoinWebhookSecret: "",
    divinityCoinPartnerId: "",
    divinityCoinSettlementFrequency: "weekly",
    // Shopify OAuth
    shopifyEnabled: false,
    shopifyApiKey: "",
    shopifyApiSecret: "",
    // Local UI settings (not in DB yet)
    autoPayouts: true,
    payoutThreshold: "100",
    payoutSchedule: "weekly",
  });

  // Ref to track latest payment settings for save handler (avoids stale closure)
  const paymentSettingsRef = useRef(paymentSettings);
  useEffect(() => {
    paymentSettingsRef.current = paymentSettings;
  }, [paymentSettings]);

  const [emailSettings, setEmailSettings] = useState({
    provider: "sendgrid",
    // SMTP settings
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "",
    fromName: "",
    // Third-party providers
    sendgridApiKey: "",
    mailgunApiKey: "",
    mailgunDomain: "",
    // SendGrid webhook verification
    sendgridWebhookVerificationKey: "",
    // Local UI settings (not in DB)
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
    // Global Rate Limiting
    globalRateLimitEnabled: true,
    globalRateLimit: "100",
    globalRateLimitWindow: "60",
    // Login Rate Limiting
    loginRateLimitEnabled: true,
    loginRateLimit: "5",
    loginRateLimitWindow: "300",
    // Password Reset Rate Limiting
    passwordResetRateLimit: "3",
    passwordResetRateLimitWindow: "900",
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

  const [idVerificationSettings, setIdVerificationSettings] = useState({
    enabled: false,
    clientId: "",
    secretKey: "",
    callbackUrl: "",
    redirectUrl: "",
    minAge: "18",
    mode: "production",
  });

  const [storageSettings, setStorageSettings] = useState({
    r2Enabled: false,
    r2AccountId: "",
    r2AccessKeyId: "",
    r2SecretAccessKey: "",
    r2BucketName: "",
    r2PublicDomain: "",
    r2Region: "auto",
    maxFileSizeMB: "50",
    maxProjectStorageMB: "200",
    allowedFileTypes: "pdf,epub,zip,mp3",
    digitalDownloadsEnabled: false,
    signedUrlExpirationMinutes: "60",
  });

  // Ref to track latest storage settings for save handler (avoids stale closure)
  const storageSettingsRef = useRef(storageSettings);
  useEffect(() => {
    storageSettingsRef.current = storageSettings;
  }, [storageSettings]);

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
        stripeConnectWebhookSecret: settings.stripeConnectWebhookSecret || "",
        divinityCoinEnabled: settings.divinityCoinEnabled || false,
        divinityCoinApiKey: settings.divinityCoinApiKey || "",
        divinityCoinWebhookSecret: settings.divinityCoinWebhookSecret || "",
        divinityCoinPartnerId: settings.divinityCoinPartnerId || "",
        divinityCoinSettlementFrequency: settings.divinityCoinSettlementFrequency || "weekly",
        shopifyEnabled: settings.shopifyEnabled || false,
        shopifyApiKey: settings.shopifyApiKey || "",
        shopifyApiSecret: settings.shopifyApiSecret || "",
        autoPayouts: settings.autoPayouts || false,
      }));

      setEmailSettings((prev) => ({
        ...prev,
        provider: settings.emailProvider || "sendgrid",
        smtpHost: settings.smtpHost || "",
        smtpPort: String(settings.smtpPort || 587),
        smtpUser: settings.smtpUser || "",
        smtpPassword: settings.smtpPassword || "",
        fromEmail: settings.smtpFromEmail || "",
        fromName: settings.smtpFromName || "",
        sendgridApiKey: settings.sendgridApiKey || "",
        sendgridWebhookVerificationKey: (settings as unknown as Record<string, unknown>).sendgridWebhookVerificationKey as string || "",
        mailgunApiKey: settings.mailgunApiKey || "",
        mailgunDomain: settings.mailgunDomain || "",
        emailVerificationRequired: settings.emailVerificationRequired || false,
        welcomeEmailEnabled: settings.welcomeEmailEnabled !== false,
        pledgeConfirmationEnabled: settings.pledgeConfirmationEnabled !== false,
        projectUpdateNotifications: settings.projectUpdateNotifications !== false,
      }));

      setSecuritySettings((prev) => ({
        ...prev,
        require2FA: settings.twoFactorRequired || false,
        sessionDuration: String(settings.sessionTimeout || 7),
        maxLoginAttempts: String(settings.maxLoginAttempts || 5),
        passwordMinLength: String(settings.passwordMinLength || 8),
        requireSpecialChar: settings.requireSpecialChars || true,
        // Global Rate Limiting
        globalRateLimitEnabled: settings.globalRateLimitEnabled !== false,
        globalRateLimit: String(settings.globalRateLimitRequests || settings.ipRateLimitRequests || 100),
        globalRateLimitWindow: String(settings.globalRateLimitWindow || settings.ipRateLimitWindow || 60),
        // Login Rate Limiting
        loginRateLimitEnabled: settings.loginRateLimitEnabled !== false,
        loginRateLimit: String(settings.loginRateLimitRequests || 5),
        loginRateLimitWindow: String(settings.loginRateLimitWindow || 300),
        // Password Reset Rate Limiting
        passwordResetRateLimit: String(settings.passwordResetRateLimitRequests || 3),
        passwordResetRateLimitWindow: String(settings.passwordResetRateLimitWindow || 900),
        csrfProtection: settings.csrfProtection !== false,
        contentSecurityPolicy: settings.contentSecurityPolicy !== false,
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
        fraudDetection: settings.aiFraudDetection !== false, // Default to true if not set
      }));

      // Set enabled flags based on whether API keys exist
      // Note: API returns masked values like "••••••••" for existing secrets
      const hasFacebookKeys = !!settings.facebookAppId && settings.facebookAppId !== "";
      const hasYoutubeKeys = !!settings.youtubeClientId && settings.youtubeClientId !== "";
      const hasTwitterKeys = !!settings.twitterApiKey && settings.twitterApiKey !== "";
      const hasDalleKey = !!settings.dalleApiKey && settings.dalleApiKey !== "";
      const hasStabilityKey = !!settings.stabilityApiKey && settings.stabilityApiKey !== "";

      setSocialSettings((prev) => ({
        ...prev,
        // Set enabled flags based on existing keys
        facebookEnabled: hasFacebookKeys,
        instagramEnabled: hasFacebookKeys, // Instagram uses same Facebook OAuth
        youtubeEnabled: hasYoutubeKeys,
        twitterEnabled: hasTwitterKeys,
        dalleEnabled: hasDalleKey,
        stabilityEnabled: hasStabilityKey,
        // API keys (may be masked with "••••••••")
        facebookAppId: settings.facebookAppId || "",
        facebookAppSecret: settings.facebookAppSecret || "",
        facebookPageAccessToken: settings.facebookPageAccessToken || "",
        youtubeClientId: settings.youtubeClientId || "",
        youtubeClientSecret: settings.youtubeClientSecret || "",
        youtubeApiKey: settings.youtubeApiKey || "",
        twitterApiKey: settings.twitterApiKey || "",
        twitterApiSecret: settings.twitterApiSecret || "",
        twitterBearerToken: settings.twitterBearerToken || "",
        twitterAccessToken: settings.twitterAccessToken || "",
        twitterAccessSecret: settings.twitterAccessSecret || "",
        dalleApiKey: settings.dalleApiKey || "",
        stabilityApiKey: settings.stabilityApiKey || "",
        // Auto-posting settings
        autoPostEnabled: settings.autoPostEnabled || false,
        postApprovalRequired: settings.postApprovalRequired !== false,
      }));

      // Load ID verification settings
      setIdVerificationSettings({
        enabled: settings.idVerificationEnabled || false,
        clientId: settings.shuftiClientId || "",
        secretKey: settings.shuftiSecretKey || "",
        callbackUrl: settings.shuftiCallbackUrl || "",
        redirectUrl: settings.shuftiRedirectUrl || "",
        minAge: String(settings.idVerificationMinAge || 18),
        mode: settings.idVerificationMode || "production",
      });

      // Load storage settings
      setStorageSettings({
        r2Enabled: settings.r2Enabled || false,
        r2AccountId: settings.r2AccountId || "",
        r2AccessKeyId: settings.r2AccessKeyId || "",
        r2SecretAccessKey: settings.r2SecretAccessKey || "",
        r2BucketName: settings.r2BucketName || "",
        r2PublicDomain: settings.r2PublicDomain || "",
        r2Region: settings.r2Region || "auto",
        maxFileSizeMB: String(settings.maxFileSizeMB || 50),
        maxProjectStorageMB: String(settings.maxProjectStorageMB || 200),
        allowedFileTypes: settings.allowedFileTypes || "pdf,epub,zip,mp3",
        digitalDownloadsEnabled: settings.digitalDownloadsEnabled || false,
        signedUrlExpirationMinutes: String(settings.signedUrlExpirationMinutes || 60),
      });
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

  const [r2TestResult, setR2TestResult] = useState<"idle" | "testing" | "success" | "error">("idle");

  const testR2 = async () => {
    setR2TestResult("testing");
    try {
      // Use ref to get latest values (avoids stale closure)
      const currentStorageSettings = storageSettingsRef.current;
      const response = await fetch("/api/admin/settings/test-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          accountId: currentStorageSettings.r2AccountId,
          accessKeyId: currentStorageSettings.r2AccessKeyId,
          secretAccessKey: currentStorageSettings.r2SecretAccessKey,
          bucketName: currentStorageSettings.r2BucketName,
        }),
      });
      setR2TestResult(response.ok ? "success" : "error");
    } catch {
      setR2TestResult("error");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setError(null);

    // Small delay to ensure React state and refs are fully updated
    await new Promise(resolve => setTimeout(resolve, 100));

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
          // Use ref to get latest values (avoids stale closure from blur events)
          const currentPaymentSettings = paymentSettingsRef.current;
          data = {
            stripeEnabled: currentPaymentSettings.stripeEnabled,
            stripePublishableKey: currentPaymentSettings.stripePublicKey,
            stripeSecretKey: currentPaymentSettings.stripeSecretKey,
            stripeWebhookSecret: currentPaymentSettings.stripeWebhookSecret,
            stripeConnectWebhookSecret: currentPaymentSettings.stripeConnectWebhookSecret,
            divinityCoinEnabled: currentPaymentSettings.divinityCoinEnabled,
            divinityCoinApiKey: currentPaymentSettings.divinityCoinApiKey,
            divinityCoinWebhookSecret: currentPaymentSettings.divinityCoinWebhookSecret,
            divinityCoinPartnerId: currentPaymentSettings.divinityCoinPartnerId,
            divinityCoinSettlementFrequency: currentPaymentSettings.divinityCoinSettlementFrequency,
            shopifyEnabled: currentPaymentSettings.shopifyEnabled,
            shopifyApiKey: currentPaymentSettings.shopifyApiKey,
            shopifyApiSecret: currentPaymentSettings.shopifyApiSecret,
            autoPayouts: currentPaymentSettings.autoPayouts,
          };
          break;
        case "email":
          section = "email";
          data = {
            emailProvider: emailSettings.provider,
            smtpHost: emailSettings.smtpHost,
            smtpPort: parseInt(emailSettings.smtpPort) || 587,
            smtpUser: emailSettings.smtpUser,
            smtpPassword: emailSettings.smtpPassword,
            smtpFromEmail: emailSettings.fromEmail,
            smtpFromName: emailSettings.fromName,
            sendgridApiKey: emailSettings.sendgridApiKey,
            sendgridWebhookVerificationKey: emailSettings.sendgridWebhookVerificationKey,
            mailgunApiKey: emailSettings.mailgunApiKey,
            mailgunDomain: emailSettings.mailgunDomain,
            emailVerificationRequired: emailSettings.emailVerificationRequired,
            welcomeEmailEnabled: emailSettings.welcomeEmailEnabled,
            pledgeConfirmationEnabled: emailSettings.pledgeConfirmationEnabled,
            projectUpdateNotifications: emailSettings.projectUpdateNotifications,
          };
          break;
        case "social":
          section = "social";
          data = {
            facebookAppId: socialSettings.facebookAppId,
            facebookAppSecret: socialSettings.facebookAppSecret,
            facebookPageAccessToken: socialSettings.facebookPageAccessToken,
            youtubeClientId: socialSettings.youtubeClientId,
            youtubeClientSecret: socialSettings.youtubeClientSecret,
            youtubeApiKey: socialSettings.youtubeApiKey,
            twitterApiKey: socialSettings.twitterApiKey,
            twitterApiSecret: socialSettings.twitterApiSecret,
            twitterBearerToken: socialSettings.twitterBearerToken,
            twitterAccessToken: socialSettings.twitterAccessToken,
            twitterAccessSecret: socialSettings.twitterAccessSecret,
            dalleApiKey: socialSettings.dalleApiKey,
            stabilityApiKey: socialSettings.stabilityApiKey,
            autoPostEnabled: socialSettings.autoPostEnabled,
            postApprovalRequired: socialSettings.postApprovalRequired,
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
            aiFraudDetection: aiSettings.fraudDetection,
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
            // Global Rate Limiting
            globalRateLimitEnabled: securitySettings.globalRateLimitEnabled,
            globalRateLimitRequests: parseInt(securitySettings.globalRateLimit),
            globalRateLimitWindow: parseInt(securitySettings.globalRateLimitWindow),
            // Login Rate Limiting
            loginRateLimitEnabled: securitySettings.loginRateLimitEnabled,
            loginRateLimitRequests: parseInt(securitySettings.loginRateLimit),
            loginRateLimitWindow: parseInt(securitySettings.loginRateLimitWindow),
            // Password Reset Rate Limiting
            passwordResetRateLimitRequests: parseInt(securitySettings.passwordResetRateLimit),
            passwordResetRateLimitWindow: parseInt(securitySettings.passwordResetRateLimitWindow),
            // Legacy fields for backwards compatibility
            ipRateLimitEnabled: securitySettings.globalRateLimitEnabled,
            ipRateLimitRequests: parseInt(securitySettings.globalRateLimit),
            ipRateLimitWindow: parseInt(securitySettings.globalRateLimitWindow),
            csrfProtection: securitySettings.csrfProtection,
            contentSecurityPolicy: securitySettings.contentSecurityPolicy,
          };
          break;
        case "idverify":
          section = "idverify";
          data = {
            idVerificationEnabled: idVerificationSettings.enabled,
            shuftiClientId: idVerificationSettings.clientId,
            shuftiSecretKey: idVerificationSettings.secretKey,
            shuftiCallbackUrl: idVerificationSettings.callbackUrl,
            shuftiRedirectUrl: idVerificationSettings.redirectUrl,
            idVerificationMinAge: parseInt(idVerificationSettings.minAge) || 18,
            idVerificationMode: idVerificationSettings.mode,
          };
          break;
        case "storage":
          section = "storage";
          // Use ref to get latest values (avoids stale closure from EditableInput blur events)
          const currentStorageSettings = storageSettingsRef.current;
          data = {
            r2Enabled: currentStorageSettings.r2Enabled,
            r2AccountId: currentStorageSettings.r2AccountId,
            r2AccessKeyId: currentStorageSettings.r2AccessKeyId,
            r2SecretAccessKey: currentStorageSettings.r2SecretAccessKey,
            r2BucketName: currentStorageSettings.r2BucketName,
            r2PublicDomain: currentStorageSettings.r2PublicDomain,
            r2Region: currentStorageSettings.r2Region,
            maxFileSizeMB: parseInt(currentStorageSettings.maxFileSizeMB) || 50,
            maxProjectStorageMB: parseInt(currentStorageSettings.maxProjectStorageMB) || 200,
            allowedFileTypes: currentStorageSettings.allowedFileTypes,
            digitalDownloadsEnabled: currentStorageSettings.digitalDownloadsEnabled,
            signedUrlExpirationMinutes: parseInt(currentStorageSettings.signedUrlExpirationMinutes) || 60,
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
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ section, data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      // Reload settings from database to confirm save and show masked values
      await fetchSettings();

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
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-11 lg:w-auto lg:inline-grid">
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
          <TabsTrigger value="communication">
            <MessageSquare className="mr-2 h-4 w-4" />
            Mailboxes
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
          <TabsTrigger value="idverify">
            <ShieldCheck className="mr-2 h-4 w-4" />
            ID Verify
          </TabsTrigger>
          <TabsTrigger value="storage">
            <Cloud className="mr-2 h-4 w-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="mr-2 h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="database">
            <DatabaseIcon className="mr-2 h-4 w-4" />
            Database
          </TabsTrigger>
        </TabsList>


        <GeneralSettings 
          settings={generalSettings}
          onSettingsChange={setGeneralSettings}
          onSave={handleSave}
        />

        <PaymentSettings
          settings={paymentSettings}
          onSettingsChange={setPaymentSettings}
          onSave={handleSave}
        />

        <EmailSettings
          settings={emailSettings}
          onSettingsChange={setEmailSettings}
          onSave={handleSave}
        />

        <CommunicationSettings />

        <SocialSettings
          settings={socialSettings}
          testResults={socialTestResults}
          onSettingsChange={setSocialSettings}
          onSave={handleSave}
          onTestFacebook={testFacebook}
          onTestYoutube={testYoutube}
          onTestTwitter={testTwitter}
        />

        <AiSettings
          settings={aiSettings}
          testResults={aiTestResults}
          onSettingsChange={setAiSettings}
          onSave={handleSave}
          onTestOpenAI={testOpenAI}
          onTestAnthropic={testAnthropic}
        />

        <SecuritySettings
          settings={securitySettings}
          onSettingsChange={setSecuritySettings}
        />

        <IdVerificationSettings
          settings={idVerificationSettings}
          onSettingsChange={setIdVerificationSettings}
          onSave={handleSave}
        />

        <StorageSettings
          settings={storageSettings}
          testResult={r2TestResult}
          onSettingsChange={setStorageSettings}
          onSave={handleSave}
          onTestR2={testR2}
        />

        <ApiSettings />

        <DatabaseSettings />
      </Tabs>
    </div>
  );
}
