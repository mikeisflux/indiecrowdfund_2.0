"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  FileText,
  Truck,
  CreditCard,
  Bell,
  Plug,
  Users,
  Image as ImageIcon,
  Globe,
  ExternalLink,
  Loader2,
  CheckCircle,
  RefreshCw,
  Banknote,
  Lock,
  Building2,
  AlertTriangle,
  Store,
  Key,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type SettingsSection = "general" | "survey" | "shipping" | "payments" | "notifications" | "integrations" | "shopify" | "shipstation" | "shippo" | "easypost" | "stamps" | "team";

interface SettingsTabProps {
  projectName?: string;
  currency?: string;
  timezone?: string;
  projectId?: string;
  onRefresh?: () => void;
}

const settingsNav = [
  { id: "general", label: "General", icon: Settings },
  { id: "survey", label: "Survey", icon: FileText },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "shopify", label: "Shopify API Key", icon: Key },
  { id: "shipstation", label: "ShipStation API", icon: Key },
  { id: "shippo", label: "Shippo API", icon: Key },
  { id: "easypost", label: "EasyPost API", icon: Key },
  { id: "stamps", label: "Stamps.com API", icon: Key },
  { id: "team", label: "Team", icon: Users },
] as const;

export function SettingsTab({
  projectName = "Flying Sparks Volumes 1-3",
  currency = "USD",
  timezone = "America/Los_Angeles",
  projectId,
  onRefresh,
}: SettingsTabProps) {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [name, setName] = useState(projectName);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);

  // Loading states
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingSurvey, setIsSavingSurvey] = useState(false);
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isConnectingShipStation, setIsConnectingShipStation] = useState(false);
  const [isConnectingEasyship, setIsConnectingEasyship] = useState(false);
  const [isConnectingShopify, setIsConnectingShopify] = useState(false);

  // Stripe Connect state
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboarded: boolean;
    loading: boolean;
    error: string | null;
  }>({ connected: false, onboarded: false, loading: true, error: null });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isResettingStripe, setIsResettingStripe] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // DivinityCoin bank account state
  const [bankAccount, setBankAccount] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking" as "checking" | "savings",
  });
  const [bankAccountStatus, setBankAccountStatus] = useState<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  }>({ saved: false, loading: true, lastFour: null });
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Chain2Pay bank account state
  const [chain2payBank, setChain2payBank] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking" as "checking" | "savings",
  });
  const [chain2payBankStatus, setChain2payBankStatus] = useState<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  }>({ saved: false, loading: true, lastFour: null });
  const [isSavingChain2payBank, setIsSavingChain2payBank] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Integration credentials
  const [shipStationKey, setShipStationKey] = useState("");
  const [shipStationSecret, setShipStationSecret] = useState("");
  const [easyshipToken, setEasyshipToken] = useState("");
  const [shopifyDomain, setShopifyDomain] = useState("");

  // Shopify status
  const [shopifyStatus, setShopifyStatus] = useState<{
    connected: boolean;
    loading: boolean;
    shopName: string | null;
  }>({ connected: false, loading: true, shopName: null });

  // Shopify API credentials (per-project)
  const [shopifyApiCredentials, setShopifyApiCredentials] = useState({
    apiKey: "",
    apiSecret: "",
  });
  const [shopifyCredsStatus, setShopifyCredsStatus] = useState<{
    saved: boolean;
    loading: boolean;
  }>({ saved: false, loading: true });
  const [isSavingShopifyCreds, setIsSavingShopifyCreds] = useState(false);

  // ShipStation API credentials
  const [shipstationCredentials, setShipstationCredentials] = useState({
    apiKey: "",
    apiSecret: "",
  });
  const [shipstationCredsStatus, setShipstationCredsStatus] = useState<{
    saved: boolean;
    loading: boolean;
  }>({ saved: false, loading: true });
  const [isSavingShipstationCreds, setIsSavingShipstationCreds] = useState(false);

  // Shippo API credentials
  const [shippoCredentials, setShippoCredentials] = useState({
    apiToken: "",
  });
  const [shippoCredsStatus, setShippoCredsStatus] = useState<{
    saved: boolean;
    loading: boolean;
  }>({ saved: false, loading: true });
  const [isSavingShippoCreds, setIsSavingShippoCreds] = useState(false);

  // EasyPost API credentials
  const [easypostCredentials, setEasypostCredentials] = useState({
    apiKey: "",
  });
  const [easypostCredsStatus, setEasypostCredsStatus] = useState<{
    saved: boolean;
    loading: boolean;
  }>({ saved: false, loading: true });
  const [isSavingEasypostCreds, setIsSavingEasypostCreds] = useState(false);

  // Stamps.com API credentials
  const [stampsCredentials, setStampsCredentials] = useState({
    integrationId: "",
    username: "",
    password: "",
  });
  const [stampsCredsStatus, setStampsCredsStatus] = useState<{
    saved: boolean;
    loading: boolean;
  }>({ saved: false, loading: true });
  const [isSavingStampsCreds, setIsSavingStampsCreds] = useState(false);

  // Switch states
  const [surveySettings, setSurveySettings] = useState({
    allowAddressChanges: true,
    sendConfirmationEmail: true,
    lockAfterFulfillment: true,
    sendReminders: true,
  });

  const [shippingSettings, setShippingSettings] = useState({
    domesticShipping: true,
    internationalShipping: true,
    addressValidation: true,
  });

  const [paymentSettings, setPaymentSettings] = useState({
    autoRetry: true,
    sendReceipts: true,
    failedNotifications: true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    surveyCompletions: false,
    failedPayments: true,
    newPreorders: true,
    dailySummary: true,
  });

  // Check Stripe connection status on mount
  useEffect(() => {
    async function checkStripeStatus() {
      try {
        const response = await fetch("/api/stripe/connect");
        const data = await response.json();

        if (!response.ok) {
          setStripeStatus({
            connected: false,
            onboarded: false,
            loading: false,
            error: data.error || "Failed to check status",
          });
          return;
        }

        setStripeStatus({
          connected: data.connected || false,
          onboarded: data.onboarded || false,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to check Stripe status:", error);
        setStripeStatus({
          connected: false,
          onboarded: false,
          loading: false,
          error: "Network error checking status"
        });
      }
    }
    checkStripeStatus();
  }, []);

  // Check DivinityCoin bank account status on mount
  useEffect(() => {
    async function checkBankAccountStatus() {
      try {
        const response = await fetch("/api/creator/bank-account");
        if (response.ok) {
          const data = await response.json();
          setBankAccountStatus({
            saved: data.exists,
            loading: false,
            lastFour: data.lastFour || null,
          });
          if (data.exists) {
            setBankAccount(prev => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
            }));
          }
        } else {
          setBankAccountStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        setBankAccountStatus({ saved: false, loading: false, lastFour: null });
      }
    }
    checkBankAccountStatus();
  }, []);

  // Check Chain2Pay bank account status on mount
  useEffect(() => {
    async function checkChain2payBankStatus() {
      try {
        const response = await fetch("/api/creator/chain2pay-bank-account");
        if (response.ok) {
          const data = await response.json();
          setChain2payBankStatus({
            saved: data.exists,
            loading: false,
            lastFour: data.lastFour || null,
          });
          if (data.exists) {
            setChain2payBank(prev => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
            }));
          }
        } else {
          setChain2payBankStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        setChain2payBankStatus({ saved: false, loading: false, lastFour: null });
      }
    }
    checkChain2payBankStatus();
  }, []);

  // Check Shopify connection status on mount
  useEffect(() => {
    async function checkShopifyStatus() {
      if (!projectId) {
        setShopifyStatus({ connected: false, loading: false, shopName: null });
        return;
      }
      try {
        const response = await fetch(`/api/creator/indiekit/shopify?projectId=${projectId}&action=status`);
        if (response.ok) {
          const data = await response.json();
          setShopifyStatus({
            connected: data.connected || false,
            loading: false,
            shopName: data.shop?.name || null,
          });
        } else {
          setShopifyStatus({ connected: false, loading: false, shopName: null });
        }
      } catch {
        setShopifyStatus({ connected: false, loading: false, shopName: null });
      }
    }
    checkShopifyStatus();
  }, [projectId]);

  // Load Shopify API credentials on mount (user-level, not project-level)
  useEffect(() => {
    async function loadShopifyCredentials() {
      try {
        const response = await fetch("/api/creator/indiekit/shopify/credentials");
        if (response.ok) {
          const data = await response.json();
          setShopifyCredsStatus({
            saved: data.hasCredentials || false,
            loading: false,
          });
          if (data.hasCredentials && data.apiKeyPreview) {
            setShopifyApiCredentials({
              apiKey: data.apiKeyPreview,
              apiSecret: "••••••••",
            });
          }
          // Also update shop connection status from user-level data
          if (data.hasConnectedStore && data.shopDomain) {
            setShopifyStatus({
              connected: true,
              loading: false,
              shopName: data.shopDomain,
            });
          }
        } else {
          setShopifyCredsStatus({ saved: false, loading: false });
        }
      } catch {
        setShopifyCredsStatus({ saved: false, loading: false });
      }
    }
    loadShopifyCredentials();
  }, []);

  // Load shipping provider credentials on mount
  useEffect(() => {
    async function loadShippingProviderCredentials() {
      try {
        const response = await fetch("/api/creator/indiekit/shipping-providers/credentials");
        if (response.ok) {
          const data = await response.json();

          // ShipStation
          setShipstationCredsStatus({
            saved: data.shipstation?.hasCredentials || false,
            loading: false,
          });
          if (data.shipstation?.hasCredentials && data.shipstation?.apiKeyPreview) {
            setShipstationCredentials({
              apiKey: data.shipstation.apiKeyPreview,
              apiSecret: "••••••••",
            });
          }

          // Shippo
          setShippoCredsStatus({
            saved: data.shippo?.hasCredentials || false,
            loading: false,
          });
          if (data.shippo?.hasCredentials && data.shippo?.apiTokenPreview) {
            setShippoCredentials({
              apiToken: data.shippo.apiTokenPreview,
            });
          }

          // EasyPost
          setEasypostCredsStatus({
            saved: data.easypost?.hasCredentials || false,
            loading: false,
          });
          if (data.easypost?.hasCredentials && data.easypost?.apiKeyPreview) {
            setEasypostCredentials({
              apiKey: data.easypost.apiKeyPreview,
            });
          }

          // Stamps.com
          setStampsCredsStatus({
            saved: data.stamps?.hasCredentials || false,
            loading: false,
          });
          if (data.stamps?.hasCredentials) {
            setStampsCredentials({
              integrationId: data.stamps.integrationIdPreview || "••••••••",
              username: data.stamps.usernamePreview || "••••••••",
              password: "••••••••",
            });
          }
        } else {
          // Set all to not loading
          setShipstationCredsStatus({ saved: false, loading: false });
          setShippoCredsStatus({ saved: false, loading: false });
          setEasypostCredsStatus({ saved: false, loading: false });
          setStampsCredsStatus({ saved: false, loading: false });
        }
      } catch {
        setShipstationCredsStatus({ saved: false, loading: false });
        setShippoCredsStatus({ saved: false, loading: false });
        setEasypostCredsStatus({ saved: false, loading: false });
        setStampsCredsStatus({ saved: false, loading: false });
      }
    }
    loadShippingProviderCredentials();
  }, []);

  // Handle OAuth callback messages
  useEffect(() => {
    if (!searchParams) return;

    const shopifyResult = searchParams.get("shopify");
    const shopName = searchParams.get("shop");
    const errorMsg = searchParams.get("error");

    if (shopifyResult === "connected") {
      toast.success(`Connected to ${shopName || "Shopify"} successfully!`);
      setShopifyStatus(prev => ({ ...prev, connected: true, shopName: shopName || prev.shopName }));
      setActiveSection("integrations");
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("shopify");
      newUrl.searchParams.delete("shop");
      window.history.replaceState({}, "", newUrl.toString());
    } else if (errorMsg) {
      toast.error(decodeURIComponent(errorMsg));
      setActiveSection("integrations");
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams]);

  // Stripe Connect handlers
  const handleConnectStripe = async () => {
    setIsConnectingStripe(true);
    setConnectError(null);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to connect Stripe");
        return;
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Stripe connection:", error);
      setConnectError("Network error connecting to Stripe");
    } finally {
      setIsConnectingStripe(false);
    }
  };

  const handleResetStripe = async () => {
    setIsResettingStripe(true);
    setConnectError(null);
    try {
      const response = await fetch("/api/stripe/connect/reset", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to reset Stripe");
        return;
      }

      setStripeStatus({
        connected: false,
        onboarded: false,
        loading: false,
        error: null,
      });
      setShowResetConfirm(false);
    } catch (error) {
      console.error("Failed to reset Stripe connection:", error);
      setConnectError("Network error resetting Stripe");
    } finally {
      setIsResettingStripe(false);
    }
  };

  // DivinityCoin bank account handler
  const handleSaveBankAccount = async () => {
    if (!bankAccount.bankName || !bankAccount.accountHolder ||
        !bankAccount.accountNumber || !bankAccount.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }

    if (bankAccount.routingNumber.length !== 9) {
      toast.error("Routing number must be 9 digits");
      return;
    }

    if (bankAccount.accountNumber.length < 4 || bankAccount.accountNumber.length > 17) {
      toast.error("Please enter a valid account number");
      return;
    }

    setIsSavingBank(true);
    try {
      const response = await fetch("/api/creator/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ ...bankAccount, projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save bank account");
      }

      const data = await response.json();
      setBankAccountStatus({
        saved: true,
        loading: false,
        lastFour: data.lastFour,
      });
      setBankAccount(prev => ({
        ...prev,
        accountNumber: "",
        routingNumber: "",
      }));
      toast.success("Bank account saved securely!");
    } catch (error) {
      console.error("Failed to save bank account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save bank account");
    } finally {
      setIsSavingBank(false);
    }
  };

  // Save Chain2Pay bank account
  const handleSaveChain2payBank = async () => {
    if (!chain2payBank.bankName || !chain2payBank.accountHolder ||
        !chain2payBank.accountNumber || !chain2payBank.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }

    if (chain2payBank.routingNumber.length !== 9) {
      toast.error("Routing number must be 9 digits");
      return;
    }

    if (chain2payBank.accountNumber.length < 4 || chain2payBank.accountNumber.length > 17) {
      toast.error("Please enter a valid account number");
      return;
    }

    setIsSavingChain2payBank(true);
    try {
      const response = await fetch("/api/creator/chain2pay-bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ ...chain2payBank, projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save bank account");
      }

      const data = await response.json();
      setChain2payBankStatus({
        saved: true,
        loading: false,
        lastFour: data.lastFour,
      });
      setChain2payBank(prev => ({
        ...prev,
        accountNumber: "",
        routingNumber: "",
      }));
      toast.success("Chain2Pay bank account saved securely!");
    } catch (error) {
      console.error("Failed to save Chain2Pay bank account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save bank account");
    } finally {
      setIsSavingChain2payBank(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("projectId", projectId);

      const res = await fetch("/api/creator/indiekit/settings/image", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload image");
      }

      toast.success("Project image updated");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!projectId) return;

    setIsSavingGeneral(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "general",
          settings: { name, currency: selectedCurrency, timezone: selectedTimezone },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("General settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveSurvey = async () => {
    if (!projectId) return;

    setIsSavingSurvey(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "survey",
          settings: surveySettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Survey settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingSurvey(false);
    }
  };

  const handleSaveShipping = async () => {
    if (!projectId) return;

    setIsSavingShipping(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "shipping",
          settings: shippingSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Shipping settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingShipping(false);
    }
  };

  const handleSavePayments = async () => {
    if (!projectId) return;

    setIsSavingPayments(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "payments",
          settings: paymentSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Payment settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingPayments(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!projectId) return;

    setIsSavingNotifications(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "notifications",
          settings: notificationSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Notification settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleConnectShipStation = async () => {
    if (!projectId || !shipStationKey.trim() || !shipStationSecret.trim()) {
      toast.error("Please enter both API key and secret");
      return;
    }

    setIsConnectingShipStation(true);
    try {
      const res = await fetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          service: "shipstation",
          apiKey: shipStationKey,
          apiSecret: shipStationSecret,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect ShipStation");
      }

      toast.success("Connected to ShipStation");
      setShipStationKey("");
      setShipStationSecret("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect ShipStation");
    } finally {
      setIsConnectingShipStation(false);
    }
  };

  const handleConnectEasyship = async () => {
    if (!projectId || !easyshipToken.trim()) {
      toast.error("Please enter your API token");
      return;
    }

    setIsConnectingEasyship(true);
    try {
      const res = await fetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          service: "easyship",
          apiKey: easyshipToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect Easyship");
      }

      toast.success("Connected to Easyship");
      setEasyshipToken("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Easyship");
    } finally {
      setIsConnectingEasyship(false);
    }
  };

  const handleDisconnectShopify = async () => {
    if (!projectId) return;

    setIsConnectingShopify(true);
    try {
      const res = await fetch("/api/creator/indiekit/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "disconnect",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect Shopify");
      }

      toast.success("Disconnected from Shopify");
      setShopifyStatus({
        connected: false,
        loading: false,
        shopName: null,
      });
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect Shopify");
    } finally {
      setIsConnectingShopify(false);
    }
  };

  const handleSaveShopifyCredentials = async () => {
    const apiKey = shopifyApiCredentials.apiKey.trim();
    const apiSecret = shopifyApiCredentials.apiSecret.trim();

    // Check if values are new (not masked placeholders)
    const isNewApiKey = apiKey && !apiKey.includes("••••");
    const isNewApiSecret = apiSecret && !apiSecret.includes("••••");

    if (!shopifyCredsStatus.saved) {
      // First time saving - both fields required
      if (!apiKey || !apiSecret) {
        toast.error("Please enter both API Key and API Secret");
        return;
      }
      if (!isNewApiKey || !isNewApiSecret) {
        toast.error("Please enter valid API Key and API Secret");
        return;
      }
    } else {
      // Updating - at least one field must have a new value
      if (!isNewApiKey && !isNewApiSecret) {
        toast.info("No changes to save. Click in a field to enter new values.");
        return;
      }
    }

    setIsSavingShopifyCreds(true);
    try {
      const payload: { apiKey?: string; apiSecret?: string } = {};
      if (isNewApiKey) payload.apiKey = apiKey;
      if (isNewApiSecret) payload.apiSecret = apiSecret;

      const res = await fetch("/api/creator/indiekit/shopify/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credentials");
      }

      const data = await res.json();
      setShopifyCredsStatus({ saved: true, loading: false });
      setShopifyApiCredentials({
        apiKey: data.apiKeyPreview || "••••••••",
        apiSecret: "••••••••",
      });
      toast.success("Shopify API credentials saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save credentials");
    } finally {
      setIsSavingShopifyCreds(false);
    }
  };

  const handleClearShopifyCredentials = async () => {
    setIsSavingShopifyCreds(true);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear credentials");
      }

      setShopifyCredsStatus({ saved: false, loading: false });
      setShopifyApiCredentials({ apiKey: "", apiSecret: "" });
      // Also reset shop connection status since credentials are cleared
      setShopifyStatus({ connected: false, loading: false, shopName: null });
      toast.success("Shopify API credentials cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear credentials");
    } finally {
      setIsSavingShopifyCreds(false);
    }
  };

  // Generic handler for saving shipping provider credentials
  const handleSaveShippingProviderCredentials = async (
    provider: "shipstation" | "shippo" | "easypost" | "stamps",
    credentials: Record<string, string>,
    setStatus: (status: { saved: boolean; loading: boolean }) => void,
    setSaving: (saving: boolean) => void,
    providerName: string
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/shipping-providers/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ provider, credentials }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credentials");
      }

      setStatus({ saved: true, loading: false });
      toast.success(`${providerName} API credentials saved!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  // Generic handler for clearing shipping provider credentials
  const handleClearShippingProviderCredentials = async (
    provider: "shipstation" | "shippo" | "easypost" | "stamps",
    setCredentials: (creds: Record<string, string>) => void,
    emptyCredentials: Record<string, string>,
    setStatus: (status: { saved: boolean; loading: boolean }) => void,
    setSaving: (saving: boolean) => void,
    providerName: string
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/shipping-providers/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear credentials");
      }

      setStatus({ saved: false, loading: false });
      setCredentials(emptyCredentials);
      toast.success(`${providerName} API credentials cleared`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear credentials");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Project Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure your project settings and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Settings Navigation */}
        <Card>
          <CardContent className="p-2">
            <nav className="space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveSection(item.id as SettingsSection)}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${isActive ? "text-teal-600" : ""}`} />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {activeSection === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic project configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Project Image</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage}>
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Change Image"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Los_Angeles">(UTC-08:00) Pacific Time</SelectItem>
                      <SelectItem value="America/Denver">(UTC-07:00) Mountain Time</SelectItem>
                      <SelectItem value="America/Chicago">(UTC-06:00) Central Time</SelectItem>
                      <SelectItem value="America/New_York">(UTC-05:00) Eastern Time</SelectItem>
                      <SelectItem value="Europe/London">(UTC+00:00) London</SelectItem>
                      <SelectItem value="Europe/Paris">(UTC+01:00) Paris</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveGeneral} disabled={isSavingGeneral}>
                  {isSavingGeneral ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "survey" && (
            <Card>
              <CardHeader>
                <CardTitle>Survey Settings</CardTitle>
                <CardDescription>Configure backer survey options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Allow Address Changes</p>
                    <p className="text-sm text-muted-foreground">Backers can update shipping address after submitting</p>
                  </div>
                  <Switch
                    checked={surveySettings.allowAddressChanges}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, allowAddressChanges: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Send Confirmation Email</p>
                    <p className="text-sm text-muted-foreground">Email backers when their survey is completed</p>
                  </div>
                  <Switch
                    checked={surveySettings.sendConfirmationEmail}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, sendConfirmationEmail: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Lock After Fulfillment</p>
                    <p className="text-sm text-muted-foreground">Prevent survey changes once order ships</p>
                  </div>
                  <Switch
                    checked={surveySettings.lockAfterFulfillment}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, lockAfterFulfillment: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Send Reminder Emails</p>
                    <p className="text-sm text-muted-foreground">Automatically remind backers to complete survey</p>
                  </div>
                  <Switch
                    checked={surveySettings.sendReminders}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, sendReminders: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveSurvey} disabled={isSavingSurvey}>
                  {isSavingSurvey ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "shipping" && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Settings</CardTitle>
                <CardDescription>Configure shipping regions and rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Domestic Shipping</p>
                    <p className="text-sm text-muted-foreground">Enable shipping within your country</p>
                  </div>
                  <Switch
                    checked={shippingSettings.domesticShipping}
                    onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, domesticShipping: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">International Shipping</p>
                    <p className="text-sm text-muted-foreground">Enable shipping to other countries</p>
                  </div>
                  <Switch
                    checked={shippingSettings.internationalShipping}
                    onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, internationalShipping: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Address Validation</p>
                    <p className="text-sm text-muted-foreground">Validate addresses using USPS/postal services</p>
                  </div>
                  <Switch
                    checked={shippingSettings.addressValidation}
                    onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, addressValidation: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveShipping} disabled={isSavingShipping}>
                  {isSavingShipping ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "payments" && (
            <div className="space-y-6">
              {/* Stripe Connect Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Connect Your Stripe Account</CardTitle>
                  <CardDescription>Connect or create a Stripe account to receive payouts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Show errors if any */}
                  {(stripeStatus.error || connectError) && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Stripe Connection Issue</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <span>{stripeStatus.error || connectError}</span>
                        {connectError?.includes("already connected") && (
                          <div className="flex flex-col gap-2">
                            <span>
                              If you previously connected a Stripe account but never completed onboarding,
                              you can reset your connection and try again.
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowResetConfirm(true)}
                              disabled={isResettingStripe}
                              className="w-fit"
                            >
                              {isResettingStripe ? (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                  Resetting...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Reset Stripe Connection
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className={`p-4 border rounded-lg ${stripeStatus.onboarded ? "border-green-500" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                          stripeStatus.onboarded ? "bg-green-500" : "bg-[#635BFF]"
                        }`}>
                          {stripeStatus.onboarded ? (
                            <CheckCircle className="h-6 w-6 text-white" />
                          ) : (
                            <CreditCard className="h-6 w-6 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {stripeStatus.onboarded ? "Stripe Connected" : "Stripe Connect"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {stripeStatus.loading ? (
                              "Checking connection status..."
                            ) : stripeStatus.onboarded ? (
                              "Your Stripe account is connected and ready to receive payments."
                            ) : stripeStatus.connected ? (
                              "Your Stripe account is connected but onboarding is incomplete. Click to continue setup."
                            ) : (
                              "Connect or create a Stripe account to receive payouts. You'll complete identity verification through Stripe's secure process."
                            )}
                          </p>
                        </div>
                      </div>
                      {stripeStatus.onboarded ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowResetConfirm(true)}
                            disabled={isResettingStripe}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {isResettingStripe ? "Disconnecting..." : "Disconnect"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={handleConnectStripe}
                          disabled={isConnectingStripe || stripeStatus.loading}
                          className="bg-[#635BFF] hover:bg-[#5851ea]"
                        >
                          {stripeStatus.loading ? "Checking..." : isConnectingStripe ? "Connecting..." : stripeStatus.connected ? "Complete Setup" : "Connect Stripe"}
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {!stripeStatus.onboarded && (
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t have a Stripe account?{" "}
                      <a
                        href="https://stripe.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Sign up for free
                      </a>
                      {" "}&bull; It only takes a few minutes to get started
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* DivinityCoin Bank Account Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    DivinityCoin Settlement Account
                  </CardTitle>
                  <CardDescription>
                    Enter your bank account details for DivinityCoin settlements. All data is encrypted and stored securely.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bankAccountStatus.loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : bankAccountStatus.saved ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg border-green-500">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                            <CheckCircle className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">Bank Account Connected</p>
                            <p className="text-sm text-muted-foreground">
                              {bankAccount.bankName} • Account ending in {bankAccountStatus.lastFour}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-500">
                          <Lock className="h-3 w-3 mr-1" />
                          Secured
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBankAccountStatus(prev => ({ ...prev, saved: false }))}
                      >
                        Update Bank Account
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                        <Lock className="h-4 w-4" />
                        <AlertTitle>Secure & Encrypted</AlertTitle>
                        <AlertDescription>
                          Your bank account information is encrypted using AES-256 encryption before storage.
                          We never store unencrypted account numbers.
                        </AlertDescription>
                      </Alert>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="bank-name">Bank Name</Label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="bank-name"
                              placeholder="e.g., Chase Bank, Bank of America"
                              value={bankAccount.bankName}
                              onChange={(e) => setBankAccount(prev => ({ ...prev, bankName: e.target.value }))}
                              className="pl-10"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="account-holder">Account Holder Name</Label>
                          <Input
                            id="account-holder"
                            placeholder="Name as it appears on account"
                            value={bankAccount.accountHolder}
                            onChange={(e) => setBankAccount(prev => ({ ...prev, accountHolder: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="routing-number">Routing Number</Label>
                          <Input
                            id="routing-number"
                            type="text"
                            inputMode="numeric"
                            maxLength={9}
                            placeholder="9-digit routing number"
                            value={bankAccount.routingNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                              setBankAccount(prev => ({ ...prev, routingNumber: value }));
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            9 digits, found on the bottom left of your checks
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="account-number">Account Number</Label>
                          <Input
                            id="account-number"
                            type="password"
                            inputMode="numeric"
                            maxLength={17}
                            placeholder="Your account number"
                            value={bankAccount.accountNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                              setBankAccount(prev => ({ ...prev, accountNumber: value }));
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Account Type</Label>
                        <Select
                          value={bankAccount.accountType}
                          onValueChange={(value: "checking" | "savings") =>
                            setBankAccount(prev => ({ ...prev, accountType: value }))
                          }
                        >
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={handleSaveBankAccount}
                          disabled={isSavingBank}
                          className="bg-[#0066FF] hover:bg-[#0052CC]"
                        >
                          {isSavingBank ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Encrypting & Saving...
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Save Bank Account
                            </>
                          )}
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        DivinityCoin settlements are processed within 14 business days after your campaign ends.{" "}
                        <a
                          href="https://divinitycoin.com/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Learn more about DivinityCoin
                        </a>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chain2Pay Bank Account Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Chain2Pay Settlement Account
                  </CardTitle>
                  <CardDescription>
                    Enter your bank account details for Chain2Pay settlements. All data is encrypted and stored securely.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chain2payBankStatus.loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : chain2payBankStatus.saved ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg border-green-500">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                            <CheckCircle className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">Bank Account Connected</p>
                            <p className="text-sm text-muted-foreground">
                              {chain2payBank.bankName} • Account ending in {chain2payBankStatus.lastFour}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-500">
                          <Lock className="h-3 w-3 mr-1" />
                          Secured
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChain2payBankStatus(prev => ({ ...prev, saved: false }))}
                      >
                        Update Bank Account
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                        <Lock className="h-4 w-4" />
                        <AlertTitle>Secure & Encrypted</AlertTitle>
                        <AlertDescription>
                          Your bank account information is encrypted using AES-256 encryption before storage.
                          We never store unencrypted account numbers.
                        </AlertDescription>
                      </Alert>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="c2p-bank-name">Bank Name</Label>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="c2p-bank-name"
                              placeholder="e.g., Chase Bank, Bank of America"
                              value={chain2payBank.bankName}
                              onChange={(e) => setChain2payBank(prev => ({ ...prev, bankName: e.target.value }))}
                              className="pl-10"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="c2p-account-holder">Account Holder Name</Label>
                          <Input
                            id="c2p-account-holder"
                            placeholder="Name as it appears on account"
                            value={chain2payBank.accountHolder}
                            onChange={(e) => setChain2payBank(prev => ({ ...prev, accountHolder: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="c2p-routing-number">Routing Number</Label>
                          <Input
                            id="c2p-routing-number"
                            type="text"
                            inputMode="numeric"
                            maxLength={9}
                            placeholder="9-digit routing number"
                            value={chain2payBank.routingNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                              setChain2payBank(prev => ({ ...prev, routingNumber: value }));
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            9 digits, found on the bottom left of your checks
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="c2p-account-number">Account Number</Label>
                          <Input
                            id="c2p-account-number"
                            type="password"
                            inputMode="numeric"
                            maxLength={17}
                            placeholder="Your account number"
                            value={chain2payBank.accountNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                              setChain2payBank(prev => ({ ...prev, accountNumber: value }));
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Account Type</Label>
                        <Select
                          value={chain2payBank.accountType}
                          onValueChange={(value: "checking" | "savings") =>
                            setChain2payBank(prev => ({ ...prev, accountType: value }))
                          }
                        >
                          <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="checking">Checking</SelectItem>
                            <SelectItem value="savings">Savings</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={handleSaveChain2payBank}
                          disabled={isSavingChain2payBank}
                          className="bg-[#3B82F6] hover:bg-[#2563EB]"
                        >
                          {isSavingChain2payBank ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Encrypting & Saving...
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Save Bank Account
                            </>
                          )}
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Chain2Pay settlements are processed within 14 business days after your campaign ends.{" "}
                        <a
                          href="https://chain2pay.cloud/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Learn more about Chain2Pay
                        </a>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Payment Collection Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Collection Settings</CardTitle>
                  <CardDescription>Configure payment collection options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Auto-Retry Failed Payments</p>
                      <p className="text-sm text-muted-foreground">Automatically retry failed charges after 3 days</p>
                    </div>
                    <Switch
                      checked={paymentSettings.autoRetry}
                      onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, autoRetry: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Send Payment Receipts</p>
                      <p className="text-sm text-muted-foreground">Email receipts for successful charges</p>
                    </div>
                    <Switch
                      checked={paymentSettings.sendReceipts}
                      onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, sendReceipts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Failed Payment Notifications</p>
                      <p className="text-sm text-muted-foreground">Notify backers when their payment fails</p>
                    </div>
                    <Switch
                      checked={paymentSettings.failedNotifications}
                      onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, failedNotifications: checked })}
                    />
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSavePayments} disabled={isSavingPayments}>
                    {isSavingPayments ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure email notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Survey Completions</p>
                    <p className="text-sm text-muted-foreground">Get notified when backers complete surveys</p>
                  </div>
                  <Switch
                    checked={notificationSettings.surveyCompletions}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, surveyCompletions: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Failed Payments</p>
                    <p className="text-sm text-muted-foreground">Get notified about failed payment attempts</p>
                  </div>
                  <Switch
                    checked={notificationSettings.failedPayments}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, failedPayments: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">New Pre-orders</p>
                    <p className="text-sm text-muted-foreground">Get notified when new pre-orders are placed</p>
                  </div>
                  <Switch
                    checked={notificationSettings.newPreorders}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newPreorders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Daily Summary</p>
                    <p className="text-sm text-muted-foreground">Receive a daily activity summary email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.dailySummary}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, dailySummary: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveNotifications} disabled={isSavingNotifications}>
                  {isSavingNotifications ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "integrations" && (
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect third-party services for fulfillment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stripe - Already connected through platform */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Stripe</p>
                      <p className="text-sm text-muted-foreground">Payment processing</p>
                    </div>
                  </div>
                  <Button variant="outline" className="text-green-600 border-green-600">Connected</Button>
                </div>

                {/* Shopify */}
                <div className={`flex items-center justify-between p-4 border rounded-lg ${shopifyStatus.connected ? "border-green-500" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded flex items-center justify-center ${shopifyStatus.connected ? "bg-green-100" : "bg-[#95BF47]/20"}`}>
                      <Store className={`h-5 w-5 ${shopifyStatus.connected ? "text-green-600" : "text-[#95BF47]"}`} />
                    </div>
                    <div>
                      <p className="font-medium">Shopify</p>
                      <p className="text-sm text-muted-foreground">
                        {shopifyStatus.loading
                          ? "Checking connection..."
                          : shopifyStatus.connected
                          ? `Connected to ${shopifyStatus.shopName || "your store"}`
                          : "E-commerce fulfillment integration"}
                      </p>
                    </div>
                  </div>
                  {shopifyStatus.loading ? (
                    <Button variant="outline" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button>
                  ) : shopifyStatus.connected ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Connected
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDisconnectShopify}
                        disabled={isConnectingShopify}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        {isConnectingShopify ? "..." : "Disconnect"}
                      </Button>
                    </div>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline">Connect</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Connect Shopify</AlertDialogTitle>
                          <AlertDialogDescription>
                            Connect your Shopify store to push orders for fulfillment and sync tracking information.
                            You&apos;ll be redirected to Shopify to authorize the connection.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="shopify-domain">Shop Domain</Label>
                            <Input
                              id="shopify-domain"
                              placeholder="your-store or your-store.myshopify.com"
                              value={shopifyDomain}
                              onChange={(e) => setShopifyDomain(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Enter your Shopify store name or full domain
                            </p>
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (!shopifyDomain.trim()) {
                                toast.error("Please enter your shop domain");
                                return;
                              }
                              // Redirect to OAuth authorization
                              window.location.href = `/api/creator/indiekit/shopify/oauth/authorize?shop=${encodeURIComponent(shopifyDomain.trim())}`;
                            }}
                            disabled={!shopifyDomain.trim()}
                          >
                            <Store className="h-4 w-4 mr-2" />
                            Connect with Shopify
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {/* ShipStation */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">ShipStation</p>
                      <p className="text-sm text-muted-foreground">Shipping label generation & tracking</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">Connect</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Connect ShipStation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Connect your ShipStation account to automatically sync orders and generate shipping labels.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="shipstation-key">API Key</Label>
                          <Input
                            id="shipstation-key"
                            placeholder="Enter your ShipStation API key"
                            value={shipStationKey}
                            onChange={(e) => setShipStationKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shipstation-secret">API Secret</Label>
                          <Input
                            id="shipstation-secret"
                            type="password"
                            placeholder="Enter your API secret"
                            value={shipStationSecret}
                            onChange={(e) => setShipStationSecret(e.target.value)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Find your API credentials in ShipStation under Settings → API Settings
                        </p>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConnectShipStation} disabled={isConnectingShipStation}>
                          {isConnectingShipStation ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Zapier */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-orange-100 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Zapier</p>
                      <p className="text-sm text-muted-foreground">Workflow automation</p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <a href="https://zapier.com" target="_blank" rel="noopener noreferrer">
                      Connect <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>

                {/* Easyship */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Easyship</p>
                      <p className="text-sm text-muted-foreground">Global shipping rates & labels</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">Connect</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Connect Easyship</AlertDialogTitle>
                        <AlertDialogDescription>
                          Connect your Easyship account for international shipping rates and labels.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="easyship-token">API Token</Label>
                          <Input
                            id="easyship-token"
                            placeholder="Enter your Easyship API token"
                            value={easyshipToken}
                            onChange={(e) => setEasyshipToken(e.target.value)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Find your API token in Easyship under Settings → API
                        </p>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConnectEasyship} disabled={isConnectingEasyship}>
                          {isConnectingEasyship ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "shopify" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-[#95BF47]" />
                  Shopify API Credentials
                </CardTitle>
                <CardDescription>
                  Enter your Shopify app API credentials to enable OAuth connection for your store.
                  These credentials are saved to your account and work across all your projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {shopifyCredsStatus.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <Store className="h-4 w-4" />
                      <AlertTitle>Setup Instructions</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>To connect Shopify, create a custom app in the Shopify Partners dashboard:</p>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                          <li>Go to <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">partners.shopify.com</a> → Apps → Create app</li>
                          <li>Under <strong>Access</strong> → <strong>Scopes</strong>, enter:
                            <code className="block bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded text-xs mt-1 break-all">write_draft_orders,read_fulfillments,write_fulfillments,read_orders,write_orders,read_products</code>
                          </li>
                          <li>Set <strong>Redirect URL</strong> to:
                            <code className="block bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded text-xs mt-1 break-all">{typeof window !== "undefined" ? window.location.origin : ""}/api/creator/indiekit/shopify/oauth/callback</code>
                          </li>
                          <li>Under <strong>URLs</strong> section:
                            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                              <li>Set <strong>App URL</strong> to: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/dashboard/indiekit/shopify/app</code></li>
                              <li><strong>Uncheck</strong> &quot;Embed app in Shopify admin&quot;</li>
                            </ul>
                          </li>
                          <li>Set <strong>Webhooks API Version</strong> to: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">2024-10</code></li>
                          <li>Click <strong>Release</strong> to create a new version, then <strong>Install app</strong> on your store</li>
                          <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> from the app overview below</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    {shopifyCredsStatus.saved && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">API credentials saved. You can now connect your Shopify store in the Integrations section.</span>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="shopify-api-key">API Key (Client ID)</Label>
                        <Input
                          id="shopify-api-key"
                          name="shopify-api-key"
                          type="text"
                          placeholder="Your Shopify API key..."
                          value={shopifyApiCredentials.apiKey}
                          onChange={(e) => setShopifyApiCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                          onFocus={() => {
                            // Clear masked value when user focuses to enter new value
                            if (shopifyApiCredentials.apiKey.includes("••••")) {
                              setShopifyApiCredentials(prev => ({ ...prev, apiKey: "" }));
                            }
                          }}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-form-type="other"
                          data-1p-ignore="true"
                          data-lpignore="true"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shopify-api-secret">API Secret (Client Secret)</Label>
                        <Input
                          id="shopify-api-secret"
                          name="shopify-api-secret"
                          type="text"
                          placeholder="Your Shopify API secret..."
                          value={shopifyApiCredentials.apiSecret}
                          onChange={(e) => setShopifyApiCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                          onFocus={() => {
                            // Clear masked value when user focuses to enter new value
                            if (shopifyApiCredentials.apiSecret.includes("••••")) {
                              setShopifyApiCredentials(prev => ({ ...prev, apiSecret: "" }));
                            }
                          }}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-form-type="other"
                          data-1p-ignore="true"
                          data-lpignore="true"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={handleSaveShopifyCredentials}
                        disabled={isSavingShopifyCreds}
                        className="bg-[#95BF47] hover:bg-[#7a9e3a]"
                      >
                        {isSavingShopifyCreds ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            {shopifyCredsStatus.saved ? "Update Credentials" : "Save Credentials"}
                          </>
                        )}
                      </Button>

                      {shopifyCredsStatus.saved && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearShopifyCredentials}
                          disabled={isSavingShopifyCreds}
                          className="text-destructive hover:text-destructive"
                        >
                          Clear Credentials
                        </Button>
                      )}
                    </div>

                    <Separator />

                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="font-medium">Required Shopify Scopes:</p>
                      <p>Your app needs these permissions: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">read_products, write_draft_orders, read_orders, write_orders, read_fulfillments, write_fulfillments</code></p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "shipstation" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  ShipStation API Credentials
                </CardTitle>
                <CardDescription>
                  Enter your ShipStation API credentials to enable shipping label generation and order syncing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {shipstationCredsStatus.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <Truck className="h-4 w-4" />
                      <AlertTitle>Get Your API Credentials</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>To connect ShipStation, you need your API Key and Secret:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Log into <a href="https://ship.shipstation.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">ShipStation</a></li>
                          <li>Go to Settings → Account → API Settings</li>
                          <li>Generate a new API Key if you don&apos;t have one</li>
                          <li>Copy both the API Key and API Secret below</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    {shipstationCredsStatus.saved && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">API credentials saved. ShipStation integration is ready.</span>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="shipstation-api-key">API Key</Label>
                        <Input
                          id="shipstation-api-key"
                          type="text"
                          placeholder="Your ShipStation API key..."
                          value={shipstationCredentials.apiKey}
                          onChange={(e) => setShipstationCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                          onFocus={() => {
                            if (shipstationCredentials.apiKey.includes("••••")) {
                              setShipstationCredentials(prev => ({ ...prev, apiKey: "" }));
                            }
                          }}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shipstation-api-secret">API Secret</Label>
                        <Input
                          id="shipstation-api-secret"
                          type="password"
                          placeholder="Your ShipStation API secret..."
                          value={shipstationCredentials.apiSecret}
                          onChange={(e) => setShipstationCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                          onFocus={() => {
                            if (shipstationCredentials.apiSecret.includes("••••")) {
                              setShipstationCredentials(prev => ({ ...prev, apiSecret: "" }));
                            }
                          }}
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          const apiKey = shipstationCredentials.apiKey.trim();
                          const apiSecret = shipstationCredentials.apiSecret.trim();
                          if (!apiKey || apiKey.includes("••••") || !apiSecret || apiSecret.includes("••••")) {
                            toast.error("Please enter valid API Key and Secret");
                            return;
                          }
                          handleSaveShippingProviderCredentials(
                            "shipstation",
                            { apiKey, apiSecret },
                            setShipstationCredsStatus,
                            setIsSavingShipstationCreds,
                            "ShipStation"
                          );
                        }}
                        disabled={isSavingShipstationCreds}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSavingShipstationCreds ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            {shipstationCredsStatus.saved ? "Update Credentials" : "Save Credentials"}
                          </>
                        )}
                      </Button>

                      {shipstationCredsStatus.saved && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleClearShippingProviderCredentials(
                            "shipstation",
                            (creds) => setShipstationCredentials(creds as { apiKey: string; apiSecret: string }),
                            { apiKey: "", apiSecret: "" },
                            setShipstationCredsStatus,
                            setIsSavingShipstationCreds,
                            "ShipStation"
                          )}
                          disabled={isSavingShipstationCreds}
                          className="text-destructive hover:text-destructive"
                        >
                          Clear Credentials
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "shippo" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-600" />
                  Shippo API Credentials
                </CardTitle>
                <CardDescription>
                  Enter your Shippo API token to enable shipping rate comparison and label generation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {shippoCredsStatus.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Alert className="bg-purple-50/50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                      <Truck className="h-4 w-4" />
                      <AlertTitle>Get Your API Token</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>To connect Shippo, you need your API Token:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Log into <a href="https://apps.goshippo.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Shippo</a></li>
                          <li>Go to Settings → API</li>
                          <li>Copy your Live API Token (starts with &quot;shippo_live_&quot;)</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    {shippoCredsStatus.saved && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">API token saved. Shippo integration is ready.</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="shippo-api-token">API Token</Label>
                      <Input
                        id="shippo-api-token"
                        type="password"
                        placeholder="shippo_live_..."
                        value={shippoCredentials.apiToken}
                        onChange={(e) => setShippoCredentials({ apiToken: e.target.value })}
                        onFocus={() => {
                          if (shippoCredentials.apiToken.includes("••••")) {
                            setShippoCredentials({ apiToken: "" });
                          }
                        }}
                        autoComplete="off"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          const apiToken = shippoCredentials.apiToken.trim();
                          if (!apiToken || apiToken.includes("••••")) {
                            toast.error("Please enter a valid API Token");
                            return;
                          }
                          handleSaveShippingProviderCredentials(
                            "shippo",
                            { apiToken },
                            setShippoCredsStatus,
                            setIsSavingShippoCreds,
                            "Shippo"
                          );
                        }}
                        disabled={isSavingShippoCreds}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isSavingShippoCreds ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            {shippoCredsStatus.saved ? "Update Token" : "Save Token"}
                          </>
                        )}
                      </Button>

                      {shippoCredsStatus.saved && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleClearShippingProviderCredentials(
                            "shippo",
                            (creds) => setShippoCredentials(creds as { apiToken: string }),
                            { apiToken: "" },
                            setShippoCredsStatus,
                            setIsSavingShippoCreds,
                            "Shippo"
                          )}
                          disabled={isSavingShippoCreds}
                          className="text-destructive hover:text-destructive"
                        >
                          Clear Token
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "easypost" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-orange-600" />
                  EasyPost API Credentials
                </CardTitle>
                <CardDescription>
                  Enter your EasyPost API key to enable multi-carrier shipping with a single integration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {easypostCredsStatus.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Alert className="bg-orange-50/50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                      <Truck className="h-4 w-4" />
                      <AlertTitle>Get Your API Key</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>To connect EasyPost, you need your API Key:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Log into <a href="https://www.easypost.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">EasyPost</a></li>
                          <li>Go to Account Settings → API Keys</li>
                          <li>Copy your Production API Key (starts with &quot;EZAK&quot;)</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    {easypostCredsStatus.saved && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">API key saved. EasyPost integration is ready.</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="easypost-api-key">API Key</Label>
                      <Input
                        id="easypost-api-key"
                        type="password"
                        placeholder="EZAK..."
                        value={easypostCredentials.apiKey}
                        onChange={(e) => setEasypostCredentials({ apiKey: e.target.value })}
                        onFocus={() => {
                          if (easypostCredentials.apiKey.includes("••••")) {
                            setEasypostCredentials({ apiKey: "" });
                          }
                        }}
                        autoComplete="off"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          const apiKey = easypostCredentials.apiKey.trim();
                          if (!apiKey || apiKey.includes("••••")) {
                            toast.error("Please enter a valid API Key");
                            return;
                          }
                          handleSaveShippingProviderCredentials(
                            "easypost",
                            { apiKey },
                            setEasypostCredsStatus,
                            setIsSavingEasypostCreds,
                            "EasyPost"
                          );
                        }}
                        disabled={isSavingEasypostCreds}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {isSavingEasypostCreds ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            {easypostCredsStatus.saved ? "Update Key" : "Save Key"}
                          </>
                        )}
                      </Button>

                      {easypostCredsStatus.saved && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleClearShippingProviderCredentials(
                            "easypost",
                            (creds) => setEasypostCredentials(creds as { apiKey: string }),
                            { apiKey: "" },
                            setEasypostCredsStatus,
                            setIsSavingEasypostCreds,
                            "EasyPost"
                          )}
                          disabled={isSavingEasypostCreds}
                          className="text-destructive hover:text-destructive"
                        >
                          Clear Key
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "stamps" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-red-600" />
                  Stamps.com API Credentials
                </CardTitle>
                <CardDescription>
                  Enter your Stamps.com integration credentials to enable USPS shipping directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {stampsCredsStatus.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Alert className="bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                      <Truck className="h-4 w-4" />
                      <AlertTitle>Get Your API Credentials</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>To connect Stamps.com, you need your Integration credentials:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Apply for a Stamps.com Developer account at <a href="https://developer.stamps.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.stamps.com</a></li>
                          <li>Create an application and get approved</li>
                          <li>Use your Integration ID, username, and password</li>
                        </ol>
                        <p className="text-xs text-muted-foreground mt-2">Note: Stamps.com requires developer approval before you can access their API.</p>
                      </AlertDescription>
                    </Alert>

                    {stampsCredsStatus.saved && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Credentials saved. Stamps.com integration is ready.</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="stamps-integration-id">Integration ID</Label>
                        <Input
                          id="stamps-integration-id"
                          type="text"
                          placeholder="Your Integration ID..."
                          value={stampsCredentials.integrationId}
                          onChange={(e) => setStampsCredentials(prev => ({ ...prev, integrationId: e.target.value }))}
                          onFocus={() => {
                            if (stampsCredentials.integrationId.includes("••••")) {
                              setStampsCredentials(prev => ({ ...prev, integrationId: "" }));
                            }
                          }}
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="stamps-username">Username</Label>
                          <Input
                            id="stamps-username"
                            type="text"
                            placeholder="Your Stamps.com username..."
                            value={stampsCredentials.username}
                            onChange={(e) => setStampsCredentials(prev => ({ ...prev, username: e.target.value }))}
                            onFocus={() => {
                              if (stampsCredentials.username.includes("••••")) {
                                setStampsCredentials(prev => ({ ...prev, username: "" }));
                              }
                            }}
                            autoComplete="off"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stamps-password">Password</Label>
                          <Input
                            id="stamps-password"
                            type="password"
                            placeholder="Your Stamps.com password..."
                            value={stampsCredentials.password}
                            onChange={(e) => setStampsCredentials(prev => ({ ...prev, password: e.target.value }))}
                            onFocus={() => {
                              if (stampsCredentials.password.includes("••••")) {
                                setStampsCredentials(prev => ({ ...prev, password: "" }));
                              }
                            }}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => {
                          const integrationId = stampsCredentials.integrationId.trim();
                          const username = stampsCredentials.username.trim();
                          const password = stampsCredentials.password.trim();
                          if (!integrationId || integrationId.includes("••••") ||
                              !username || username.includes("••••") ||
                              !password || password.includes("••••")) {
                            toast.error("Please enter all credentials");
                            return;
                          }
                          handleSaveShippingProviderCredentials(
                            "stamps",
                            { integrationId, username, password },
                            setStampsCredsStatus,
                            setIsSavingStampsCreds,
                            "Stamps.com"
                          );
                        }}
                        disabled={isSavingStampsCreds}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isSavingStampsCreds ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            {stampsCredsStatus.saved ? "Update Credentials" : "Save Credentials"}
                          </>
                        )}
                      </Button>

                      {stampsCredsStatus.saved && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleClearShippingProviderCredentials(
                            "stamps",
                            (creds) => setStampsCredentials(creds as { integrationId: string; username: string; password: string }),
                            { integrationId: "", username: "", password: "" },
                            setStampsCredsStatus,
                            setIsSavingStampsCreds,
                            "Stamps.com"
                          )}
                          disabled={isSavingStampsCreds}
                          className="text-destructive hover:text-destructive"
                        >
                          Clear Credentials
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "team" && (
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage who has access to IndieKit for this project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/30">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="mb-4">No team members added yet</p>
                  <p className="text-sm mb-4">Team members added here get access to IndieKit for this project only. This is separate from project collaborators.</p>
                  <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Invite Team Member
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Disconnect Stripe Account?"
        description="Are you sure you want to disconnect your Stripe account? You will need to reconnect it to accept payments."
        confirmText="Disconnect"
        variant="destructive"
        onConfirm={handleResetStripe}
        loading={isResettingStripe}
      />
    </div>
  );
}
