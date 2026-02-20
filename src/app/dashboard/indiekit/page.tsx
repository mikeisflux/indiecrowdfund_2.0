"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings,
  Bell,
  ChevronLeft,
  Package,
  Truck,
  Mail,
  Download,
  Users,
  DollarSign,
  Check,
  Lock,
  ClipboardList,
  LayoutDashboard,
  Box,
  ShoppingCart,
  TrendingUp,
  ChevronRight,
  Loader2,
  FileText,
  FolderKanban,
  UsersRound,
  Layers,
  FileDown,
  Clock,
  BarChart3,
  HeadphonesIcon,
  FormInput,
  BoxIcon,
  UserCircle,
  Inbox,
  CreditCard,
  AlertCircle,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCSRFHeaders } from "@/lib/csrf";

// Types and constants
import type {
  Project,
  FulfillmentStats,
  WorkflowStep,
  Backer,
  PackageGroup,
  ShippingService,
  DigitalFile,
  DistributionRule,
  EmailCampaign,
  SurveyAddon,
} from "./types";
import { WORKFLOW_STEPS, SHIPPING_SERVICES } from "./constants";

// Components
import {
  BackerDialog,
  UploadDialog,
  EmailDialog,
  AddonDialog,
  DistributionDialog,
  NPSFeedbackDialog,
} from "./components/dialogs";
import { ImportAddonFromProjectDialog } from "./components/dialogs/import-addon-from-project-dialog";
import {
  OverviewTab,
  BackersTab,
  AddonsTab,
  PackagesTab,
  ShippingTab,
  DigitalTab,
  PreOrdersTab,
  EmailsTab,
  TeaserPagesTab,
  EmailListTab,
  ProjectsTab,
  SegmentsTab,
  ExportTab,
  TimelineTab,
  CountsTab,
  SupportTab,
  SurveyBuilderTab,
  ManageSurveyTab,
  SettingsTab,
  ProductsTab,
  AccountSettingsTab,
  UpdatesTab,
  InboxTab,
  SkuMappingTab,
} from "./components/tabs";
import { WhatsNextBanner } from "./components/whats-next-banner";

const SELECTED_PROJECT_KEY = "indiecrowdfund_selected_project";

export default function IndieKitPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [stats, setStats] = useState<FulfillmentStats | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(WORKFLOW_STEPS);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shippingServices, setShippingServices] = useState<ShippingService[]>(SHIPPING_SERVICES);
  const [digitalFiles, setDigitalFiles] = useState<DigitalFile[]>([]);
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [emailMemberCount, setEmailMemberCount] = useState<number>(0);
  const [userEmail, setUserEmail] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [surveyAddons, setSurveyAddons] = useState<SurveyAddon[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [segments, setSegments] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>([]);
  const [rewards, setRewards] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [addons, setAddons] = useState<{ id: string; name: string; price: number }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [timeline, setTimeline] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  const [surveyQuestions, setSurveyQuestions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBackers, setSelectedBackers] = useState<string[]>([]);
  const [isBackerDialogOpen, setIsBackerDialogOpen] = useState(false);
  const [selectedBacker, setSelectedBacker] = useState<Backer | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<{ subject?: string; body?: string; name?: string } | null>(null);
  const [isAddonDialogOpen, setIsAddonDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<SurveyAddon | null>(null);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
  const [isNPSDialogOpen, setIsNPSDialogOpen] = useState(false);
  const [packageGroupFilter, setPackageGroupFilter] = useState<string>("all");
  const [workflowActionLoading, setWorkflowActionLoading] = useState<string | null>(null);
  const [isChargePreviewOpen, setIsChargePreviewOpen] = useState(false);

  // Workflow action handlers
  const handleWorkflowAction = async (stepId: string) => {
    if (!selectedProjectId || workflowActionLoading) return;

    // For charge_cards, show preview dialog instead of charging directly
    if (stepId === "charge_cards") {
      setIsChargePreviewOpen(true);
      return;
    }

    // Map step ID to API action
    const actionMap: Record<string, { action: string; successMsg: string; errorMsg: string }> = {
      lock_orders: {
        action: "lock_orders",
        successMsg: "Orders locked successfully",
        errorMsg: "Failed to lock orders",
      },
      lock_addresses: {
        action: "lock_addresses",
        successMsg: "Addresses locked successfully",
        errorMsg: "Failed to lock addresses",
      },
      start_shipping: {
        action: "push_to_fulfillment",
        successMsg: "Orders pushed to fulfillment",
        errorMsg: "Failed to push orders",
      },
      shipped: {
        action: "mark_shipped",
        successMsg: "Orders marked as shipped",
        errorMsg: "Failed to mark orders as shipped",
      },
    };

    const actionConfig = actionMap[stepId];
    if (!actionConfig) {
      // For surveys step, just navigate to emails tab
      if (stepId === "surveys") {
        setActiveTab("emails");
      }
      return;
    }

    // Get all backer IDs for the action
    const pledgeIds = backers.map(b => b.id);
    if (pledgeIds.length === 0) {
      toast.info("No backers to process");
      return;
    }

    setWorkflowActionLoading(stepId);
    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: actionConfig.action,
          pledgeIds,
          projectId: selectedProjectId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || actionConfig.errorMsg);
      }

      toast.success(`${actionConfig.successMsg} (${data.results?.success || pledgeIds.length} backers)`);
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : actionConfig.errorMsg);
    } finally {
      setWorkflowActionLoading(null);
    }
  };

  // Fetch IndieKit data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);

      const res = await fetch(`/api/creator/indiekit?${params}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to fetch IndieKit data");
      }

      const data = await res.json();
      setProjects(data.projects || []);
      setStats(data.stats || null);
      setBackers(data.backers || []);
      setPackageGroups(data.packageGroups || []);
      setDigitalFiles(data.digitalFiles || []);
      setDistributionRules(data.distributionRules || []);
      setEmailCampaigns(data.emailCampaigns || []);
      setEmailMemberCount(data.emailMemberCount || 0);
      setUserEmail(data.userEmail || "");
      setSegments(data.segments || []);
      setProducts(data.products || []);
      setRewards(data.rewards || []);
      setAddons(data.addons || []);
      setSurveyAddons(data.surveyAddons || []);
      setTimeline(data.timeline || []);

      // Only set default project if none selected and no saved preference
      if (!selectedProjectId && data.projects?.length > 0) {
        const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
        if (savedProjectId && data.projects.some((p: Project) => p.id === savedProjectId)) {
          setSelectedProjectId(savedProjectId);
        } else {
          setSelectedProjectId(data.projects[0].id);
          localStorage.setItem(SELECTED_PROJECT_KEY, data.projects[0].id);
        }
      }

      if (data.workflowState) {
        setWorkflowSteps(data.workflowState);
      }
    } catch (error) {
      console.error("IndieKit fetch error:", error);
      toast.error("Failed to load IndieKit data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  // Load selected project from URL param or localStorage on mount and mark as initialized
  useEffect(() => {
    const urlProject = searchParams?.get("project");
    const savedProjectId = urlProject || localStorage.getItem(SELECTED_PROJECT_KEY);
    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
      localStorage.setItem(SELECTED_PROJECT_KEY, savedProjectId);
    }
    // Mark as initialized after reading (even if no saved project)
    setIsInitialized(true);
  }, [searchParams]);

  // Only fetch data after initialization from localStorage is complete
  useEffect(() => {
    if (isInitialized) {
      fetchData();
    }
  }, [fetchData, isInitialized]);

  // Filter backers
  const filteredBackers = backers.filter((backer) => {
    const matchesSearch = backer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backer.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || backer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Check if user has an active campaign (including prelaunch pages)
  const hasActiveCampaign = projects.some(p =>
    ["ACTIVE", "FUNDED", "COMPLETED", "FULFILLING", "LIVE"].includes(p.status) ||
    p.prelaunchActive === true
  ) || backers.length > 0;

  // Toggle backer selection
  const toggleBackerSelection = (backerId: string) => {
    setSelectedBackers((prev) =>
      prev.includes(backerId) ? prev.filter((id) => id !== backerId) : [...prev, backerId]
    );
  };

  // Select all visible backers
  const selectAllBackers = () => {
    if (selectedBackers.length === filteredBackers.length) {
      setSelectedBackers([]);
    } else {
      setSelectedBackers(filteredBackers.map((b) => b.id));
    }
  };

  // Open backer detail dialog
  const openBackerDetail = (backer: Backer) => {
    setSelectedBacker(backer);
    setIsBackerDialogOpen(true);
  };

  // Push selected orders
  const pushSelectedOrders = async () => {
    if (selectedBackers.length === 0) {
      toast.error("Please select orders to push");
      return;
    }
    toast.success(`Pushing ${selectedBackers.length} orders to fulfillment...`);
  };

  // Calculate fulfillment percentage
  const fulfillmentPercent = stats ? (stats.fulfilledBackers / stats.totalBackers) * 100 : 0;
  const surveyPercent = stats ? (stats.surveysCompleted / stats.totalBackers) * 100 : 0;

  if (loading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading IndieKit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-teal-500/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-teal-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-primary/10 top-1/2 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-purple-500/10 bottom-20 right-1/3" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/dashboard?project=${selectedProjectId}`}>
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
                IndieKit
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">Fulfillment</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Select value={selectedProjectId} onValueChange={(value) => {
              setSelectedProjectId(value);
              localStorage.setItem(SELECTED_PROJECT_KEY, value);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Take Action Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-teal-600" />
                  Take Action
                </CardTitle>
                <CardDescription>Fulfillment workflow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {workflowSteps.map((step) => {
                  // Use actionCount from workflow state if available, otherwise calculate
                  const actionCount = step.actionCount ?? (() => {
                    switch (step.id) {
                      case "surveys":
                        return stats?.surveysPending || 0;
                      case "lock_orders":
                        return backers.filter(b => b.surveyCompleted && b.status === "not_pushed").length;
                      case "charge_cards":
                        return stats?.chargeStats?.notCharged || 0;
                      case "lock_addresses":
                        return backers.filter(b => b.addressComplete).length;
                      case "start_shipping":
                        return backers.filter(b => b.status === "not_pushed").length;
                      case "shipped":
                        return backers.filter(b => b.status === "pushed").length;
                      default:
                        return 0;
                    }
                  })();
                  const isClickable = step.status !== "locked";
                  const isLoading = workflowActionLoading === step.id;
                  const hasAction = ["lock_orders", "charge_cards", "lock_addresses", "start_shipping", "shipped"].includes(step.id);

                  return (
                    <div key={step.id} className="space-y-1">
                      <button
                        onClick={() => {
                          if (isClickable && step.targetTab) {
                            setActiveTab(step.targetTab);
                          }
                        }}
                        disabled={step.status === "locked"}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg p-3 transition-colors text-left",
                          step.status === "in_progress" && "bg-teal-50 border border-teal-200",
                          step.status === "completed" && "bg-green-50",
                          step.status === "pending" && "bg-muted/50 hover:bg-muted",
                          step.status === "locked" && "opacity-50 cursor-not-allowed",
                          isClickable && "cursor-pointer hover:ring-2 hover:ring-teal-200"
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          step.status === "completed" && "bg-green-500 text-white",
                          step.status === "in_progress" && "bg-teal-500 text-white",
                          step.status === "pending" && "bg-gray-200 text-gray-600",
                          step.status === "locked" && "bg-gray-100 text-gray-400"
                        )}>
                          {step.status === "completed" ? (
                            <Check className="h-4 w-4" />
                          ) : step.status === "locked" ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <step.icon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            step.status === "locked" && "text-muted-foreground"
                          )}>
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                        </div>
                        {actionCount > 0 && step.status !== "completed" && (
                          <Badge variant="secondary" className={cn(
                            "text-xs",
                            step.status === "in_progress" && "bg-teal-100 text-teal-700",
                            step.status === "pending" && "bg-amber-100 text-amber-700"
                          )}>
                            {actionCount}
                          </Badge>
                        )}
                        {step.status === "in_progress" && (
                          <ChevronRight className="h-4 w-4 text-teal-600" />
                        )}
                      </button>
                      {/* Action button for actionable steps */}
                      {hasAction && step.status !== "locked" && step.status !== "completed" && actionCount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 border-teal-200 text-teal-700 hover:bg-teal-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleWorkflowAction(step.id);
                          }}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              {step.id === "lock_orders" && `Lock ${actionCount} Orders`}
                              {step.id === "charge_cards" && `Charge ${actionCount} Cards`}
                              {step.id === "lock_addresses" && `Lock ${actionCount} Addresses`}
                              {step.id === "start_shipping" && `Push ${actionCount} to Fulfillment`}
                              {step.id === "shipped" && `Mark ${actionCount} Shipped`}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Fulfillment</span>
                    <span className="font-medium">{stats?.fulfilledBackers || 0}/{stats?.totalBackers || 0}</span>
                  </div>
                  <Progress value={fulfillmentPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{fulfillmentPercent.toFixed(0)}% complete</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Surveys</span>
                    <span className="font-medium">{stats?.surveysCompleted || 0}/{stats?.totalBackers || 0}</span>
                  </div>
                  <Progress value={surveyPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{surveyPercent.toFixed(0)}% collected</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setIsNPSDialogOpen(true)}
                >
                  Give Feedback
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Stats Overview Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Raised</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${(stats?.totalRaised || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Backers</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats?.totalBackers || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Add-on Sales</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${(stats?.addOnPurchases || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Shipped</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats?.packagesShipped || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* What's Next Banner - shown when fulfillment is nearly complete */}
            {fulfillmentPercent >= 95 && (
              <div className="mb-6">
                <WhatsNextBanner
                  upcomingProjectsCount={3}
                  onTellUsClick={() => window.location.href = "/dashboard/create"}
                  onViewProjects={() => setActiveTab("projects")}
                />
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* Row 1: Dashboard & Core Management */}
              <TabsList className="mb-1 h-auto gap-1 p-2 bg-muted/50 justify-center">
                <TabsTrigger value="overview">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="backers">
                  <Users className="h-4 w-4 mr-2" />
                  Backers
                </TabsTrigger>
                <TabsTrigger value="projects">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Projects
                </TabsTrigger>
                <TabsTrigger value="updates">
                  <FileText className="h-4 w-4 mr-2" />
                  Updates
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Clock className="h-4 w-4 mr-2" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="support">
                  <HeadphonesIcon className="h-4 w-4 mr-2" />
                  Support
                </TabsTrigger>
                <TabsTrigger value="sku-mapping">
                  <Link2 className="h-4 w-4 mr-2" />
                  SKU Mapping
                </TabsTrigger>
              </TabsList>
              {/* Row 2: Fulfillment & Products */}
              <TabsList className="mb-1 h-auto gap-1 p-2 bg-muted/50 justify-center">
                <TabsTrigger value="packages">
                  <Box className="h-4 w-4 mr-2" />
                  Packages
                </TabsTrigger>
                <TabsTrigger value="products">
                  <BoxIcon className="h-4 w-4 mr-2" />
                  Products
                </TabsTrigger>
                <TabsTrigger value="shipping">
                  <Truck className="h-4 w-4 mr-2" />
                  Shipping
                </TabsTrigger>
                <TabsTrigger value="digital">
                  <Download className="h-4 w-4 mr-2" />
                  Digital
                </TabsTrigger>
                <TabsTrigger value="addons">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add-ons
                </TabsTrigger>
                <TabsTrigger value="preorders">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Pre-Orders
                </TabsTrigger>
              </TabsList>
              {/* Row 3: Communication & Marketing */}
              <TabsList className="mb-1 h-auto gap-1 p-2 bg-muted/50 justify-center">
                <TabsTrigger value="inbox">
                  <Inbox className="h-4 w-4 mr-2" />
                  Inbox
                </TabsTrigger>
                <TabsTrigger value="emails">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Campaigns
                </TabsTrigger>
                <TabsTrigger value="email-list">
                  <UsersRound className="h-4 w-4 mr-2" />
                  Email List
                </TabsTrigger>
                <TabsTrigger value="teaser">
                  <FileText className="h-4 w-4 mr-2" />
                  Teaser Pages
                </TabsTrigger>
                <TabsTrigger value="segments">
                  <Layers className="h-4 w-4 mr-2" />
                  Segments
                </TabsTrigger>
              </TabsList>
              {/* Row 4: Data, Surveys & Settings */}
              <TabsList className="mb-6 h-auto gap-1 p-2 bg-muted/50 justify-center">
                <TabsTrigger value="counts">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Counts
                </TabsTrigger>
                <TabsTrigger value="export">
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </TabsTrigger>
                <TabsTrigger value="survey-builder">
                  <FormInput className="h-4 w-4 mr-2" />
                  Survey Builder
                </TabsTrigger>
                <TabsTrigger value="manage-survey">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Manage Survey
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="account">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Account
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab stats={stats} backers={backers} timeline={timeline} projectId={selectedProjectId} onSwitchTab={setActiveTab} />
              </TabsContent>

              <TabsContent value="backers">
                <BackersTab
                  backers={backers}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  selectedBackers={selectedBackers}
                  onToggleBackerSelection={toggleBackerSelection}
                  onSelectAllBackers={selectAllBackers}
                  onOpenBackerDetail={openBackerDetail}
                  onPushSelectedOrders={pushSelectedOrders}
                  hasActiveCampaign={hasActiveCampaign}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="addons">
                <AddonsTab
                  stats={stats}
                  backers={backers}
                  surveyAddons={surveyAddons}
                  onOpenAddonDialog={() => setIsAddonDialogOpen(true)}
                  onOpenImportDialog={() => setIsImportDialogOpen(true)}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                  onEditAddon={(addon) => {
                    setEditingAddon(addon);
                    setIsAddonDialogOpen(true);
                  }}
                />
              </TabsContent>

              <TabsContent value="packages">
                <PackagesTab
                  packageGroups={packageGroups}
                  packageGroupFilter={packageGroupFilter}
                  onPackageGroupFilterChange={setPackageGroupFilter}
                  hasActiveCampaign={hasActiveCampaign}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="shipping">
                <ShippingTab shippingServices={shippingServices} projectId={selectedProjectId} onRefresh={fetchData} />
              </TabsContent>

              <TabsContent value="digital">
                <DigitalTab
                  stats={stats}
                  digitalFiles={digitalFiles}
                  distributionRules={distributionRules}
                  onOpenUploadDialog={() => setIsUploadDialogOpen(true)}
                  onOpenDistributionDialog={() => setIsDistributionDialogOpen(true)}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="preorders">
                <PreOrdersTab stats={stats} hasActiveCampaign={hasActiveCampaign} />
              </TabsContent>

              <TabsContent value="emails">
                <EmailsTab
                  emailCampaigns={emailCampaigns}
                  onOpenEmailDialog={(template) => {
                    setEmailTemplate(template || null);
                    setIsEmailDialogOpen(true);
                  }}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                />
              </TabsContent>

              <TabsContent value="teaser">
                <TeaserPagesTab hasActiveCampaign={hasActiveCampaign} projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="email-list">
                <EmailListTab projectId={selectedProjectId} hasActiveCampaign={hasActiveCampaign} />
              </TabsContent>

              <TabsContent value="projects">
                <ProjectsTab
                  projects={projects}
                  hasActiveCampaign={hasActiveCampaign}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={(projectId) => {
                    setSelectedProjectId(projectId);
                    localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
                  }}
                />
              </TabsContent>

              <TabsContent value="segments">
                <SegmentsTab segments={segments} projectId={selectedProjectId} onRefresh={fetchData} />
              </TabsContent>

              <TabsContent value="export">
                <ExportTab projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="sku-mapping">
                <SkuMappingTab projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="timeline">
                <TimelineTab entries={timeline} projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="updates">
                <UpdatesTab
                  projectId={selectedProjectId}
                  projectName={projects.find(p => p.id === selectedProjectId)?.title}
                  hasActiveCampaign={hasActiveCampaign}
                />
              </TabsContent>

              <TabsContent value="counts">
                <CountsTab
                  totalBackers={stats?.totalBackers}
                  surveysDone={stats?.surveysCompleted}
                  preOrders={stats?.preOrderBackers}
                  backersWithAddons={stats?.backersWithAddons}
                  totalAddonItems={stats?.totalAddonItems}
                  pledgeLevelBreakdown={stats?.pledgeLevelBreakdown}
                  surveyStatusBreakdown={stats?.surveyStatusBreakdown}
                  shippingRegionBreakdown={stats?.shippingRegionBreakdown}
                  paymentStatusBreakdown={stats?.paymentStatusBreakdown}
                />
              </TabsContent>

              <TabsContent value="support">
                <SupportTab backers={backers} projectId={selectedProjectId} onRefresh={fetchData} />
              </TabsContent>

              <TabsContent value="survey-builder">
                <SurveyBuilderTab projectId={selectedProjectId} questions={surveyQuestions} />
              </TabsContent>

              <TabsContent value="manage-survey">
                <ManageSurveyTab projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="settings">
                <SettingsTab
                  projectName={projects.find(p => p.id === selectedProjectId)?.title}
                />
              </TabsContent>

              <TabsContent value="products">
                <ProductsTab products={products} projectId={selectedProjectId} />
              </TabsContent>

              <TabsContent value="account">
                <AccountSettingsTab />
              </TabsContent>

              <TabsContent value="inbox">
                <InboxTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <BackerDialog
        open={isBackerDialogOpen}
        onOpenChange={setIsBackerDialogOpen}
        backer={selectedBacker}
        availableAddons={addons}
        onRefresh={fetchData}
      />

      <UploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        projectId={selectedProjectId}
        onUploaded={() => fetchData()}
      />

      <EmailDialog
        open={isEmailDialogOpen}
        onOpenChange={(open) => {
          setIsEmailDialogOpen(open);
          if (!open) setEmailTemplate(null);
        }}
        projects={projects}
        selectedProjectId={selectedProjectId}
        memberCount={emailMemberCount}
        userEmail={userEmail}
        onImportComplete={() => fetchData()}
        initialTemplate={emailTemplate}
      />

      <AddonDialog
        open={isAddonDialogOpen}
        onOpenChange={(open) => {
          setIsAddonDialogOpen(open);
          if (!open) setEditingAddon(null);
        }}
        editingAddon={editingAddon}
        projectId={selectedProjectId}
        onSave={() => {
          fetchData();
          setIsAddonDialogOpen(false);
          setEditingAddon(null);
        }}
      />

      <ImportAddonFromProjectDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        projectId={selectedProjectId}
        existingAddonIds={surveyAddons.map((a) => a.id)}
        onImported={() => {
          fetchData();
          setIsImportDialogOpen(false);
        }}
      />

      <DistributionDialog
        open={isDistributionDialogOpen}
        onOpenChange={setIsDistributionDialogOpen}
        digitalFiles={digitalFiles}
        projectId={selectedProjectId}
        rewards={rewards}
        addons={addons}
        onCreated={() => fetchData()}
      />

      <NPSFeedbackDialog
        open={isNPSDialogOpen}
        onOpenChange={setIsNPSDialogOpen}
        onSubmit={(score, feedback) => {
          console.log("NPS Score:", score, "Feedback:", feedback);
          toast.success("Thank you for your feedback!");
        }}
      />

      {/* Charge Cards Preview Dialog */}
      <Dialog open={isChargePreviewOpen} onOpenChange={setIsChargePreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-600" />
              Charge Cards Preview
            </DialogTitle>
            <DialogDescription>
              Review additional charges before processing. These are for add-ons and extras purchased through the survey, not the original pledge amounts.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            // Calculate backers with add-ons that need charging
            const backersToCharge = backers.filter(b =>
              b.addons && b.addons.length > 0 && b.chargeStatus !== "charged"
            );
            const totalAddonsAmount = backersToCharge.reduce((sum, b) =>
              sum + (b.addons?.reduce((s, a) => s + (a.amount * a.quantity), 0) || 0), 0
            );

            if (backersToCharge.length === 0) {
              return (
                <div className="py-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-2">No Additional Charges Needed</h3>
                  <p className="text-sm text-muted-foreground">
                    All backers have been charged for their add-ons, or no add-ons were purchased.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* Summary */}
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{backersToCharge.length}</p>
                      <p className="text-xs text-muted-foreground">Backers to Charge</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{backersToCharge.reduce((sum, b) => sum + (b.addons?.length || 0), 0)}</p>
                      <p className="text-xs text-muted-foreground">Total Add-ons</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-teal-600">${totalAddonsAmount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Total to Charge</p>
                    </div>
                  </div>
                </div>

                {/* Info box */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-blue-800">
                    <p className="font-medium">What gets charged?</p>
                    <p className="mt-1">Only add-ons purchased through the survey. The original pledge amount was already collected when they backed the project.</p>
                  </div>
                </div>

                {/* Breakdown by backer */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Backer</TableHead>
                        <TableHead>Add-ons</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backersToCharge.slice(0, 10).map((backer) => {
                        const addonTotal = backer.addons?.reduce((s, a) => s + (a.amount * a.quantity), 0) || 0;
                        return (
                          <TableRow key={backer.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{backer.name}</p>
                                <p className="text-xs text-muted-foreground">{backer.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {backer.addons?.map((addon, idx) => (
                                  <div key={idx} className="text-muted-foreground">
                                    {addon.quantity}x {addon.name}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${addonTotal.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {backersToCharge.length > 10 && (
                    <div className="p-3 text-center text-sm text-muted-foreground border-t">
                      And {backersToCharge.length - 10} more backers...
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChargePreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={async () => {
                const backersToCharge = backers.filter(b =>
                  b.addons && b.addons.length > 0 && b.chargeStatus !== "charged"
                );
                if (backersToCharge.length === 0) {
                  setIsChargePreviewOpen(false);
                  return;
                }

                setWorkflowActionLoading("charge_cards");
                try {
                  const res = await fetch("/api/creator/indiekit/backers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
                    body: JSON.stringify({
                      action: "charge_cards",
                      pledgeIds: backersToCharge.map(b => b.id),
                      projectId: selectedProjectId,
                    }),
                  });

                  const data = await res.json();

                  if (!res.ok) {
                    throw new Error(data.error || "Failed to charge cards");
                  }

                  toast.success(`Successfully charged ${data.results?.success || backersToCharge.length} backers`);
                  fetchData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to charge cards");
                } finally {
                  setWorkflowActionLoading(null);
                  setIsChargePreviewOpen(false);
                }
              }}
              disabled={workflowActionLoading === "charge_cards" || backers.filter(b => b.addons && b.addons.length > 0 && b.chargeStatus !== "charged").length === 0}
            >
              {workflowActionLoading === "charge_cards" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Confirm & Charge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
