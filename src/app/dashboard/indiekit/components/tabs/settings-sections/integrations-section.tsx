"use client";

import { apiFetch } from "@/lib/fetch-utils";
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CreditCard,
  Truck,
  Globe,
  ExternalLink,
  Loader2,
  CheckCircle,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

interface ShopifyStatus {
  connected: boolean;
  loading: boolean;
  shopName: string | null;
}

interface IntegrationsSectionProps {
  projectId?: string;
  onRefresh?: () => void;
  shopifyStatus: ShopifyStatus;
  setShopifyStatus: React.Dispatch<React.SetStateAction<ShopifyStatus>>;
}

export function IntegrationsSection({
  projectId,
  onRefresh,
  shopifyStatus,
  setShopifyStatus,
}: IntegrationsSectionProps) {
  const searchParams = useSearchParams();
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [shipStationKey, setShipStationKey] = useState("");
  const [shipStationSecret, setShipStationSecret] = useState("");
  const [easyshipToken, setEasyshipToken] = useState("");
  const [isConnectingShipStation, setIsConnectingShipStation] = useState(false);
  const [isConnectingEasyship, setIsConnectingEasyship] = useState(false);
  const [isConnectingShopify, setIsConnectingShopify] = useState(false);

  // Handle OAuth callback messages
  useEffect(() => {
    if (!searchParams) return;

    const shopifyResult = searchParams.get("shopify");
    const shopName = searchParams.get("shop");
    const errorMsg = searchParams.get("error");

    if (shopifyResult === "connected") {
      toast.success(`Connected to ${shopName || "Shopify"} successfully!`);
      setShopifyStatus(prev => ({ ...prev, connected: true, shopName: shopName || prev.shopName }));
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("shopify");
      newUrl.searchParams.delete("shop");
      window.history.replaceState({}, "", newUrl.toString());
    } else if (errorMsg) {
      toast.error(decodeURIComponent(errorMsg));
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams, setShopifyStatus]);

  const handleConnectShipStation = async () => {
    if (!projectId || !shipStationKey.trim() || !shipStationSecret.trim()) {
      toast.error("Please enter both API key and secret");
      return;
    }

    setIsConnectingShipStation(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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
      const res = await apiFetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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
      const res = await apiFetch("/api/creator/indiekit/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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

  return (
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
  );
}
