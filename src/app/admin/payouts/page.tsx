"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

// Payout interface
interface Payout {
  id: string;
  projectId: string;
  amount: number;
  grossAmount: number;
  processorFees: number;
  platformFees: number;
  type: "CAMPAIGN" | "LATE_PLEDGE" | "PLEDGE_MANAGER";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  payoutId: string | null;
  bankAccountLast4: string | null;
  sentAt: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    fundingGoal: number;
    currentFunding: number;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  };
}

interface PayoutStats {
  pending: number;
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

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch payouts
  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);

      const response = await fetch(`/api/admin/payouts?${params}`);
      if (!response.ok) throw new Error("Failed to fetch payouts");

      const data = await response.json();
      setPayouts(data.payouts);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  // Handle payout action
  const handlePayoutAction = async (payoutId: string, action: string) => {
    try {
      setProcessing(true);
      const response = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update payout");
      }

      await fetchPayouts();
      setShowProcessDialog(false);
      setSelectedPayout(null);
    } catch (error) {
      console.error("Error updating payout:", error);
      alert(error instanceof Error ? error.message : "Failed to update payout");
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
      case "PROCESSING":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case "COMPLETED":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-600"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "CAMPAIGN":
        return <Badge variant="secondary">Campaign</Badge>;
      case "LATE_PLEDGE":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Late Pledge</Badge>;
      case "PLEDGE_MANAGER":
        return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">Pledge Manager</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // Export payouts as CSV
  const exportPayouts = () => {
    const csv = [
      ["ID", "Project", "Creator", "Type", "Status", "Gross Amount", "Net Amount", "Platform Fees", "Processor Fees", "Created", "Sent"].join(","),
      ...payouts.map((p) =>
        [
          p.id,
          `"${p.project.title}"`,
          `"${p.project.user.name || p.project.user.email}"`,
          p.type,
          p.status,
          p.grossAmount,
          p.amount,
          p.platformFees,
          p.processorFees,
          p.createdAt,
          p.sentAt || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">Payouts</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage creator payouts and fund transfers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPayouts} className="flex-1 sm:flex-none">
            <RefreshCw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportPayouts} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Pending Payouts</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">
              {formatCurrency(stats?.pendingAmount || 0)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Processing</CardTitle>
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processing || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">Currently in transit</p>
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
              {formatCurrency(stats?.completedAmount || 0)} paid out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Failed</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed || 0}</div>
            <p className="text-xs text-zinc-500 mt-1">Need attention</p>
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
                placeholder="Search by project, creator, or payout ID..."
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
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CAMPAIGN">Campaign</SelectItem>
                <SelectItem value="LATE_PLEDGE">Late Pledge</SelectItem>
                <SelectItem value="PLEDGE_MANAGER">Pledge Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Banknote className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No payouts found</p>
              <p className="text-sm">Payouts will appear here when projects are funded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net Payout</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {payout.project.thumbnailUrl ? (
                          <Image
                            src={payout.project.thumbnailUrl}
                            alt={payout.project.title}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{payout.project.title}</p>
                          <p className="text-xs text-zinc-500">
                            Goal: {formatCurrency(payout.project.fundingGoal)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payout.project.user.name || "Unknown"}</p>
                        <p className="text-xs text-zinc-500">{payout.project.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(payout.type)}</TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payout.grossAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(payout.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">
                      {formatDistanceToNow(new Date(payout.createdAt), { addSuffix: true })}
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
                              setSelectedPayout(payout);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <ArrowUpRight className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {payout.status === "PENDING" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPayout(payout);
                                setShowProcessDialog(true);
                              }}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Process Payout
                            </DropdownMenuItem>
                          )}
                          {payout.status === "FAILED" && (
                            <DropdownMenuItem
                              onClick={() => handlePayoutAction(payout.id, "RETRY")}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Retry Payout
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
                {pagination.total} payouts
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

      {/* Payout Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payout Details</DialogTitle>
            <DialogDescription>
              Complete breakdown of this payout transaction
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                {selectedPayout.project.thumbnailUrl ? (
                  <Image
                    src={selectedPayout.project.thumbnailUrl}
                    alt={selectedPayout.project.title}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded bg-zinc-100 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-zinc-400" />
                  </div>
                )}
                <div>
                  <p className="font-bold">{selectedPayout.project.title}</p>
                  <p className="text-sm text-zinc-500">
                    by {selectedPayout.project.user.name || selectedPayout.project.user.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-500">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedPayout.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Type</p>
                  <div className="mt-1">{getTypeBadge(selectedPayout.type)}</div>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Gross Amount</span>
                  <span className="font-medium">{formatCurrency(selectedPayout.grossAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Platform Fee (5%)</span>
                  <span className="text-red-500">-{formatCurrency(selectedPayout.platformFees)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Processor Fee</span>
                  <span className="text-red-500">-{formatCurrency(selectedPayout.processorFees)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Net Payout</span>
                  <span className="text-emerald-600">{formatCurrency(selectedPayout.amount)}</span>
                </div>
              </div>

              {selectedPayout.payoutId && (
                <div>
                  <p className="text-sm text-zinc-500">Payout ID</p>
                  <p className="font-mono text-sm">{selectedPayout.payoutId}</p>
                </div>
              )}

              {selectedPayout.bankAccountLast4 && (
                <div>
                  <p className="text-sm text-zinc-500">Bank Account</p>
                  <p className="font-medium">****{selectedPayout.bankAccountLast4}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Created</p>
                  <p>{format(new Date(selectedPayout.createdAt), "PPp")}</p>
                </div>
                {selectedPayout.sentAt && (
                  <div>
                    <p className="text-zinc-500">Sent</p>
                    <p>{format(new Date(selectedPayout.sentAt), "PPp")}</p>
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

      {/* Process Payout Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout</DialogTitle>
            <DialogDescription>
              This will initiate the payout transfer to the creator&apos;s bank account.
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Confirm Payout Processing
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      You are about to process a payout of{" "}
                      <strong>{formatCurrency(selectedPayout.amount)}</strong> to{" "}
                      <strong>{selectedPayout.project.user.name || selectedPayout.project.user.email}</strong>
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
              onClick={() => selectedPayout && handlePayoutAction(selectedPayout.id, "PROCESS")}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Process Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
