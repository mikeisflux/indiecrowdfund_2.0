"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Send,
  Lock,
  CreditCard,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  FileText,
  Link2,
  ExternalLink,
  Upload,
  Trash2,
  Eye,
  ChevronRight,
  Check,
  X,
  Play,
  Pause,
  LayoutDashboard,
  ClipboardList,
  Box,
  ShoppingCart,
  TrendingUp,
  ArrowRight,
  History,
  Tag,
  Banknote,
  UserPlus,
  UserCheck,
  Edit,
  Copy,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Types
interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface FulfillmentStats {
  totalBackers: number;
  fulfilledBackers: number;
  surveysCompleted: number;
  surveysPending: number;
  totalRaised: number;
  addOnPurchases: number;
  digitalDownloads: number;
  packagesShipped: number;
  // Charge breakdown
  chargeStats: {
    notCharged: number;
    errored: number;
    charged: number;
    paypalCollected: number;
  };
  // Pre-orders
  preOrderBackers: number;
  preOrderRevenue: number;
  returningBackers: number;
  newBackers: number;
}

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  status: "completed" | "in_progress" | "pending" | "locked";
  icon: React.ElementType;
}

interface Backer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  pledgeAmount: number;
  reward: string;
  rewardAmount: number;
  status: "not_pushed" | "push_errored" | "pushed" | "shipped";
  chargeStatus: "not_charged" | "errored" | "charged" | "paypal_collected";
  surveyCompleted: boolean;
  addressComplete: boolean;
  shippingAddress?: {
    name?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  // Balance breakdown
  balance: {
    pledgeAmount: number;
    pledgeLevelAmount: number;
    addonsAmount: number;
    shippingAmount: number;
    totalCharged: number;
    balanceDue: number;
  };
  items: { name: string; quantity: number; sku?: string }[];
  addons: { id: string; name: string; quantity: number; amount: number }[];
  digitalDownloads: { name: string; downloaded: boolean; distributedAt?: string }[];
  // For changelog/activity
  activity: { date: string; action: string; details?: string }[];
}

interface SurveyAddon {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  quantityLimit?: number;
  purchasedCount: number;
}

interface DistributionRule {
  id: string;
  name: string;
  condition: string; // "If [product] is in order"
  triggerProduct: string;
  distributeFile: string;
  requiresPayment: boolean;
  status: "not_started" | "started" | "completed";
  distributedCount: number;
  totalEligible: number;
  startedAt?: string;
}

interface PackageGroup {
  id: string;
  name: string;
  type: "domestic" | "international" | "incomplete";
  itemCount: number;
  backerCount: number;
  status: "pending" | "processing" | "shipped";
  statusCounts: {
    notPushed: number;
    pushErrored: number;
    pushed: number;
    shipped: number;
  };
  lastSentAt?: string;
  items: {
    name: string;
    quantity: number;
    weight: { lbs: number; oz: number };
    customsValid: boolean;
    sku?: string;
  }[];
  totalWeight: { lbs: number; oz: number };
}

interface ShippingService {
  id: string;
  name: string;
  connected: boolean;
  connectedAt?: string;
  icon: string;
}

interface DigitalFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  distributedTo: number;
  totalEligible: number;
}

interface EmailCampaign {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "sent";
  scheduledFor?: string;
  sentAt?: string;
  recipients: number;
  openRate?: number;
}

// Workflow steps configuration
const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "surveys", label: "Send & Remind", description: "Collect backer surveys", icon: Mail, status: "pending" },
  { id: "lock_orders", label: "Lock Orders", description: "Finalize backer selections", icon: Lock, status: "locked" },
  { id: "charge_cards", label: "Charge Cards", description: "Process additional payments", icon: CreditCard, status: "locked" },
  { id: "lock_addresses", label: "Lock Addresses", description: "Confirm shipping details", icon: MapPin, status: "locked" },
  { id: "start_shipping", label: "Start Shipping", description: "Push orders to fulfillment", icon: Truck, status: "locked" },
  { id: "shipped", label: "Shipped", description: "Mark orders as complete", icon: CheckCircle2, status: "locked" },
];

// Available shipping services
const SHIPPING_SERVICES: ShippingService[] = [
  { id: "shipstation", name: "ShipStation", connected: false, icon: "📦" },
  { id: "shippo", name: "Shippo", connected: false, icon: "🚚" },
  { id: "easypost", name: "EasyPost", connected: false, icon: "📬" },
  { id: "pirateship", name: "Pirate Ship", connected: false, icon: "🏴‍☠️" },
];

// Status colors
const STATUS_COLORS = {
  not_pushed: "bg-gray-100 text-gray-700",
  push_errored: "bg-red-100 text-red-700",
  pushed: "bg-yellow-100 text-yellow-700",
  shipped: "bg-green-100 text-green-700",
};

const STATUS_LABELS = {
  not_pushed: "Not Pushed",
  push_errored: "Push Errored",
  pushed: "Pushed",
  shipped: "Shipped",
};

export default function IndieKitPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [stats, setStats] = useState<FulfillmentStats | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(WORKFLOW_STEPS);
  const [backers, setBackers] = useState<Backer[]>([]);
  const [packageGroups, setPackageGroups] = useState<PackageGroup[]>([]);
  const [shippingServices, setShippingServices] = useState<ShippingService[]>(SHIPPING_SERVICES);
  const [digitalFiles, setDigitalFiles] = useState<DigitalFile[]>([]);
  const [distributionRules, setDistributionRules] = useState<DistributionRule[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [surveyAddons, setSurveyAddons] = useState<SurveyAddon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBackers, setSelectedBackers] = useState<string[]>([]);
  const [isBackerDialogOpen, setIsBackerDialogOpen] = useState(false);
  const [selectedBacker, setSelectedBacker] = useState<Backer | null>(null);
  const [backerDialogTab, setBackerDialogTab] = useState("order");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isAddonDialogOpen, setIsAddonDialogOpen] = useState(false);
  const [isDistributionDialogOpen, setIsDistributionDialogOpen] = useState(false);
  const [packageGroupFilter, setPackageGroupFilter] = useState<string>("all");

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
      setEmailCampaigns(data.emailCampaigns || []);

      if (!selectedProjectId && data.projects?.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }

      // Update workflow steps based on project state
      if (data.workflowState) {
        setWorkflowSteps(data.workflowState);
      }
    } catch (error) {
      console.error("IndieKit fetch error:", error);
      // Set demo data for development
      setDemoData();
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  // Set demo data for development/preview
  const setDemoData = () => {
    setProjects([
      { id: "1", title: "My Awesome Project", slug: "my-awesome-project", status: "FUNDED" },
    ]);
    setSelectedProjectId("1");
    setStats({
      totalBackers: 684,
      fulfilledBackers: 669,
      surveysCompleted: 650,
      surveysPending: 34,
      totalRaised: 125000,
      addOnPurchases: 8500,
      digitalDownloads: 595,
      packagesShipped: 420,
      chargeStats: {
        notCharged: 15,
        errored: 12,
        charged: 614,
        paypalCollected: 43,
      },
      preOrderBackers: 43,
      preOrderRevenue: 5720,
      returningBackers: 126,
      newBackers: 558,
    });
    setBackers([
      {
        id: "b1",
        name: "John Doe",
        email: "john@example.com",
        pledgeAmount: 150,
        reward: "Early Bird Special",
        rewardAmount: 100,
        status: "shipped",
        chargeStatus: "charged",
        surveyCompleted: true,
        addressComplete: true,
        shippingAddress: { name: "John Doe", line1: "123 Main St", city: "New York", state: "NY", country: "US", postalCode: "10001", phone: "555-1234" },
        balance: { pledgeAmount: 150, pledgeLevelAmount: 100, addonsAmount: 40, shippingAmount: 10, totalCharged: 150, balanceDue: 0 },
        items: [{ name: "Main Product", quantity: 1, sku: "MAIN-001" }, { name: "Add-on A", quantity: 2, sku: "ADDON-A" }],
        addons: [{ id: "a1", name: "Extra Sticker Pack", quantity: 2, amount: 20 }, { id: "a2", name: "Art Print", quantity: 1, amount: 20 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: true, distributedAt: "2024-01-16" }],
        activity: [{ date: "2024-01-20", action: "Order shipped", details: "Tracking: 1Z999AA10123456784" }, { date: "2024-01-16", action: "Survey completed" }, { date: "2024-01-10", action: "Pledge received" }],
      },
      {
        id: "b2",
        name: "Jane Smith",
        email: "jane@example.com",
        pledgeAmount: 250,
        reward: "Premium Bundle",
        rewardAmount: 200,
        status: "pushed",
        chargeStatus: "charged",
        surveyCompleted: true,
        addressComplete: true,
        shippingAddress: { name: "Jane Smith", line1: "456 Oak Ave", city: "Los Angeles", state: "CA", country: "US", postalCode: "90001" },
        balance: { pledgeAmount: 250, pledgeLevelAmount: 200, addonsAmount: 35, shippingAmount: 15, totalCharged: 250, balanceDue: 0 },
        items: [{ name: "Main Product", quantity: 1 }, { name: "Premium Add-on", quantity: 1 }],
        addons: [{ id: "a3", name: "Soundtrack Album", quantity: 1, amount: 35 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: false }, { name: "Soundtrack", downloaded: false }],
        activity: [{ date: "2024-01-18", action: "Pushed to ShipStation" }, { date: "2024-01-15", action: "Survey completed" }],
      },
      {
        id: "b3",
        name: "Bob Wilson",
        email: "bob@example.com",
        pledgeAmount: 75,
        reward: "Basic Tier",
        rewardAmount: 50,
        status: "not_pushed",
        chargeStatus: "not_charged",
        surveyCompleted: false,
        addressComplete: false,
        balance: { pledgeAmount: 75, pledgeLevelAmount: 50, addonsAmount: 15, shippingAmount: 10, totalCharged: 50, balanceDue: 25 },
        items: [{ name: "Main Product", quantity: 1 }],
        addons: [{ id: "a1", name: "Extra Sticker Pack", quantity: 1, amount: 15 }],
        digitalDownloads: [],
        activity: [{ date: "2024-01-10", action: "Pledge received" }],
      },
      {
        id: "b4",
        name: "Alice Brown",
        email: "alice@example.com",
        pledgeAmount: 500,
        reward: "Collector's Edition",
        rewardAmount: 400,
        status: "push_errored",
        chargeStatus: "errored",
        surveyCompleted: true,
        addressComplete: true,
        shippingAddress: { name: "Alice Brown", line1: "789 Pine Rd", city: "Chicago", state: "IL", country: "US", postalCode: "60601" },
        balance: { pledgeAmount: 500, pledgeLevelAmount: 400, addonsAmount: 75, shippingAmount: 25, totalCharged: 400, balanceDue: 100 },
        items: [{ name: "Collector's Set", quantity: 1 }, { name: "Exclusive Item", quantity: 1 }],
        addons: [{ id: "a4", name: "Signed Art Print", quantity: 1, amount: 75 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: true }, { name: "Soundtrack", downloaded: true }],
        activity: [{ date: "2024-01-19", action: "Push failed", details: "Invalid address format" }, { date: "2024-01-17", action: "Card charge failed" }],
      },
    ]);
    setPackageGroups([
      {
        id: "pg1",
        name: "Package Group #643455",
        type: "domestic",
        itemCount: 2,
        backerCount: 320,
        status: "shipped",
        statusCounts: { notPushed: 0, pushErrored: 0, pushed: 0, shipped: 320 },
        lastSentAt: "2024-01-18",
        items: [
          { name: "Main Product", quantity: 1, weight: { lbs: 1, oz: 8.0 }, customsValid: true, sku: "MAIN-001" },
          { name: "Sticker Pack", quantity: 1, weight: { lbs: 0, oz: 2.0 }, customsValid: true, sku: "STICKER-001" },
        ],
        totalWeight: { lbs: 1, oz: 10.0 },
      },
      {
        id: "pg2",
        name: "Package Group #643475",
        type: "domestic",
        itemCount: 4,
        backerCount: 150,
        status: "processing",
        statusCounts: { notPushed: 10, pushErrored: 5, pushed: 85, shipped: 50 },
        lastSentAt: "2024-01-19",
        items: [
          { name: "Main Product", quantity: 1, weight: { lbs: 1, oz: 8.0 }, customsValid: true },
          { name: "Premium Add-on", quantity: 1, weight: { lbs: 0, oz: 12.0 }, customsValid: true },
          { name: "Art Book", quantity: 1, weight: { lbs: 2, oz: 0.0 }, customsValid: true },
          { name: "Sticker Pack", quantity: 1, weight: { lbs: 0, oz: 2.0 }, customsValid: true },
        ],
        totalWeight: { lbs: 4, oz: 6.0 },
      },
      {
        id: "pg3",
        name: "Package Group #643486",
        type: "international",
        itemCount: 3,
        backerCount: 214,
        status: "pending",
        statusCounts: { notPushed: 200, pushErrored: 12, pushed: 2, shipped: 0 },
        items: [
          { name: "Digital Art Book", quantity: 1, weight: { lbs: 0, oz: 0.0 }, customsValid: false },
          { name: "Justified E-Book", quantity: 1, weight: { lbs: 0, oz: 0.0 }, customsValid: false },
          { name: "Soundtrack Digital", quantity: 1, weight: { lbs: 0, oz: 0.0 }, customsValid: false },
        ],
        totalWeight: { lbs: 0, oz: 0.0 },
      },
    ]);
    setDigitalFiles([
      { id: "df1", name: "Digital Art Book.pdf", size: "45 MB", type: "PDF", uploadedAt: "2024-01-15", distributedTo: 595, totalEligible: 684 },
      { id: "df2", name: "Soundtrack.zip", size: "120 MB", type: "ZIP", uploadedAt: "2024-01-20", distributedTo: 320, totalEligible: 450 },
    ]);
    setDistributionRules([
      { id: "dr1", name: "FS Vol 1", condition: "If [Flying Sparks Volume 1 Digital] is in the order", triggerProduct: "Flying Sparks Volume 1 Digital", distributeFile: "Flying Sparks Vol 1.pdf", requiresPayment: false, status: "started", distributedCount: 625, totalEligible: 684, startedAt: "10/13/24" },
      { id: "dr2", name: "FS Vol 2", condition: "If [Flying Sparks Volume 2 Digital] is in the order", triggerProduct: "Flying Sparks Volume 2 Digital", distributeFile: "Flying Sparks Vol 2.pdf", requiresPayment: false, status: "started", distributedCount: 3, totalEligible: 450, startedAt: "09/27/24" },
      { id: "dr3", name: "Soundtrack", condition: "If [Digital Soundtrack] is in the order", triggerProduct: "Digital Soundtrack", distributeFile: "Soundtrack.zip", requiresPayment: true, status: "not_started", distributedCount: 0, totalEligible: 320 },
    ]);
    setSurveyAddons([
      { id: "sa1", name: "Extra Sticker Pack", description: "Additional set of 10 vinyl stickers", price: 15, available: true, purchasedCount: 234 },
      { id: "sa2", name: "Art Print", description: "12x18 signed art print", price: 25, available: true, quantityLimit: 100, purchasedCount: 87 },
      { id: "sa3", name: "Soundtrack Album", description: "Digital soundtrack download", price: 10, available: true, purchasedCount: 156 },
      { id: "sa4", name: "Signed Art Print", description: "Limited edition signed by creator", price: 75, available: false, quantityLimit: 50, purchasedCount: 50 },
    ]);
    setEmailCampaigns([
      { id: "ec1", title: "Survey Reminder", status: "sent", sentAt: "2024-01-10", recipients: 684, openRate: 72 },
      { id: "ec2", title: "Shipping Update", status: "scheduled", scheduledFor: "2024-02-01", recipients: 684 },
      { id: "ec3", title: "Thank You Note", status: "draft", recipients: 0 },
    ]);
    setWorkflowSteps([
      { ...WORKFLOW_STEPS[0], status: "completed" },
      { ...WORKFLOW_STEPS[1], status: "completed" },
      { ...WORKFLOW_STEPS[2], status: "completed" },
      { ...WORKFLOW_STEPS[3], status: "completed" },
      { ...WORKFLOW_STEPS[4], status: "in_progress" },
      { ...WORKFLOW_STEPS[5], status: "pending" },
    ]);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter backers
  const filteredBackers = backers.filter((backer) => {
    const matchesSearch = backer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backer.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || backer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
    // API call would go here
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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              <h1 className="text-base sm:text-lg font-semibold">IndieKit</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">Fulfillment</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
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
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-3 transition-colors",
                      step.status === "in_progress" && "bg-teal-50 border border-teal-200",
                      step.status === "completed" && "bg-green-50",
                      step.status === "pending" && "bg-muted/50",
                      step.status === "locked" && "opacity-50"
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
                    {step.status === "in_progress" && (
                      <ChevronRight className="h-4 w-4 text-teal-600" />
                    )}
                  </div>
                ))}
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

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6 flex-wrap">
                <TabsTrigger value="overview">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="backers">
                  <Users className="h-4 w-4 mr-2" />
                  Backers
                </TabsTrigger>
                <TabsTrigger value="addons">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add-ons
                </TabsTrigger>
                <TabsTrigger value="packages">
                  <Box className="h-4 w-4 mr-2" />
                  Packages
                </TabsTrigger>
                <TabsTrigger value="shipping">
                  <Truck className="h-4 w-4 mr-2" />
                  Shipping
                </TabsTrigger>
                <TabsTrigger value="digital">
                  <Download className="h-4 w-4 mr-2" />
                  Digital
                </TabsTrigger>
                <TabsTrigger value="preorders">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Pre-Orders
                </TabsTrigger>
                <TabsTrigger value="emails">
                  <Mail className="h-4 w-4 mr-2" />
                  Emails
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Status Flow Component */}
                <Card>
                  <CardHeader>
                    <CardTitle>Fulfillment Status Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between py-4">
                      {Object.entries(STATUS_LABELS).map(([status, label], index) => {
                        const count = backers.filter((b) => b.status === status).length;
                        return (
                          <div key={status} className="flex items-center">
                            <div className="text-center">
                              <div className={cn(
                                "inline-flex h-3 w-3 rounded-full mb-2",
                                status === "not_pushed" && "bg-gray-400",
                                status === "push_errored" && "bg-amber-500",
                                status === "pushed" && "bg-amber-500",
                                status === "shipped" && "bg-green-500"
                              )} />
                              <p className="text-3xl font-bold">{count}</p>
                              <p className="text-sm text-muted-foreground">{label}</p>
                            </div>
                            {index < Object.keys(STATUS_LABELS).length - 1 && (
                              <ArrowRight className="h-6 w-6 text-gray-300 mx-4" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Charge Details Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Charge Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-lg border p-4 text-center">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 mb-2">
                          <Circle className="h-5 w-5 text-gray-600" />
                        </div>
                        <p className="text-2xl font-bold">{stats?.chargeStats?.notCharged || 0}</p>
                        <p className="text-sm text-muted-foreground">Not Charged</p>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 mb-2">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <p className="text-2xl font-bold">{stats?.chargeStats?.errored || 0}</p>
                        <p className="text-sm text-muted-foreground">Errored</p>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100 mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <p className="text-2xl font-bold">{stats?.chargeStats?.charged || 0}</p>
                        <p className="text-sm text-muted-foreground">Charged</p>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mb-2">
                          <Banknote className="h-5 w-5 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold">{stats?.chargeStats?.paypalCollected || 0}</p>
                        <p className="text-sm text-muted-foreground">PayPal Collected</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Activity</CardTitle>
                    <Button variant="outline" size="sm">View All</Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">150 orders shipped</p>
                          <p className="text-xs text-muted-foreground">US Standard package group</p>
                        </div>
                        <p className="text-xs text-muted-foreground">2 hours ago</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Survey reminder sent</p>
                          <p className="text-xs text-muted-foreground">34 backers reminded</p>
                        </div>
                        <p className="text-xs text-muted-foreground">5 hours ago</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Download className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Digital files distributed</p>
                          <p className="text-xs text-muted-foreground">Soundtrack.zip sent to 320 backers</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Yesterday</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Backers Tab */}
              <TabsContent value="backers" className="space-y-4">
                {/* Filters and Actions */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex flex-1 gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search backers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]">
                        <Filter className="h-4 w-4 mr-2" />
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
                  </div>
                  <div className="flex gap-2">
                    {selectedBackers.length > 0 && (
                      <Button onClick={pushSelectedOrders} className="bg-teal-600 hover:bg-teal-700">
                        <Send className="h-4 w-4 mr-2" />
                        Push {selectedBackers.length} Orders
                      </Button>
                    )}
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                {/* Backers Table */}
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedBackers.length === filteredBackers.length && filteredBackers.length > 0}
                              onCheckedChange={selectAllBackers}
                            />
                          </TableHead>
                          <TableHead>Backer</TableHead>
                          <TableHead>Reward</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Survey</TableHead>
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
                                onCheckedChange={() => toggleBackerSelection(backer.id)}
                              />
                            </TableCell>
                            <TableCell onClick={() => openBackerDetail(backer)}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  {backer.avatar && <AvatarImage src={backer.avatar} />}
                                  <AvatarFallback>{backer.name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{backer.name}</p>
                                  <p className="text-xs text-muted-foreground">{backer.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell onClick={() => openBackerDetail(backer)}>{backer.reward}</TableCell>
                            <TableCell onClick={() => openBackerDetail(backer)}>${backer.pledgeAmount}</TableCell>
                            <TableCell onClick={() => openBackerDetail(backer)}>
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
                            <TableCell onClick={() => openBackerDetail(backer)}>
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
                                  <DropdownMenuItem onClick={() => openBackerDetail(backer)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Send className="h-4 w-4 mr-2" />
                                    Push to Fulfillment
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
              </TabsContent>

              {/* Add-ons Tab - Survey Upselling */}
              <TabsContent value="addons" className="space-y-6">
                {/* Add-ons Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Survey Add-ons</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure add-ons that backers can purchase during their survey
                    </p>
                  </div>
                  <Button onClick={() => setIsAddonDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Add-on
                  </Button>
                </div>

                {/* Add-ons Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Total Add-on Revenue</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">${(stats?.addOnPurchases || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Backers with Add-ons</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">
                        {backers.filter(b => b.addons && b.addons.length > 0).length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Active Add-ons</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">
                        {surveyAddons.filter(a => a.available).length}/{surveyAddons.length}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Add-ons List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Available Add-ons</CardTitle>
                    <CardDescription>
                      These add-ons will be offered to backers when they complete their survey
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {surveyAddons.map((addon) => (
                        <div key={addon.id} className="flex items-start justify-between rounded-lg border p-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium">{addon.name}</h4>
                              <Badge variant={addon.available ? "default" : "secondary"}>
                                {addon.available ? "Active" : "Sold Out"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="font-medium text-teal-600">${addon.price}</span>
                              <span className="text-muted-foreground">
                                {addon.purchasedCount} purchased
                              </span>
                              {addon.quantityLimit && (
                                <span className="text-muted-foreground">
                                  {addon.quantityLimit - addon.purchasedCount} remaining
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  {addon.available ? (
                                    <>
                                      <X className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>

                    {surveyAddons.length === 0 && (
                      <div className="text-center py-12">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">No add-ons configured</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create add-ons to offer additional products during the survey
                        </p>
                        <Button onClick={() => setIsAddonDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Add-on
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* How Add-ons Work */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">How Survey Add-ons Work</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-teal-700">1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Backer receives survey email</p>
                          <p className="text-xs text-muted-foreground">Survey is sent after campaign ends</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-teal-700">2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Backer completes survey & browses add-ons</p>
                          <p className="text-xs text-muted-foreground">Add-ons are shown after survey questions</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-teal-700">3</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Backer selects add-ons & pays</p>
                          <p className="text-xs text-muted-foreground">Payment is collected via saved card</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-teal-700">4</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Add-ons added to their order</p>
                          <p className="text-xs text-muted-foreground">Items included in fulfillment</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Packages Tab */}
              <TabsContent value="packages" className="space-y-4">
                {/* Package Group Filter */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Package Groups</h3>
                    <div className="flex gap-2">
                      <Button
                        variant={packageGroupFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPackageGroupFilter("all")}
                        className={packageGroupFilter === "all" ? "bg-teal-600 hover:bg-teal-700" : ""}
                      >
                        All ({packageGroups.length})
                      </Button>
                      <Button
                        variant={packageGroupFilter === "incomplete" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPackageGroupFilter("incomplete")}
                        className={packageGroupFilter === "incomplete" ? "bg-teal-600 hover:bg-teal-700" : ""}
                      >
                        Incomplete ({packageGroups.filter(g => g.type === "incomplete").length})
                      </Button>
                      <Button
                        variant={packageGroupFilter === "international" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPackageGroupFilter("international")}
                        className={packageGroupFilter === "international" ? "bg-teal-600 hover:bg-teal-700" : ""}
                      >
                        International ({packageGroups.filter(g => g.type === "international").length})
                      </Button>
                      <Button
                        variant={packageGroupFilter === "domestic" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPackageGroupFilter("domestic")}
                        className={packageGroupFilter === "domestic" ? "bg-teal-600 hover:bg-teal-700" : ""}
                      >
                        Domestic ({packageGroups.filter(g => g.type === "domestic").length})
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Groups
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700">
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
                        {/* Group Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold">{group.name}</h4>
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
                              <DropdownMenuItem>View This Group</DropdownMenuItem>
                              <DropdownMenuItem>Export Orders</DropdownMenuItem>
                              <DropdownMenuItem>Export Reports</DropdownMenuItem>
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
                            disabled={group.statusCounts.notPushed === 0}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send {group.statusCounts.notPushed} to ShipStation
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
                                          <button className="text-teal-600 underline ml-1">edit</button>
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
                          <Button variant="link" className="text-teal-600">
                            View This Group
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Pre-Orders Tab */}
              <TabsContent value="preorders" className="space-y-6">
                {/* Pre-Orders Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Pre-Orders & Upselling</h3>
                    <p className="text-sm text-muted-foreground">
                      Track pre-order backers and manage your post-campaign store
                    </p>
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Pre-Order Store
                  </Button>
                </div>

                {/* Pre-Order Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Pre-Order Revenue</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">${(stats?.preOrderRevenue || 0).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Pre-Order Backers</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">{stats?.preOrderBackers || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Returning Backers</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">{stats?.returningBackers || 0}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">New Backers</span>
                      </div>
                      <p className="text-2xl font-bold mt-1">{stats?.newBackers || 0}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* New vs Returning Backers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Backer Breakdown</CardTitle>
                    <CardDescription>Campaign backers vs pre-order customers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Visual bar */}
                      <div className="flex h-8 rounded-lg overflow-hidden">
                        <div
                          className="bg-teal-600 flex items-center justify-center text-white text-sm font-medium"
                          style={{ width: `${((stats?.returningBackers || 0) / (stats?.totalBackers || 1)) * 100}%` }}
                        >
                          {stats?.returningBackers || 0} Returning
                        </div>
                        <div
                          className="bg-teal-400 flex items-center justify-center text-white text-sm font-medium"
                          style={{ width: `${((stats?.newBackers || 0) / (stats?.totalBackers || 1)) * 100}%` }}
                        >
                          {stats?.newBackers || 0} New
                        </div>
                      </div>

                      {/* Stats table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead></TableHead>
                            <TableHead className="text-right">Backers</TableHead>
                            <TableHead className="text-right">Pledged</TableHead>
                            <TableHead className="text-right">Avg/Backer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-teal-600" />
                                <span>Returning Backers</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {stats?.returningBackers || 0}
                              <span className="text-muted-foreground ml-1">
                                ({(((stats?.returningBackers || 0) / (stats?.totalBackers || 1)) * 100).toFixed(0)}%)
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              ${((stats?.returningBackers || 0) * 183).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">$183.00</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-teal-400" />
                                <span>New Backers</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {stats?.newBackers || 0}
                              <span className="text-muted-foreground ml-1">
                                ({(((stats?.newBackers || 0) / (stats?.totalBackers || 1)) * 100).toFixed(0)}%)
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              ${((stats?.newBackers || 0) * 175).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">$175.00</TableCell>
                          </TableRow>
                          <TableRow className="font-medium">
                            <TableCell>Total</TableCell>
                            <TableCell className="text-right">{stats?.totalBackers || 0}</TableCell>
                            <TableCell className="text-right">${(stats?.totalRaised || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              ${((stats?.totalRaised || 0) / (stats?.totalBackers || 1)).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Pre-Order Store Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pre-Order Store</CardTitle>
                    <CardDescription>Configure your post-campaign pre-order store</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Store Status</p>
                        <p className="text-sm text-muted-foreground">Accept new pre-orders from customers</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Open</Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Store URL</p>
                        <p className="text-sm text-teal-600">https://indiekit.co/store/my-awesome-project</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Available Products</p>
                        <p className="text-sm text-muted-foreground">Products available for pre-order</p>
                      </div>
                      <span className="font-medium">4 products</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Shipping Tab */}
              <TabsContent value="shipping" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Connected Services</CardTitle>
                    <CardDescription>Connect to shipping platforms to automate fulfillment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {shippingServices.map((service) => (
                      <div key={service.id} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                            {service.icon}
                          </div>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.connected ? (
                              <p className="text-sm text-muted-foreground">
                                Connected {service.connectedAt}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not connected</p>
                            )}
                          </div>
                        </div>
                        {service.connected ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              <Check className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                            <Button variant="ghost" size="sm">Disconnect</Button>
                          </div>
                        ) : (
                          <Button className="bg-teal-600 hover:bg-teal-700">
                            <Link2 className="h-4 w-4 mr-2" />
                            Connect
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Auto-push orders when address confirmed</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically send orders to fulfillment service
                        </p>
                      </div>
                      <Checkbox />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Send tracking emails automatically</p>
                        <p className="text-sm text-muted-foreground">
                          Email backers when tracking info is available
                        </p>
                      </div>
                      <Checkbox defaultChecked />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Digital Downloads Tab */}
              <TabsContent value="digital" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Digital Downloads</h3>
                    <p className="text-sm text-muted-foreground">Manage and distribute digital rewards</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      View Downloads ({digitalFiles.length})
                    </Button>
                    <Button onClick={() => setIsUploadDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                  </div>
                </div>

                {/* Blast Notification Banner */}
                <Card className="bg-muted/50">
                  <CardContent className="py-6 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Send email notifications to backers receiving digital downloads.
                    </p>
                    <Button className="bg-teal-600 hover:bg-teal-700">
                      <Mail className="h-4 w-4 mr-2" />
                      Blast {stats?.digitalDownloads || 0} Notification Emails
                    </Button>
                  </CardContent>
                </Card>

                {/* Distribution Rules */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Distribution Rules</CardTitle>
                      <CardDescription>Configure automatic file distribution based on order contents</CardDescription>
                    </div>
                    <Button onClick={() => setIsDistributionDialogOpen(true)} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Rule
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">Distribution Rule</TableHead>
                          <TableHead>Distributed</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {distributionRules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{rule.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  If <Badge variant="secondary" className="mx-1">{rule.triggerProduct}</Badge>
                                  is in the order, distribute {rule.distributeFile}.
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {rule.requiresPayment ? "Lockdown/Payment required." : "Lockdown/Payment is not required."}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {rule.distributedCount} files
                            </TableCell>
                            <TableCell>
                              <div>
                                <Badge className={cn(
                                  rule.status === "started" && "bg-green-100 text-green-700",
                                  rule.status === "not_started" && "bg-gray-100 text-gray-700",
                                  rule.status === "completed" && "bg-blue-100 text-blue-700"
                                )}>
                                  {rule.status === "started" ? "Started" : rule.status === "completed" ? "Completed" : "Not Started"}
                                </Badge>
                                {rule.startedAt && (
                                  <p className="text-xs text-muted-foreground mt-1">{rule.startedAt}</p>
                                )}
                                {rule.status === "started" && (
                                  <Button variant="link" size="sm" className="text-teal-600 p-0 h-auto mt-1">
                                    Refresh
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {distributionRules.length === 0 && (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">No distribution rules</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create rules to automatically distribute files to eligible backers
                        </p>
                        <Button onClick={() => setIsDistributionDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Distribution Rule
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Uploaded Files */}
                <Card>
                  <CardHeader>
                    <CardTitle>Uploaded Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {digitalFiles.map((file) => (
                        <div key={file.id} className="flex items-start justify-between rounded-lg border p-4">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                              <FileText className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-medium">{file.name}</h4>
                              <p className="text-sm text-muted-foreground">{file.size} · {file.type}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Uploaded {file.uploadedAt}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {file.distributedTo}/{file.totalEligible} distributed
                            </p>
                            <Progress
                              value={(file.distributedTo / file.totalEligible) * 100}
                              className="h-2 w-32 mt-2"
                            />
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" variant="outline">
                                <Send className="h-4 w-4 mr-2" />
                                Distribute
                              </Button>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {digitalFiles.length === 0 && (
                        <div className="text-center py-12">
                          <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="font-semibold mb-2">No digital files yet</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Upload files to distribute to your backers
                          </p>
                          <Button onClick={() => setIsUploadDialogOpen(true)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload File
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Emails Tab */}
              <TabsContent value="emails" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Email Campaigns</h3>
                    <p className="text-sm text-muted-foreground">Communicate with your backers</p>
                  </div>
                  <Button onClick={() => setIsEmailDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Campaign
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Recipients</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Open Rate</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emailCampaigns.map((campaign) => (
                          <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.title}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                campaign.status === "sent" && "bg-green-100 text-green-700",
                                campaign.status === "scheduled" && "bg-blue-100 text-blue-700",
                                campaign.status === "draft" && "bg-gray-100 text-gray-700"
                              )}>
                                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>{campaign.recipients}</TableCell>
                            <TableCell>
                              {campaign.sentAt || campaign.scheduledFor || "—"}
                            </TableCell>
                            <TableCell>
                              {campaign.openRate ? `${campaign.openRate}%` : "—"}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Edit</DropdownMenuItem>
                                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                  {campaign.status === "draft" && (
                                    <DropdownMenuItem>Send Now</DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Suggested Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Suggested Email Timeline</CardTitle>
                    <CardDescription>Optimal times to reach your backers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Survey Launch</p>
                          <p className="text-xs text-muted-foreground">Send immediately after campaign ends</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Survey Reminder</p>
                          <p className="text-xs text-muted-foreground">1 week after initial survey</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">3</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Shipping Update</p>
                          <p className="text-xs text-muted-foreground">When production begins</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-teal-700">4</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Tracking Notification</p>
                          <p className="text-xs text-muted-foreground">Automated when orders ship</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Backer Detail Dialog */}
      <Dialog open={isBackerDialogOpen} onOpenChange={setIsBackerDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Pledge #{selectedBacker?.id}
                <Button variant="outline" size="sm" className="ml-2">
                  <Eye className="h-3 w-3 mr-1" />
                  View as Backer
                </Button>
              </DialogTitle>
            </div>
          </DialogHeader>
          {selectedBacker && (
            <div className="space-y-6">
              {/* Status and Shipping Info Cards */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Status Card */}
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-3">Status</h4>
                  {!selectedBacker.surveyCompleted ? (
                    <div>
                      <Badge className="bg-red-600 text-white mb-2">SURVEY NOT COMPLETED</Badge>
                      <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                        {!selectedBacker.addressComplete && (
                          <li className="flex items-center gap-2">
                            <Circle className="h-2 w-2" />
                            Address information required
                          </li>
                        )}
                        <li className="flex items-center gap-2">
                          <Circle className="h-2 w-2" />
                          Survey question completion required
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <Badge className="bg-green-600 text-white">SURVEY COMPLETE</Badge>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Badge className={STATUS_COLORS[selectedBacker.status]}>
                      {STATUS_LABELS[selectedBacker.status]}
                    </Badge>
                  </div>
                </div>

                {/* Shipping Address Card */}
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium">Shipping Information</h4>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                  {selectedBacker.shippingAddress ? (
                    <div className="text-sm">
                      <p>{selectedBacker.shippingAddress.name}</p>
                      <p>{selectedBacker.shippingAddress.line1}</p>
                      {selectedBacker.shippingAddress.line2 && <p>{selectedBacker.shippingAddress.line2}</p>}
                      <p>
                        {selectedBacker.shippingAddress.city}, {selectedBacker.shippingAddress.state} {selectedBacker.shippingAddress.postalCode}
                      </p>
                      <p>{selectedBacker.shippingAddress.country}</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-red-600 font-medium">Address Incomplete</p>
                      <p className="text-xs text-muted-foreground">
                        Address City, Line 1, Postal Code, Phone Number, and State are missing
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={backerDialogTab} onValueChange={setBackerDialogTab}>
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="order">Order</TabsTrigger>
                  <TabsTrigger value="digital">Digital Downloads</TabsTrigger>
                  <TabsTrigger value="shipping">Shipping</TabsTrigger>
                  <TabsTrigger value="packages">Packages</TabsTrigger>
                  <TabsTrigger value="emails">Emails</TabsTrigger>
                  <TabsTrigger value="changelog">Changelog</TabsTrigger>
                </TabsList>

                {/* Order Tab with Balance Breakdown */}
                <TabsContent value="order" className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Balance Card */}
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium mb-3">Balance</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span>Amount Pledged</span>
                            <Check className="h-3 w-3 text-green-500" />
                          </div>
                          <span>(${selectedBacker.balance?.pledgeAmount?.toFixed(2) || "0.00"})</span>
                        </div>
                        <p className="text-xs text-muted-foreground">View pledge on Kickstarter</p>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between">
                            <span>Pledge Level</span>
                            <span>${selectedBacker.balance?.pledgeLevelAmount?.toFixed(2) || "0.00"}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">${selectedBacker.rewardAmount} - {selectedBacker.reward}</p>
                        </div>
                        <div className="flex justify-between">
                          <span>Add-ons</span>
                          <span>${selectedBacker.balance?.addonsAmount?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping</span>
                          <span>${selectedBacker.balance?.shippingAmount?.toFixed(2) || "0.00"}</span>
                        </div>
                        <div className="border-t pt-2 mt-2 font-medium">
                          <div className="flex justify-between">
                            <span>Balance</span>
                            <span className={selectedBacker.balance?.balanceDue === 0 ? "text-green-600" : "text-red-600"}>
                              ${selectedBacker.balance?.balanceDue?.toFixed(2) || "0.00"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Items Card */}
                    <div className="rounded-lg border p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">Items ({selectedBacker.items?.length || 0})</h4>
                        <Button variant="ghost" size="sm">Pack List</Button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-2 flex justify-between">
                            <span>Pledge Items ({selectedBacker.items?.length || 0})</span>
                            <span>QTY</span>
                          </p>
                          <div className="space-y-1">
                            {selectedBacker.items?.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{item.name}</span>
                                <span>{item.quantity}</span>
                              </div>
                            )) || <p className="text-sm text-muted-foreground">No items</p>}
                          </div>
                        </div>
                        {selectedBacker.addons && selectedBacker.addons.length > 0 && (
                          <div className="border-t pt-2">
                            <p className="text-xs text-muted-foreground font-medium mb-2 flex justify-between">
                              <span>Add-ons ({selectedBacker.addons.length})</span>
                              <span>QTY</span>
                            </p>
                            <div className="space-y-1">
                              {selectedBacker.addons.map((addon, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span>{addon.name}</span>
                                  <span>{addon.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="w-full mt-2">
                          <Plus className="h-3 w-3 mr-1" />
                          Add SKUs
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Digital Downloads Tab */}
                <TabsContent value="digital" className="space-y-4">
                  {selectedBacker.digitalDownloads?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedBacker.digitalDownloads.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              {file.distributedAt && (
                                <p className="text-xs text-muted-foreground">Distributed {file.distributedAt}</p>
                              )}
                            </div>
                          </div>
                          {file.downloaded ? (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              Downloaded
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Downloaded</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border p-6 text-center">
                      <Download className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No digital downloads for this tier</p>
                    </div>
                  )}
                </TabsContent>

                {/* Shipping Tab */}
                <TabsContent value="shipping" className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium">Shipping Details</h4>
                      <Button variant="outline" size="sm">
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                    {selectedBacker.shippingAddress ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{selectedBacker.shippingAddress.name}</p>
                        <p>{selectedBacker.shippingAddress.line1}</p>
                        {selectedBacker.shippingAddress.line2 && <p>{selectedBacker.shippingAddress.line2}</p>}
                        <p>
                          {selectedBacker.shippingAddress.city}, {selectedBacker.shippingAddress.state} {selectedBacker.shippingAddress.postalCode}
                        </p>
                        <p>{selectedBacker.shippingAddress.country}</p>
                        {selectedBacker.shippingAddress.phone && (
                          <p className="text-muted-foreground">Phone: {selectedBacker.shippingAddress.phone}</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No shipping address provided</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Packages Tab */}
                <TabsContent value="packages" className="space-y-4">
                  <div className="rounded-lg border p-4 text-center">
                    <Box className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Package information will appear here once orders are pushed to fulfillment</p>
                  </div>
                </TabsContent>

                {/* Emails Tab */}
                <TabsContent value="emails" className="space-y-4">
                  <div className="rounded-lg border p-4 text-center">
                    <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Email history for this backer will appear here</p>
                    <Button variant="outline" size="sm" className="mt-4">
                      <Mail className="h-3 w-3 mr-1" />
                      Send Email
                    </Button>
                  </div>
                </TabsContent>

                {/* Changelog Tab */}
                <TabsContent value="changelog" className="space-y-4">
                  {selectedBacker.activity && selectedBacker.activity.length > 0 ? (
                    <div className="space-y-3">
                      {selectedBacker.activity.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">{entry.action}</p>
                            {entry.details && <p className="text-muted-foreground">{entry.details}</p>}
                            <p className="text-xs text-muted-foreground">{entry.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-center">
                      <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBackerDialogOpen(false)}>
              Close
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Mail className="h-4 w-4 mr-2" />
              Contact Backer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Digital File</DialogTitle>
            <DialogDescription>
              Upload a file to distribute to your backers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop your file here, or click to browse
              </p>
              <Button variant="outline" size="sm">
                Choose File
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Distribution Rules</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All backers</SelectItem>
                  <SelectItem value="tier">Specific reward tiers</SelectItem>
                  <SelectItem value="addon">Add-on purchasers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              Upload & Distribute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Campaign Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Email Campaign</DialogTitle>
            <DialogDescription>
              Create a new email to send to your backers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-title">Campaign Title</Label>
              <Input id="campaign-title" placeholder="e.g., Shipping Update" />
            </div>
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All backers</SelectItem>
                  <SelectItem value="survey_pending">Survey pending</SelectItem>
                  <SelectItem value="not_shipped">Not shipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-on Dialog */}
      <Dialog open={isAddonDialogOpen} onOpenChange={setIsAddonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Survey Add-on</DialogTitle>
            <DialogDescription>
              Add a product that backers can purchase during their survey
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="addon-name">Add-on Name</Label>
              <Input id="addon-name" placeholder="e.g., Extra Sticker Pack" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-description">Description</Label>
              <Input id="addon-description" placeholder="Brief description of the add-on" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addon-price">Price ($)</Label>
                <Input id="addon-price" type="number" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addon-limit">Quantity Limit (optional)</Label>
                <Input id="addon-limit" type="number" placeholder="Unlimited" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="addon-active" defaultChecked />
              <Label htmlFor="addon-active" className="text-sm">Make available immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddonDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              Create Add-on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Distribution Rule Dialog */}
      <Dialog open={isDistributionDialogOpen} onOpenChange={setIsDistributionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Distribution Rule</DialogTitle>
            <DialogDescription>
              Set up automatic file distribution based on order contents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input id="rule-name" placeholder="e.g., Digital Art Book Distribution" />
            </div>
            <div className="space-y-2">
              <Label>Trigger Product</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product1">Digital Art Book</SelectItem>
                  <SelectItem value="product2">Soundtrack Album</SelectItem>
                  <SelectItem value="product3">E-Book Bundle</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When this product is in the order, the file will be distributed
              </p>
            </div>
            <div className="space-y-2">
              <Label>File to Distribute</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a file..." />
                </SelectTrigger>
                <SelectContent>
                  {digitalFiles.map((file) => (
                    <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="require-payment" />
              <Label htmlFor="require-payment" className="text-sm">
                Require payment/lockdown before distribution
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDistributionDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
