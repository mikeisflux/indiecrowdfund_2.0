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
  Link2,
  Package,
  Trash2,
  Save,
  Key,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type SettingsSection = "general" | "survey" | "shipping" | "payments" | "notifications" | "integrations" | "shopify" | "team";

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

  // SKU Mapping state
  interface SkuMapping {
    id: string;
    sourceType: string;
    sourceId: string;
    sourceName: string;
    shopifySku: string;
    shopifyProductName?: string;
    quantity: number;
  }
  interface UnmappedItem {
    sourceType: string;
    sourceId: string;
    sourceName: string;
    amount?: number;
    quantityClaimed?: number;
  }
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<UnmappedItem[]>([]);
  const [isLoadingSkuMappings, setIsLoadingSkuMappings] = useState(false);
  const [isSavingSkuMapping, setIsSavingSkuMapping] = useState<string | null>(null);
  const [skuInputs, setSkuInputs] = useState<Record<string, string>>({});

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

  // Load Shopify API credentials on mount
  useEffect(() => {
    async function loadShopifyCredentials() {
      if (!projectId) {
        setShopifyCredsStatus({ saved: false, loading: false });
        return;
      }
      try {
        const response = await fetch(`/api/creator/indiekit/shopify/credentials?projectId=${projectId}`);
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
        } else {
          setShopifyCredsStatus({ saved: false, loading: false });
        }
      } catch {
        setShopifyCredsStatus({ saved: false, loading: false });
      }
    }
    loadShopifyCredentials();
  }, [projectId]);

  // Fetch SKU mappings when Shopify is connected
  useEffect(() => {
    async function fetchSkuMappings() {
      if (!projectId || !shopifyStatus.connected) {
        setSkuMappings([]);
        setUnmappedItems([]);
        return;
      }

      setIsLoadingSkuMappings(true);
      try {
        const response = await fetch(`/api/creator/indiekit/shopify/sku-mapping?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setSkuMappings(data.mappings || []);
          setUnmappedItems(data.unmappedItems || []);
        }
      } catch (error) {
        console.error("Failed to fetch SKU mappings:", error);
      } finally {
        setIsLoadingSkuMappings(false);
      }
    }
    fetchSkuMappings();
  }, [projectId, shopifyStatus.connected]);

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
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

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
      const payload: { projectId: string; apiKey?: string; apiSecret?: string } = { projectId };
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
    if (!projectId) return;

    setIsSavingShopifyCreds(true);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear credentials");
      }

      setShopifyCredsStatus({ saved: false, loading: false });
      setShopifyApiCredentials({ apiKey: "", apiSecret: "" });
      toast.success("Shopify API credentials cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear credentials");
    } finally {
      setIsSavingShopifyCreds(false);
    }
  };

  const handleSaveSkuMapping = async (item: UnmappedItem) => {
    const sku = skuInputs[`${item.sourceType}-${item.sourceId}`];
    if (!sku?.trim()) {
      toast.error("Please enter a Shopify SKU");
      return;
    }

    setIsSavingSkuMapping(`${item.sourceType}-${item.sourceId}`);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "save",
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          sourceName: item.sourceName,
          shopifySku: sku.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save mapping");
      }

      const data = await res.json();
      setSkuMappings(prev => [...prev, data.mapping]);
      setUnmappedItems(prev => prev.filter(i =>
        !(i.sourceType === item.sourceType && i.sourceId === item.sourceId)
      ));
      setSkuInputs(prev => {
        const next = { ...prev };
        delete next[`${item.sourceType}-${item.sourceId}`];
        return next;
      });
      toast.success(`Mapped "${item.sourceName}" to SKU: ${sku.trim()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mapping");
    } finally {
      setIsSavingSkuMapping(null);
    }
  };

  const handleDeleteSkuMapping = async (mapping: SkuMapping) => {
    setIsSavingSkuMapping(mapping.id);
    try {
      const res = await fetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "delete",
          mappingId: mapping.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete mapping");
      }

      setSkuMappings(prev => prev.filter(m => m.id !== mapping.id));
      setUnmappedItems(prev => [...prev, {
        sourceType: mapping.sourceType,
        sourceId: mapping.sourceId,
        sourceName: mapping.sourceName,
      }]);
      toast.success(`Removed mapping for "${mapping.sourceName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete mapping");
    } finally {
      setIsSavingSkuMapping(null);
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
                              window.location.href = `/api/creator/indiekit/shopify/oauth/authorize?projectId=${projectId}&shop=${encodeURIComponent(shopifyDomain.trim())}`;
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

                {/* SKU Mapping - Only shows when Shopify is connected */}
                {shopifyStatus.connected && (
                  <Card className="border-[#95BF47]/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-5 w-5 text-[#95BF47]" />
                          <CardTitle className="text-base">Shopify SKU Mapping</CardTitle>
                        </div>
                        {isLoadingSkuMappings && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <CardDescription>
                        Map your rewards, add-ons, and items to Shopify SKUs for fulfillment
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isLoadingSkuMappings ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          {/* Existing Mappings */}
                          {skuMappings.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">Mapped Items</p>
                              <div className="space-y-2">
                                {skuMappings.map((mapping) => (
                                  <div
                                    key={mapping.id}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Package className="h-4 w-4 text-green-600" />
                                      <div>
                                        <p className="text-sm font-medium">{mapping.sourceName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          <Badge variant="outline" className="text-xs mr-2">
                                            {mapping.sourceType === "ADDON" ? "Add-on" :
                                             mapping.sourceType === "REWARD" ? "Reward" : "Item"}
                                          </Badge>
                                          SKU: <span className="font-mono">{mapping.shopifySku}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteSkuMapping(mapping)}
                                      disabled={isSavingSkuMapping === mapping.id}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      {isSavingSkuMapping === mapping.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unmapped Items */}
                          {unmappedItems.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">
                                Unmapped Items ({unmappedItems.length})
                              </p>
                              <div className="space-y-2">
                                {unmappedItems.map((item) => {
                                  const key = `${item.sourceType}-${item.sourceId}`;
                                  return (
                                    <div
                                      key={key}
                                      className="flex items-center gap-3 p-3 border rounded-lg"
                                    >
                                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.sourceName}</p>
                                        <p className="text-xs text-muted-foreground">
                                          <Badge variant="outline" className="text-xs">
                                            {item.sourceType === "ADDON" ? "Add-on" :
                                             item.sourceType === "REWARD" ? "Reward" : "Item"}
                                          </Badge>
                                          {item.amount !== undefined && (
                                            <span className="ml-2">${(item.amount / 100).toFixed(2)}</span>
                                          )}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          placeholder="Shopify SKU"
                                          className="w-32 h-8 text-sm"
                                          value={skuInputs[key] || ""}
                                          onChange={(e) => setSkuInputs(prev => ({
                                            ...prev,
                                            [key]: e.target.value
                                          }))}
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveSkuMapping(item)}
                                          disabled={isSavingSkuMapping === key || !skuInputs[key]?.trim()}
                                          className="h-8"
                                        >
                                          {isSavingSkuMapping === key ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Save className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Empty state */}
                          {skuMappings.length === 0 && unmappedItems.length === 0 && (
                            <div className="text-center py-6 text-muted-foreground">
                              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No rewards, add-ons, or items to map</p>
                              <p className="text-xs">Items will appear here once you have rewards set up</p>
                            </div>
                          )}

                          {/* All mapped success state */}
                          {skuMappings.length > 0 && unmappedItems.length === 0 && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">All items have been mapped to Shopify SKUs</span>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

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
                  Each project needs its own Shopify app credentials.
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
                      <AlertDescription className="space-y-2">
                        <p>To connect Shopify, you need to create your own app in the Shopify Partners dashboard:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Go to <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">partners.shopify.com</a> and create an app</li>
                          <li>Set <strong>App URL</strong> to: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/dashboard/indiekit</code></li>
                          <li>Set <strong>Redirect URL</strong> to: <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/creator/indiekit/shopify/oauth/callback</code></li>
                          <li>Copy the Client ID (API Key) and Client Secret below</li>
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
