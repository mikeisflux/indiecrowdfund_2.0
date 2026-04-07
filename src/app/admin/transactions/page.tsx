"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Download,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/fetch-utils";
import {
  type UnifiedTransaction,
  type TransactionStats,
  type Pagination,
  type TransactionDetail,
  type StripeLookupResult,
  exportCSV,
  StatsCards,
  TransactionFilters,
  TransactionTable,
  TransactionDetailDialog,
  StripeLookupDialog,
  BreakdownCards,
} from "./components";

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

  // Handle stripe lookup from detail dialog
  const handleStripeLookupFromDetail = (id: string) => {
    setStripeLookupId(id);
    setShowStripeLookup(true);
    setSelectedTransaction(null);
    setTransactionDetail(null);
  };

  // Handle closing detail dialog
  const handleCloseDetail = () => {
    setSelectedTransaction(null);
    setTransactionDetail(null);
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStripeLookup(true)}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Stripe Lookup
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(transactions)}>
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
      {stats && <StatsCards stats={stats} />}

      {/* Filters */}
      <TransactionFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        processorFilter={processorFilter}
        setProcessorFilter={setProcessorFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />

      {/* Transaction Table with Tabs */}
      <TransactionTable
        transactions={transactions}
        stats={stats}
        pagination={pagination}
        isLoading={isLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fetchDetail={fetchDetail}
        fetchTransactions={fetchTransactions}
      />

      {/* Processor & Type Breakdown */}
      {stats && <BreakdownCards stats={stats} />}

      {/* Detail and Lookup Dialogs */}
      <TransactionDetailDialog
        selectedTransaction={selectedTransaction}
        transactionDetail={transactionDetail}
        isLoadingDetail={isLoadingDetail}
        onClose={handleCloseDetail}
        onStripeLookup={handleStripeLookupFromDetail}
      />
      <StripeLookupDialog
        showStripeLookup={showStripeLookup}
        setShowStripeLookup={setShowStripeLookup}
        stripeLookupId={stripeLookupId}
        setStripeLookupId={setStripeLookupId}
        stripeLookupResult={stripeLookupResult}
        isLoadingStripeLookup={isLoadingStripeLookup}
        doStripeLookup={doStripeLookup}
      />
    </div>
  );
}
