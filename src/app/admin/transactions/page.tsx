"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  DollarSign,
  Eye,
  ArrowLeft,
  TrendingUp,
  Activity,
  AlertTriangle,
  Clock,
  CreditCard,
  Coins,
  ExternalLink,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/fetch-utils";

// Types
interface UnifiedTransaction {
  id: string;
  type: "PLEDGE" | "MARKETPLACE" | "DC_TRANSACTION" | "DC_REDEMPTION" | "PAYOUT" | "SETTLEMENT";
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  projectId: string | null;
  projectName: string | null;
  itemDescription: string;
  amount: number;
  currency: string;
  processorFees: number;
  platformFees: number;
  paymentProcessor: string | null;
  stripePaymentIntentId: string | null;
  stripeSetupIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  divinityCoinPaymentId: string | null;
  externalTransactionId: string | null;
  status: string;
  failureReason: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  chargedImmediately: boolean | null;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  metadata: Record<string, unknown> | null;
}

interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  pledgeCount: number;
  pledgeVolume: number;
  pledgeCompleted: number;
  pledgeFailed: number;
  pledgePending: number;
  pledgeRefunded: number;
  marketplaceCount: number;
  marketplaceVolume: number;
  failedTransactions: number;
  refundedTransactions: number;
  stripeTransactions: number;
  dcTransactions: number;
  todayTransactions: number;
  todayVolume: number;
  totalPlatformFees: number;
  totalProcessorFees: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TransactionDetail {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface StripeLookupResult {
  lookupType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stripe?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  databaseMatch?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagnostics?: Record<string, any>;
}

export default function TransactionsPage() {
  // Data state
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processorFilter, setProcessorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail view state
  const [selectedTransaction, setSelectedTransaction] = useState<UnifiedTransaction | null>(null);
  const [transactionDetail, setTransactionDetail] = useState<TransactionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Stripe lookup state
  const [showStripeLookup, setShowStripeLookup] = useState(false);
  const [stripeLookupId, setStripeLookupId] = useState("");
  const [stripeLookupResult, setStripeLookupResult] = useState<StripeLookupResult | null>(null);
  const [isLoadingStripeLookup, setIsLoadingStripeLookup] = useState(false);

  // Fetch transactions
  const fetchTransactions = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeTab,
        status: statusFilter,
        processor: processorFilter,
        search: searchQuery,
        page: page.toString(),
        limit: "50",
      });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetchWithRetry(`/api/admin/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      setTransactions(data.transactions);
      setStats(data.stats);
      setPagination(data.pagination);
      if (data.queryErrors && data.queryErrors.length > 0) {
        toast.error(`Some queries failed: ${data.queryErrors.join(", ")}. Data may be incomplete.`);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, processorFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  // Fetch transaction detail
  const fetchDetail = async (txn: UnifiedTransaction) => {
    setSelectedTransaction(txn);
    setTransactionDetail(null);
    setIsLoadingDetail(true);

    try {
      const response = await fetchWithRetry(
        `/api/admin/transactions/${txn.id}?type=${txn.type}`
      );
      if (!response.ok) throw new Error("Failed to fetch detail");
      const data = await response.json();
      setTransactionDetail(data.detail);
    } catch (error) {
      console.error("Error fetching transaction detail:", error);
      toast.error("Failed to load transaction details");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Stripe lookup
  const doStripeLookup = async () => {
    if (!stripeLookupId.trim()) return;
    setIsLoadingStripeLookup(true);
    setStripeLookupResult(null);

    try {
      const response = await fetchWithRetry(
        `/api/admin/transactions/stripe-lookup?id=${encodeURIComponent(stripeLookupId.trim())}`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Lookup failed");
      }
      const data = await response.json();
      setStripeLookupResult(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lookup failed";
      toast.error(message);
    } finally {
      setIsLoadingStripeLookup(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    if (transactions.length === 0) {
      toast.info("No transactions to export");
      return;
    }

    const headers = [
      "Date",
      "Type",
      "Status",
      "User Name",
      "User Email",
      "Project/Item",
      "Description",
      "Amount",
      "Currency",
      "Processor",
      "Platform Fees",
      "Stripe PI ID",
      "Stripe SI ID",
      "DC Payment ID",
      "External Transaction ID",
      "Failure Reason",
      "Retry Count",
      "ID",
    ];

    const rows = transactions.map((t) => [
      t.createdAt,
      t.type,
      t.status,
      t.userName || "",
      t.userEmail,
      t.projectName || "",
      t.itemDescription,
      t.amount.toFixed(2),
      t.currency,
      t.paymentProcessor || "",
      t.platformFees.toFixed(2),
      t.stripePaymentIntentId || "",
      t.stripeSetupIntentId || "",
      t.divinityCoinPaymentId || "",
      t.externalTransactionId || "",
      t.failureReason || "",
      t.retryCount.toString(),
      t.id,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getTypeBadge = (type: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PLEDGE: { label: "Pledge", variant: "default" },
      MARKETPLACE: { label: "Marketplace", variant: "secondary" },
      DC_TRANSACTION: { label: "DC Transaction", variant: "outline" },
      DC_REDEMPTION: { label: "DC Redemption", variant: "outline" },
      PAYOUT: { label: "Payout", variant: "secondary" },
      SETTLEMENT: { label: "Settlement", variant: "secondary" },
    };
    const c = config[type] || { label: type, variant: "outline" as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string }> = {
      COMPLETED: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
      PENDING: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
      FAILED: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
      REFUNDED: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
      CANCELLED: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
      CHARGEBACK: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
      PROCESSING: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
      INITIATED: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    };
    const c = config[status] || { className: "bg-gray-100 text-gray-800" };
    return <Badge className={c.className}>{status}</Badge>;
  };

  const getProcessorBadge = (processor: string | null) => {
    if (!processor) return <span className="text-muted-foreground text-xs">N/A</span>;
    if (processor === "STRIPE") {
      return (
        <Badge variant="outline" className="gap-1">
          <CreditCard className="h-3 w-3" />
          Stripe
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Coins className="h-3 w-3" />
        DC
      </Badge>
    );
  };

  // Transaction detail dialog content
  const renderDetailView = () => {
    if (!selectedTransaction) return null;

    return (
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={() => {
          setSelectedTransaction(null);
          setTransactionDetail(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeft
                className="h-5 w-5 cursor-pointer hover:text-emerald-600"
                onClick={() => {
                  setSelectedTransaction(null);
                  setTransactionDetail(null);
                }}
              />
              Transaction Detail
              {getTypeBadge(selectedTransaction.type)}
              {getStatusBadge(selectedTransaction.status)}
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : transactionDetail ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Processor</p>
                  <p className="text-sm font-medium mt-1">{getProcessorBadge(selectedTransaction.paymentProcessor)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">{format(new Date(selectedTransaction.createdAt), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">ID</p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-mono truncate">{selectedTransaction.id}</p>
                    <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => copyToClipboard(selectedTransaction.id)} />
                  </div>
                </div>
              </div>

              {/* User Info */}
              {transactionDetail.user && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">User Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>{" "}
                        <span className="font-medium">{transactionDetail.user.name || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        <span className="font-medium">{transactionDetail.user.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">User ID:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.user.id}</span>
                      </div>
                      {transactionDetail.user.stripeCustomerId && (
                        <div>
                          <span className="text-muted-foreground">Stripe Customer:</span>{" "}
                          <span className="font-mono text-xs">{transactionDetail.user.stripeCustomerId}</span>
                        </div>
                      )}
                      {transactionDetail.user.divinityCoinBalance !== undefined && (
                        <div>
                          <span className="text-muted-foreground">DC Balance:</span>{" "}
                          <span className="font-medium">{formatCurrency(transactionDetail.user.divinityCoinBalance)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Project/Book Info */}
              {(transactionDetail.project || transactionDetail.book) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {transactionDetail.book ? "Book Information" : "Project Information"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {transactionDetail.project && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Title:</span>{" "}
                            <span className="font-medium">{transactionDetail.project.title}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>{" "}
                            <span>{transactionDetail.project.status}</span>
                          </div>
                          {transactionDetail.project.fundingGoal && (
                            <div>
                              <span className="text-muted-foreground">Funding:</span>{" "}
                              <span>{formatCurrency(transactionDetail.project.currentFunding)} / {formatCurrency(transactionDetail.project.fundingGoal)}</span>
                            </div>
                          )}
                          {transactionDetail.project.creator && (
                            <div>
                              <span className="text-muted-foreground">Creator:</span>{" "}
                              <span>{transactionDetail.project.creator.name || transactionDetail.project.creator.email}</span>
                            </div>
                          )}
                        </>
                      )}
                      {transactionDetail.book && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Title:</span>{" "}
                            <span className="font-medium">{transactionDetail.book.title}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Price:</span>{" "}
                            <span>{formatCurrency(transactionDetail.book.price)}</span>
                          </div>
                          {transactionDetail.book.creator && (
                            <div>
                              <span className="text-muted-foreground">Creator:</span>{" "}
                              <span>{transactionDetail.book.creator.name || transactionDetail.book.creator.email}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Payment Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {transactionDetail.record.stripePaymentIntentId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Stripe Payment Intent:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.record.stripePaymentIntentId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 ml-1"
                          onClick={() => {
                            setStripeLookupId(transactionDetail.record.stripePaymentIntentId);
                            setShowStripeLookup(true);
                            setSelectedTransaction(null);
                            setTransactionDetail(null);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1"
                          onClick={() => copyToClipboard(transactionDetail.record.stripePaymentIntentId)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {transactionDetail.record.stripeSetupIntentId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Stripe Setup Intent:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.record.stripeSetupIntentId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 ml-1"
                          onClick={() => {
                            setStripeLookupId(transactionDetail.record.stripeSetupIntentId);
                            setShowStripeLookup(true);
                            setSelectedTransaction(null);
                            setTransactionDetail(null);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1"
                          onClick={() => copyToClipboard(transactionDetail.record.stripeSetupIntentId)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {transactionDetail.record.stripePaymentMethodId && (
                      <div>
                        <span className="text-muted-foreground">Payment Method:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.record.stripePaymentMethodId}</span>
                      </div>
                    )}
                    {transactionDetail.record.stripeCustomerId && (
                      <div>
                        <span className="text-muted-foreground">Stripe Customer:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.record.stripeCustomerId}</span>
                      </div>
                    )}
                    {transactionDetail.record.divinityCoinPaymentId && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">DC Payment ID:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.record.divinityCoinPaymentId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 ml-1"
                          onClick={() => copyToClipboard(transactionDetail.record.divinityCoinPaymentId)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {transactionDetail.record.chargedImmediately !== undefined && (
                      <div>
                        <span className="text-muted-foreground">Charged Immediately:</span>{" "}
                        <span>{transactionDetail.record.chargedImmediately ? "Yes" : "No"}</span>
                      </div>
                    )}
                    {transactionDetail.record.backerNumber && (
                      <div>
                        <span className="text-muted-foreground">Backer #:</span>{" "}
                        <span className="font-medium">#{transactionDetail.record.backerNumber}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Amount Breakdown (for pledges) */}
              {transactionDetail.record.rewardAmount !== undefined && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Amount Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reward Amount:</span>
                        <span>{formatCurrency(transactionDetail.record.rewardAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Add-ons Amount:</span>
                        <span>{formatCurrency(transactionDetail.record.addonsAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping Amount:</span>
                        <span>{formatCurrency(transactionDetail.record.shippingAmount)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1 mt-1">
                        <span>Total:</span>
                        <span>{formatCurrency(transactionDetail.record.amount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fee Breakdown (for payouts) */}
              {transactionDetail.record.grossAmount !== undefined && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fee Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross Amount:</span>
                        <span>{formatCurrency(transactionDetail.record.grossAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Processor Fees:</span>
                        <span className="text-red-600">-{formatCurrency(transactionDetail.record.processorFees)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fees:</span>
                        <span className="text-red-600">-{formatCurrency(transactionDetail.record.platformFees)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1 mt-1">
                        <span>Net Payout:</span>
                        <span>{formatCurrency(transactionDetail.record.amount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Marketplace Fee Breakdown */}
              {transactionDetail.record.platformFee !== undefined && transactionDetail.type === "MARKETPLACE" && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fee Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sale Amount:</span>
                        <span>{formatCurrency(transactionDetail.record.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fee:</span>
                        <span className="text-red-600">-{formatCurrency(transactionDetail.record.platformFee)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1 mt-1">
                        <span>Creator Payout:</span>
                        <span>{formatCurrency(transactionDetail.record.creatorPayout)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Retry Info */}
              {transactionDetail.record.retryCount > 0 && (
                <Card className="border-yellow-200 dark:border-yellow-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      Retry Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Retry Count:</span>{" "}
                        <span className="font-medium">{transactionDetail.record.retryCount}</span>
                      </div>
                      {transactionDetail.record.nextRetryAt && (
                        <div>
                          <span className="text-muted-foreground">Next Retry:</span>{" "}
                          <span>{format(new Date(transactionDetail.record.nextRetryAt), "MMM d, yyyy h:mm a")}</span>
                        </div>
                      )}
                      {transactionDetail.record.lastFailureReason && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Last Failure:</span>{" "}
                          <span className="text-red-600">{transactionDetail.record.lastFailureReason}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reward & Addons */}
              {transactionDetail.reward && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Reward</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <p className="font-medium">{transactionDetail.reward.title}</p>
                      <p className="text-muted-foreground">{formatCurrency(transactionDetail.reward.amount)} - {transactionDetail.reward.type}</p>
                    </div>
                    {transactionDetail.addons && transactionDetail.addons.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-sm font-medium mb-2">Add-ons:</p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {transactionDetail.addons.map((addon: any) => (
                          <div key={addon.id} className="flex justify-between text-sm">
                            <span>{addon.addon.title} x{addon.quantity}</span>
                            <span>{formatCurrency(addon.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              {transactionDetail.timeline && transactionDetail.timeline.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Event Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {transactionDetail.timeline.map((event: any, idx: number) => (
                        <div key={idx} className="flex gap-3 text-sm">
                          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                          <div>
                            <p className="font-medium">{event.event}</p>
                            {event.detail && (
                              <p className="text-muted-foreground text-xs">{event.detail}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(event.date), "MMM d, yyyy h:mm:ss a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fulfillment Status */}
              {transactionDetail.record.fulfillmentStatus && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fulfillment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span>{" "}
                        {getStatusBadge(transactionDetail.record.fulfillmentStatus)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Survey:</span>{" "}
                        <span>{transactionDetail.record.surveyCompleted ? "Completed" : "Not completed"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Confirmation Email:</span>{" "}
                        <span>{transactionDetail.record.confirmationEmailSent ? "Sent" : "Not sent"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Download Info (for marketplace) */}
              {transactionDetail.record.downloadCount !== undefined && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Delivery Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Downloads:</span>{" "}
                        <span className="font-medium">{transactionDetail.record.downloadCount}</span>
                      </div>
                      {transactionDetail.record.lastDownloadedAt && (
                        <div>
                          <span className="text-muted-foreground">Last Download:</span>{" "}
                          <span>{format(new Date(transactionDetail.record.lastDownloadedAt), "MMM d, yyyy")}</span>
                        </div>
                      )}
                      {transactionDetail.record.deliveredAt && (
                        <div>
                          <span className="text-muted-foreground">Delivered:</span>{" "}
                          <span>{format(new Date(transactionDetail.record.deliveredAt), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Discount Code (for marketplace) */}
              {transactionDetail.discountCode && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Discount Code Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Code:</span>{" "}
                        <span className="font-mono">{transactionDetail.discountCode.code}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>{" "}
                        <span>{transactionDetail.discountCode.type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Discount:</span>{" "}
                        <span>{formatCurrency(transactionDetail.discountCode.discountAmount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Raw Data */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Raw Record Data
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-xs"
                      onClick={() => copyToClipboard(JSON.stringify(transactionDetail.record, null, 2))}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto">
                    {JSON.stringify(transactionDetail.record, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Failed to load details</p>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  // Stripe Lookup Dialog
  const renderStripeLookupDialog = () => (
    <Dialog open={showStripeLookup} onOpenChange={setShowStripeLookup}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Lookup Tool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Stripe ID (pi_xxx, seti_xxx, cs_xxx, or any ID)"
              value={stripeLookupId}
              onChange={(e) => setStripeLookupId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doStripeLookup()}
              className="font-mono text-sm"
            />
            <Button
              onClick={doStripeLookup}
              disabled={isLoadingStripeLookup || !stripeLookupId.trim()}
            >
              {isLoadingStripeLookup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Supported prefixes: <code>pi_</code> (Payment Intent), <code>seti_</code> (Setup Intent), <code>cs_</code> (Checkout Session), or any database/external ID
          </p>

          {stripeLookupResult && (
            <div className="space-y-4">
              {/* Diagnostics Summary */}
              {stripeLookupResult.diagnostics && (
                <Card className={stripeLookupResult.diagnostics.statusMismatch || stripeLookupResult.diagnostics.noDBRecord || stripeLookupResult.diagnostics.hasError ? "border-red-200 dark:border-red-800" : "border-green-200 dark:border-green-800"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {stripeLookupResult.diagnostics.statusMismatch || stripeLookupResult.diagnostics.noDBRecord || stripeLookupResult.diagnostics.hasError ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      Diagnostic Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(stripeLookupResult.diagnostics).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className={
                            key === "statusMismatch" && value === true ? "text-red-600 font-medium" :
                            key === "noDBRecord" && value === true ? "text-red-600 font-medium" :
                            key === "hasError" && value === true ? "text-red-600 font-medium" :
                            key === "isFullyPaid" && value === true ? "text-green-600 font-medium" :
                            ""
                          }>
                            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "N/A")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stripe Data */}
              {stripeLookupResult.stripe && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Stripe Response ({stripeLookupResult.lookupType})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-xs"
                        onClick={() => copyToClipboard(JSON.stringify(stripeLookupResult.stripe, null, 2))}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-80 overflow-y-auto">
                      {JSON.stringify(stripeLookupResult.stripe, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* DB Match */}
              {stripeLookupResult.databaseMatch && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Database Match</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(stripeLookupResult.databaseMatch, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            Comprehensive diagnostic view of all transactions across the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStripeLookup(true)}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Stripe Lookup
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransactions(pagination.page)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-xl font-bold mt-1">{stats.totalTransactions}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalVolume)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Today</span>
              </div>
              <p className="text-xl font-bold mt-1">{stats.todayTransactions}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.todayVolume)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <p className="text-xl font-bold mt-1">{stats.byStatus.COMPLETED || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              <p className="text-xl font-bold mt-1">{stats.byStatus.PENDING || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-muted-foreground">Failed</span>
              </div>
              <p className="text-xl font-bold mt-1 text-red-600">{stats.failedTransactions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Platform Fees</span>
              </div>
              <p className="text-xl font-bold mt-1">{formatCurrency(stats.totalPlatformFees)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, project, transaction ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="CHARGEBACK">Chargeback</SelectItem>
                </SelectContent>
              </Select>
              <Select value={processorFilter} onValueChange={setProcessorFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Processor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Processors</SelectItem>
                  <SelectItem value="STRIPE">Stripe</SelectItem>
                  <SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground sr-only">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[140px]"
                  placeholder="From date"
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground sr-only">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[140px]"
                  placeholder="To date"
                />
              </div>
              {(searchQuery || statusFilter !== "all" || processorFilter !== "all" || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setProcessorFilter("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1">
            All
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.totalTransactions}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pledge" className="gap-1">
            Pledges
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.PLEDGE}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-1">
            Marketplace
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.MARKETPLACE}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dc_transaction" className="gap-1">
            DC Txns
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.DC_TRANSACTION}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="payout" className="gap-1">
            Payouts
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.PAYOUT}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="settlement" className="gap-1">
            Settlements
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.SETTLEMENT}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* All tabs share the same table content */}
        {["all", "pledge", "marketplace", "dc_transaction", "dc_redemption", "payout", "settlement"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </CardContent>
              </Card>
            ) : transactions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No transactions found</p>
                  <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Date</TableHead>
                          <TableHead className="w-[100px]">Type</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Project / Item</TableHead>
                          <TableHead className="text-right w-[100px]">Amount</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[90px]">Processor</TableHead>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead className="w-[60px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((txn) => (
                          <TableRow
                            key={`${txn.type}-${txn.id}`}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              txn.status === "FAILED" ? "bg-red-50/50 dark:bg-red-950/10" :
                              txn.status === "CHARGEBACK" ? "bg-purple-50/50 dark:bg-purple-950/10" :
                              ""
                            }`}
                            onClick={() => fetchDetail(txn)}
                          >
                            <TableCell className="text-xs">
                              {format(new Date(txn.createdAt), "MMM d, yyyy")}
                              <br />
                              <span className="text-muted-foreground">
                                {format(new Date(txn.createdAt), "h:mm a")}
                              </span>
                            </TableCell>
                            <TableCell>{getTypeBadge(txn.type)}</TableCell>
                            <TableCell>
                              <div className="max-w-[180px]">
                                <p className="text-sm font-medium truncate">{txn.userName || "N/A"}</p>
                                <p className="text-xs text-muted-foreground truncate">{txn.userEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <p className="text-sm truncate">{txn.projectName || txn.itemDescription}</p>
                                {txn.projectName && txn.itemDescription !== txn.projectName && (
                                  <p className="text-xs text-muted-foreground truncate">{txn.itemDescription}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(txn.amount)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {getStatusBadge(txn.status)}
                                {txn.retryCount > 0 && (
                                  <span className="text-xs text-yellow-600">
                                    {txn.retryCount} retries
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getProcessorBadge(txn.paymentProcessor)}</TableCell>
                            <TableCell>
                              <div className="max-w-[160px]">
                                {txn.externalTransactionId ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-mono truncate">
                                      {txn.externalTransactionId}
                                    </span>
                                    <Copy
                                      className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(txn.externalTransactionId!);
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">N/A</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchDetail(txn);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagination.page <= 1}
                          onClick={() => fetchTransactions(pagination.page - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pagination.page >= pagination.totalPages}
                          onClick={() => fetchTransactions(pagination.page + 1)}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Processor & Type Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">By Payment Processor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Stripe</span>
                  </div>
                  <Badge variant="secondary">{stats.stripeTransactions}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">DivinityCoin</span>
                  </div>
                  <Badge variant="secondary">{stats.dcTransactions}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">By Transaction Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.byType)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm">{getTypeBadge(type)}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail and Lookup Dialogs */}
      {renderDetailView()}
      {renderStripeLookupDialog()}
    </div>
  );
}
