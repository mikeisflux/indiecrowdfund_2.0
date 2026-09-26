"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  RefreshCw,
  Send,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  RefreshCcw,
  Search,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { PackageGroup } from "../../types";
import {
  InstructionsContent,
  PackageGroupCard,
  SkuMappingContent,
  ConnectServiceDialog,
  CreateGroupDialog,
  ViewGroupDialog,
  EditCustomsDialog,
  RateEstimateDialog,
} from "./packages-sections";
import type { EditingCustomsItem } from "./packages-sections";

interface PackagesTabProps {
  packageGroups: PackageGroup[];
  packageGroupFilter: string;
  onPackageGroupFilterChange: (filter: string) => void;
  hasActiveCampaign?: boolean;
  projectId?: string;
  rewards?: { id: string; name: string }[];
  onRefresh?: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  shopify: "Shopify",
  shipstation: "ShipStation",
  shippo: "Shippo",
  easypost: "EasyPost",
};

type IntegrationState = {
  connected: boolean;
  storeName?: string | null;
  lastSyncError?: string | null;
};

export function PackagesTab({
  packageGroups,
  packageGroupFilter,
  onPackageGroupFilterChange,
  hasActiveCampaign = true,
  projectId,
  rewards = [],
  onRefresh,
}: PackagesTabProps) {
  const [segmentFilter, setSegmentFilter] = useState("ready_to_ship");
  const [searchGroupId, setSearchGroupId] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleString());
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethodState] = useState("shipstation");
  const [integrations, setIntegrations] = useState<Record<string, IntegrationState>>({});
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<PackageGroup | null>(null);
  const [ratingGroup, setRatingGroup] = useState<PackageGroup | null>(null);
  const [editingCustomsItem, setEditingCustomsItem] = useState<EditingCustomsItem | null>(null);

  // Remember the chosen method per campaign; before this the tab silently
  // reset to ShipStation on every mount and the "Connected Service" box was
  // hardcoded to "ShipStation (NDM Express)" regardless of reality.
  const methodStorageKey = projectId ? `indiekit-fulfillment-method-${projectId}` : null;
  const setFulfillmentMethod = useCallback(
    (method: string) => {
      setFulfillmentMethodState(method);
      try {
        if (methodStorageKey) localStorage.setItem(methodStorageKey, method);
      } catch {
        // Private-mode storage failures shouldn't break the switch.
      }
    },
    [methodStorageKey]
  );

  const loadIntegrations = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/creator/indiekit/integrations?projectId=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      // The integrations API returns this object under `fulfillment`
      // (reading the wrong key here left this tab convinced nothing was
      // ever connected, which dead-ended every order push).
      const fulfillment = (data.fulfillment || {}) as Record<string, IntegrationState>;
      setIntegrations(fulfillment);
      // Initial method: the saved choice, else whichever service is
      // actually connected, else keep the default.
      let saved: string | null = null;
      try {
        saved = methodStorageKey ? localStorage.getItem(methodStorageKey) : null;
      } catch {
        saved = null;
      }
      if (saved) {
        setFulfillmentMethodState(saved);
      } else {
        const connected = Object.entries(fulfillment).find(([, v]) => v?.connected);
        if (connected) setFulfillmentMethodState(connected[0]);
      }
    } catch {
      // Leave state as-is; the card will show "Not connected".
    }
  }, [projectId, methodStorageKey]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const activeIntegration = integrations[fulfillmentMethod];
  const isServiceMethod = fulfillmentMethod === "shopify" || fulfillmentMethod === "shipstation";
  const serviceConnected = !isServiceMethod || !!activeIntegration?.connected;
  const methodLabel = PROVIDER_LABELS[fulfillmentMethod]
    || (fulfillmentMethod === "csv" ? "CSV Export" : fulfillmentMethod === "manual" ? "Manual Fulfillment" : fulfillmentMethod);

  const connectedServices = Object.entries(integrations)
    .filter(([, v]) => v?.connected)
    .map(([provider, v]) => ({
      id: provider,
      name: PROVIDER_LABELS[provider] || provider,
      accountId: v?.storeName || "Connected",
    }));

  const reportPushResult = (data: { pushed?: number; count?: number; failed?: number; errors?: string[]; remaining?: number; message?: string }, serviceName: string) => {
    const pushed = data.pushed ?? data.count ?? 0;
    if (data.failed) {
      toast.error(
        `${data.failed} order(s) failed to push${data.errors?.[0] ? ` — ${data.errors[0]}` : ""}`
      );
    }
    if (pushed > 0 || !data.failed) {
      toast.success(data.message || `Pushed ${pushed} order(s) to ${serviceName}`);
    }
    if (data.remaining) {
      toast.info(`${data.remaining} order(s) still queued — push again to continue`);
    }
  };

  const handlePushOrders = async (groupId?: string) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    const group = groupId ? packageGroups.find((g) => g.id === groupId) : undefined;

    // CSV / manual methods have nothing to push to — the equivalent action
    // is exporting the orders.
    if (fulfillmentMethod === "csv") {
      handleExport(groupId || "", "csv");
      return;
    }
    if (fulfillmentMethod === "manual") {
      toast.info("Manual fulfillment: export orders or update statuses from the Backers tab");
      return;
    }
    if (!serviceConnected) {
      toast.error(`${methodLabel} isn't connected — add it under step 1 (Connect)`);
      return;
    }

    setIsPushing(true);
    try {
      const endpoint = fulfillmentMethod === "shopify"
        ? "/api/creator/indiekit/shopify"
        : "/api/creator/indiekit/fulfillment";

      const bodyData = fulfillmentMethod === "shopify"
        ? {
            projectId,
            action: "push_orders",
          }
        : {
            projectId,
            action: "push_orders",
            groupId,
            // Groups are generated per reward tier, so the server resolves
            // the group's orders by its name (the reward title).
            groupName: group?.name,
          };

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Push failed");
      }

      const data = await res.json();
      reportPushResult(data, methodLabel);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push failed");
    } finally {
      setIsPushing(false);
    }
  };

  const handleUpdateConnection = (service: { name: string }) => {
    toast.info(`Re-enter your ${service.name} credentials to update the connection`);
    setIsConnectDialogOpen(true);
  };

  const handleSyncOrderStatus = async () => {
    if (!projectId) return;
    if (!isServiceMethod) {
      toast.info("Status sync needs a connected service (Shopify or ShipStation)");
      return;
    }
    if (!serviceConnected) {
      toast.error(`${methodLabel} isn't connected — add it under step 1 (Connect)`);
      return;
    }

    setIsSyncingStatus(true);
    try {
      const endpoint = fulfillmentMethod === "shopify"
        ? "/api/creator/indiekit/shopify"
        : "/api/creator/indiekit/fulfillment";

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "sync_status",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }

      const data = await res.json();
      toast.success(data.message || `Synced ${data.updated || 0} order(s) from ${methodLabel}`);
      setLastRefreshed(new Date().toLocaleString());
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setIsSyncingStatus(false);
    }
  };

  const handleRefreshPackageGroups = async () => {
    if (!projectId) return;

    setIsRefreshing(true);
    try {
      // Package groups are derived server-side and handed down as props, so
      // refreshing just means re-running the parent's fetch. This used to GET
      // /api/creator/indiekit/fulfillment?action=refresh_groups — a route that
      // only exports POST and has no refresh_groups action, so every click
      // 405'd and showed "Refresh failed" while the data was in fact fine.
      await onRefresh?.();
      setLastRefreshed(new Date().toLocaleString());
      toast.success("Package groups refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSearchPackageGroup = () => {
    // The full group list is already loaded as a prop — resolve locally.
    // (This used to GET a ?action=get_group endpoint that never existed
    // server-side, so search failed with a 405 every time.)
    if (!searchGroupId.trim()) {
      toast.error("Please enter a group ID or name to search");
      return;
    }

    setIsSearching(true);
    const q = searchGroupId.trim().toLowerCase();
    const group =
      packageGroups.find((g) => g.id.toLowerCase() === q) ||
      packageGroups.find((g) => g.name.toLowerCase().includes(q));
    if (group) {
      setViewingGroup(group);
    } else {
      toast.error(`No package group matching "${searchGroupId}"`);
    }
    setIsSearching(false);
  };

  const handlePushAllOrders = async () => {
    if (!projectId) return;
    if (fulfillmentMethod === "csv") {
      handleExport("", "csv");
      return;
    }
    if (fulfillmentMethod === "manual") {
      toast.info("Manual fulfillment: export orders or update statuses from the Backers tab");
      return;
    }
    if (!serviceConnected) {
      toast.error(`${methodLabel} isn't connected — add it under step 1 (Connect)`);
      return;
    }

    setIsPushing(true);
    try {
      const endpoint = fulfillmentMethod === "shopify"
        ? "/api/creator/indiekit/shopify"
        : "/api/creator/indiekit/fulfillment";

      const bodyData = fulfillmentMethod === "shopify"
        ? {
            projectId,
            action: "push_orders",
          }
        : {
            projectId,
            action: "push_all",
            segment: segmentFilter,
          };

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Push failed");
      }

      const data = await res.json();
      reportPushResult(data, methodLabel);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push failed");
    } finally {
      setIsPushing(false);
    }
  };

  const handleRetryErrored = async () => {
    if (!projectId) return;

    setIsRetrying(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "retry_errored",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Retry failed");
      }

      const data = await res.json();
      toast.success(`Re-pushed ${data.count || 0} errored orders`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDeleteGroup = async (group: PackageGroup) => {
    if (!projectId) return;
    if (!window.confirm(`Delete custom group "${group.name}"? Orders in it are unaffected.`)) return;
    try {
      const res = await apiFetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ projectId, action: "delete_group", groupId: group.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete group");
      toast.success(`Deleted "${group.name}"`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete group");
    }
  };

  const handleExport = async (groupId: string, format: "csv" | "excel" | "packing_slips" | "shipping_labels") => {
    if (!projectId) return;
    const group = groupId ? packageGroups.find((g) => g.id === groupId) : undefined;

    // Packing slips render as a printable page (print dialog saves as
    // PDF) rather than a file the server would have to typeset.
    if (format === "packing_slips") {
      const qs = new URLSearchParams({ projectId });
      if (group?.custom) qs.set("groupId", group.id);
      else if (group?.name) qs.set("groupName", group.name);
      window.open(`/api/creator/indiekit/packing-slips?${qs}`, "_blank");
      return;
    }

    try {
      const res = await apiFetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "export",
          groupId,
          groupName: group?.custom ? undefined : group?.name,
          format,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }

      const data = await res.json();
      if (data.csv) {
        const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || "orders.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${data.count ?? 0} order(s)`);
      } else if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
        toast.success("Export ready for download");
      } else {
        toast.error("Export returned no file");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  // Show message if no active campaign
  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground">
              You must have an active campaign to see data here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals for Process All actions
  const totalNotPushed = packageGroups.reduce((sum, g) => sum + g.statusCounts.notPushed, 0);
  const totalErrored = packageGroups.reduce((sum, g) => sum + g.statusCounts.pushErrored, 0);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" className="-mb-4" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Fulfillment Integration Header */}
      <div className="bg-teal-600 text-white rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold mb-2">Fulfillment Integration</h2>
            <p className="text-teal-100">Push orders to your shipping service and track fulfillment status</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                Switch Fulfillment Method
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setFulfillmentMethod("shopify"); toast.success("Switched to Shopify"); }}>Shopify</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFulfillmentMethod("shipstation"); toast.success("Switched to ShipStation"); }}>ShipStation</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFulfillmentMethod("csv"); toast.success("Switched to CSV Export"); }}>CSV Export</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFulfillmentMethod("manual"); toast.success("Switched to Manual Fulfillment"); }}>Manual Fulfillment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Process Tabs */}
      <Tabs defaultValue="by-group">
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max min-w-full">
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="connect">1. Connect</TabsTrigger>
          {fulfillmentMethod === "shopify" && (
            <TabsTrigger value="sku-mapping">2. SKU Mapping</TabsTrigger>
          )}
          {fulfillmentMethod !== "shopify" && (
            <TabsTrigger value="sku-mapping" disabled className="opacity-50">2. SKU Mapping</TabsTrigger>
          )}
          <TabsTrigger value="process-all">3a. Process All</TabsTrigger>
          <TabsTrigger value="by-group">3b. Process by Group</TabsTrigger>
        </TabsList>
        </div>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="space-y-6">
          <InstructionsContent onGetStarted={() => setIsConnectDialogOpen(true)} />
        </TabsContent>

        {/* Connect Tab */}
        <TabsContent value="connect" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
            </CardHeader>
            <CardContent>
              {connectedServices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Account / Store</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectedServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{service.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {service.accountId}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-teal-600" onClick={() => handleUpdateConnection(service)}>
                            Update
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No services connected yet</p>
                </div>
              )}

              <div className="flex justify-center mt-6">
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setIsConnectDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SKU Mapping Tab (Shopify only) */}
        <TabsContent value="sku-mapping" className="space-y-6">
          <SkuMappingContent projectId={projectId} fulfillmentMethod={fulfillmentMethod} />
        </TabsContent>

        {/* Process All Tab */}
        <TabsContent value="process-all" className="space-y-6">
          {/* Filter by Segment */}
          <div className="w-full">
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Filter by Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backers</SelectItem>
                <SelectItem value="ready_to_ship">All Backers with Ready To Ship Orders</SelectItem>
                <SelectItem value="survey_complete">Survey Complete</SelectItem>
                <SelectItem value="address_complete">Address Complete</SelectItem>
                <SelectItem value="payment_complete">Payment Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Box, Add New Orders Box, Search Box Row */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Fulfillment Method</h4>
                <p className="font-semibold">{methodLabel}</p>
                {isServiceMethod ? (
                  serviceConnected ? (
                    <p className="text-sm text-green-600">
                      Connected{activeIntegration?.storeName ? ` · ${activeIntegration.storeName}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">Not connected — see step 1 (Connect)</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">No service connection needed</p>
                )}
                {isServiceMethod && serviceConnected && (
                  <Button variant="link" className="text-teal-600 p-0 h-auto mt-2" onClick={handleSyncOrderStatus} disabled={isSyncingStatus}>
                    {isSyncingStatus ? "Syncing..." : "Update Order Status"}
                    {!isSyncingStatus && <ArrowRight className="h-3 w-3 ml-1" />}
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Button className="bg-teal-600 hover:bg-teal-700 w-full mb-2" onClick={handleRefreshPackageGroups} disabled={isRefreshing}>
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isRefreshing ? "Refreshing..." : "Refresh Package Groups"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Last Refreshed: {lastRefreshed}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Search Package Group</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Package Group #"
                    value={searchGroupId}
                    onChange={(e) => setSearchGroupId(e.target.value)}
                  />
                  <Button size="icon" className="bg-teal-600 hover:bg-teal-700" onClick={handleSearchPackageGroup} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Bulk Actions</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Push all orders to your shipping service at once, or retry failed pushes.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={totalNotPushed === 0 || isPushing}
                  onClick={handlePushAllOrders}
                >
                  {isPushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {isPushing ? "Pushing..." : `Push all ${totalNotPushed} orders`}
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={totalErrored === 0 || isRetrying}
                  onClick={handleRetryErrored}
                >
                  {isRetrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  {isRetrying ? "Retrying..." : `Re-push all ${totalErrored} errored orders`}
                </Button>
                <Button variant="outline" onClick={handleSyncOrderStatus} disabled={isSyncingStatus}>
                  {isSyncingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                  {isSyncingStatus ? "Syncing..." : "Update Order Status"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Summary */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-4">Overall Status</h4>
              <div className="flex items-center justify-between py-4 px-6 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm text-muted-foreground">Not Pushed</span>
                  </div>
                  <p className="text-3xl font-bold">{totalNotPushed}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Push Errored</span>
                  </div>
                  <p className="text-3xl font-bold">{totalErrored}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Pushed</span>
                  </div>
                  <p className="text-3xl font-bold">
                    {packageGroups.reduce((sum, g) => sum + g.statusCounts.pushed, 0)}
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">Shipped</span>
                  </div>
                  <p className="text-3xl font-bold">
                    {packageGroups.reduce((sum, g) => sum + g.statusCounts.shipped, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Process by Group Tab */}
        <TabsContent value="by-group" className="space-y-4">
          {/* Filter by Segment */}
          <div className="w-full">
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Filter by Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backers</SelectItem>
                <SelectItem value="ready_to_ship">All Backers with Ready To Ship Orders</SelectItem>
                <SelectItem value="survey_complete">Survey Complete</SelectItem>
                <SelectItem value="address_complete">Address Complete</SelectItem>
                <SelectItem value="payment_complete">Payment Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Box, Add New Orders Box, Search Box Row */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Fulfillment Method</h4>
                <p className="font-semibold">{methodLabel}</p>
                {isServiceMethod ? (
                  serviceConnected ? (
                    <p className="text-sm text-green-600">
                      Connected{activeIntegration?.storeName ? ` · ${activeIntegration.storeName}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">Not connected — see step 1 (Connect)</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">No service connection needed</p>
                )}
                {isServiceMethod && serviceConnected && (
                  <Button variant="link" className="text-teal-600 p-0 h-auto mt-2" onClick={handleSyncOrderStatus} disabled={isSyncingStatus}>
                    {isSyncingStatus ? "Syncing..." : "Update Order Status"}
                    {!isSyncingStatus && <ArrowRight className="h-3 w-3 ml-1" />}
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Button className="bg-teal-600 hover:bg-teal-700 w-full mb-2" onClick={handleRefreshPackageGroups} disabled={isRefreshing}>
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isRefreshing ? "Refreshing..." : "Refresh Package Groups"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Last Refreshed: {lastRefreshed}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Search Package Group</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Package Group #"
                    value={searchGroupId}
                    onChange={(e) => setSearchGroupId(e.target.value)}
                  />
                  <Button size="icon" className="bg-teal-600 hover:bg-teal-700" onClick={handleSearchPackageGroup} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Package Group Filter */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h3 className="text-lg font-semibold whitespace-nowrap">Package Groups</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={packageGroupFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("all")}
                  className={packageGroupFilter === "all" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  All ({packageGroups.length})
                </Button>
                <Button
                  variant={packageGroupFilter === "incomplete" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("incomplete")}
                  className={packageGroupFilter === "incomplete" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  Incomplete ({packageGroups.filter(g => g.type === "incomplete").length})
                </Button>
                <Button
                  variant={packageGroupFilter === "international" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("international")}
                  className={packageGroupFilter === "international" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  International ({packageGroups.filter(g => g.type === "international").length})
                </Button>
                <Button
                  variant={packageGroupFilter === "domestic" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("domestic")}
                  className={packageGroupFilter === "domestic" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  Domestic ({packageGroups.filter(g => g.type === "domestic").length})
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleRefreshPackageGroups} disabled={isRefreshing}>
                {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {isRefreshing ? "Refreshing..." : "Refresh Groups"}
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setShowCreateGroupDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
          </div>

          {/* Package Groups Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {packageGroups
              .filter(g => packageGroupFilter === "all" || g.type === packageGroupFilter)
              .map((group) => (
              <PackageGroupCard
                key={group.id}
                group={group}
                fulfillmentMethod={fulfillmentMethod}
                isPushing={isPushing}
                onPushOrders={handlePushOrders}
                onViewGroup={setViewingGroup}
                onExport={handleExport}
                onDeleteGroup={handleDeleteGroup}
                onEstimateShipping={setRatingGroup}
                onEditCustoms={(groupId, item) =>
                  setEditingCustomsItem({
                    groupId,
                    itemName: item.name,
                    customsDescription: item.customsDescription,
                    countryOfOrigin: item.countryOfOrigin,
                    declaredValue: item.declaredValue,
                    customsCode: item.customsCode,
                    weightOz: item.weightOz,
                  })
                }
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ConnectServiceDialog
        open={isConnectDialogOpen}
        onOpenChange={setIsConnectDialogOpen}
        projectId={projectId}
        onConnected={(service) => {
          setFulfillmentMethod(service);
          loadIntegrations();
          onRefresh?.();
        }}
      />

      <CreateGroupDialog
        open={showCreateGroupDialog}
        onOpenChange={setShowCreateGroupDialog}
        projectId={projectId}
        rewards={rewards}
        onRefresh={onRefresh}
      />

      <ViewGroupDialog
        group={viewingGroup}
        onClose={() => setViewingGroup(null)}
        fulfillmentMethod={fulfillmentMethod}
        isPushing={isPushing}
        onPushOrders={handlePushOrders}
      />

      <RateEstimateDialog
        group={ratingGroup}
        onClose={() => setRatingGroup(null)}
        projectId={projectId}
      />

      <EditCustomsDialog
        editingItem={editingCustomsItem}
        onClose={() => setEditingCustomsItem(null)}
        projectId={projectId}
        onRefresh={onRefresh}
      />
    </div>
  );
}
