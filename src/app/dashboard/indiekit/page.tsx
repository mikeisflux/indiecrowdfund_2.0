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
  status: "not_pushed" | "push_errored" | "pushed" | "shipped";
  surveyCompleted: boolean;
  shippingAddress?: {
    line1: string;
    city: string;
    country: string;
    postalCode: string;
  };
  items: { name: string; quantity: number }[];
  digitalDownloads: { name: string; downloaded: boolean }[];
}

interface PackageGroup {
  id: string;
  name: string;
  itemCount: number;
  backerCount: number;
  status: "pending" | "processing" | "shipped";
  items: string[];
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
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBackers, setSelectedBackers] = useState<string[]>([]);
  const [isBackerDialogOpen, setIsBackerDialogOpen] = useState(false);
  const [selectedBacker, setSelectedBacker] = useState<Backer | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

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
    });
    setBackers([
      {
        id: "b1",
        name: "John Doe",
        email: "john@example.com",
        pledgeAmount: 150,
        reward: "Early Bird Special",
        status: "shipped",
        surveyCompleted: true,
        shippingAddress: { line1: "123 Main St", city: "New York", country: "US", postalCode: "10001" },
        items: [{ name: "Main Product", quantity: 1 }, { name: "Add-on A", quantity: 2 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: true }],
      },
      {
        id: "b2",
        name: "Jane Smith",
        email: "jane@example.com",
        pledgeAmount: 250,
        reward: "Premium Bundle",
        status: "pushed",
        surveyCompleted: true,
        shippingAddress: { line1: "456 Oak Ave", city: "Los Angeles", country: "US", postalCode: "90001" },
        items: [{ name: "Main Product", quantity: 1 }, { name: "Premium Add-on", quantity: 1 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: false }, { name: "Soundtrack", downloaded: false }],
      },
      {
        id: "b3",
        name: "Bob Wilson",
        email: "bob@example.com",
        pledgeAmount: 75,
        reward: "Basic Tier",
        status: "not_pushed",
        surveyCompleted: false,
        items: [{ name: "Main Product", quantity: 1 }],
        digitalDownloads: [],
      },
      {
        id: "b4",
        name: "Alice Brown",
        email: "alice@example.com",
        pledgeAmount: 500,
        reward: "Collector's Edition",
        status: "push_errored",
        surveyCompleted: true,
        shippingAddress: { line1: "789 Pine Rd", city: "Chicago", country: "US", postalCode: "60601" },
        items: [{ name: "Collector's Set", quantity: 1 }, { name: "Exclusive Item", quantity: 1 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: true }, { name: "Soundtrack", downloaded: true }],
      },
    ]);
    setPackageGroups([
      { id: "pg1", name: "US Standard", itemCount: 2, backerCount: 320, status: "shipped", items: ["Main Product", "Sticker Pack"] },
      { id: "pg2", name: "US Premium", itemCount: 4, backerCount: 150, status: "processing", items: ["Main Product", "Premium Add-on", "Art Book", "Sticker Pack"] },
      { id: "pg3", name: "International", itemCount: 2, backerCount: 214, status: "pending", items: ["Main Product", "Sticker Pack"] },
    ]);
    setDigitalFiles([
      { id: "df1", name: "Digital Art Book.pdf", size: "45 MB", type: "PDF", uploadedAt: "2024-01-15", distributedTo: 595, totalEligible: 684 },
      { id: "df2", name: "Soundtrack.zip", size: "120 MB", type: "ZIP", uploadedAt: "2024-01-20", distributedTo: 320, totalEligible: 450 },
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
                <TabsTrigger value="emails">
                  <Mail className="h-4 w-4 mr-2" />
                  Emails
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Order Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Order Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      {Object.entries(STATUS_LABELS).map(([status, label]) => {
                        const count = backers.filter((b) => b.status === status).length;
                        const percent = backers.length > 0 ? (count / backers.length) * 100 : 0;
                        return (
                          <div key={status} className="text-center">
                            <div className={cn(
                              "inline-flex h-12 w-12 items-center justify-center rounded-full mb-2",
                              STATUS_COLORS[status as keyof typeof STATUS_COLORS]
                            )}>
                              {status === "shipped" && <CheckCircle2 className="h-6 w-6" />}
                              {status === "pushed" && <Truck className="h-6 w-6" />}
                              {status === "push_errored" && <AlertCircle className="h-6 w-6" />}
                              {status === "not_pushed" && <Circle className="h-6 w-6" />}
                            </div>
                            <p className="text-2xl font-bold">{count}</p>
                            <p className="text-sm text-muted-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{percent.toFixed(0)}%</p>
                          </div>
                        );
                      })}
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

              {/* Packages Tab */}
              <TabsContent value="packages" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Package Groups</h3>
                    <p className="text-sm text-muted-foreground">Manage fulfillment by package configuration</p>
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </div>

                <div className="grid gap-4">
                  {packageGroups.map((group) => (
                    <Card key={group.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold">{group.name}</h4>
                              <Badge className={cn(
                                group.status === "shipped" && "bg-green-100 text-green-700",
                                group.status === "processing" && "bg-yellow-100 text-yellow-700",
                                group.status === "pending" && "bg-gray-100 text-gray-700"
                              )}>
                                {group.status.charAt(0).toUpperCase() + group.status.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {group.backerCount} backers · {group.itemCount} items per package
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.items.map((item, idx) => (
                                <Badge key={idx} variant="outline">{item}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {group.status === "pending" && (
                              <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                                <Send className="h-4 w-4 mr-2" />
                                Push All
                              </Button>
                            )}
                            {group.status === "processing" && (
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-2" />
                                View Progress
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit Group</DropdownMenuItem>
                                <DropdownMenuItem>Export Orders</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">Delete Group</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
                    <h3 className="text-lg font-semibold">Digital Files</h3>
                    <p className="text-sm text-muted-foreground">Manage and distribute digital rewards</p>
                  </div>
                  <Button onClick={() => setIsUploadDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                </div>

                <div className="grid gap-4">
                  {digitalFiles.map((file) => (
                    <Card key={file.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
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
                      </CardContent>
                    </Card>
                  ))}

                  {digitalFiles.length === 0 && (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Download className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-semibold mb-2">No digital files yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload files to distribute to your backers
                        </p>
                        <Button onClick={() => setIsUploadDialogOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Backer Details</DialogTitle>
          </DialogHeader>
          {selectedBacker && (
            <div className="space-y-6">
              {/* Backer Info */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  {selectedBacker.avatar && <AvatarImage src={selectedBacker.avatar} />}
                  <AvatarFallback className="text-lg">{selectedBacker.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{selectedBacker.name}</h3>
                  <p className="text-muted-foreground">{selectedBacker.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={STATUS_COLORS[selectedBacker.status]}>
                      {STATUS_LABELS[selectedBacker.status]}
                    </Badge>
                    {selectedBacker.surveyCompleted ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        Survey Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        Survey Pending
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">${selectedBacker.pledgeAmount}</p>
                  <p className="text-sm text-muted-foreground">{selectedBacker.reward}</p>
                </div>
              </div>

              {/* Tabs for different info */}
              <Tabs defaultValue="order">
                <TabsList>
                  <TabsTrigger value="order">Order</TabsTrigger>
                  <TabsTrigger value="shipping">Shipping</TabsTrigger>
                  <TabsTrigger value="digital">Digital</TabsTrigger>
                </TabsList>

                <TabsContent value="order" className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-3">Items</h4>
                    <div className="space-y-2">
                      {selectedBacker.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="text-muted-foreground">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="shipping" className="space-y-4">
                  {selectedBacker.shippingAddress ? (
                    <div className="rounded-lg border p-4">
                      <h4 className="font-medium mb-3">Shipping Address</h4>
                      <p className="text-sm">{selectedBacker.shippingAddress.line1}</p>
                      <p className="text-sm">
                        {selectedBacker.shippingAddress.city}, {selectedBacker.shippingAddress.postalCode}
                      </p>
                      <p className="text-sm">{selectedBacker.shippingAddress.country}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-center">
                      <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No shipping address provided</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="digital" className="space-y-4">
                  {selectedBacker.digitalDownloads.length > 0 ? (
                    <div className="space-y-2">
                      {selectedBacker.digitalDownloads.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm">{file.name}</span>
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
                    <div className="rounded-lg border p-4 text-center">
                      <Download className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No digital downloads for this tier</p>
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
    </div>
  );
}
