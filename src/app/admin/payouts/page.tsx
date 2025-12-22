"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Search,
  MoreHorizontal,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  Banknote,
  Building2,
  Play,
  RotateCcw,
  User,
  Plus,
  Trash2,
  Edit,
  Send,
  Eye,
  Ban,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// DivinityCoin Settlement interface
interface Settlement {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "INITIATED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  projectId: string | null;
  projectName: string | null;
  divinitySettlementId: string | null;
  divinityBatchId: string | null;
  initiatedAt: string | null;
  processedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  adminNotes: string | null;
  processedBy: string | null;
  createdAt: string;
  updatedAt: string;
  bankAccount: {
    id: string;
    bankNameDisplay: string | null;
    accountLastFour: string | null;
    accountType: string;
    isVerified: boolean;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
  } | null;
}

interface SettlementStats {
  pending: number;
  initiated: number;
  processing: number;
  completed: number;
  failed: number;
  pendingAmount: number;
  completedAmount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function DivinityPayoutsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Create/Edit form state
  const [formData, setFormData] = useState({
    bankAccountId: "",
    amount: "",
    projectId: "",
    adminNotes: "",
  });

  // Fetch settlements
  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/divinity-payouts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch settlements");

      const data = await response.json();
      setSettlements(data.settlements);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching settlements:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, statusFilter]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Handle settlement action
  const handleSettlementAction = async (settlementId: string, action: string, notes?: string) => {
    try {
      setProcessing(true);
      const response = await fetch("/api/admin/divinity-payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ settlementId, action, notes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settlement");
      }

      await fetchSettlements();
      setShowProcessDialog(false);
      setShowEditDialog(false);
      setSelectedSettlement(null);
    } catch (error) {
      console.error("Error updating settlement:", error);
      alert(error instanceof Error ? error.message : "Failed to update settlement");
    } finally {
      setProcessing(false);
    }
  };

  // Create new settlement
  const handleCreateSettlement = async () => {
    try {
      setProcessing(true);
      const response = await fetch("/api/admin/divinity-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          bankAccountId: formData.bankAccountId,
          amount: parseFloat(formData.amount),
          projectId: formData.projectId || null,
          adminNotes: formData.adminNotes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create settlement");
      }

      await fetchSettlements();
      setShowCreateDialog(false);
      setFormData({ bankAccountId: "", amount: "", projectId: "", adminNotes: "" });
    } catch (error) {
      console.error("Error creating settlement:", error);
      alert(error instanceof Error ? error.message : "Failed to create settlement");
    } finally {
      setProcessing(false);
    }
  };

  // Delete settlement
  const handleDeleteSettlement = async (settlementId: string) => {
    if (!confirm("Are you sure you want to delete this settlement? This action cannot be undone.")) {
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`/api/admin/divinity-payouts?id=${settlementId}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete settlement");
      }

      await fetchSettlements();
    } catch (error) {
      console.error("Error deleting settlement:", error);
      alert(error instanceof Error ? error.message : "Failed to delete settlement");
    } finally {
      setProcessing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "INITIATED":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Send className="w-3 h-3 mr-1" />Initiated</Badge>;
      case "PROCESSING":
        return <Badge variant="outline" className="text-indigo-600 border-indigo-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "COMPLETED":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-600"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary"><Ban className="w-3 h-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Export settlements as CSV
  const exportSettlements = () => {
    const csv = [
      ["ID", "Creator", "Email", "Bank", "Account Last 4", "Amount", "Status", "Project", "DivinityCoin ID", "Created", "Completed", "Notes"].join(","),
      ...settlements.map((s) =>
        [
          s.id,
          `"${s.bankAccount.user.name || "Unknown"}"`,
          `"${s.bankAccount.user.email}"`,
          `"${s.bankAccount.bankNameDisplay || "Unknown"}"`,
          s.bankAccount.accountLastFour || "",
          s.amount,
          s.status,
          `"${s.project?.title || "N/A"}"`,
          s.divinitySettlementId || "",
          s.createdAt,
          s.completedAt || "",
          `"${s.adminNotes || ""}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `divinity-settlements-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Banknote className="h-6 w-6 text-white" />
            </div>
            DivinityCoin Payouts
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage creator settlements for DivinityCoin payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSettlements} className="flex-1 sm:flex-none">
            <RefreshCw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportSettlements} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Settlement</span>
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <Banknote className="h-4 w-4 text-amber-600" />
        <AlertTitle>DivinityCoin Settlement Management</AlertTitle>
        <AlertDescription>
          This page manages payouts for creators who use DivinityCoin as their payment processor.
          Settlements are wired directly to creators&apos; bank accounts within 14 business days after campaign completion.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Pending</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">
              {formatCurrency(stats?.pendingAmount || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Initiated</CardTitle>
            <Send className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.initiated || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">Wire started</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Processing</CardTitle>
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processing || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Completed</CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">
              {formatCurrency(stats?.completedAmount || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Failed</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">Need attention</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Paid</CardTitle>
            <Banknote className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {formatCurrency(stats?.completedAmount || 0)}
            </div>
            <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Search by creator name, email, or settlement ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="INITIATED">Initiated</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Settlements Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : settlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Banknote className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No settlements found</p>
              <p className="text-sm">DivinityCoin settlements will appear here</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Settlement
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {settlement.bankAccount.user.image ? (
                          <Image
                            src={settlement.bankAccount.user.image}
                            alt={settlement.bankAccount.user.name || ""}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{settlement.bankAccount.user.name || "Unknown"}</p>
                          <p className="text-xs text-zinc-500">{settlement.bankAccount.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-zinc-400" />
                        <div>
                          <p className="font-medium text-sm">{settlement.bankAccount.bankNameDisplay || "Unknown"}</p>
                          <p className="text-xs text-zinc-500">
                            ••••{settlement.bankAccount.accountLastFour} ({settlement.bankAccount.accountType})
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {settlement.project ? (
                        <div className="flex items-center gap-2">
                          {settlement.project.imageUrl ? (
                            <Image
                              src={settlement.project.imageUrl}
                              alt={settlement.project.title}
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center">
                              <Banknote className="w-4 h-4 text-zinc-400" />
                            </div>
                          )}
                          <span className="text-sm truncate max-w-[150px]">{settlement.project.title}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-sm">Manual settlement</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(settlement.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">
                      {formatDistanceToNow(new Date(settlement.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSettlement(settlement);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {settlement.status === "PENDING" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSettlement(settlement);
                                  setShowProcessDialog(true);
                                }}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Initiate Wire
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSettlement(settlement);
                                  setFormData({
                                    bankAccountId: settlement.bankAccount.id,
                                    amount: settlement.amount.toString(),
                                    projectId: settlement.projectId || "",
                                    adminNotes: settlement.adminNotes || "",
                                  });
                                  setShowEditDialog(true);
                                }}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Settlement
                              </DropdownMenuItem>
                            </>
                          )}
                          {settlement.status === "INITIATED" && (
                            <DropdownMenuItem
                              onClick={() => handleSettlementAction(settlement.id, "MARK_PROCESSING")}
                            >
                              <Loader2 className="w-4 h-4 mr-2" />
                              Mark Processing
                            </DropdownMenuItem>
                          )}
                          {(settlement.status === "INITIATED" || settlement.status === "PROCESSING") && (
                            <DropdownMenuItem
                              onClick={() => handleSettlementAction(settlement.id, "MARK_COMPLETED")}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Completed
                            </DropdownMenuItem>
                          )}
                          {settlement.status === "FAILED" && (
                            <DropdownMenuItem
                              onClick={() => handleSettlementAction(settlement.id, "RETRY")}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Retry Settlement
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {settlement.status === "PENDING" && (
                            <DropdownMenuItem
                              onClick={() => handleDeleteSettlement(settlement.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                          {(settlement.status === "PENDING" || settlement.status === "INITIATED") && (
                            <DropdownMenuItem
                              onClick={() => handleSettlementAction(settlement.id, "CANCEL")}
                              className="text-red-600"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-zinc-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} settlements
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
            <DialogDescription>
              Complete breakdown of this DivinityCoin settlement
            </DialogDescription>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              {/* Creator Info */}
              <div className="flex items-center gap-3 pb-4 border-b">
                {selectedSettlement.bankAccount.user.image ? (
                  <Image
                    src={selectedSettlement.bankAccount.user.image}
                    alt={selectedSettlement.bankAccount.user.name || ""}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-zinc-400" />
                  </div>
                )}
                <div>
                  <p className="font-bold">{selectedSettlement.bankAccount.user.name || "Unknown"}</p>
                  <p className="text-sm text-zinc-500">{selectedSettlement.bankAccount.user.email}</p>
                </div>
              </div>

              {/* Bank Account */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-zinc-500" />
                  <span className="font-medium">Bank Account</span>
                </div>
                <p className="text-sm">{selectedSettlement.bankAccount.bankNameDisplay || "Unknown Bank"}</p>
                <p className="text-sm text-zinc-500">
                  Account ending in ••••{selectedSettlement.bankAccount.accountLastFour} ({selectedSettlement.bankAccount.accountType})
                </p>
                {selectedSettlement.bankAccount.isVerified ? (
                  <Badge variant="outline" className="mt-2 text-green-600 border-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mt-2 text-yellow-600 border-yellow-600">
                    <AlertCircle className="w-3 h-3 mr-1" />Unverified
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedSettlement.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Amount</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedSettlement.amount)}</p>
                </div>
              </div>

              {selectedSettlement.project && (
                <div>
                  <p className="text-sm text-zinc-500 mb-2">Project</p>
                  <div className="flex items-center gap-2">
                    {selectedSettlement.project.imageUrl && (
                      <Image
                        src={selectedSettlement.project.imageUrl}
                        alt={selectedSettlement.project.title}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    <span className="font-medium">{selectedSettlement.project.title}</span>
                  </div>
                </div>
              )}

              {selectedSettlement.divinitySettlementId && (
                <div>
                  <p className="text-sm text-zinc-500">DivinityCoin Settlement ID</p>
                  <p className="font-mono text-sm">{selectedSettlement.divinitySettlementId}</p>
                </div>
              )}

              {selectedSettlement.adminNotes && (
                <div>
                  <p className="text-sm text-zinc-500">Admin Notes</p>
                  <p className="text-sm bg-zinc-50 dark:bg-zinc-800 p-2 rounded">{selectedSettlement.adminNotes}</p>
                </div>
              )}

              {selectedSettlement.failureReason && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Failure Reason</AlertTitle>
                  <AlertDescription>{selectedSettlement.failureReason}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
                <div>
                  <p className="text-zinc-500">Created</p>
                  <p>{format(new Date(selectedSettlement.createdAt), "PPp")}</p>
                </div>
                {selectedSettlement.completedAt && (
                  <div>
                    <p className="text-zinc-500">Completed</p>
                    <p>{format(new Date(selectedSettlement.completedAt), "PPp")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Settlement Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Wire Transfer</DialogTitle>
            <DialogDescription>
              This will initiate a wire transfer to the creator&apos;s bank account.
            </DialogDescription>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Confirm Wire Transfer
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      You are about to initiate a wire transfer of{" "}
                      <strong>{formatCurrency(selectedSettlement.amount)}</strong> to{" "}
                      <strong>{selectedSettlement.bankAccount.user.name || selectedSettlement.bankAccount.user.email}</strong>
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-2">
                      Bank: {selectedSettlement.bankAccount.bankNameDisplay} (••••{selectedSettlement.bankAccount.accountLastFour})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedSettlement && handleSettlementAction(selectedSettlement.id, "INITIATE")}
              disabled={processing}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Initiate Wire
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Settlement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Settlement</DialogTitle>
            <DialogDescription>
              Manually create a DivinityCoin settlement for a creator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankAccountId">Bank Account ID</Label>
              <Input
                id="bankAccountId"
                placeholder="Enter creator's bank account ID"
                value={formData.bankAccountId}
                onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">Project ID (Optional)</Label>
              <Input
                id="projectId"
                placeholder="Link to a specific project"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Admin Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about this settlement..."
                value={formData.adminNotes}
                onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSettlement}
              disabled={processing || !formData.bankAccountId || !formData.amount}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Settlement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Settlement Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Settlement</DialogTitle>
            <DialogDescription>
              Update the settlement details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount (USD)</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Admin Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Add notes about this settlement..."
                value={formData.adminNotes}
                onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedSettlement && handleSettlementAction(
                selectedSettlement.id,
                "UPDATE",
                JSON.stringify({ amount: parseFloat(formData.amount), adminNotes: formData.adminNotes })
              )}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
