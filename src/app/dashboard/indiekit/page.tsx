"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  Package,
  Users,
  DollarSign,
  Truck,
  Check,
  Loader2,
  Bell,
  Settings,
  LayoutDashboard,
  Mail,
  FileText,
  CreditCard,
  AlertCircle,
  ClipboardCheck,
  PackageCheck,
  Download,
  Box,
  BarChart3,
  TrendingUp,
  UserCircle,
  FolderKanban,
  FormInput,
  Lock,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

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
  FulfillmentPhase,
  AlwaysAvailableTab,
  PhaseTab,
  TimelineEntry,
  Segment,
  Product,
  SurveyQuestion,
} from "./types";
import { WORKFLOW_STEPS, SHIPPING_SERVICES } from "./constants";
import { SELECTED_PROJECT_KEY, useInitialProjectId } from "./constants";

// Import dialogs directly from v1
import {
  BackerDialog,
  UploadDialog,
  EmailDialog,
  AddonDialog,
  DistributionDialog,
  NPSFeedbackDialog,
} from "./components/dialogs";

// Import WhatsNextBanner from v1
import { WhatsNextBanner } from "./components/whats-next-banner";

// Import layout components
import { PhaseSelector } from "./components/layout/PhaseSelector";
import { WorkflowProgress } from "./components/layout/WorkflowProgress";

// Import v1 tabs that are used directly (not merged)
import {
  BackersTab,
  UpdatesTab,
  SettingsTab,
  AccountSettingsTab,
  ProjectsTab,
  TeaserPagesTab,
  PreOrdersTab,
} from "./components/tabs";

// Import v2 merged tabs
import { DashboardTab } from "./components/tabs/DashboardTab";
import { EmailMarketingTab } from "./components/tabs/EmailMarketingTab";
import { SetupTab } from "./components/tabs/SetupTab";
import { SurveysTab } from "./components/tabs/SurveysTab";
import { FinalizeTab } from "./components/tabs/FinalizeTab";
import { OrderLockTab } from "./components/tabs/OrderLockTab";
import { PaymentsTab } from "./components/tabs/PaymentsTab";
import { DigitalDeliveryTab } from "./components/tabs/DigitalDeliveryTab";
import { PhysicalDeliveryTab } from "./components/tabs/PhysicalDeliveryTab";
import { ReportsTab } from "./components/tabs/ReportsTab";
import { RefundRequestsTab } from "./components/tabs/RefundRequestsTab";
import { HelpTipsProvider, HelpTipsToggle, HelpTooltip } from "@/components/help/help-tooltip";

// Always-available tab config
const ALWAYS_AVAILABLE_TABS: { id: AlwaysAvailableTab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "backers", label: "Backers", icon: Users },
  { id: "email-marketing", label: "Email Marketing", icon: Mail },
  { id: "updates", label: "Updates", icon: FileText },
  { id: "refund-requests", label: "Refund Requests", icon: ReceiptText },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "account", label: "Account", icon: UserCircle },
  { id: "projects", label: "Projects", icon: FolderKanban },
];

// Phase tab configs
const PRE_FULFILLMENT_TABS: { id: PhaseTab; label: string; icon: React.ElementType }[] = [
  { id: "setup", label: "Setup", icon: FormInput },
  { id: "surveys", label: "Surveys", icon: ClipboardCheck },
  { id: "order-lock", label: "Order Lock", icon: PackageCheck },
  { id: "finalize", label: "Finalize", icon: Lock },
  { id: "teaser-pages", label: "Teaser Pages", icon: FileText },
];

const FULFILLMENT_TABS: { id: PhaseTab; label: string; icon: React.ElementType }[] = [
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "digital-delivery", label: "Digital Delivery", icon: Download },
  { id: "physical-delivery", label: "Physical Delivery", icon: Box },
];

const POST_FULFILLMENT_TABS: { id: PhaseTab; label: string; icon: React.ElementType }[] = [
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "late-backers", label: "Late Backers", icon: TrendingUp },
];

// Short hover blurbs per tab; "Show more" deep-links to the matching
// IndieKit-handbook section (?tab=<id> — ids match the handbook's).
const TAB_TIPS: Record<string, string> = {
  "dashboard": "Your home base — stats, timeline, and the What's Next banner telling you the next step.",
  "backers": "Every backer's pledge, survey status, add-ons, and shipping details in one list.",
  "email-marketing": "Send marketing campaigns, manage your subscriber list, and build segments.",
  "updates": "Post progress updates that notify all your backers.",
  "refund-requests": "Review and approve or decline backer refund requests.",
  "settings": "Shipping-carrier keys, integrations, and fulfillment preferences.",
  "account": "Your creator account, email username, and payout details.",
  "projects": "Switch between your projects and see which phase each one is in.",
  "setup": "Configure items, SKUs, and shipping options before surveys go out.",
  "surveys": "Build and send the backer survey that collects addresses and add-on picks.",
  "order-lock": "Ask backers to confirm & lock their orders early so you can charge and ship sooner.",
  "finalize": "Close out surveys and freeze the final order list for production.",
  "teaser-pages": "Public coming-soon pages that collect interest for your next campaign.",
  "payments": "Charge cards on file — survey balances, shipping differences, and extra items.",
  "digital-delivery": "Upload digital files and distribute them to the backers entitled to them.",
  "physical-delivery": "Push orders to shipping carriers, print labels, and track what's shipped.",
  "printing-comics": "Order print runs and hard-copy proofs for your book.",
  "reports": "Totals, item counts, and exports for production and accounting.",
  "late-backers": "Accept late pledges after your campaign has ended.",
};
const tabHelpHref = (id: string) => `/indiekit-handbook?tab=${id}`;

// Workflow steps that freeze backer data — these require an explicit
// confirmation before running because reversing them isn't a single click.
const WORKFLOW_CONFIRM_COPY: Record<string, { title: string; body: string; cta: string }> = {
  lock_orders: {
    title: "Lock all orders?",
    body: "This finalizes every backer's reward and add-on selections so they can no longer change their order. Only do this once your survey window has closed.",
    cta: "Lock Orders",
  },
  lock_addresses: {
    title: "Lock all shipping addresses?",
    body: "This finalizes every backer's shipping address so they can no longer update where their rewards are sent. Do this just before you push orders to fulfillment.",
    cta: "Lock Addresses",
  },
};

export default function IndieKitPage() {
  const searchParams = useSearchParams();
  const initialProjectId = useInitialProjectId();
  // Navigation state
  const [activeSection, setActiveSection] = useState<"always" | "phase">("always");
  const [activeAlwaysTab, setActiveAlwaysTab] = useState<AlwaysAvailableTab>("dashboard");
  const [activePhase, setActivePhase] = useState<FulfillmentPhase>("pre-fulfillment");
  const [activePhaseTab, setActivePhaseTab] = useState<PhaseTab>("setup");

  // Data state - same as v1
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [stats, setStats] = useState<FulfillmentStats | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(WORKFLOW_STEPS);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
  const [shippingServices] = useState<ShippingService[]>(SHIPPING_SERVICES);
  const [digitalFiles, setDigitalFiles] = useState<DigitalFile[]>([]);
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [emailMemberCount, setEmailMemberCount] = useState<number>(0);
  const [userEmail, setUserEmail] = useState<string>("");
  const [surveyAddons, setSurveyAddons] = useState<SurveyAddon[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rewards, setRewards] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [addons, setAddons] = useState<{ id: string; name: string; price: number }[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [userRole, setUserRole] = useState<string>("USER");
  const [hasApprovedProject, setHasApprovedProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBackers, setSelectedBackers] = useState<string[]>([]);
  const [packageGroupFilter, setPackageGroupFilter] = useState<string>("all");
  const [workflowActionLoading, setWorkflowActionLoading] = useState<string | null>(null);
  const [backersPage, setBackersPage] = useState(1);
  const [backersTotalPages, setBackersTotalPages] = useState(1);
  const [backersTotalCount, setBackersTotalCount] = useState(0);

  // Dialog state
  const [isBackerDialogOpen, setIsBackerDialogOpen] = useState(false);
  const [selectedBacker, setSelectedBacker] = useState<Backer | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<{ subject?: string; body?: string; name?: string } | null>(null);
  const [isAddonDialogOpen, setIsAddonDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<SurveyAddon | null>(null);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
  const [isNPSDialogOpen, setIsNPSDialogOpen] = useState(false);
  const [isChargePreviewOpen, setIsChargePreviewOpen] = useState(false);
  const [confirmStepId, setConfirmStepId] = useState<string | null>(null);

  // Computed
  const hasActiveCampaign = projects.some(p =>
    ["ACTIVE", "FUNDED", "COMPLETED", "FULFILLING", "LIVE"].includes(p.status) ||
    p.prelaunchActive === true
  ) || backers.length > 0;

  // Email access is locked unless creator has an approved prelaunch page or campaign (super admins always have access)
  const emailAccessLocked = userRole !== "SUPER_ADMIN" && !hasApprovedProject;

  const fulfillmentPercent = stats ? (stats.fulfilledBackers / stats.totalBackers) * 100 : 0;

  // Debounce search query to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredBackers = useMemo(() => {
    const query = debouncedSearchQuery.toLowerCase();
    return backers.filter((backer) => {
      const matchesSearch = !query ||
        backer.name.toLowerCase().includes(query) ||
        backer.email.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || backer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [backers, debouncedSearchQuery, statusFilter]);

  // Data fetching - same as v1
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      // Pull every backer for the project. The Backers tab filters,
      // bulk-acts, segments, and exports — all of which need the full
      // set in memory. Server-side pagination here was the root cause
      // of the "filter by foil addon shows 1 of 6 backers" bug: the
      // missing 5 sat on pages the client never fetched.
      params.set("backersLimit", "0");

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
      if (data.backersPagination) {
        setBackersTotalPages(data.backersPagination.totalPages);
        setBackersTotalCount(data.backersPagination.total);
      }
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
      setSurveyQuestions(data.surveyQuestions || []);
      setUserRole(data.userRole || "USER");
      setHasApprovedProject(data.hasApprovedProject ?? false);

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
  }, [selectedProjectId, backersPage]);

  useEffect(() => {
    // Priority: prop from parent (when embedded) > URL param > localStorage
    const urlProject = searchParams?.get("project");
    const savedProjectId = initialProjectId || urlProject || localStorage.getItem(SELECTED_PROJECT_KEY);
    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
      localStorage.setItem(SELECTED_PROJECT_KEY, savedProjectId);
    }
    setIsInitialized(true);
  }, [searchParams, initialProjectId]);

  useEffect(() => {
    if (isInitialized) {
      fetchData();
    }
  }, [fetchData, isInitialized]);

  // Deep-link handler: ?backer=<pledgeId> auto-opens the BackerDialog
  // for that specific pledge once backers have loaded. Used by the
  // messaging "click a transaction" flow. Fires once per pledgeId so a
  // refresh of `backers` (caused by paging / filtering) doesn't keep
  // re-opening the dialog after the user has closed it.
  const handledBackerDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    const target = searchParams?.get("backer");
    if (!target) return;
    if (handledBackerDeepLinkRef.current === target) return;
    if (backers.length === 0) return;
    const match = backers.find((b) => b.id === target);
    if (match) {
      handledBackerDeepLinkRef.current = target;
      setActiveAlwaysTab("backers");
      setSelectedBacker(match);
      setIsBackerDialogOpen(true);
    }
  }, [backers, searchParams]);

  // Runs a workflow action against the API. Confirmation (when required) is
  // handled by handleWorkflowAction before this is reached.
  const executeWorkflowAction = async (stepId: string) => {
    if (!selectedProjectId) return;

    const actionMap: Record<string, { action: string; successMsg: string; errorMsg: string }> = {
      lock_orders: { action: "lock_orders", successMsg: "Orders locked successfully", errorMsg: "Failed to lock orders" },
      lock_addresses: { action: "lock_addresses", successMsg: "Addresses locked successfully", errorMsg: "Failed to lock addresses" },
      start_shipping: { action: "push_to_fulfillment", successMsg: "Orders pushed to fulfillment", errorMsg: "Failed to push orders" },
      shipped: { action: "mark_shipped", successMsg: "Orders marked as shipped", errorMsg: "Failed to mark orders as shipped" },
    };

    const actionConfig = actionMap[stepId];
    if (!actionConfig) return;

    const pledgeIds = backers.map(b => b.id);
    if (pledgeIds.length === 0) {
      toast.info("No backers to process");
      return;
    }

    setWorkflowActionLoading(stepId);
    try {
      const res = await apiFetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action: actionConfig.action, pledgeIds, projectId: selectedProjectId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || actionConfig.errorMsg);

      toast.success(`${actionConfig.successMsg} (${data.results?.success || pledgeIds.length} backers)`);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : actionConfig.errorMsg);
    } finally {
      setWorkflowActionLoading(null);
    }
  };

  // Workflow action handler - dispatches based on the step.
  const handleWorkflowAction = async (stepId: string) => {
    if (!selectedProjectId || workflowActionLoading) return;

    if (stepId === "charge_cards") {
      setIsChargePreviewOpen(true);
      return;
    }

    if (stepId === "surveys") {
      setActiveSection("always");
      setActiveAlwaysTab("email-marketing");
      return;
    }

    // Lock steps freeze backer data — confirm before running.
    if (WORKFLOW_CONFIRM_COPY[stepId]) {
      setConfirmStepId(stepId);
      return;
    }

    await executeWorkflowAction(stepId);
  };

  // Backer handlers
  const toggleBackerSelection = (backerId: string) => {
    setSelectedBackers((prev) => prev.includes(backerId) ? prev.filter((id) => id !== backerId) : [...prev, backerId]);
  };

  const selectAllBackers = () => {
    if (selectedBackers.length === filteredBackers.length) {
      setSelectedBackers([]);
    } else {
      setSelectedBackers(filteredBackers.map((b) => b.id));
    }
  };

  const openBackerDetail = (backer: Backer) => {
    setSelectedBacker(backer);
    setIsBackerDialogOpen(true);
  };

  const pushSelectedOrders = async () => {
    if (selectedBackers.length === 0) {
      toast.error("Please select orders to push");
      return;
    }
    toast.success(`Pushing ${selectedBackers.length} orders to fulfillment...`);
  };

  // Handle navigating from the workflow sidebar
  const handleNavigateFromWorkflow = (tab: string) => {
    // Map v1 tab names to v2 navigation
    const mapping: Record<string, { section: "always" | "phase"; alwaysTab?: AlwaysAvailableTab; phase?: FulfillmentPhase; phaseTab?: PhaseTab }> = {
      emails: { section: "always", alwaysTab: "email-marketing" },
      backers: { section: "always", alwaysTab: "backers" },
      packages: { section: "phase", phase: "fulfillment", phaseTab: "physical-delivery" },
    };

    const target = mapping[tab];
    if (target) {
      setActiveSection(target.section);
      if (target.section === "always" && target.alwaysTab) {
        setActiveAlwaysTab(target.alwaysTab);
      } else if (target.section === "phase" && target.phase && target.phaseTab) {
        setActivePhase(target.phase);
        setActivePhaseTab(target.phaseTab);
      }
    }
  };

  // Phase tab selection
  const handleSelectPhaseTab = (tab: PhaseTab) => {
    setActiveSection("phase");
    setActivePhaseTab(tab);
  };

  const handleSelectAlwaysTab = (tab: AlwaysAvailableTab) => {
    setActiveSection("always");
    setActiveAlwaysTab(tab);
  };

  // Get current phase tabs
  const currentPhaseTabs = activePhase === "pre-fulfillment" ? PRE_FULFILLMENT_TABS
    : activePhase === "fulfillment" ? FULFILLMENT_TABS
    : POST_FULFILLMENT_TABS;

  // Set default phase tab when phase changes
  const handlePhaseChange = (phase: FulfillmentPhase) => {
    setActivePhase(phase);
    setActiveSection("phase");
    const tabs = phase === "pre-fulfillment" ? PRE_FULFILLMENT_TABS
      : phase === "fulfillment" ? FULFILLMENT_TABS
      : POST_FULFILLMENT_TABS;
    setActivePhaseTab(tabs[0].id);
  };

  if (loading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading IndieKit">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading IndieKit...</p>
        </div>
      </div>
    );
  }

  return (
    <HelpTipsProvider surface="indiekit">
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-teal-500/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-teal-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-primary/10 top-1/2 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-purple-500/10 bottom-20 right-1/3" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href={`/dashboard?project=${selectedProjectId}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              <h1 className="text-base sm:text-lg font-semibold">IndieKit</h1>
              <Badge className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 text-xs">2.0</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Select value={selectedProjectId} onValueChange={(value) => {
              setSelectedProjectId(value);
              localStorage.setItem(SELECTED_PROJECT_KEY, value);
            }}>
              <SelectTrigger className="w-[140px] sm:w-[180px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={() => setIsNPSDialogOpen(true)} aria-label="Give feedback" title="Give feedback">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={() => handleSelectAlwaysTab("settings")} aria-label="Settings" title="Settings">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Left Sidebar - Workflow Progress */}
          <div className="lg:col-span-1">
            <WorkflowProgress
              workflowSteps={workflowSteps}
              stats={stats}
              backers={backers}
              workflowActionLoading={workflowActionLoading}
              onWorkflowAction={handleWorkflowAction}
              onNavigateToTab={handleNavigateFromWorkflow}
              onGiveFeedback={() => setIsNPSDialogOpen(true)}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Stats Overview Cards */}
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
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
                  <p className="text-2xl font-bold mt-1">${(stats?.postSurveyAddonRevenue || 0).toLocaleString()}</p>
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
                  onViewProjects={() => handleSelectAlwaysTab("projects")}
                />
              </div>
            )}

            {/* Always Available Navigation Bar */}
            <div className="mb-4 flex flex-wrap items-center gap-1 p-2 rounded-xl bg-muted/50 border border-border">
              {ALWAYS_AVAILABLE_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSection === "always" && activeAlwaysTab === tab.id;
                return (
                  <HelpTooltip key={tab.id} tip={TAB_TIPS[tab.id] || tab.label} href={tabHelpHref(tab.id)}>
                    <button
                      onClick={() => handleSelectAlwaysTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-background shadow-sm font-medium text-foreground border border-foreground/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50 border border-transparent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  </HelpTooltip>
                );
              })}
              <HelpTipsToggle className="ml-auto pl-2" />
            </div>

            {/* Phase Selector & Phase Tabs */}
            <div className="mb-4 space-y-3">
              <PhaseSelector activePhase={activePhase} onPhaseChange={handlePhaseChange} isPhaseActive={activeSection === "phase"} />

              {/* Phase Sub-tabs */}
              <div className="flex gap-1 p-1.5 rounded-lg bg-muted/30 border border-border">
                {currentPhaseTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeSection === "phase" && activePhaseTab === tab.id;
                  return (
                    <HelpTooltip key={tab.id} tip={TAB_TIPS[tab.id] || tab.label} href={tabHelpHref(tab.id)}>
                      <button
                        onClick={() => handleSelectPhaseTab(tab.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors flex-1 justify-center",
                          isActive
                            ? "bg-background shadow-sm font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    </HelpTooltip>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {/* Always Available Tabs */}
              {activeSection === "always" && activeAlwaysTab === "dashboard" && (
                <DashboardTab
                  stats={stats}
                  backers={backers}
                  timeline={timeline}
                  projectId={selectedProjectId}
                  onSwitchTab={(tab) => {
                    // Map v1 tab switches to v2
                    const alwaysMapping: Record<string, AlwaysAvailableTab> = {
                      backers: "backers",
                      emails: "email-marketing",
                      updates: "updates",
                      settings: "settings",
                    };
                    if (alwaysMapping[tab]) {
                      handleSelectAlwaysTab(alwaysMapping[tab]);
                    }
                  }}
                />
              )}

              {activeSection === "always" && activeAlwaysTab === "backers" && (
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
                  currentPage={backersPage}
                  totalPages={backersTotalPages}
                  totalCount={backersTotalCount}
                  onPageChange={setBackersPage}
                />
              )}

              {activeSection === "always" && activeAlwaysTab === "email-marketing" && (
                <EmailMarketingTab
                  emailCampaigns={emailCampaigns}
                  onOpenEmailDialog={(template) => {
                    setEmailTemplate(template || null);
                    setIsEmailDialogOpen(true);
                  }}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                  segments={segments}
                  hasActiveCampaign={hasActiveCampaign}
                  emailAccessLocked={emailAccessLocked}
                />
              )}

              {activeSection === "always" && activeAlwaysTab === "updates" && (
                <UpdatesTab
                  projectId={selectedProjectId}
                  projectName={projects.find(p => p.id === selectedProjectId)?.title}
                  hasActiveCampaign={hasActiveCampaign}
                />
              )}

              {activeSection === "always" && activeAlwaysTab === "settings" && (
                <SettingsTab projectName={projects.find(p => p.id === selectedProjectId)?.title} />
              )}

              {activeSection === "always" && activeAlwaysTab === "account" && (
                <AccountSettingsTab />
              )}

              {activeSection === "always" && activeAlwaysTab === "refund-requests" && (
                <RefundRequestsTab projectId={selectedProjectId} />
              )}

              {activeSection === "always" && activeAlwaysTab === "projects" && (
                <ProjectsTab
                  projects={projects}
                  hasActiveCampaign={hasActiveCampaign}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={(projectId) => {
                    setSelectedProjectId(projectId);
                    localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
                  }}
                />
              )}

              {/* Pre-Fulfillment Phase Tabs */}
              {activeSection === "phase" && activePhaseTab === "setup" && (
                <SetupTab
                  products={products}
                  projectId={selectedProjectId}
                />
              )}

              {activeSection === "phase" && activePhaseTab === "surveys" && (
                <SurveysTab
                  emailCampaigns={emailCampaigns}
                  onOpenEmailDialog={(template) => {
                    setEmailTemplate(template || null);
                    setIsEmailDialogOpen(true);
                  }}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                  surveyQuestions={surveyQuestions}
                  stats={stats}
                  backers={backers}
                  surveyAddons={surveyAddons}
                  onOpenAddonDialog={() => setIsAddonDialogOpen(true)}
                  onEditAddon={(addon) => {
                    setEditingAddon(addon);
                    setIsAddonDialogOpen(true);
                  }}
                />
              )}

              {activeSection === "phase" && activePhaseTab === "order-lock" && (
                <OrderLockTab
                  projectId={selectedProjectId}
                  backers={backers}
                  onOpenBackerDetail={openBackerDetail}
                />
              )}

              {activeSection === "phase" && activePhaseTab === "finalize" && (
                <FinalizeTab
                  stats={stats}
                  backers={backers}
                  workflowActionLoading={workflowActionLoading}
                  onWorkflowAction={handleWorkflowAction}
                />
              )}

              {/* Fulfillment Phase Tabs */}
              {activeSection === "phase" && activePhaseTab === "payments" && (
                <PaymentsTab
                  stats={stats}
                  onOpenChargePreview={() => setIsChargePreviewOpen(true)}
                />
              )}

              {activeSection === "phase" && activePhaseTab === "digital-delivery" && (
                <DigitalDeliveryTab
                  stats={stats}
                  digitalFiles={digitalFiles}
                  distributionRules={distributionRules}
                  onOpenUploadDialog={() => setIsUploadDialogOpen(true)}
                  onOpenDistributionDialog={() => setIsDistributionDialogOpen(true)}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                />
              )}

              {activeSection === "phase" && activePhaseTab === "physical-delivery" && (
                <PhysicalDeliveryTab
                  packageGroups={packageGroups}
                  packageGroupFilter={packageGroupFilter}
                  onPackageGroupFilterChange={setPackageGroupFilter}
                  shippingServices={shippingServices}
                  hasActiveCampaign={hasActiveCampaign}
                  projectId={selectedProjectId}
                  onRefresh={fetchData}
                />
              )}

              {/* Post-Fulfillment Phase Tabs */}
              {activeSection === "phase" && activePhaseTab === "reports" && (
                <ReportsTab
                  timeline={timeline}
                  projectId={selectedProjectId}
                  stats={stats}
                />
              )}

              {activeSection === "phase" && activePhaseTab === "teaser-pages" && (
                <TeaserPagesTab hasActiveCampaign={hasActiveCampaign} projectId={selectedProjectId} />
              )}

              {activeSection === "phase" && activePhaseTab === "late-backers" && (
                <PreOrdersTab stats={stats} hasActiveCampaign={hasActiveCampaign} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs - reused from v1 */}
      {/* key forces a clean remount whenever the active backer changes so
          internal state (active tab, pending modifier assignments, edit
          flags, fetched survey data) can't leak from a previous backer's
          dialog session into this one. */}
      <BackerDialog
        key={selectedBacker?.id ?? "empty"}
        open={isBackerDialogOpen}
        onOpenChange={setIsBackerDialogOpen}
        backer={selectedBacker}
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
        onSubmit={async (score, feedback) => {
          try {
            const res = await apiFetch("/api/creator/indiekit/feedback", {
              method: "POST",
              headers: { "Content-Type": "application/json", },
              body: JSON.stringify({ score, feedback, projectId: selectedProjectId }),
            });
            if (!res.ok) throw new Error("Failed to submit feedback");
            toast.success("Thank you for your feedback!");
          } catch {
            toast.error("Failed to submit feedback. Please try again.");
          }
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
              Review additional charges before processing.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            // Filter to backers who actually owe more than was already
            // collected — survey-time add-ons / shipping upgrades.
            // The old filter (`addons.length > 0 && chargeStatus !==
            // "charged"`) was way too loose — every backer who had
            // ever ordered an add-on matched, including the ones who
            // paid for those add-ons at original pledge time. On the
            // Mandawhorian campaign this turned a "Charge 2 Cards"
            // button into a 28-backer / $3325 confirmation dialog,
            // and clicking it would have routed 51 abandoned-cart
            // PENDING DC pledges through chargeSavedPledge, which
            // marks rows with no saved payment method as FAILED,
            // decrements project totals, and emails backers.
            // Now we mirror chargeStats.notCharged exactly: filter
            // strictly on balanceDue > 0 (the same value the
            // "Charge N Cards" button label is computed from).
            const backersToCharge = backers.filter(
              (b) => b.chargeStatus !== "charged" && b.balance.balanceDue > 0
            );
            const totalAddonsAmount = backersToCharge.reduce(
              (sum, b) => sum + b.balance.balanceDue,
              0
            );

            if (backersToCharge.length === 0) {
              return (
                <div className="py-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-2">No Additional Charges Needed</h3>
                  <p className="text-sm text-muted-foreground">All backers have been charged or no add-ons purchased.</p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/30">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{backersToCharge.length}</p>
                      <p className="text-xs text-muted-foreground">Backers to Charge</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {/*
                          Sum addon QUANTITIES, not entry count. "2x Upgrade
                          to Foil" should count as 2 items, not 1.
                        */}
                        {backersToCharge.reduce(
                          (sum, b) =>
                            sum +
                            (b.addons?.reduce(
                              (s, a) => s + (Number(a.quantity) || 0),
                              0
                            ) || 0),
                          0
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Add-ons</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-teal-600">${totalAddonsAmount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Total to Charge</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-blue-800 dark:text-blue-300">Only add-ons purchased through the survey. Original pledge amounts were already collected.</p>
                </div>

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
                      {backersToCharge.map((backer) => {
                        // Surface a line for every contributor to the
                        // balance, not just addons. If the balance is
                        // sourced from a shipping upgrade or a reward-
                        // tier change (legitimate IndieKit edit), show
                        // it so the creator isn't staring at a blank
                        // "Add-ons" column wondering where the dollar
                        // amount came from.
                        const addonsTotal = (backer.addons || []).reduce(
                          (s, a) => s + Number(a.amount) * Number(a.quantity || 1),
                          0
                        );
                        const nonAddonBalance =
                          Math.round((backer.balance.balanceDue - addonsTotal) * 100) / 100;
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
                                {nonAddonBalance > 0.005 && (
                                  <div className="text-muted-foreground italic">
                                    Other charges (reward / shipping): ${nonAddonBalance.toFixed(2)}
                                  </div>
                                )}
                                {(backer.addons || []).length === 0 &&
                                  nonAddonBalance <= 0.005 && (
                                    <div className="text-muted-foreground italic">
                                      (No itemized detail)
                                    </div>
                                  )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${backer.balance.balanceDue.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChargePreviewOpen(false)}>Cancel</Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={async () => {
                // Use the SAME filter as the preview popup so the
                // confirm action can never charge more pledges than
                // the dialog promised. balanceDue > 0 is the only
                // valid signal that a backer actually owes more.
                const backersToCharge = backers.filter(
                  (b) => b.chargeStatus !== "charged" && b.balance.balanceDue > 0
                );
                if (backersToCharge.length === 0) {
                  setIsChargePreviewOpen(false);
                  return;
                }

                setWorkflowActionLoading("charge_cards");
                try {
                  const res = await apiFetch("/api/creator/indiekit/backers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", },
                    body: JSON.stringify({
                      action: "charge_cards",
                      pledgeIds: backersToCharge.map(b => b.id),
                      projectId: selectedProjectId,
                      idempotencyKey: uuidv4(),
                    }),
                  });

                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to charge cards");

                  toast.success(`Successfully charged ${data.results?.success || backersToCharge.length} backers`);
                  fetchData();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to charge cards");
                } finally {
                  setWorkflowActionLoading(null);
                  setIsChargePreviewOpen(false);
                }
              }}
              disabled={
                workflowActionLoading === "charge_cards" ||
                backers.filter((b) => b.chargeStatus !== "charged" && b.balance.balanceDue > 0).length === 0
              }
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

      {/* Lock-step confirmation */}
      <AlertDialog
        open={confirmStepId !== null}
        onOpenChange={(open) => { if (!open) setConfirmStepId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              {confirmStepId ? WORKFLOW_CONFIRM_COPY[confirmStepId]?.title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStepId ? WORKFLOW_CONFIRM_COPY[confirmStepId]?.body : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const step = confirmStepId;
                setConfirmStepId(null);
                if (step) executeWorkflowAction(step);
              }}
            >
              {confirmStepId ? WORKFLOW_CONFIRM_COPY[confirmStepId]?.cta : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </HelpTipsProvider>
  );
}
