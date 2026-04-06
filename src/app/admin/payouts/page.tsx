"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Download,
  Banknote,
  RotateCcw,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

import {
  CreatorProject,
  PayoutStats,
  BankAccountDetails,
  CreatorBalance,
  BalanceStats,
} from "./components/types";
import { PayoutStatsCards } from "./components/PayoutStatsCards";
import { ProjectsTable } from "./components/ProjectsTable";
import { CreatorBalancesTable } from "./components/CreatorBalancesTable";
import { ProjectDetailDialog } from "./components/ProjectDetailDialog";
import { BankDetailsDialog } from "./components/BankDetailsDialog";
import { CreateSettlementDialog } from "./components/CreateSettlementDialog";
import { CreatorBalancePayoutDialog } from "./components/CreatorBalancePayoutDialog";

export default function PayoutsPage() {
  const [projects, setProjects] = useState<CreatorProject[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    totalProjects: 0,
    pendingPayouts: 0,
    processingPayouts: 0,
    settledPayouts: 0,
    overpaidPayouts: 0,
    totalAmountOwed: 0,
    totalAmountSettled: 0,
    totalRemaining: 0,
    totalRefunded: 0,
    totalOverpaid: 0,
    projectsWithoutBank: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<CreatorProject | null>(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [bankDetails, setBankDetails] = useState<BankAccountDetails | null>(null);
  const [loadingBankDetails, setLoadingBankDetails] = useState(false);
  const [showCreateSettlement, setShowCreateSettlement] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Creator balances state (for marketplace/indiekit earnings)
  const [creatorBalances, setCreatorBalances] = useState<CreatorBalance[]>([]);
  const [balanceStats, setBalanceStats] = useState<BalanceStats>({
    totalCreatorsWithBalance: 0,
    totalBalance: 0,
    creatorsWithoutBank: 0,
  });
  const [selectedCreator, setSelectedCreator] = useState<CreatorBalance | null>(null);
  const [showCreatorBalanceDialog, setShowCreatorBalanceDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "whop" | "balances">("projects");

  // Whop projects state
  const [whopProjects, setWhopProjects] = useState<CreatorProject[]>([]);
  const [whopStats, setWhopStats] = useState<PayoutStats>({
    totalProjects: 0, pendingPayouts: 0, processingPayouts: 0, settledPayouts: 0,
    overpaidPayouts: 0, totalAmountOwed: 0, totalAmountSettled: 0, totalRemaining: 0,
    totalRefunded: 0, totalOverpaid: 0, projectsWithoutBank: 0,
  });
  const [selectedWhopProject, setSelectedWhopProject] = useState<CreatorProject | null>(null);

  // Fetch Whop projects
  const fetchWhopProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      const response = await fetch(`/api/admin/payouts/whop?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch Whop payouts");
      const data = await response.json();
      setWhopProjects(data.projects || []);
      setWhopStats(data.stats || whopStats);
    } catch (error) {
      console.error("Error fetching Whop payouts:", error);
      toast.error("Failed to load Whop payouts");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery]);

  // Fetch projects that need payouts
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await fetch(`/api/admin/payouts/divinitycoin?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch creator payouts");
      }

      const data = await response.json();
      setProjects(data.projects || []);
      setStats(data.stats || {
        totalProjects: 0,
        pendingPayouts: 0,
        processingPayouts: 0,
        settledPayouts: 0,
        overpaidPayouts: 0,
        totalAmountOwed: 0,
        totalAmountSettled: 0,
        totalRemaining: 0,
        totalRefunded: 0,
        totalOverpaid: 0,
        projectsWithoutBank: 0,
      });
      // Set creator balances from marketplace/indiekit earnings
      setCreatorBalances(data.creatorBalances || []);
      setBalanceStats(data.balanceStats || {
        totalCreatorsWithBalance: 0,
        totalBalance: 0,
        creatorsWithoutBank: 0,
      });
    } catch (error) {
      console.error("Error fetching creator payouts:", error);
      toast.error("Failed to load creator payouts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchProjects();
    fetchWhopProjects();
  }, [fetchProjects, fetchWhopProjects]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // View bank account details
  const viewBankDetails = async (bankAccountId: string, type?: string) => {
    setLoadingBankDetails(true);
    setShowBankDetails(true);
    try {
      const url = type
        ? `/api/admin/bank-accounts/${bankAccountId}?type=${type}`
        : `/api/admin/bank-accounts/${bankAccountId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch bank account details");
      }
      const data = await response.json();
      setBankDetails(data);
    } catch (error) {
      console.error("Error fetching bank account:", error);
      toast.error("Failed to load bank account details");
      setShowBankDetails(false);
    } finally {
      setLoadingBankDetails(false);
    }
  };

  // Create settlement
  const createSettlement = async () => {
    if (!selectedProject || !settlementAmount) return;

    setProcessing(true);
    try {
      const response = await apiFetch("/api/admin/payouts/divinitycoin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: selectedProject.id,
          amount: parseFloat(settlementAmount),
          adminNotes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create settlement");
      }

      toast.success("Settlement created successfully");
      setShowCreateSettlement(false);
      setSettlementAmount("");
      setAdminNotes("");
      fetchProjects();
    } catch (error) {
      console.error("Error creating settlement:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create settlement");
    } finally {
      setProcessing(false);
    }
  };

  // Create Whop settlement
  const createWhopSettlement = async () => {
    if (!selectedWhopProject || !settlementAmount) return;
    setProcessing(true);
    try {
      const response = await apiFetch("/api/admin/payouts/whop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedWhopProject.id,
          amount: parseFloat(settlementAmount),
          adminNotes,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create settlement");
      }
      toast.success("Whop settlement created successfully");
      setShowCreateSettlement(false);
      setSettlementAmount("");
      setAdminNotes("");
      setSelectedWhopProject(null);
      fetchWhopProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create Whop settlement");
    } finally {
      setProcessing(false);
    }
  };

  // Create balance payout for marketplace/indiekit earnings
  const createBalancePayout = async () => {
    if (!selectedCreator || !settlementAmount) return;

    setProcessing(true);
    try {
      const response = await apiFetch("/api/admin/payouts/divinitycoin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creatorId: selectedCreator.id,
          amount: parseFloat(settlementAmount),
          adminNotes,
          type: "BALANCE_PAYOUT",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create balance payout");
      }

      toast.success("Balance payout created successfully");
      setShowCreatorBalanceDialog(false);
      setSettlementAmount("");
      setAdminNotes("");
      setSelectedCreator(null);
      fetchProjects();
    } catch (error) {
      console.error("Error creating balance payout:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create balance payout");
    } finally {
      setProcessing(false);
    }
  };

  // Export as CSV
  const exportCSV = () => {
    const csv = [
      ["Project", "Creator", "Email", "Total Raised", "Total Refunded", "Effective Revenue", "DC Partner Fee (3%)", "Per-Transaction Fee ($0.30/txn)", "Platform Fee (3%)", "Total Fees", "Amount Owed", "Amount Settled", "Remaining", "Has Bank", "Status"].join(","),
      ...projects.map((p) =>
        [
          `"${p.title}"`,
          `"${p.creator.name || "Unknown"}"`,
          p.creator.email,
          p.totalRaised,
          p.totalRefunded,
          p.effectiveRevenue,
          p.processorFee,
          p.perTransactionFee,
          p.platformFee,
          p.totalFees,
          p.amountOwed,
          p.amountSettled,
          p.remainingAmount,
          p.hasBank ? "Yes" : "No",
          p.settlementStatus,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `creator-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Banknote className="h-6 w-6 text-white" />
            </div>
            Creator Payouts
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage payouts to creators for funded campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchProjects} disabled={loading} className="flex-1 sm:flex-none">
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={projects.length === 0} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <PayoutStatsCards stats={stats} formatCurrency={formatCurrency} />

      {/* Refund/Overpaid Alert */}
      {(stats.totalRefunded > 0 || stats.overpaidPayouts > 0) && (
        <Alert className="border-red-200 bg-red-50">
          <RotateCcw className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800">Refunds Detected</AlertTitle>
          <AlertDescription className="text-red-700">
            {formatCurrency(stats.totalRefunded)} in total refunds issued across campaigns.
            {stats.overpaidPayouts > 0 && (
              <span className="font-medium"> {stats.overpaidPayouts} project(s) overpaid by {formatCurrency(stats.totalOverpaid)} — creator(s) owe money back.</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Creator Balances Alert (from Marketplace/IndieKit) */}
      {balanceStats.totalCreatorsWithBalance > 0 && (
        <Alert className="border-teal-200 bg-teal-50">
          <DollarSign className="h-4 w-4 text-teal-600" />
          <AlertTitle className="text-teal-800">Creator Balances Available</AlertTitle>
          <AlertDescription className="text-teal-700">
            {balanceStats.totalCreatorsWithBalance} creator(s) have balances totaling {formatCurrency(balanceStats.totalBalance)} from Marketplace and IndieKit sales.
            {balanceStats.creatorsWithoutBank > 0 && (
              <span className="font-medium"> ({balanceStats.creatorsWithoutBank} need bank setup)</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("projects")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "projects"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Campaign Payouts ({stats.totalProjects})
        </button>
        <button
          onClick={() => setActiveTab("whop")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "whop"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Whop Campaigns ({whopStats.totalProjects})
        </button>
        <button
          onClick={() => setActiveTab("balances")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "balances"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Creator Balances ({balanceStats.totalCreatorsWithBalance})
        </button>
      </div>

      {/* Projects Tab Content */}
      {activeTab === "projects" && (
        <ProjectsTable
          projects={projects}
          loading={loading}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          setSearchQuery={setSearchQuery}
          setStatusFilter={setStatusFilter}
          onSelectProject={setSelectedProject}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Whop Campaigns Tab Content */}
      {activeTab === "whop" && (
        <ProjectsTable
          projects={whopProjects}
          loading={false}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          setSearchQuery={setSearchQuery}
          setStatusFilter={setStatusFilter}
          onSelectProject={setSelectedWhopProject}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Creator Balances Tab Content */}
      {activeTab === "balances" && (
        <CreatorBalancesTable
          creatorBalances={creatorBalances}
          loading={loading}
          formatCurrency={formatCurrency}
          onPayoutCreator={(creator) => {
            setSelectedCreator(creator);
            setSettlementAmount(creator.balance.toFixed(2));
            setShowCreatorBalanceDialog(true);
          }}
        />
      )}

      {/* Creator Balance Payout Dialog */}
      <CreatorBalancePayoutDialog
        open={showCreatorBalanceDialog}
        onOpenChange={setShowCreatorBalanceDialog}
        selectedCreator={selectedCreator}
        settlementAmount={settlementAmount}
        setSettlementAmount={setSettlementAmount}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        processing={processing}
        onCreatePayout={createBalancePayout}
        formatCurrency={formatCurrency}
      />

      {/* Project Detail Dialog (DivinityCoin) */}
      <ProjectDetailDialog
        selectedProject={selectedProject}
        onClose={() => setSelectedProject(null)}
        onViewBankDetails={viewBankDetails}
        onCreateSettlement={(amount) => {
          setSettlementAmount(amount);
          setShowCreateSettlement(true);
        }}
        formatCurrency={formatCurrency}
      />

      {/* Whop Project Detail Dialog */}
      <ProjectDetailDialog
        selectedProject={selectedWhopProject}
        onClose={() => setSelectedWhopProject(null)}
        onViewBankDetails={(id) => viewBankDetails(id, "whop")}
        onCreateSettlement={(amount) => {
          setSettlementAmount(amount);
          setShowCreateSettlement(true);
        }}
        formatCurrency={formatCurrency}
      />

      {/* Bank Details Dialog */}
      <BankDetailsDialog
        open={showBankDetails}
        onOpenChange={setShowBankDetails}
        bankDetails={bankDetails}
        loadingBankDetails={loadingBankDetails}
      />

      {/* Create Settlement Dialog */}
      <CreateSettlementDialog
        open={showCreateSettlement}
        onOpenChange={setShowCreateSettlement}
        selectedProject={selectedProject || selectedWhopProject}
        settlementAmount={settlementAmount}
        setSettlementAmount={setSettlementAmount}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        processing={processing}
        onCreateSettlement={selectedWhopProject ? createWhopSettlement : createSettlement}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
