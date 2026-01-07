"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Send,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  RefreshCcw,
  Search,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { PackageGroup } from "../../types";

interface ConnectedService {
  id: string;
  name: string;
  accountId: string;
  connectedAt: string;
}

interface PackagesTabProps {
  packageGroups: PackageGroup[];
  packageGroupFilter: string;
  onPackageGroupFilterChange: (filter: string) => void;
  hasActiveCampaign?: boolean;
  connectedServices?: ConnectedService[];
  projectId?: string;
  onRefresh?: () => void;
}

export function PackagesTab({
  packageGroups,
  packageGroupFilter,
  onPackageGroupFilterChange,
  hasActiveCampaign = true,
  connectedServices = [],
  projectId,
  onRefresh,
}: PackagesTabProps) {
  const [segmentFilter, setSegmentFilter] = useState("ready_to_ship");
  const [searchGroupId, setSearchGroupId] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState(new Date().toLocaleString());
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("shopify");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [fulfillmentMethod, setFulfillmentMethod] = useState("shipstation");
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<string>("domestic");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<PackageGroup | null>(null);
  const [editingCustomsItem, setEditingCustomsItem] = useState<{ groupId: string; itemName: string } | null>(null);
  const [customsDescription, setCustomsDescription] = useState("");
  const [customsValue, setCustomsValue] = useState("");
  const [customsCountry, setCustomsCountry] = useState("US");
  const [isSavingCustoms, setIsSavingCustoms] = useState(false);

  const handleConnect = async () => {
    if (selectedService === "shopify") {
      if (!shopDomain.trim() || !apiKey.trim()) {
        toast.error("Please enter your Shopify store domain and access token");
        return;
      }
    } else {
      if (!apiKey.trim() || !apiSecret.trim()) {
        toast.error("Please enter both API key and secret");
        return;
      }
    }

    setIsConnecting(true);
    try {
      // Use Shopify-specific endpoint for Shopify connections
      const endpoint = selectedService === "shopify"
        ? "/api/creator/indiekit/shopify"
        : "/api/creator/indiekit/integrations";

      const bodyData = selectedService === "shopify"
        ? {
            projectId,
            action: "connect",
            shopDomain: shopDomain.trim(),
            accessToken: apiKey.trim(),
          }
        : {
            projectId,
            service: selectedService,
            apiKey,
            apiSecret,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }

      const data = await res.json();
      toast.success(data.message || `Connected to ${selectedService.charAt(0).toUpperCase() + selectedService.slice(1)}`);
      setIsConnectDialogOpen(false);
      setApiKey("");
      setApiSecret("");
      setShopDomain("");
      setFulfillmentMethod(selectedService);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePushOrders = async (groupId?: string) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsPushing(true);
    try {
      // Use Shopify endpoint if Shopify is selected
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
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Push failed");
      }

      const data = await res.json();
      const serviceName = fulfillmentMethod === "shopify" ? "Shopify" : "fulfillment";
      toast.success(`Pushed ${data.pushed || data.count || 0} orders to ${serviceName}`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push failed");
    } finally {
      setIsPushing(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRefreshStatus = async () => {
    if (!projectId) return;

    try {
      const res = await fetch(`/api/creator/indiekit/fulfillment?projectId=${projectId}&action=refresh`, {
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }

      setLastRefreshed(new Date().toLocaleString());
      toast.success("Order status updated");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    }
  };

  const handleUpdateConnection = async (service: ConnectedService) => {
    if (!projectId) return;

    try {
      const res = await fetch(`/api/creator/indiekit/integrations?projectId=${projectId}&serviceId=${service.id}`, {
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get connection details");
      }

      const data = await res.json();
      setSelectedService(service.name.toLowerCase());
      setApiKey(data.apiKey || "");
      setApiSecret("");
      setIsConnectDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update connection");
    }
  };

  const handleSyncOrderStatus = async () => {
    if (!projectId) return;

    setIsSyncingStatus(true);
    try {
      // Use Shopify endpoint if Shopify is selected
      const endpoint = fulfillmentMethod === "shopify"
        ? "/api/creator/indiekit/shopify"
        : "/api/creator/indiekit/fulfillment";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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
      const serviceName = fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod;
      toast.success(data.message || `Synced ${data.updated || 0} orders from ${serviceName}`);
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
      const res = await fetch(`/api/creator/indiekit/fulfillment?projectId=${projectId}&action=refresh_groups`, {
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Refresh failed");
      }

      setLastRefreshed(new Date().toLocaleString());
      toast.success("Package groups refreshed");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSearchPackageGroup = async () => {
    if (!projectId || !searchGroupId.trim()) {
      toast.error("Please enter a group ID to search");
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/creator/indiekit/fulfillment?projectId=${projectId}&action=get_group&groupId=${searchGroupId}`, {
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Group not found");
      }

      const data = await res.json();
      if (data.group) {
        setViewingGroup(data.group);
      } else {
        toast.error(`Package group #${searchGroupId} not found`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePushAllOrders = async () => {
    if (!projectId) return;

    setIsPushing(true);
    try {
      // Use Shopify endpoint if Shopify is selected
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Push failed");
      }

      const data = await res.json();
      const serviceName = fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod;
      toast.success(`Pushed ${data.pushed || data.count || 0} orders to ${serviceName}`);
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
      const res = await fetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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

  const handleCreateGroup = async () => {
    if (!projectId || !newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setIsCreatingGroup(true);
    try {
      const res = await fetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "create_group",
          name: newGroupName,
          type: newGroupType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create group");
      }

      toast.success(`Created package group "${newGroupName}"`);
      setShowCreateGroupDialog(false);
      setNewGroupName("");
      setNewGroupType("domestic");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create group");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleExport = async (groupId: string, format: "csv" | "excel" | "packing_slips" | "shipping_labels") => {
    if (!projectId) return;

    try {
      const res = await fetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "export",
          groupId,
          format,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }

      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
        toast.success(`Export ready for download`);
      } else {
        toast.success(`Export is being prepared. You'll receive an email when it's ready.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const handleSaveCustoms = async () => {
    if (!projectId || !editingCustomsItem) return;

    setIsSavingCustoms(true);
    try {
      const res = await fetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "update_customs",
          groupId: editingCustomsItem.groupId,
          itemName: editingCustomsItem.itemName,
          customs: {
            description: customsDescription,
            value: parseFloat(customsValue) || 0,
            countryOfOrigin: customsCountry,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update customs info");
      }

      toast.success("Customs information updated");
      setEditingCustomsItem(null);
      setCustomsDescription("");
      setCustomsValue("");
      setCustomsCountry("US");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customs");
    } finally {
      setIsSavingCustoms(false);
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

      {/* Process Tabs - Now includes Instructions and Connect */}
      <Tabs defaultValue="by-group">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="connect">1. Connect</TabsTrigger>
          <TabsTrigger value="process-all">2a. Process All</TabsTrigger>
          <TabsTrigger value="by-group">2b. Process by Group</TabsTrigger>
        </TabsList>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How Fulfillment Integration Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold">Connect Your Shipping Service</h4>
                      <p className="text-sm text-muted-foreground">
                        Link your ShipStation, EasyPost, or other fulfillment account to enable automatic order syncing.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold">Set Up Package Groups</h4>
                      <p className="text-sm text-muted-foreground">
                        Organize orders by shipping destination, product type, or custom criteria for efficient processing.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold">Push Orders</h4>
                      <p className="text-sm text-muted-foreground">
                        Send orders to your shipping service individually by group, or all at once with Process All.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold">Track Status</h4>
                      <p className="text-sm text-muted-foreground">
                        Monitor push status and shipping progress in real-time. Handle any errors that occur.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      5
                    </div>
                    <div>
                      <h4 className="font-semibold">Update Order Status</h4>
                      <p className="text-sm text-muted-foreground">
                        Sync shipping status back from your fulfillment service to mark orders as shipped.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-teal-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Before You Begin</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Ensure all product weights are set correctly for accurate shipping rates</li>
                      <li>• Configure customs information for international shipments</li>
                      <li>• Verify backer addresses are complete before pushing orders</li>
                      <li>• Test with a small batch first before bulk processing</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setIsConnectDialogOpen(true)}>
                  Get Started - Connect Service
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
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
                      <TableHead>Account</TableHead>
                      <TableHead>Connected</TableHead>
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
                        <TableCell className="text-muted-foreground">
                          {service.connectedAt}
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
          <div className="grid gap-4 md:grid-cols-3">
            {/* Service Box */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Connected Service</h4>
                <p className="font-semibold">{fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod === "shipstation" ? "ShipStation" : fulfillmentMethod.charAt(0).toUpperCase() + fulfillmentMethod.slice(1)}</p>
                <p className="text-sm text-muted-foreground">{fulfillmentMethod === "shopify" ? "(Fulfillment Orders)" : fulfillmentMethod === "shipstation" ? "(NDM Express)" : ""}</p>
                <Button variant="link" className="text-teal-600 p-0 h-auto mt-2" onClick={handleSyncOrderStatus} disabled={isSyncingStatus}>
                  {isSyncingStatus ? "Syncing..." : "Update Order Status"}
                  {!isSyncingStatus && <ArrowRight className="h-3 w-3 ml-1" />}
                </Button>
              </CardContent>
            </Card>

            {/* Add New Orders Box */}
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

            {/* Search Box */}
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
          <div className="grid gap-4 md:grid-cols-3">
            {/* Service Box */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Connected Service</h4>
                <p className="font-semibold">{fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod === "shipstation" ? "ShipStation" : fulfillmentMethod.charAt(0).toUpperCase() + fulfillmentMethod.slice(1)}</p>
                <p className="text-sm text-muted-foreground">{fulfillmentMethod === "shopify" ? "(Fulfillment Orders)" : fulfillmentMethod === "shipstation" ? "(NDM Express)" : ""}</p>
                <Button variant="link" className="text-teal-600 p-0 h-auto mt-2" onClick={handleSyncOrderStatus} disabled={isSyncingStatus}>
                  {isSyncingStatus ? "Syncing..." : "Update Order Status"}
                  {!isSyncingStatus && <ArrowRight className="h-3 w-3 ml-1" />}
                </Button>
              </CardContent>
            </Card>

            {/* Add New Orders Box */}
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

            {/* Search Box */}
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
              <Card key={group.id}>
                <CardContent className="pt-6">
                  {/* Group Header with ID */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-semibold">Package Group #{group.id}</h4>
                        <p className="text-sm text-muted-foreground">{group.name}</p>
                      </div>
                      <Badge className="bg-teal-100 text-teal-700">
                        {group.type.charAt(0).toUpperCase() + group.type.slice(1)}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingGroup(group)}>View This Group</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(group.id, "csv")}>Export Orders</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(group.id, "excel")}>Export Reports</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Status Flow */}
                  <div className="flex items-center justify-between py-3 mb-4 border-y">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                      <span className="text-sm">{group.statusCounts.notPushed}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-sm">{group.statusCounts.pushErrored}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-sm">{group.statusCounts.pushed}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm">{group.statusCounts.shipped}</span>
                    </div>
                  </div>

                  {/* Send Button */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Group Last Sent: {group.lastSentAt || "Never"}
                    </p>
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 w-full"
                      disabled={group.statusCounts.notPushed === 0 || isPushing}
                      onClick={() => handlePushOrders(group.id)}
                    >
                      {isPushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {isPushing ? "Sending..." : `Send ${group.statusCounts.notPushed} to ${fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod === "shipstation" ? "ShipStation" : "Fulfillment"}`}
                    </Button>
                  </div>

                  {/* Items Table */}
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12">Qty.</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right w-24">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.quantity}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{item.name}</p>
                                {!item.customsValid && (
                                  <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Not Valid for Customs
                                    <button className="text-teal-600 underline ml-1" onClick={() => setEditingCustomsItem({ groupId: group.id, itemName: item.name })}>edit</button>
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {item.weight.lbs} lb {item.weight.oz.toFixed(1)} oz
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={2} className="text-right font-medium">
                            {group.items.length} items
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {group.totalWeight.lbs} lb {group.totalWeight.oz.toFixed(1)} oz
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* View Group Link */}
                  <div className="mt-4 text-center">
                    <Button variant="link" className="text-teal-600" onClick={() => setViewingGroup(group)}>
                      View This Group
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>

                  {/* Export Reports Dropdown */}
                  <div className="mt-2 pt-2 border-t">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Export reports for this group
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem onClick={() => handleExport(group.id, "csv")}>Export as CSV</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(group.id, "excel")}>Export as Excel</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(group.id, "packing_slips")}>Export Packing Slips</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(group.id, "shipping_labels")}>Export Shipping Labels</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Connect Service Dialog */}
      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Fulfillment Service</DialogTitle>
            <DialogDescription>
              Connect to a shipping service to push orders directly for fulfillment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service">Select Service</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="shipstation">ShipStation</SelectItem>
                  <SelectItem value="easyship">Easyship</SelectItem>
                  <SelectItem value="shippo">Shippo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedService === "shopify" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="shopDomain">Shopify Store Domain</Label>
                  <Input
                    id="shopDomain"
                    placeholder="your-store.myshopify.com"
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your store&apos;s myshopify.com domain (e.g., your-store.myshopify.com)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Access Token</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your Shopify access token"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-2">
                  <p className="font-medium">To get your Shopify access token:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Go to your Shopify Admin &rarr; Settings &rarr; Apps and sales channels</li>
                    <li>Click &quot;Develop apps&quot; &rarr; Create an app</li>
                    <li>Configure Admin API scopes: <code className="bg-muted px-1 rounded">write_orders, read_orders, write_fulfillments, read_fulfillments</code></li>
                    <li>Install the app and copy the Admin API access token</li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Enter your API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    placeholder="Enter your API secret"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  <p>You can find your API credentials in your {selectedService.charAt(0).toUpperCase() + selectedService.slice(1)} account settings.</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Service"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Package Group</DialogTitle>
            <DialogDescription>
              Create a new package group to organize orders for fulfillment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., US Domestic Orders"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupType">Group Type</Label>
              <Select value={newGroupType} onValueChange={setNewGroupType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestic">Domestic</SelectItem>
                  <SelectItem value="international">International</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroupDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleCreateGroup}
              disabled={isCreatingGroup}
            >
              {isCreatingGroup ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Group Dialog */}
      <Dialog open={!!viewingGroup} onOpenChange={(open) => !open && setViewingGroup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Package Group #{viewingGroup?.id}</DialogTitle>
            <DialogDescription>
              {viewingGroup?.name}
            </DialogDescription>
          </DialogHeader>
          {viewingGroup && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Not Pushed</p>
                  <p className="text-xl font-bold">{viewingGroup.statusCounts.notPushed}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Errored</p>
                  <p className="text-xl font-bold">{viewingGroup.statusCounts.pushErrored}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Pushed</p>
                  <p className="text-xl font-bold">{viewingGroup.statusCounts.pushed}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Shipped</p>
                  <p className="text-xl font-bold">{viewingGroup.statusCounts.shipped}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Qty.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right w-24">Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingGroup.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.quantity}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.weight.lbs} lb {item.weight.oz.toFixed(1)} oz
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingGroup(null)}>
              Close
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                if (viewingGroup) handlePushOrders(viewingGroup.id);
              }}
              disabled={!viewingGroup || viewingGroup.statusCounts.notPushed === 0 || isPushing}
            >
              {isPushing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod === "shipstation" ? "ShipStation" : "Fulfillment"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customs Dialog */}
      <Dialog open={!!editingCustomsItem} onOpenChange={(open) => !open && setEditingCustomsItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customs Information</DialogTitle>
            <DialogDescription>
              Update customs details for {editingCustomsItem?.itemName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customsDescription">Description</Label>
              <Input
                id="customsDescription"
                placeholder="Brief description of the item"
                value={customsDescription}
                onChange={(e) => setCustomsDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customsValue">Declared Value (USD)</Label>
              <Input
                id="customsValue"
                type="number"
                placeholder="0.00"
                value={customsValue}
                onChange={(e) => setCustomsValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customsCountry">Country of Origin</Label>
              <Select value={customsCountry} onValueChange={setCustomsCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">United States</SelectItem>
                  <SelectItem value="CN">China</SelectItem>
                  <SelectItem value="UK">United Kingdom</SelectItem>
                  <SelectItem value="DE">Germany</SelectItem>
                  <SelectItem value="JP">Japan</SelectItem>
                  <SelectItem value="KR">South Korea</SelectItem>
                  <SelectItem value="TW">Taiwan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCustomsItem(null)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveCustoms}
              disabled={isSavingCustoms}
            >
              {isSavingCustoms ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Customs Info"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
