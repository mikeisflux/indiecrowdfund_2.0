"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Coins,
  Search,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Gift,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fetchWithRetry } from "@/lib/fetch-utils";

interface Transaction {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  userBalance: number;
  amount: number;
  type: string;
  description: string | null;
  metadata: {
    requestId?: string;
    codePrefix?: string;
    codeSuffix?: string;
    previousBalance?: number;
    newBalance?: number;
    timestamp?: string;
    ip?: string;
    externalTransactionId?: string;
    redemptionId?: string;
    bonusPercent?: number;
    originalAmount?: number;
  } | null;
  pledgeId: string | null;
  pledgeAmount: number | null;
  projectTitle: string | null;
  createdAt: string;
}

interface Stats {
  totalRedemptions: number;
  totalPayments: number;
  totalRefunds: number;
  redemptionTotal: number;
  paymentTotal: number;
  refundTotal: number;
  uniqueUsers: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function DivinityCoinRedemptionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRedemptions: 0,
    totalPayments: 0,
    totalRefunds: 0,
    redemptionTotal: 0,
    paymentTotal: 0,
    refundTotal: 0,
    uniqueUsers: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());

      const response = await fetchWithRetry(
        `/api/admin/divinitycoin-redemptions?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setTransactions(data.transactions || []);
      setStats(data.stats || stats);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));
    } catch (error) {
      console.error("Error fetching redemption data:", error);
      toast.error("Failed to load redemption history");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchQuery, pagination.page, pagination.limit, stats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "REDEMPTION":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Redemption</Badge>;
      case "PAYMENT":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Payment</Badge>;
      case "REFUND":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Refund</Badge>;
      case "BONUS":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Bonus</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "REDEMPTION":
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case "PAYMENT":
        return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
      case "REFUND":
        return <RotateCcw className="h-4 w-4 text-amber-500" />;
      case "BONUS":
        return <Gift className="h-4 w-4 text-purple-500" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const getAmountColor = (amount: number) => {
    if (amount > 0) return "text-green-600";
    if (amount < 0) return "text-red-600";
    return "";
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-7 w-7 text-amber-500" />
            DivinityCoin Redemption History
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive history of all user code redemptions, payments, and refunds
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              Total Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.redemptionTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalRedemptions.toLocaleString()} codes redeemed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-blue-500" />
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.paymentTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalPayments.toLocaleString()} payments made
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-500" />
              Total Refunds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(stats.refundTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalRefunds.toLocaleString()} refunds issued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Unique Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              users with DC activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name, email, or description..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="REDEMPTION">Redemptions</SelectItem>
                <SelectItem value="PAYMENT">Payments</SelectItem>
                <SelectItem value="REFUND">Refunds</SelectItem>
                <SelectItem value="BONUS">Bonuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Loading...</p>
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Coins className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground">No transactions found</p>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={tx.userImage || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(tx.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{tx.userName || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{tx.userEmail}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(tx.type)}
                        {getTypeBadge(tx.type)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[250px]">
                        {tx.description || "-"}
                      </p>
                      {tx.projectTitle && (
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          Project: {tx.projectTitle}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${getAmountColor(tx.amount)}`}>
                        {tx.amount > 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{formatDate(tx.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total.toLocaleString()} transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTransaction && getTypeIcon(selectedTransaction.type)}
              Transaction Details
            </DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedTransaction.userImage || undefined} />
                  <AvatarFallback>{getInitials(selectedTransaction.userName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedTransaction.userName || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{selectedTransaction.userEmail}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="font-medium">{formatCurrency(selectedTransaction.userBalance)}</p>
                </div>
              </div>

              {/* Transaction Info */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  {getTypeBadge(selectedTransaction.type)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className={`font-medium ${getAmountColor(selectedTransaction.amount)}`}>
                    {selectedTransaction.amount > 0 ? "+" : ""}
                    {formatCurrency(selectedTransaction.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-right max-w-[250px]">{selectedTransaction.description || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDate(selectedTransaction.createdAt)}</span>
                </div>
                {selectedTransaction.projectTitle && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Project</span>
                    <span>{selectedTransaction.projectTitle}</span>
                  </div>
                )}
                {selectedTransaction.pledgeAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pledge Amount</span>
                    <span>{formatCurrency(selectedTransaction.pledgeAmount)}</span>
                  </div>
                )}
              </div>

              {/* Metadata / Audit Trail */}
              {selectedTransaction.metadata && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Audit Trail</p>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
                    {selectedTransaction.metadata.codePrefix && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Code</span>
                        <span className="font-mono">
                          {selectedTransaction.metadata.codePrefix}****
                          {selectedTransaction.metadata.codeSuffix}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.metadata.previousBalance !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Balance Before</span>
                        <span>{formatCurrency(selectedTransaction.metadata.previousBalance)}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.newBalance !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Balance After</span>
                        <span>{formatCurrency(selectedTransaction.metadata.newBalance)}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.ip && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IP Address</span>
                        <span className="font-mono">{selectedTransaction.metadata.ip}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.requestId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Request ID</span>
                        <span className="font-mono text-[10px] break-all">
                          {selectedTransaction.metadata.requestId}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.metadata.externalTransactionId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">External ID</span>
                        <span className="font-mono text-[10px] break-all">
                          {selectedTransaction.metadata.externalTransactionId}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.metadata.bonusPercent !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bonus Rate</span>
                        <span>{(selectedTransaction.metadata.bonusPercent * 100).toFixed(2)}%</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.timestamp && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timestamp</span>
                        <span>{new Date(selectedTransaction.metadata.timestamp).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground font-mono">
                ID: {selectedTransaction.id}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
