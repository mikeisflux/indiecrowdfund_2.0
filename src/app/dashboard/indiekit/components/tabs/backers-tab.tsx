"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Download,
  RefreshCw,
  Send,
  MoreHorizontal,
  Eye,
  Mail,
  Check,
  Clock,
  Lock,
  MapPin,
  ChevronDown,
  AlertCircle,
  Loader2,
  X,
  Calendar,
  DollarSign,
  Gift,
  Package,
  Globe,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import type { Backer } from "../../types";
import { STATUS_COLORS, STATUS_LABELS } from "../../types";

interface SkuMapping {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  shopifySku: string;
  shopifyProductName?: string;
}

interface BackersTabProps {
  backers: Backer[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  selectedBackers: string[];
  onToggleBackerSelection: (backerId: string) => void;
  onSelectAllBackers: () => void;
  onOpenBackerDetail: (backer: Backer) => void;
  onPushSelectedOrders: () => void;
  hasActiveCampaign?: boolean;
  projectId?: string;
  onRefresh?: () => void;
  // Pagination
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}

export function BackersTab({
  backers,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedBackers,
  onToggleBackerSelection,
  onSelectAllBackers,
  onOpenBackerDetail,
  hasActiveCampaign = true,
  projectId,
  onRefresh,
  currentPage = 1,
  totalPages = 1,
  totalCount,
  onPageChange,
}: BackersTabProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncingTracking, setIsSyncingTracking] = useState(false);

  // SKU Mappings state
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([]);
  const [isLoadingSkuMappings, setIsLoadingSkuMappings] = useState(false);

  // Filter states
  const [rewardFilter, setRewardFilter] = useState<string[]>([]);
  const [addonFilter, setAddonFilter] = useState<string[]>([]);
  const [skuFilter, setSkuFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [pledgeAmountMin, setPledgeAmountMin] = useState<string>("");
  const [pledgeAmountMax, setPledgeAmountMax] = useState<string>("");
  const [pledgeDateFrom, setPledgeDateFrom] = useState<string>("");
  const [pledgeDateTo, setPledgeDateTo] = useState<string>("");
  const [surveyFilter, setSurveyFilter] = useState<string>("all");

  // Fetch SKU mappings when projectId changes
  useEffect(() => {
    async function fetchSkuMappings() {
      if (!projectId) {
        setSkuMappings([]);
        return;
      }

      setIsLoadingSkuMappings(true);
      try {
        const response = await apiFetch(`/api/creator/indiekit/shopify/sku-mapping?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setSkuMappings(data.mappings || []);
        } else {
          console.error("Failed to fetch SKU mappings:", response.status);
        }
      } catch (error) {
        console.error("Failed to fetch SKU mappings:", error);
      } finally {
        setIsLoadingSkuMappings(false);
      }
    }
    fetchSkuMappings();
  }, [projectId]);

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const rewards = Array.from(new Set(backers.map(b => b.reward).filter(Boolean))).sort();
    const addons = Array.from(new Set(backers.flatMap(b => b.addons?.map(a => a.name) || []))).sort();
    const locations = Array.from(new Set(backers.map(b => b.shippingAddress?.country).filter(Boolean) as string[])).sort();
    return { rewards, addons, locations };
  }, [backers]);

  // Build SKU filter options from mappings
  const skuFilterOptions = useMemo(() => {
    return skuMappings.map(m => ({
      id: m.id,
      label: `${m.sourceName} → ${m.shopifySku}`,
      sku: m.shopifySku,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      sourceName: m.sourceName,
    }));
  }, [skuMappings]);

  // Helper to check if a backer has a specific SKU mapping
  const backerHasSkuMapping = (backer: Backer, mapping: SkuMapping): boolean => {
    // Check if backer's reward matches the mapping (by ID or name)
    if (mapping.sourceType === "REWARD" || mapping.sourceType === "TIER") {
      // Match by reward ID if available, otherwise by name
      if (backer.rewardId && backer.rewardId === mapping.sourceId) return true;
      if (backer.reward === mapping.sourceName) return true;
    }

    // Check if backer's addons match the mapping (by ID or name)
    if (mapping.sourceType === "ADDON") {
      if (backer.addons?.some(a => a.id === mapping.sourceId || a.name === mapping.sourceName)) return true;
    }

    // Check if backer's items match by SKU
    if (backer.items?.some(i => i.sku === mapping.shopifySku)) return true;

    return false;
  };

  // Count active filters
  const activeFilterCount = [
    rewardFilter.length > 0,
    addonFilter.length > 0,
    skuFilter.length > 0,
    locationFilter.length > 0,
    pledgeAmountMin !== "" || pledgeAmountMax !== "",
    pledgeDateFrom !== "" || pledgeDateTo !== "",
    surveyFilter !== "all",
  ].filter(Boolean).length;

  // Clear all filters
  const clearAllFilters = () => {
    setRewardFilter([]);
    setAddonFilter([]);
    setSkuFilter([]);
    setLocationFilter([]);
    setPledgeAmountMin("");
    setPledgeAmountMax("");
    setPledgeDateFrom("");
    setPledgeDateTo("");
    setSurveyFilter("all");
    onStatusFilterChange("all");
  };

  // Helper function for bulk actions
  const performBulkAction = async (action: string, successMessage: string) => {
    if (!projectId || selectedBackers.length === 0) {
      toast.error("No backers selected or no project");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action,
          pledgeIds: selectedBackers,
          projectId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }

      toast.success(successMessage.replace("{count}", String(data.results?.success || selectedBackers.length)));
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsProcessing(false);
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

  const filteredBackers = backers
    .filter((backer) => {
      // Search filter
      const matchesSearch = backer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        backer.email.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === "all" || backer.status === statusFilter;

      // Reward filter
      const matchesReward = rewardFilter.length === 0 || rewardFilter.includes(backer.reward);

      // Add-on filter
      const matchesAddon = addonFilter.length === 0 ||
        backer.addons?.some(a => addonFilter.includes(a.name));

      // SKU filter - now uses mapped SKUs
      let matchesSku = true;
      if (skuFilter.length > 0) {
        const selectedMappings = skuMappings.filter(m => skuFilter.includes(m.id));
        matchesSku = selectedMappings.some(mapping => backerHasSkuMapping(backer, mapping));
      }

      // Location filter
      const matchesLocation = locationFilter.length === 0 ||
        (backer.shippingAddress?.country && locationFilter.includes(backer.shippingAddress.country));

      // Pledge amount range filter
      let matchesPledgeAmount = true;
      const amount = backer.pledgeAmount;
      const minAmount = pledgeAmountMin ? parseFloat(pledgeAmountMin) : null;
      const maxAmount = pledgeAmountMax ? parseFloat(pledgeAmountMax) : null;
      if (minAmount !== null && amount < minAmount) matchesPledgeAmount = false;
      if (maxAmount !== null && amount > maxAmount) matchesPledgeAmount = false;

      // Pledge date range filter
      let matchesPledgeDate = true;
      if (backer.pledgeDate && (pledgeDateFrom || pledgeDateTo)) {
        const pledgeDate = new Date(backer.pledgeDate);
        if (pledgeDateFrom) {
          const fromDate = new Date(pledgeDateFrom);
          if (pledgeDate < fromDate) matchesPledgeDate = false;
        }
        if (pledgeDateTo) {
          const toDate = new Date(pledgeDateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire day
          if (pledgeDate > toDate) matchesPledgeDate = false;
        }
      }

      // Survey filter
      let matchesSurvey = true;
      if (surveyFilter !== "all") {
        matchesSurvey = surveyFilter === "completed" ? backer.surveyCompleted : !backer.surveyCompleted;
      }

      return matchesSearch && matchesStatus && matchesReward && matchesAddon &&
             matchesSku && matchesLocation && matchesPledgeAmount && matchesPledgeDate && matchesSurvey;
    })
    .sort((a, b) => {
      // Sort by backer number, backers without numbers go to the end
      const aNum = a.backerNumber || Infinity;
      const bNum = b.backerNumber || Infinity;
      return aNum - bNum;
    });

  // Calculate stats for selected backers
  const selectedBackerData = backers.filter(b => selectedBackers.includes(b.id));

  // Handle bulk send survey reminder
  const handleSendSurveyReminder = async () => {
    const pendingSurveys = selectedBackerData.filter(b => !b.surveyCompleted).length;
    if (pendingSurveys === 0) {
      toast.info("All selected backers have completed their surveys");
      return;
    }
    await performBulkAction("send_survey_reminder", "Sent survey reminders to {count} backers");
  };

  // Handle bulk lock orders
  const handleLockOrders = async () => {
    await performBulkAction("lock_orders", "Locked orders for {count} backers");
  };

  // Handle bulk lock addresses
  const handleLockAddresses = async () => {
    const withAddresses = selectedBackerData.filter(b => b.addressComplete).length;
    if (withAddresses === 0) {
      toast.error("No selected backers have complete addresses");
      return;
    }
    await performBulkAction("lock_addresses", "Locked addresses for {count} backers");
  };

  // Handle push to fulfillment
  const handlePushToFulfillment = async () => {
    await performBulkAction("push_to_fulfillment", "Pushed {count} orders to fulfillment");
  };

  // Handle mark shipped
  const handleMarkShipped = async () => {
    const pushedOrders = selectedBackerData.filter(b => b.status === "pushed").length;
    if (pushedOrders === 0) {
      toast.info("No pushed orders selected to mark as shipped");
      return;
    }
    await performBulkAction("mark_shipped", "Marked {count} orders as shipped");
  };

  // Pull tracking back from the connected carriers. Deliberately not a bulk
  // action on selected rows: the question is "which shipments have tracking
  // now", and that isn't something you can select in advance.
  const handleSyncTracking = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    setIsSyncingTracking(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_tracking", projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      if (data.synced > 0) {
        toast.success(data.message);
      } else {
        // Nothing new is a normal outcome, not a failure — say so without
        // dressing it up as success.
        toast.info(data.message || "No new tracking numbers were available.");
      }
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync tracking");
    } finally {
      setIsSyncingTracking(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    try {
      const res = await fetch(`/api/creator/indiekit/export?projectId=${projectId}&type=backers`);

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backers-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export downloaded");
    } catch {
      toast.error("Failed to export data");
    }
  };

  // Helper component for multi-select filter popover
  const FilterPopover = ({
    label,
    icon: Icon,
    options,
    selected,
    onToggle,
  }: {
    label: string;
    icon: React.ElementType;
    options: string[];
    selected: string[];
    onToggle: (value: string) => void;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-9 ${selected.length > 0 ? "border-teal-500 bg-teal-50" : ""}`}>
          <Icon className="h-4 w-4 mr-2" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-teal-100 text-teal-700">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            {selected.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => selected.forEach(v => onToggle(v))}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No options available</p>
            ) : (
              options.map((option) => (
                <div
                  key={option}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => onToggle(option)}
                >
                  <Checkbox
                    checked={selected.includes(option)}
                  />
                  <span className="text-sm truncate">{option}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 sm:flex-initial sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by backer name or email"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedBackers.length > 0 && (
            <>
              {/* Bulk Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="whitespace-nowrap">
                    Bulk Actions ({selectedBackers.length})
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleSendSurveyReminder}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Survey Reminder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLockOrders}>
                    <Lock className="h-4 w-4 mr-2" />
                    Lock Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLockAddresses}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Lock Addresses
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePushToFulfillment} disabled={isProcessing}>
                    <Send className="h-4 w-4 mr-2" />
                    Push to Fulfillment
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleMarkShipped} disabled={isProcessing}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Shipped
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handlePushToFulfillment}
                className="bg-teal-600 hover:bg-teal-700"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Push {selectedBackers.length} Orders
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={handleSyncTracking}
            disabled={isSyncingTracking}
            title="Fetch tracking numbers from your connected fulfillment services"
          >
            {isSyncingTracking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Tracking
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Rewards Filter */}
        <FilterPopover
          label="Rewards"
          icon={Gift}
          options={filterOptions.rewards}
          selected={rewardFilter}
          onToggle={(value) => setRewardFilter(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
          )}
        />

        {/* Add-ons Filter */}
        <FilterPopover
          label="Add-ons"
          icon={Package}
          options={filterOptions.addons}
          selected={addonFilter}
          onToggle={(value) => setAddonFilter(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
          )}
        />

        {/* SKU Mapping Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={`h-9 ${skuFilter.length > 0 ? "border-teal-500 bg-teal-50" : ""}`}>
              <Link2 className="h-4 w-4 mr-2" />
              SKU Mapping
              {skuFilter.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-teal-100 text-teal-700">
                  {skuFilter.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">SKU Mapping</span>
                {skuFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setSkuFilter([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 space-y-1">
                {isLoadingSkuMappings ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : skuFilterOptions.length === 0 ? (
                  <div className="text-center py-4 px-2">
                    <Link2 className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No SKUs mapped yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please map SKUs through the SKU Mapping tab first
                    </p>
                  </div>
                ) : (
                  skuFilterOptions.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => setSkuFilter(prev =>
                        prev.includes(option.id) ? prev.filter(v => v !== option.id) : [...prev, option.id]
                      )}
                    >
                      <Checkbox
                        checked={skuFilter.includes(option.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{option.sourceName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{option.sku}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {option.sourceType === "ADDON" ? "Add-on" :
                         option.sourceType === "REWARD" ? "Reward" : "Item"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className={`w-[130px] h-9 ${statusFilter !== "all" ? "border-teal-500 bg-teal-50" : ""}`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="not_pushed">Not Pushed</SelectItem>
            <SelectItem value="push_errored">Push Errored</SelectItem>
            <SelectItem value="pushed">Pushed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>

        {/* Location Filter */}
        <FilterPopover
          label="Location"
          icon={Globe}
          options={filterOptions.locations}
          selected={locationFilter}
          onToggle={(value) => setLocationFilter(prev =>
            prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
          )}
        />

        {/* Pledge Amount Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 ${(pledgeAmountMin || pledgeAmountMax) ? "border-teal-500 bg-teal-50" : ""}`}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Pledge amount
              {(pledgeAmountMin || pledgeAmountMax) && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-teal-100 text-teal-700">
                  {pledgeAmountMin && pledgeAmountMax
                    ? `$${pledgeAmountMin}-$${pledgeAmountMax}`
                    : pledgeAmountMin
                    ? `≥$${pledgeAmountMin}`
                    : `≤$${pledgeAmountMax}`}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pledge amount</span>
                {(pledgeAmountMin || pledgeAmountMax) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setPledgeAmountMin("");
                      setPledgeAmountMax("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Min</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={pledgeAmountMin}
                      onChange={(e) => setPledgeAmountMin(e.target.value)}
                      className="pl-6 h-8"
                    />
                  </div>
                </div>
                <span className="text-muted-foreground mt-4">—</span>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Max</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="∞"
                      value={pledgeAmountMax}
                      onChange={(e) => setPledgeAmountMax(e.target.value)}
                      className="pl-6 h-8"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Pledge Date Range Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 ${(pledgeDateFrom || pledgeDateTo) ? "border-teal-500 bg-teal-50" : ""}`}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Pledge date
              {(pledgeDateFrom || pledgeDateTo) && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 bg-teal-100 text-teal-700">
                  {pledgeDateFrom && pledgeDateTo
                    ? `${new Date(pledgeDateFrom).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(pledgeDateTo).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : pledgeDateFrom
                    ? `From ${new Date(pledgeDateFrom).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : `Until ${new Date(pledgeDateTo).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pledge date range</span>
                {(pledgeDateFrom || pledgeDateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setPledgeDateFrom("");
                      setPledgeDateTo("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">From</label>
                  <Input
                    type="date"
                    value={pledgeDateFrom}
                    onChange={(e) => setPledgeDateFrom(e.target.value)}
                    className="h-8"
                  />
                </div>
                <span className="text-muted-foreground mt-4">—</span>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">To</label>
                  <Input
                    type="date"
                    value={pledgeDateTo}
                    onChange={(e) => setPledgeDateTo(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Survey Filter */}
        <Select value={surveyFilter} onValueChange={setSurveyFilter}>
          <SelectTrigger className={`w-[130px] h-9 ${surveyFilter !== "all" ? "border-teal-500 bg-teal-50" : ""}`}>
            <SelectValue placeholder="Survey" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All surveys</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear filters button */}
        {(activeFilterCount > 0 || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}

        {/* Results count */}
        <div className="ml-auto text-sm text-muted-foreground">
          Showing {filteredBackers.length} of {totalCount ?? backers.length} backers
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2 py-2">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Card Charging Dialog */}

      {/* Backers Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedBackers.length === filteredBackers.length && filteredBackers.length > 0}
                    onCheckedChange={onSelectAllBackers}
                  />
                </TableHead>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Backer</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead>Order Lock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBackers.map((backer) => (
                <TableRow key={backer.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedBackers.includes(backer.id)}
                      onCheckedChange={() => onToggleBackerSelection(backer.id)}
                    />
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)} className="font-medium text-muted-foreground">
                    {backer.backerNumber || "—"}
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {backer.avatar && <AvatarImage src={backer.avatar} />}
                        <AvatarFallback>{backer.name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{backer.name}</p>
                          {backer.needsMigrationPayment && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                              Payment required
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{backer.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>{backer.reward}</TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <span className={backer.needsMigrationPayment ? "text-red-600 font-medium" : undefined}>
                      ${Number(backer.pledgeAmount).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    {backer.surveyCompleted ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    {backer.orderLockStatus === "LOCKED" ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    ) : backer.orderLockStatus === "LOCK_REQUESTED" ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Requested
                      </Badge>
                    ) : backer.orderLockStatus === "DECLINED" ? (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        <X className="h-3 w-3 mr-1" />
                        Declined
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unlocked</span>
                    )}
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <Badge className={STATUS_COLORS[backer.status]}>
                      {STATUS_LABELS[backer.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenBackerDetail(backer)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          // Open email composer with this backer's email pre-filled
                          window.location.href = `mailto:${backer.email}?subject=Regarding%20Your%20Pledge`;
                        }}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          if (!projectId) {
                            toast.error("No project selected");
                            return;
                          }
                          try {
                            const res = await apiFetch("/api/creator/indiekit/backers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", },
                              body: JSON.stringify({
                                action: "push_to_fulfillment",
                                pledgeIds: [backer.id],
                                projectId,
                              }),
                            });
                            if (!res.ok) {
                              const data = await res.json();
                              throw new Error(data.error || "Push failed");
                            }
                            toast.success(`Pushed order for ${backer.name} to fulfillment`);
                            onRefresh?.();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Push failed");
                          }
                        }}>
                          <Send className="h-4 w-4 mr-2" />
                          Push to Fulfillment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          if (!projectId) {
                            toast.error("No project selected");
                            return;
                          }
                          try {
                            const res = await apiFetch("/api/creator/indiekit/backers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", },
                              body: JSON.stringify({
                                action: "mark_shipped",
                                pledgeIds: [backer.id],
                                projectId,
                              }),
                            });
                            if (!res.ok) {
                              const data = await res.json();
                              throw new Error(data.error || "Failed to mark as shipped");
                            }
                            toast.success(`Marked order for ${backer.name} as shipped`);
                            onRefresh?.();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Failed to mark as shipped");
                          }
                        }}>
                          <Check className="h-4 w-4 mr-2" />
                          Mark as Shipped
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
