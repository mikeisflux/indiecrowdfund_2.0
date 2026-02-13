"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  User,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Undo2,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface TransactionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface TransactionPledge {
  id: string;
  amount: number;
  status: string;
  project: {
    id: string;
    title: string;
    slug: string;
  };
}

interface Transaction {
  id: string;
  userId: string;
  pledgeId: string | null;
  amount: number;
  type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: TransactionUser;
  pledge: TransactionPledge | null;
}

interface Stats {
  totalTransactions: number;
  payments: { count: number; total: number };
  redemptions: { count: number; total: number };
  refunds: { count: number; total: number };
  refundDeductions: { count: number; total: number };
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function DivinityCoinRedemptionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    payments: { count: 0, total: 0 },
    redemptions: { count: 0, total: 0 },
    refunds: { count: 0, total: 0 },
    refundDeductions: { count: 0, total: 0 },
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Detail dialog
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Create/Edit dialog
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formUserId, setFormUserId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState("PAYMENT");
  const [formDescription, setFormDescription] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/admin/divinitycoin-redemptions?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
      setStats(data.stats || {
        totalTransactions: 0,
        payments: { count: 0, total: 0 },
        redemptions: { count: 0, total: 0 },
        refunds: { count: 0, total: 0 },
        refundDeductions: { count: 0, total: 0 },
      });
      setPagination(data.pagination || {
        page: 1,
        limit: 50,
        totalCount: 0,
        totalPages: 0,
      });
    } catch (error) {
      console.error("Error fetching DC transactions:", error);
      toast.error("Failed to load DivinityCoin transactions");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, typeFilter, searchQuery]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(amount));
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "PAYMENT":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
            <CreditCard className="w-3 h-3 mr-1" />
            Payment
          </Badge>
        );
      case "REDEMPTION":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <ArrowDownLeft className="w-3 h-3 mr-1" />
            Redemption
          </Badge>
        );
      case "REFUND":
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            <Undo2 className="w-3 h-3 mr-1" />
            Refund
          </Badge>
        );
      case "REFUND_DEDUCTION":
        return (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <ArrowUpRight className="w-3 h-3 mr-1" />
            Refund Deduction
          </Badge>
        );
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // --- Create / Edit ---
  const openCreateDialog = () => {
    setEditingTransaction(null);
    setFormUserId("");
    setFormAmount("");
    setFormType("PAYMENT");
    setFormDescription("");
    setShowFormDialog(true);
  };

  const openEditDialog = (txn: Transaction) => {
    setEditingTransaction(txn);
    setFormUserId(txn.userId);
    setFormAmount(String(txn.amount));
    setFormType(txn.type);
    setFormDescription(txn.description || "");
    setSelectedTransaction(null);
    setShowFormDialog(true);
  };

  const handleFormSubmit = async () => {
    if (!formAmount || (!editingTransaction && !formUserId)) {
      toast.error("Please fill in all required fields");
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingTransaction) {
        // PATCH
        const response = await fetch("/api/admin/divinitycoin-redemptions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
            id: editingTransaction.id,
            amount: parseFloat(formAmount),
            type: formType,
            description: formDescription,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to update transaction");
        }

        toast.success("Transaction updated");
      } else {
        // POST
        const response = await fetch("/api/admin/divinitycoin-redemptions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
            userId: formUserId,
            amount: parseFloat(formAmount),
            type: formType,
            description: formDescription,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to create transaction");
        }

        toast.success("Transaction created");
      }

      setShowFormDialog(false);
      fetchTransactions();
    } catch (error) {
      console.error("Form submit error:", error);
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setFormSubmitting(false);
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/divinitycoin-redemptions?id=${deleteTarget.id}`,
        {
          method: "DELETE",
          headers: { ...getCSRFHeaders() },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete transaction");
      }

      toast.success("Transaction deleted");
      setDeleteTarget(null);
      setSelectedTransaction(null);
      fetchTransactions();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const csv = [
      ["ID", "Date", "User", "Email", "Type", "Amount", "Description", "Project", "Pledge ID"].join(","),
      ...transactions.map((t) =>
        [
          t.id,
          format(new Date(t.createdAt), "yyyy-MM-dd HH:mm:ss"),
          `"${t.user.name || "Unknown"}"`,
          t.user.email,
          t.type,
          t.amount,
          `"${t.description || ""}"`,
          `"${t.pledge?.project?.title || ""}"`,
          t.pledgeId || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `divinitycoin-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const goToPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Coins className="h-6 w-6 text-white" />
            </div>
            DC Transactions
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            DivinityCoin transaction history and audit log
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog} className="bg-purple-600 hover:bg-purple-700 flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Transaction</span>
          </Button>
          <Button variant="outline" onClick={fetchTransactions} disabled={loading} className="flex-1 sm:flex-none">
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={transactions.length === 0} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Payments</CardTitle>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.payments.count}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.payments.total)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Redemptions</CardTitle>
            <ArrowDownLeft className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.redemptions.count}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.redemptions.total)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Refunds</CardTitle>
            <Undo2 className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.refunds.count}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.refunds.total)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Total</CardTitle>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            <p className="text-xs text-zinc-500 mt-1">All transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Search by user name, email, or description..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PAYMENT">Payments</SelectItem>
                <SelectItem value="REDEMPTION">Redemptions</SelectItem>
                <SelectItem value="REFUND">Refunds</SelectItem>
                <SelectItem value="REFUND_DEDUCTION">Refund Deductions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Coins className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm">DivinityCoin transactions will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow
                    key={txn.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <TableCell className="whitespace-nowrap text-sm text-zinc-500">
                      {format(new Date(txn.createdAt), "MMM d, yyyy")}
                      <br />
                      <span className="text-xs">{format(new Date(txn.createdAt), "h:mm a")}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{txn.user.name || "Unknown"}</p>
                          <p className="text-xs text-zinc-500 truncate">{txn.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(txn.type)}</TableCell>
                    <TableCell>
                      <p className="text-sm text-zinc-600 truncate max-w-[200px]">
                        {txn.description || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {txn.pledge?.project ? (
                        <p className="text-sm text-zinc-600 truncate max-w-[150px]">
                          {txn.pledge.project.title}
                        </p>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-bold ${
                          txn.amount >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {txn.amount >= 0 ? "+" : ""}
                        {formatCurrency(txn.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransaction(txn);
                          }}
                          title="View details"
                        >
                          <Coins className="w-3.5 h-3.5 text-zinc-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(txn);
                          }}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(txn);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
            {pagination.totalCount} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-zinc-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedTransaction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-purple-600" />
                  Transaction Details
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Amount & Type */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <div>
                    <p className="text-sm text-zinc-500">Type</p>
                    <div className="mt-1">{getTypeBadge(selectedTransaction.type)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Amount</p>
                    <p
                      className={`text-2xl font-bold ${
                        selectedTransaction.amount >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {selectedTransaction.amount >= 0 ? "+" : ""}
                      {formatCurrency(selectedTransaction.amount)}
                    </p>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-zinc-500 mb-2">User</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedTransaction.user.name || "Unknown"}</p>
                      <p className="text-sm text-zinc-500">{selectedTransaction.user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedTransaction.description && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-zinc-500 mb-1">Description</p>
                    <p className="text-sm">{selectedTransaction.description}</p>
                  </div>
                )}

                {/* Project/Pledge Info */}
                {selectedTransaction.pledge && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-zinc-500 mb-2">Linked Pledge</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Project</span>
                        <span className="font-medium">{selectedTransaction.pledge.project.title}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pledge Amount</span>
                        <span className="font-medium">{formatCurrency(selectedTransaction.pledge.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pledge Status</span>
                        <Badge variant="outline" className="text-xs">
                          {selectedTransaction.pledge.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pledge ID</span>
                        <span className="text-xs font-mono text-zinc-400">{selectedTransaction.pledge.id}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-zinc-500 mb-2">Audit Metadata</p>
                    <div className="space-y-1 text-sm">
                      {Object.entries(selectedTransaction.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-4">
                          <span className="text-zinc-500 whitespace-nowrap">{key}</span>
                          <span className="font-mono text-xs text-zinc-600 truncate text-right">
                            {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-zinc-500 mb-2">Details</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Transaction ID</span>
                      <span className="font-mono text-xs text-zinc-400">{selectedTransaction.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Created</span>
                      <span>{format(new Date(selectedTransaction.createdAt), "MMM d, yyyy h:mm a")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit / Delete from detail view */}
              <DialogFooter className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => openEditDialog(selectedTransaction)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget(selectedTransaction);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? "Edit Transaction" : "Create Transaction"}
            </DialogTitle>
            <DialogDescription>
              {editingTransaction
                ? "Modify the transaction details below."
                : "Manually add a new DivinityCoin transaction record."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* User ID - only for create */}
            {!editingTransaction && (
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="e.g. clx9abc123..."
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                />
                <p className="text-xs text-zinc-500">
                  The user&apos;s database ID (find in admin Users page)
                </p>
              </div>
            )}

            {editingTransaction && (
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                <p className="text-xs text-zinc-500">User</p>
                <p className="font-medium text-sm">
                  {editingTransaction.user.name || editingTransaction.user.email}
                </p>
              </div>
            )}

            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                  <SelectItem value="REDEMPTION">Redemption</SelectItem>
                  <SelectItem value="REFUND">Refund</SelectItem>
                  <SelectItem value="REFUND_DEDUCTION">Refund Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-10"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-zinc-500">
                Use negative values for deductions (refunds, deductions)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="e.g. Manual adjustment for..."
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFormSubmit}
              disabled={formSubmitting || !formAmount || (!editingTransaction && !formUserId)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingTransaction ? (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Type</span>
                <span className="font-medium">{deleteTarget.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount</span>
                <span className="font-bold">
                  {deleteTarget.amount >= 0 ? "+" : ""}
                  {formatCurrency(deleteTarget.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">User</span>
                <span>{deleteTarget.user.name || deleteTarget.user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID</span>
                <span className="font-mono text-xs text-zinc-400">{deleteTarget.id}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Forever
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
