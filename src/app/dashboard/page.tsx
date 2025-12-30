"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Users,
  Clock,
  Eye,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Settings,
  BarChart3,
  MessageSquare,
  Package,
  Truck,
  Sparkles,
  Plus,
  Loader2,
  XCircle,
  RefreshCw,
  Box,
  Gift,
  Download,
  Target,
  TrendingUp,
  Zap,
  CheckCircle,
  FileText,
  Trash2,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  projectUrl: string;
}

interface SelectedProject {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  daysRemaining: number;
  endDate: string | null;
  launchedAt: string | null;
  projectUrl: string;
}

interface Stats {
  todayPledges: number;
  todayBackers: number;
  todayViews: number;
  weeklyGrowth: number;
  conversionRate: number;
  avgPledge: number;
  dailyChange: number;
}

interface FundingDataPoint {
  date: string;
  amount: number;
  cumulative: number;
}

interface Backer {
  id: string;
  status: string;
  fulfillmentStatus: string;
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  amount: number;
  shippingAmount: number;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  rewardId: string | null;
  reward: string;
  addons: string;
  addonsMap: Record<string, number>;
  time: string;
}

interface RewardAddonItem {
  id: string;
  title: string;
}

interface RewardStat {
  id: string;
  title: string;
  amount: number;
  backers: number;
  total: number;
  remaining: number | null;
}

interface Referrer {
  source: string;
  visits: number;
  pledges: number;
  amount: number;
  percentage: number;
}

interface FulfillmentItem {
  name: string;
  count: number;
  type: "reward" | "addon";
}

interface FulfillmentStats {
  totalBackers: number;
  shippedBackers: number;
  fulfillmentPercentage: number;
  items: FulfillmentItem[];
  statusBreakdown: {
    notStarted: number;
    inProgress: number;
    shipped: number;
    delivered: number;
  };
}

interface DashboardData {
  projects: Project[];
  selectedProject: SelectedProject | null;
  stats: Stats | null;
  fundingData: FundingDataPoint[];
  recentBackers: Backer[];
  rewardStats: RewardStat[];
  allRewards: RewardAddonItem[];
  allAddons: RewardAddonItem[];
  referrers: Referrer[];
  fulfillmentStats: FulfillmentStats | null;
}

// Glowing stat card component for creator dashboard
function GlowingStatCard({
  title,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  color = "primary",
  trend,
  subtitle,
  delay = 0,
  pulse = false,
}: {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "blue" | "purple" | "amber" | "rose" | "cyan";
  trend?: { value: number; isPositive?: boolean; label?: string };
  subtitle?: string;
  delay?: number;
  pulse?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!isVisible || typeof value !== "number") return;
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);
    return () => clearInterval(timer);
  }, [isVisible, value]);

  const colorStyles = {
    primary: {
      bg: "from-primary/10 to-primary/5",
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    green: {
      bg: "from-emerald-500/10 to-emerald-500/5",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-500",
      glow: "group-hover:shadow-emerald-500/20",
    },
    blue: {
      bg: "from-blue-500/10 to-blue-500/5",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-500",
      glow: "group-hover:shadow-blue-500/20",
    },
    purple: {
      bg: "from-purple-500/10 to-purple-500/5",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-500",
      glow: "group-hover:shadow-purple-500/20",
    },
    amber: {
      bg: "from-amber-500/10 to-amber-500/5",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-500",
      glow: "group-hover:shadow-amber-500/20",
    },
    rose: {
      bg: "from-rose-500/10 to-rose-500/5",
      iconBg: "bg-rose-500/20",
      iconColor: "text-rose-500",
      glow: "group-hover:shadow-rose-500/20",
    },
    cyan: {
      bg: "from-cyan-500/10 to-cyan-500/5",
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-500",
      glow: "group-hover:shadow-cyan-500/20",
    },
  };

  const styles = colorStyles[color];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden bg-card/50 backdrop-blur border-border/50 transition-all duration-500 hover:border-primary/30",
        styles.glow,
        "hover:shadow-lg",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", styles.bg)} />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-xl transition-transform group-hover:scale-110",
          styles.iconBg,
          pulse && "animate-pulse"
        )}>
          <Icon className={cn("h-4 w-4", styles.iconColor)} />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold tabular-nums">
          {prefix}
          {typeof value === "number" ? displayValue.toLocaleString() : value}
          {suffix}
        </div>
        {trend && (
          <p className={cn(
            "flex items-center text-xs mt-1",
            trend.isPositive !== false ? "text-emerald-500" : "text-rose-500"
          )}>
            {trend.isPositive !== false ? (
              <ArrowUpRight className="mr-1 h-3 w-3" />
            ) : (
              <ArrowDownRight className="mr-1 h-3 w-3" />
            )}
            {trend.isPositive !== false ? "+" : ""}{trend.value}% {trend.label || ""}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Animated bar chart component
function AnimatedBarChart({
  data,
  height = 200,
  color = "primary",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: "primary" | "green" | "blue" | "purple";
}) {
  const [isVisible, setIsVisible] = useState(false);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const colorStyles = {
    primary: "from-primary to-purple-500",
    green: "from-emerald-500 to-cyan-500",
    blue: "from-blue-500 to-indigo-500",
    purple: "from-purple-500 to-pink-500",
  };

  return (
    <div style={{ height }} className="flex items-end gap-2">
      {data.map((item, index) => {
        const heightPercent = (item.value / maxValue) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div className="relative w-full group">
              <div
                className={cn(
                  "w-full rounded-t-lg bg-gradient-to-t transition-all duration-1000 ease-out",
                  colorStyles[color],
                  "group-hover:opacity-80"
                )}
                style={{
                  height: isVisible ? `${Math.max(heightPercent, 2)}%` : "0%",
                  minHeight: isVisible ? "4px" : "0",
                  transitionDelay: `${index * 50}ms`,
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                ${item.value.toLocaleString()}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Circular progress component
function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  color = "primary",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: "primary" | "green" | "blue" | "purple";
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setAnimatedValue(value);
        clearInterval(timer);
      } else {
        setAnimatedValue(current);
      }
    }, stepDuration);
    return () => clearInterval(timer);
  }, [value]);

  const colorStyles = {
    primary: "stroke-primary",
    green: "stroke-emerald-500",
    blue: "stroke-blue-500",
    purple: "stroke-purple-500",
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(colorStyles[color], "transition-all duration-1000 ease-out")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{Math.round(animatedValue)}%</span>
        <span className="text-xs text-muted-foreground">Fulfilled</span>
      </div>
    </div>
  );
}

const SELECTED_PROJECT_KEY = "indiecrowdfund_selected_project";

export default function CreatorDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [timeRange, setTimeRange] = useState("30");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingPledge, setCancellingPledge] = useState<string | null>(null);
  const [refundingPledge, setRefundingPledge] = useState<string | null>(null);
  const [deletingPledge, setDeletingPledge] = useState<string | null>(null);

  // Confirmation dialog state
  const [cancelConfirm, setCancelConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [refundConfirm, setRefundConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });

  // Bulk selection state
  const [selectedPledges, setSelectedPledges] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<{ open: boolean; action: "cancel" | "delete" }>({
    open: false,
    action: "cancel",
  });
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProjectId) params.set("projectId", selectedProjectId);
      params.set("days", timeRange);

      const res = await fetch(`/api/creator/dashboard?${params}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to fetch dashboard data");
      }

      const dashboardData = await res.json();
      setData(dashboardData);

      // Set selected project if not already set
      if (!selectedProjectId && dashboardData.selectedProject) {
        setSelectedProjectId(dashboardData.selectedProject.id);
        localStorage.setItem(SELECTED_PROJECT_KEY, dashboardData.selectedProject.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, timeRange]);

  // Load selected project from localStorage on mount
  useEffect(() => {
    const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle project selection change
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
  };

  // Cancel a pending pledge (creator)
  const handleCancelPledge = async () => {
    const pledgeId = cancelConfirm.pledgeId;
    setCancellingPledge(pledgeId);
    setCancelConfirm({ open: false, pledgeId: "" });
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "cancel", reason: "Cancelled by creator" }),
      });

      if (response.ok) {
        // Refresh dashboard data after cancellation
        await fetchDashboardData();
        toast.success("Pledge cancelled successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to cancel pledge");
      }
    } catch (err) {
      console.error("Failed to cancel pledge:", err);
      toast.error("Failed to cancel pledge");
    } finally {
      setCancellingPledge(null);
    }
  };

  // Delete a cancelled pledge (creator)
  const handleDeletePledge = async () => {
    const pledgeId = deleteConfirm.pledgeId;
    setDeletingPledge(pledgeId);
    setDeleteConfirm({ open: false, pledgeId: "" });
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });

      if (response.ok) {
        // Refresh dashboard data after deletion
        await fetchDashboardData();
        toast.success("Pledge deleted successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete pledge");
      }
    } catch (err) {
      console.error("Failed to delete pledge:", err);
      toast.error("Failed to delete pledge");
    } finally {
      setDeletingPledge(null);
    }
  };

  // Get pending pledges for bulk operations
  const pendingPledges = data?.recentBackers?.filter(b => b.status === "PENDING") || [];
  const selectedPendingCount = Array.from(selectedPledges).filter(id =>
    pendingPledges.some(p => p.id === id)
  ).length;

  // Toggle single pledge selection
  const togglePledgeSelection = (pledgeId: string) => {
    setSelectedPledges(prev => {
      const next = new Set(prev);
      if (next.has(pledgeId)) {
        next.delete(pledgeId);
      } else {
        next.add(pledgeId);
      }
      return next;
    });
  };

  // Toggle all pending pledges
  const toggleAllPending = () => {
    if (selectedPendingCount === pendingPledges.length && pendingPledges.length > 0) {
      // Deselect all pending
      setSelectedPledges(prev => {
        const next = new Set(prev);
        pendingPledges.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      // Select all pending
      setSelectedPledges(prev => {
        const next = new Set(prev);
        pendingPledges.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  // Bulk cancel pending pledges
  const handleBulkCancel = async () => {
    setBulkProcessing(true);
    const pledgeIds = Array.from(selectedPledges).filter(id =>
      pendingPledges.some(p => p.id === id)
    );

    let successCount = 0;
    let failCount = 0;

    for (const pledgeId of pledgeIds) {
      try {
        const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({ action: "cancel", reason: "Bulk cancelled by creator" }),
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setBulkProcessing(false);
    setBulkAction({ open: false, action: "cancel" });
    setSelectedPledges(new Set());
    await fetchDashboardData();

    if (successCount > 0) {
      toast.success(`${successCount} pledge(s) cancelled successfully`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} pledge(s) failed to cancel`);
    }
  };

  // Bulk delete pending pledges (hard delete from database)
  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    const pledgeIds = Array.from(selectedPledges).filter(id =>
      pendingPledges.some(p => p.id === id)
    );

    try {
      const response = await fetch(`/api/creator/pledges/bulk-delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ pledgeIds }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`${result.deletedCount} pending pledge(s) deleted`);
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete pledges");
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error("Failed to delete pledges");
    }

    setBulkProcessing(false);
    setBulkAction({ open: false, action: "delete" });
    setSelectedPledges(new Set());
    await fetchDashboardData();
  };

  // Refund a completed pledge (creator)
  const handleRefundPledge = async () => {
    const pledgeId = refundConfirm.pledgeId;
    setRefundingPledge(pledgeId);
    try {
      const response = await fetch(`/api/creator/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "refund", reason: "Refunded by creator" }),
      });

      if (response.ok) {
        // Refresh dashboard data after refund
        await fetchDashboardData();
        toast.success("Pledge refunded successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to refund pledge");
      }
    } catch (err) {
      console.error("Failed to refund pledge:", err);
      toast.error("Failed to refund pledge");
    } finally {
      setRefundingPledge(null);
    }
  };

  // Export backers to CSV
  const handleExportCSV = () => {
    if (!data?.recentBackers.length) {
      toast.error("No backers to export");
      return;
    }

    // Build dynamic headers: fixed columns + reward columns + addon columns
    const fixedHeaders = [
      "Name",
      "Email",
      "Pledge Amount",
      "Shipping Paid",
      "Fulfillment Status",
      "Address",
      "City",
      "State",
      "Country",
    ];

    // Add reward columns (each reward gets its own column)
    const rewardHeaders = (data.allRewards || []).map((r) => `Reward: ${r.title}`);

    // Add addon columns (each addon gets its own column)
    const addonHeaders = (data.allAddons || []).map((a) => `Addon: ${a.title}`);

    const headers = [...fixedHeaders, ...rewardHeaders, ...addonHeaders];

    // CSV rows
    const rows = data.recentBackers.map((backer) => {
      // Fixed columns
      const fixedCols = [
        backer.name,
        backer.email || "",
        backer.amount.toString(),
        backer.shippingAmount.toString(),
        backer.fulfillmentStatus || "",
        backer.shippingAddress || "",
        backer.shippingCity || "",
        backer.shippingState || "",
        backer.shippingCountry || "",
      ];

      // Reward columns (1 if backer has this reward, 0 if not)
      const rewardCols = (data.allRewards || []).map((r) =>
        backer.rewardId === r.id ? "1" : "0"
      );

      // Addon columns (quantity if backer has this addon, 0 if not)
      const addonCols = (data.allAddons || []).map((a) =>
        (backer.addonsMap?.[a.id] || 0).toString()
      );

      return [...fixedCols, ...rewardCols, ...addonCols];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backers-${data.selectedProject?.slug || "export"}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.recentBackers.length} backers to CSV`);
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
            </div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md mx-auto bg-card/50 backdrop-blur border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchDashboardData} className="bg-gradient-to-r from-primary to-purple-500">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No projects state
  if (!data?.projects.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>

        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                IndieCrowdfund
              </Link>
              <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
                <Sparkles className="w-3 h-3 mr-1" />
                Creator Dashboard
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <NotificationsDropdown />
              <Link href="/dashboard/settings">
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        <div className="container relative py-20">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center animate-pulse">
              <Plus className="h-12 w-12 text-primary" />
            </div>
            <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Create Your First Project
            </h1>
            <p className="mb-8 text-muted-foreground">
              Start bringing your creative vision to life. Create a crowdfunding campaign
              and connect with backers who believe in your project.
            </p>
            <Link href="/projects/new">
              <Button size="lg" className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                <Plus className="mr-2 h-5 w-5" />
                Create Project
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const project = data.selectedProject;
  const stats = data.stats;
  const fundingPercent = project
    ? (Number(project.currentAmount) / Number(project.goalAmount)) * 100
    : 0;

  // Get the last 10 days of funding data for the chart
  const chartData = data.fundingData.slice(-10).map(d => ({
    label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: d.amount,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Creator Dashboard
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <Link href="/dashboard/settings" className="hidden sm:block">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <div className="border-b bg-background/60 backdrop-blur-sm">
        <div className="container flex flex-wrap items-center gap-2 py-3 md:h-14 md:py-0 md:gap-4">
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-full sm:w-[280px] bg-card/50 backdrop-blur border-border/50">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {data.projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {project && (() => {
            const hasEnded = project.endDate ? new Date(project.endDate) < new Date() : false;
            const displayStatus = hasEnded && project.status === "LIVE" ? "ENDED" : project.status;
            return (
              <Badge
                className={cn(
                  "font-medium",
                  displayStatus === "LIVE" && "bg-gradient-to-r from-green-500 to-emerald-600 border-0",
                  displayStatus === "ENDED" && "bg-gradient-to-r from-rose-500 to-red-600 border-0",
                  displayStatus === "FUNDED" && "bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
                )}
              >
                {displayStatus === "LIVE" && <Zap className="w-3 h-3 mr-1" />}
                {displayStatus === "FUNDED" && <CheckCircle className="w-3 h-3 mr-1" />}
                {displayStatus}
              </Badge>
            );
          })()}
          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
            {project && (
              <>
                <Link href={project.projectUrl} className="flex-1 sm:flex-initial">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto hover:border-primary/50 bg-card/50 backdrop-blur">
                    <Eye className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">View</span>
                    <span className="xs:hidden">View</span>
                  </Button>
                </Link>
                <Link href={`${project.projectUrl}/edit`} className="flex-1 sm:flex-initial">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto hover:border-primary/50 bg-card/50 backdrop-blur">
                    <Settings className="mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">Edit</span>
                    <span className="xs:hidden">Edit</span>
                  </Button>
                </Link>
                <Button size="sm" className="flex-1 sm:flex-initial bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                  <Share2 className="mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">Share</span>
                  <span className="xs:hidden">Share</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container relative py-6">
        {project && stats ? (
          <>
            {/* Stats Overview - Animated */}
            <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <GlowingStatCard
                title="Total Pledged"
                value={Number(project.currentAmount)}
                prefix="$"
                icon={DollarSign}
                color="green"
                subtitle={`${fundingPercent.toFixed(0)}% of $${Number(project.goalAmount).toLocaleString()} goal`}
                delay={0}
              />
              <GlowingStatCard
                title="Backers"
                value={project.backerCount}
                icon={Users}
                color="blue"
                trend={stats.todayBackers > 0 ? { value: stats.todayBackers, label: "today" } : undefined}
                subtitle={stats.todayBackers === 0 ? "No new backers today" : undefined}
                delay={100}
              />
              <GlowingStatCard
                title="Page Views"
                value={stats.todayViews}
                icon={Eye}
                color="purple"
                trend={stats.weeklyGrowth !== 0 ? { value: Math.abs(stats.weeklyGrowth), isPositive: stats.weeklyGrowth > 0, label: "this week" } : undefined}
                subtitle={stats.weeklyGrowth === 0 ? "No change this week" : undefined}
                delay={200}
              />
              <GlowingStatCard
                title="Days Remaining"
                value={project.daysRemaining}
                icon={Clock}
                color={project.daysRemaining <= 7 ? "amber" : "cyan"}
                subtitle={project.endDate ? `Ends ${new Date(project.endDate).toLocaleDateString()}` : "No end date set"}
                delay={300}
                pulse={project.daysRemaining <= 3}
              />
            </div>

            {/* Funding Progress Bar */}
            <Card className="mb-6 bg-card/50 backdrop-blur border-border/50 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Campaign Progress</span>
                  <span className="text-sm text-muted-foreground">
                    <span className="font-bold text-primary">${Number(project.currentAmount).toLocaleString()}</span>
                    {" "}of ${Number(project.goalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                  />
                  {fundingPercent >= 100 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-transparent animate-pulse" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Main Content */}
            <Tabs defaultValue="overview" className="space-y-6">
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="inline-flex w-max md:w-auto bg-card/50 backdrop-blur border border-border/50 p-1">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="backers" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Users className="mr-2 h-4 w-4" />
                    Backers
                  </TabsTrigger>
                  <TabsTrigger value="rewards" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Package className="mr-2 h-4 w-4" />
                    Rewards
                  </TabsTrigger>
                  <TabsTrigger value="messages" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Messages
                  </TabsTrigger>
                  <Link href="/dashboard/email">
                    <TabsTrigger value="email" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50 hover:text-foreground">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Email
                      </div>
                    </TabsTrigger>
                  </Link>
                  <Link href="/dashboard/email-marketing">
                    <TabsTrigger value="email-marketing" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50 hover:text-foreground">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Marketing
                      </div>
                    </TabsTrigger>
                  </Link>
                  <TabsTrigger value="fulfillment" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-purple-500 data-[state=active]:text-white">
                    <Truck className="mr-2 h-4 w-4" />
                    Fulfillment
                  </TabsTrigger>
                  <Link href="/dashboard/updates">
                    <TabsTrigger value="updates" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50 hover:text-foreground">
                        <FileText className="mr-2 h-4 w-4" />
                        Post Updates
                      </div>
                    </TabsTrigger>
                  </Link>
                  <Link href="/dashboard/social">
                    <TabsTrigger value="social" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50 hover:text-foreground">
                        <Sparkles className="mr-2 h-4 w-4" />
                        Social Hub
                      </div>
                    </TabsTrigger>
                  </Link>
                  <Link href="/dashboard/indiekit">
                    <TabsTrigger value="indiekit" asChild>
                      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50 hover:text-foreground">
                        <Package className="mr-2 h-4 w-4" />
                        IndieKit
                      </div>
                    </TabsTrigger>
                  </Link>
                </TabsList>
              </div>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Funding Chart */}
                  <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/20">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        Funding Progress
                      </CardTitle>
                      <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[120px] bg-card/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">Last 7 days</SelectItem>
                          <SelectItem value="14">Last 14 days</SelectItem>
                          <SelectItem value="30">Last 30 days</SelectItem>
                          <SelectItem value="90">All time</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardHeader>
                    <CardContent>
                      {chartData.length > 0 ? (
                        <AnimatedBarChart data={chartData} height={250} color="primary" />
                      ) : (
                        <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                            <p>No funding data yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Backers */}
                  <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/20">
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        Recent Backers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.recentBackers.length > 0 ? (
                        <div className="space-y-4">
                          {data.recentBackers.slice(0, 5).map((backer, index) => (
                            <div
                              key={backer.id}
                              className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/30 transition-all duration-300 animate-in fade-in slide-in-from-right"
                              style={{ animationDelay: `${index * 100}ms` }}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                                  {backer.image && <AvatarImage src={backer.image} />}
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-purple-500/20">
                                    {backer.name[0]?.toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium">{backer.name}</p>
                                    <Badge
                                      variant={backer.status === "COMPLETED" ? "default" : "secondary"}
                                      className={cn(
                                        "text-[10px] px-1.5 py-0",
                                        backer.status === "COMPLETED" && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                                      )}
                                    >
                                      {backer.status}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {backer.reward}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-primary">${backer.amount}</p>
                                <p className="text-xs text-muted-foreground">
                                  {backer.time}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-muted-foreground">No backers yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Traffic Sources */}
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/20">
                        <Target className="h-4 w-4 text-purple-500" />
                      </div>
                      Traffic Sources
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.referrers.length > 0 ? (
                      <div className="space-y-4">
                        {data.referrers.map((referrer, i) => (
                          <div key={i} className="flex items-center gap-4 p-2 rounded-xl hover:bg-muted/20 transition-colors">
                            <div className="w-28 text-sm font-medium truncate">
                              {referrer.source}
                            </div>
                            <div className="flex-1">
                              <div className="flex h-2 overflow-hidden rounded-full bg-muted/30">
                                <div
                                  className="bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                                  style={{ width: `${referrer.percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="w-16 text-right text-sm text-muted-foreground">
                              {referrer.visits.toLocaleString()}
                            </div>
                            <div className="w-16 text-right text-sm font-medium">
                              {referrer.pledges}
                            </div>
                            <div className="w-24 text-right text-sm font-bold text-primary">
                              ${Number(referrer.amount).toLocaleString()}
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-4 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                          <div className="w-28" />
                          <div className="flex-1" />
                          <div className="w-16 text-right">Visits</div>
                          <div className="w-16 text-right">Pledges</div>
                          <div className="w-24 text-right">Amount</div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <Target className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No traffic data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                  <GlowingStatCard
                    title="Conversion Rate"
                    value={stats.conversionRate}
                    suffix="%"
                    icon={Target}
                    color="purple"
                    subtitle="Visitors who pledge"
                    delay={0}
                  />
                  <GlowingStatCard
                    title="Average Pledge"
                    value={stats.avgPledge}
                    prefix="$"
                    icon={DollarSign}
                    color="green"
                    subtitle="Per backer"
                    delay={100}
                  />
                  <GlowingStatCard
                    title="Today's Pledges"
                    value={stats.todayPledges}
                    prefix="$"
                    icon={TrendingUp}
                    color="blue"
                    trend={stats.dailyChange !== 0 ? { value: Math.abs(stats.dailyChange), isPositive: stats.dailyChange > 0, label: "vs yesterday" } : undefined}
                    subtitle={stats.dailyChange === 0 ? "Same as yesterday" : undefined}
                    delay={200}
                  />
                </div>
              </TabsContent>

              <TabsContent value="rewards" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/20">
                        <Gift className="h-4 w-4 text-purple-500" />
                      </div>
                      Reward Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.rewardStats.length > 0 ? (
                      <div className="space-y-4">
                        {data.rewardStats.map((reward, index) => (
                          <div
                            key={reward.id}
                            className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-gradient-to-r from-muted/20 to-transparent hover:border-primary/30 transition-all animate-in fade-in slide-in-from-left"
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            <div>
                              <p className="font-medium">{reward.title}</p>
                              <p className="text-sm text-muted-foreground">
                                ${reward.amount}
                              </p>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-center">
                                <p className="text-lg font-bold">{reward.backers}</p>
                                <p className="text-xs text-muted-foreground">Backers</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-primary">
                                  ${Number(reward.total).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">Total</p>
                              </div>
                              {reward.remaining !== null && (
                                <div className="text-center">
                                  <p className="text-lg font-bold">{reward.remaining}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Remaining
                                  </p>
                                </div>
                              )}
                              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <Gift className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No rewards created yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="backers" className="space-y-6">
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/20">
                        <Users className="h-4 w-4 text-blue-500" />
                      </div>
                      All Backers
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} className="hover:border-primary/50 bg-card/50">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {/* Bulk Actions Bar */}
                    {pendingPledges.length > 0 && (
                      <div className="mb-4 p-3 bg-muted/30 rounded-lg flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="select-all-pending"
                            checked={selectedPendingCount === pendingPledges.length && pendingPledges.length > 0}
                            onCheckedChange={toggleAllPending}
                          />
                          <label htmlFor="select-all-pending" className="text-sm cursor-pointer">
                            Select all pending ({pendingPledges.length})
                          </label>
                        </div>
                        {selectedPendingCount > 0 && (
                          <>
                            <span className="text-sm text-muted-foreground">
                              {selectedPendingCount} selected
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => setBulkAction({ open: true, action: "cancel" })}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Cancel Selected
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-rose-600 border-rose-200 hover:bg-rose-50"
                              onClick={() => setBulkAction({ open: true, action: "delete" })}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete Selected
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {data.recentBackers.length > 0 ? (
                      <div className="rounded-xl border border-border/50 overflow-x-auto">
                        <div className="grid grid-cols-7 gap-4 border-b border-border/50 bg-muted/30 p-3 text-sm font-medium min-w-[900px]">
                          <div className="w-8"></div>
                          <div>Backer</div>
                          <div>Reward</div>
                          <div>Amount</div>
                          <div>Status</div>
                          <div>Date</div>
                          <div>Actions</div>
                        </div>
                        {data.recentBackers.map((backer, index) => (
                          <div
                            key={backer.id}
                            className="grid grid-cols-7 gap-4 border-b border-border/50 p-3 text-sm last:border-0 min-w-[900px] items-center hover:bg-muted/20 transition-colors animate-in fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="w-8">
                              {backer.status === "PENDING" && (
                                <Checkbox
                                  checked={selectedPledges.has(backer.id)}
                                  onCheckedChange={() => togglePledgeSelection(backer.id)}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {backer.image && <AvatarImage src={backer.image} />}
                                <AvatarFallback className="text-xs">
                                  {backer.name[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{backer.name}</div>
                                {backer.email && (
                                  <div className="text-xs text-muted-foreground">{backer.email}</div>
                                )}
                              </div>
                            </div>
                            <div>{backer.reward}</div>
                            <div className="font-bold text-primary">${backer.amount}</div>
                            <div>
                              <Badge
                                className={cn(
                                  backer.status === "COMPLETED" && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
                                  backer.status === "PENDING" && "bg-amber-500/20 text-amber-500 border-amber-500/30",
                                  backer.status === "REFUNDED" && "bg-muted text-muted-foreground",
                                  backer.status === "CANCELLED" && "bg-rose-500/20 text-rose-500 border-rose-500/30"
                                )}
                              >
                                {backer.status}
                              </Badge>
                            </div>
                            <div className="text-muted-foreground">{backer.time}</div>
                            <div className="flex gap-2">
                              {backer.status === "PENDING" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                  onClick={() => setCancelConfirm({ open: true, pledgeId: backer.id })}
                                  disabled={cancellingPledge === backer.id}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {cancellingPledge === backer.id ? "..." : "Cancel"}
                                </Button>
                              )}
                              {backer.status === "COMPLETED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                  onClick={() => setRefundConfirm({ open: true, pledgeId: backer.id })}
                                  disabled={refundingPledge === backer.id}
                                >
                                  <RefreshCw className={`h-3 w-3 mr-1 ${refundingPledge === backer.id ? "animate-spin" : ""}`} />
                                  {refundingPledge === backer.id ? "..." : "Refund"}
                                </Button>
                              )}
                              {backer.status === "CANCELLED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                  onClick={() => setDeleteConfirm({ open: true, pledgeId: backer.id })}
                                  disabled={deletingPledge === backer.id}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  {deletingPledge === backer.id ? "..." : "Delete"}
                                </Button>
                              )}
                              {backer.status === "REFUNDED" && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-muted-foreground">No backers yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="messages">
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6 animate-pulse">
                      <MessageSquare className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="mb-2 font-semibold text-lg">Backer Messages</h3>
                    <p className="mb-6 text-sm text-muted-foreground text-center max-w-md">
                      Connect with your backers, answer questions, and keep them updated on your project&apos;s progress.
                    </p>
                    <Link href="/dashboard/messages">
                      <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Messages
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fulfillment" className="space-y-6">
                {data.fulfillmentStats && data.fulfillmentStats.totalBackers > 0 ? (
                  <>
                    {/* Fulfillment Progress Overview */}
                    <div className="grid gap-6 lg:grid-cols-3">
                      {/* Circular Progress */}
                      <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50">
                        <CardHeader>
                          <CardTitle className="text-center flex items-center justify-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/20">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            </div>
                            Fulfillment Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                          <CircularProgress
                            value={data.fulfillmentStats.fulfillmentPercentage}
                            size={180}
                            strokeWidth={12}
                            color="green"
                          />
                          <div className="mt-4 text-center">
                            <p className="text-lg font-semibold">
                              {data.fulfillmentStats.shippedBackers} of {data.fulfillmentStats.totalBackers} backers
                            </p>
                            <p className="text-sm text-muted-foreground">marked as shipped or delivered</p>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Status Breakdown */}
                      <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-500/20">
                              <Truck className="h-4 w-4 text-blue-500" />
                            </div>
                            Fulfillment Status Breakdown
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/50">
                              <div className="w-4 h-4 rounded-full bg-gray-400 mx-auto mb-2" />
                              <p className="text-2xl font-bold">{data.fulfillmentStats.statusBreakdown.notStarted}</p>
                              <p className="text-xs text-muted-foreground">Not Started</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                              <div className="w-4 h-4 rounded-full bg-blue-500 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-blue-500">{data.fulfillmentStats.statusBreakdown.inProgress}</p>
                              <p className="text-xs text-muted-foreground">In Progress</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                              <div className="w-4 h-4 rounded-full bg-amber-500 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-amber-500">{data.fulfillmentStats.statusBreakdown.shipped}</p>
                              <p className="text-xs text-muted-foreground">Shipped</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                              <div className="w-4 h-4 rounded-full bg-emerald-500 mx-auto mb-2" />
                              <p className="text-2xl font-bold text-emerald-500">{data.fulfillmentStats.statusBreakdown.delivered}</p>
                              <p className="text-xs text-muted-foreground">Delivered</p>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-6">
                            <div className="flex h-4 rounded-full overflow-hidden bg-muted/30">
                              {data.fulfillmentStats.statusBreakdown.delivered > 0 && (
                                <div
                                  className="bg-emerald-500 transition-all duration-500"
                                  style={{
                                    width: `${(data.fulfillmentStats.statusBreakdown.delivered / data.fulfillmentStats.totalBackers) * 100}%`,
                                  }}
                                />
                              )}
                              {data.fulfillmentStats.statusBreakdown.shipped > 0 && (
                                <div
                                  className="bg-amber-500 transition-all duration-500"
                                  style={{
                                    width: `${(data.fulfillmentStats.statusBreakdown.shipped / data.fulfillmentStats.totalBackers) * 100}%`,
                                  }}
                                />
                              )}
                              {data.fulfillmentStats.statusBreakdown.inProgress > 0 && (
                                <div
                                  className="bg-blue-500 transition-all duration-500"
                                  style={{
                                    width: `${(data.fulfillmentStats.statusBreakdown.inProgress / data.fulfillmentStats.totalBackers) * 100}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Items to Fulfill */}
                    <Card className="bg-card/50 backdrop-blur border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-500/20">
                            <Package className="h-4 w-4 text-purple-500" />
                          </div>
                          Items to Fulfill
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Complete breakdown of all items needed to fulfill your campaign
                        </p>
                      </CardHeader>
                      <CardContent>
                        {data.fulfillmentStats.items.length > 0 ? (
                          <div className="rounded-xl border border-border/50 overflow-hidden">
                            <div className="grid grid-cols-12 gap-4 bg-muted/30 p-3 text-sm font-medium">
                              <div className="col-span-1">Type</div>
                              <div className="col-span-8">Item Name</div>
                              <div className="col-span-3 text-right">Quantity Needed</div>
                            </div>
                            {data.fulfillmentStats.items.map((item, index) => (
                              <div
                                key={index}
                                className="grid grid-cols-12 gap-4 p-3 text-sm border-t border-border/50 items-center hover:bg-muted/20 transition-colors animate-in fade-in"
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <div className="col-span-1">
                                  {item.type === "reward" ? (
                                    <div className="p-1.5 rounded-lg bg-primary/20 inline-block">
                                      <Gift className="h-4 w-4 text-primary" />
                                    </div>
                                  ) : (
                                    <div className="p-1.5 rounded-lg bg-amber-500/20 inline-block">
                                      <Box className="h-4 w-4 text-amber-500" />
                                    </div>
                                  )}
                                </div>
                                <div className="col-span-8 flex items-center gap-2">
                                  <span className="font-medium">{item.name}</span>
                                  <Badge
                                    className={cn(
                                      item.type === "reward" ? "bg-primary/20 text-primary border-primary/30" : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                                    )}
                                  >
                                    {item.type === "reward" ? "Reward" : "Add-on"}
                                  </Badge>
                                </div>
                                <div className="col-span-3 text-right">
                                  <span className="text-lg font-bold">{item.count.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                            <div className="grid grid-cols-12 gap-4 p-3 bg-muted/30 border-t border-border/50 font-medium">
                              <div className="col-span-9">Total Items</div>
                              <div className="col-span-3 text-right text-lg text-primary">
                                {data.fulfillmentStats.items.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 text-center">
                            <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-muted-foreground">
                              No items to fulfill yet. Reward items will appear here once backers pledge.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Link to IndieKit */}
                    <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border-primary/20">
                      <CardContent className="py-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">Need more fulfillment tools?</h4>
                            <p className="text-sm text-muted-foreground">
                              Use IndieKit for advanced fulfillment management, backer surveys, shipping integration, and more.
                            </p>
                          </div>
                          <Link href="/dashboard/indiekit">
                            <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                              <Package className="mr-2 h-4 w-4" />
                              Open IndieKit
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card className="bg-card/50 backdrop-blur border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
                        <Truck className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="mb-2 font-semibold text-lg">Fulfillment available after funding</h3>
                      <p className="mb-4 text-center text-sm text-muted-foreground max-w-md">
                        Once your campaign ends successfully, you&apos;ll be able to manage
                        backer surveys and reward fulfillment here
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6 mx-auto">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Select a project to view dashboard</p>
          </div>
        )}
      </div>

      {/* Cancel Pledge Confirmation */}
      <ConfirmDialog
        open={cancelConfirm.open}
        onOpenChange={(open) => setCancelConfirm({ ...cancelConfirm, open })}
        title="Cancel Pledge?"
        description="Are you sure you want to cancel this pledge? This will remove the backer and amount from your campaign."
        confirmText="Cancel Pledge"
        variant="destructive"
        onConfirm={handleCancelPledge}
        loading={cancellingPledge === cancelConfirm.pledgeId}
      />

      {/* Refund Pledge Confirmation */}
      <ConfirmDialog
        open={refundConfirm.open}
        onOpenChange={(open) => setRefundConfirm({ ...refundConfirm, open })}
        title="Refund Pledge?"
        description="Are you sure you want to refund this pledge? This will process a refund via Stripe and remove the backer from your campaign."
        confirmText="Refund"
        variant="destructive"
        onConfirm={handleRefundPledge}
        loading={refundingPledge === refundConfirm.pledgeId}
      />

      {/* Delete Pledge Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Delete Pledge?"
        description="Are you sure you want to permanently delete this pledge? This cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeletePledge}
        loading={deletingPledge === deleteConfirm.pledgeId}
      />

      {/* Bulk Cancel Confirmation */}
      <ConfirmDialog
        open={bulkAction.open && bulkAction.action === "cancel"}
        onOpenChange={(open) => setBulkAction({ ...bulkAction, open })}
        title={`Cancel ${selectedPendingCount} Pledge(s)?`}
        description="Are you sure you want to cancel all selected pending pledges? This will mark them as cancelled and remove them from your campaign totals."
        confirmText={`Cancel ${selectedPendingCount} Pledge(s)`}
        variant="destructive"
        onConfirm={handleBulkCancel}
        loading={bulkProcessing}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkAction.open && bulkAction.action === "delete"}
        onOpenChange={(open) => setBulkAction({ ...bulkAction, open })}
        title={`Delete ${selectedPendingCount} Pledge(s)?`}
        description="Are you sure you want to permanently delete all selected pending pledges? This will completely remove them from the database and cannot be undone."
        confirmText={`Delete ${selectedPendingCount} Pledge(s)`}
        variant="destructive"
        onConfirm={handleBulkDelete}
        loading={bulkProcessing}
      />
    </div>
  );
}
