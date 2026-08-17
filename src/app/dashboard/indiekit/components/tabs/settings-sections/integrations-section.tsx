"use client";

import { apiFetch } from "@/lib/fetch-utils";
import React, { useState, useEffect, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Truck,
  Globe,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

interface ShopifyStatus {
  connected: boolean;
  loading: boolean;
  shopName: string | null;
}

/** One store on the creator's ShipStation account. */
interface ShipStationStore {
  storeId: number;
  storeName: string;
  marketplaceName?: string | null;
}

interface ShipStationStatus {
  loading: boolean;
  connected: boolean;
  /** Set when the last connection attempt or sync failed. */
  error: string | null;
  storeId: number | null;
  storeName: string | null;
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

  // ShipStation's tile used to be static markup: it read no status at all, so
  // it said "Connect" whether or not the campaign was connected. Connecting
  // showed a success toast next to a button still inviting you to connect,
  // which is exactly how it was reported to us.
  const [shipStation, setShipStation] = useState<ShipStationStatus>({
    loading: true,
    connected: false,
    error: null,
    storeId: null,
    storeName: null,
  });
  const [shipStationDialogOpen, setShipStationDialogOpen] = useState(false);
  const [isDisconnectingShipStation, setIsDisconnectingShipStation] = useState(false);

  // Store picker.
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [storeOptions, setStoreOptions] = useState<ShipStationStore[]>([]);
  const [storesUnavailable, setStoresUnavailable] = useState(false);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  const loadIntegrationStatus = useCallback(async () => {
    if (!projectId) {
      setShipStation({
        loading: false,
        connected: false,
        error: null,
        storeId: null,
        storeName: null,
      });
      return;
    }

    setShipStation((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(
        `/api/creator/indiekit/integrations?projectId=${encodeURIComponent(projectId)}`
      );
      if (!res.ok) throw new Error("Failed to load integrations");
      const data = await res.json();
      const ss = data?.fulfillment?.shipstation;
      setShipStation({
        loading: false,
        connected: !!ss?.connected,
        error: ss?.status === "ERROR" ? ss?.lastSyncError || "Connection error" : null,
        storeId: typeof ss?.storeId === "number" ? ss.storeId : null,
        storeName: typeof ss?.storeName === "string" ? ss.storeName : null,
      });
    } catch {
      // Leaving it stuck on a spinner is worse than showing the connect path;
      // a failed status read is not evidence of a failed connection, so the
      // tile falls back to its uncommitted state rather than claiming either.
      setShipStation((prev) => ({ ...prev, loading: false }));
    }
  }, [projectId]);

  useEffect(() => {
    void loadIntegrationStatus();
  }, [loadIntegrationStatus]);

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
    // A missing project used to be folded into the credentials check, so a
    // creator who had typed both fields correctly was told to enter both
    // fields. Blaming the operator for the app's own missing state cost a
    // support round-trip; the two conditions report separately now.
    if (!projectId) {
      toast.error("Select a campaign at the top of the page first");
      return;
    }
    if (!shipStationKey.trim() || !shipStationSecret.trim()) {
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

      const data = await res.json();

      toast.success("Connected to ShipStation");
      setShipStationKey("");
      setShipStationSecret("");
      setShipStationDialogOpen(false);

      const stores: ShipStationStore[] = Array.isArray(data.stores) ? data.stores : [];
      setShipStation({
        loading: false,
        connected: true,
        error: null,
        storeId: typeof data.storeId === "number" ? data.storeId : null,
        storeName: typeof data.storeName === "string" ? data.storeName : null,
      });

      // Jordan's other question: a ShipStation account has a store per selling
      // channel, and nothing here ever asked which one orders should import
      // into. If there's a real choice to make, make it now rather than
      // letting the first push land somewhere unexpected.
      if (stores.length > 1 && typeof data.storeId !== "number") {
        setStoreOptions(stores);
        setStoresUnavailable(false);
        setSelectedStoreId("");
        setStoreDialogOpen(true);
      }

      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect ShipStation");
    } finally {
      setIsConnectingShipStation(false);
    }
  };

  const openStorePicker = async () => {
    if (!projectId) return;

    setStoreOptions([]);
    setStoresUnavailable(false);
    setSelectedStoreId(shipStation.storeId != null ? String(shipStation.storeId) : "");
    setStoreDialogOpen(true);
    setIsLoadingStores(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, service: "shipstation", action: "list_stores" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Couldn't load your ShipStation stores");
      }
      const data = await res.json();
      setStoreOptions(Array.isArray(data.stores) ? data.stores : []);
      setStoresUnavailable(!!data.storesUnavailable);
      if (typeof data.storeId === "number") setSelectedStoreId(String(data.storeId));
    } catch (error) {
      setStoresUnavailable(true);
      toast.error(
        error instanceof Error ? error.message : "Couldn't load your ShipStation stores"
      );
    } finally {
      setIsLoadingStores(false);
    }
  };

  const handleSaveStore = async () => {
    if (!projectId || !selectedStoreId) return;

    setIsSavingStore(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          service: "shipstation",
          action: "set_store",
          storeId: Number(selectedStoreId),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save store");
      }
      const data = await res.json();
      setShipStation((prev) => ({
        ...prev,
        storeId: data.storeId ?? null,
        storeName: data.storeName ?? null,
      }));
      setStoreDialogOpen(false);
      toast.success(`Orders will import into ${data.storeName || "the selected store"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save store");
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleDisconnectShipStation = async () => {
    if (!projectId) return;

    setIsDisconnectingShipStation(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, service: "shipstation", action: "disconnect" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect ShipStation");
      }
      setShipStation({
        loading: false,
        connected: false,
        error: null,
        storeId: null,
        storeName: null,
      });
      toast.success("Disconnected from ShipStation");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect ShipStation");
    } finally {
      setIsDisconnectingShipStation(false);
    }
  };

  const handleConnectEasyship = async () => {
    if (!projectId) {
      toast.error("Select a campaign at the top of the page first");
      return;
    }
    if (!easyshipToken.trim()) {
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
        <div
          className={`flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg ${
            shipStation.connected ? "border-green-500" : shipStation.error ? "border-amber-500" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded flex items-center justify-center ${
                shipStation.connected ? "bg-green-100" : "bg-blue-100"
              }`}
            >
              <Truck
                className={`h-5 w-5 ${shipStation.connected ? "text-green-600" : "text-blue-600"}`}
              />
            </div>
            <div>
              <p className="font-medium">ShipStation</p>
              {/* The store control sits inline with the store it names, not in
                  the button row. A third button there wrapped onto a second
                  line, and putting it on its own line below added a third row
                  — either way this became the only tile in the panel taller
                  than the rest. */}
              <p className="text-sm text-muted-foreground">
                {shipStation.loading
                  ? "Checking connection..."
                  : shipStation.connected ? (
                      <>
                        {shipStation.storeName
                          ? `Orders import into ${shipStation.storeName}`
                          : "Connected · using your default ShipStation store"}
                        {" · "}
                        <button
                          type="button"
                          onClick={openStorePicker}
                          className="font-medium text-teal-600 underline-offset-2 hover:underline"
                        >
                          {shipStation.storeName ? "Change store" : "Choose store"}
                        </button>
                      </>
                    )
                    : "Shipping label generation & tracking"}
              </p>
              {shipStation.error && !shipStation.connected && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {shipStation.error}
                </p>
              )}
            </div>
          </div>

          {shipStation.loading ? (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : shipStation.connected ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Connected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnectShipStation}
                disabled={isDisconnectingShipStation}
                className="text-muted-foreground hover:text-destructive"
              >
                {isDisconnectingShipStation ? "..." : "Disconnect"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShipStationDialogOpen(true)}>
              {shipStation.error ? "Reconnect" : "Connect"}
            </Button>
          )}

          <AlertDialog open={shipStationDialogOpen} onOpenChange={setShipStationDialogOpen}>
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
                <AlertDialogCancel disabled={isConnectingShipStation}>Cancel</AlertDialogCancel>
                {/* A plain Button, not AlertDialogAction: the Radix action
                    closes the dialog the moment it is clicked, which would
                    tear down the form mid-request and take a failed attempt's
                    typed-in keys with it. The handler closes it on success. */}
                <Button onClick={handleConnectShipStation} disabled={isConnectingShipStation}>
                  {isConnectingShipStation ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Which ShipStation store this campaign's orders import into. */}
        <Dialog open={storeDialogOpen} onOpenChange={setStoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Choose a ShipStation store</DialogTitle>
              <DialogDescription>
                Your ShipStation account has more than one store. Pick the one this campaign&apos;s
                orders should import into — it decides which branding, packing slips and automation
                rules apply.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {isLoadingStores ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your stores...
                </div>
              ) : storesUnavailable ? (
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t read the store list from ShipStation. Orders will import into
                  your account&apos;s default store, which is fine if you only use one.
                </p>
              ) : storeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No stores came back from ShipStation. Orders will import into your account&apos;s
                  default store.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="shipstation-store">Store</Label>
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                    <SelectTrigger id="shipstation-store">
                      <SelectValue placeholder="Select a store" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeOptions.map((store) => (
                        <SelectItem key={store.storeId} value={String(store.storeId)}>
                          {store.storeName}
                          {store.marketplaceName ? ` · ${store.marketplaceName}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStoreDialogOpen(false)}
                disabled={isSavingStore}
              >
                {storeOptions.length === 0 ? "Close" : "Cancel"}
              </Button>
              {storeOptions.length > 0 && (
                <Button onClick={handleSaveStore} disabled={isSavingStore || !selectedStoreId}>
                  {isSavingStore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save store"
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
