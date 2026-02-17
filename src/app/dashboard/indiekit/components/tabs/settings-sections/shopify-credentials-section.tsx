"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, Store, Key } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

interface ShopifyStatus {
  connected: boolean;
  loading: boolean;
  shopName: string | null;
}

interface ShopifyCredentialsSectionProps {
  shopifyStatus: ShopifyStatus;
  setShopifyStatus: React.Dispatch<React.SetStateAction<ShopifyStatus>>;
}

export function ShopifyCredentialsSection({
  setShopifyStatus,
}: ShopifyCredentialsSectionProps) {
  const [shopifyApiCredentials, setShopifyApiCredentials] = useState({
    apiKey: "",
    apiSecret: "",
  });
  const [shopifyCredsStatus, setShopifyCredsStatus] = useState<{
    saved: boolean;
    loading: boolean;
  }>({ saved: false, loading: true });
  const [isSavingShopifyCreds, setIsSavingShopifyCreds] = useState(false);

  // Load Shopify API credentials on mount
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
  }, [setShopifyStatus]);

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

  return (
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
  );
}
