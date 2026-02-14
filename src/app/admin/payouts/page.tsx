"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  User,
  DollarSign,
  ChevronRight,
  ArrowLeft,
  Send,
  Building,
  Eye,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

// Creator project payout interface
interface CreatorProject {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  status: string;
  paymentProcessor?: string;
  fundedAt: string | null;
  totalRaised: number;
  partnerFee: number;
  platformFee: number;
  totalFees: number;
  amountOwed: number;
  amountSettled: number;
  remainingAmount: number;
  backerCount: number;
  hasBank: boolean;
  bankVerified: boolean;
  hasPendingSettlement: boolean;
  settlementStatus: "pending" | "processing" | "settled";
  creator: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    bankAccount: {
      id: string;
      bankName: string | null;
      accountLastFour: string | null;
      accountType: string;
      isVerified: boolean;
    } | null;
  };
  settlements: {
    id: string;
    amount: number;
    status: string;
    processedAt: string | null;
    completedAt: string | null;
  }[];
}

interface PayoutStats {
  totalProjects: number;
  pendingPayouts: number;
  processingPayouts: number;
  settledPayouts: number;
  totalAmountOwed: number;
  totalAmountSettled: number;
  totalRemaining: number;
  projectsWithoutBank: number;
}

interface BankAccountDetails {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string };
  bankName: string;
  bankNameDisplay: string | null;
  accountHolder: string;
  accountNumber: string;
  accountLastFour: string | null;
  routingNumber: string;
  accountType: string;
  isVerified: boolean;
  verifiedAt: string | null;
}

// Creator balance interface for creators with projects
interface CreatorBalance {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  balance: number;
  projectCount: number;
  projectEarnings: number;
  projects: {
    id: string;
    title: string;
    status: string;
    amount: number;
  }[];
  marketplaceSales: {
    totalAmount: number;
    creatorEarnings: number;
    count: number;
  };
  hasBank: boolean;
  bankVerified: boolean;
  bankAccount: {
    id: string;
    bankName: string | null;
    accountLastFour: string | null;
    accountType: string;
    isVerified: boolean;
  } | null;
  settlements: {
    id: string;
    amount: number;
    status: string;
    processedAt: string | null;
    completedAt: string | null;
  }[];
}

interface BalanceStats {
  totalCreatorsWithBalance: number;
  totalBalance: number;
  creatorsWithoutBank: number;
}

export default function PayoutsPage() {
  const [projects, setProjects] = useState<CreatorProject[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    totalProjects: 0,
    pendingPayouts: 0,
    processingPayouts: 0,
    settledPayouts: 0,
    totalAmountOwed: 0,
    totalAmountSettled: 0,
    totalRemaining: 0,
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
  const [activeTab, setActiveTab] = useState<"projects" | "balances">("projects");

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
        totalAmountOwed: 0,
        totalAmountSettled: 0,
        totalRemaining: 0,
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
  }, [fetchProjects]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Get settlement status badge
  const getSettlementBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending Payout
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "settled":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Settled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // View bank account details
  const viewBankDetails = async (bankAccountId: string) => {
    setLoadingBankDetails(true);
    setShowBankDetails(true);
    try {
      const response = await fetch(`/api/admin/bank-accounts/${bankAccountId}`);
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
      const response = await fetch("/api/admin/payouts/divinitycoin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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

  // Create balance payout for marketplace/indiekit earnings
  const createBalancePayout = async () => {
    if (!selectedCreator || !settlementAmount) return;

    setProcessing(true);
    try {
      const response = await fetch("/api/admin/payouts/divinitycoin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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
      ["Project", "Creator", "Email", "Total Raised", "DC Partner Fee (6%)", "Platform Fee (3%)", "Total Fees", "Amount Owed", "Amount Settled", "Remaining", "Has Bank", "Status"].join(","),
      ...projects.map((p) =>
        [
          `"${p.title}"`,
          `"${p.creator.name || "Unknown"}"`,
          p.creator.email,
          p.totalRaised,
          p.partnerFee,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Pending</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPayouts}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.totalRemaining)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Processing</CardTitle>
            <Send className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processingPayouts}</div>
            <p className="text-xs text-zinc-500 mt-1">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Settled</CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.settledPayouts}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.totalAmountSettled)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">No Bank</CardTitle>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.projectsWithoutBank}</div>
            <p className="text-xs text-zinc-500 mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

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
        <>
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
                  <Input
                    placeholder="Search by project title or creator..."
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
                    <SelectItem value="pending">Pending Payout</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Projects Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Banknote className="w-12 h-12 mb-4 text-zinc-300" />
                  <p className="text-lg font-medium">No payouts found</p>
                  <p className="text-sm">Projects that have raised money will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead>Bank Status</TableHead>
                      <TableHead className="text-right">Total Raised</TableHead>
                      <TableHead className="text-right">Amount Owed</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        onClick={() => setSelectedProject(project)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {project.imageUrl ? (
                              <Image
                                src={project.imageUrl}
                                alt={project.title}
                                width={48}
                                height={36}
                                className="w-12 h-9 rounded object-cover"
                              />
                            ) : (
                              <div className="w-12 h-9 rounded bg-zinc-100 flex items-center justify-center">
                                <Banknote className="w-5 h-5 text-zinc-400" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate max-w-[200px]">{project.title}</p>
                                {project.paymentProcessor === "DIVINITYCOIN" && (
                                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-600">DivinityCoin</Badge>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500">
                                {project.backerCount} backers
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                              <User className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{project.creator.name || "Unknown"}</p>
                              <p className="text-xs text-zinc-500">{project.creator.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {project.hasBank ? (
                            <Badge variant="outline" className={project.bankVerified ? "text-emerald-600 border-emerald-600" : "text-yellow-600 border-yellow-600"}>
                              <Building className="w-3 h-3 mr-1" />
                              {project.bankVerified ? "Verified" : "Unverified"}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              No Bank
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-zinc-600">
                            {formatCurrency(project.totalRaised)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            {formatCurrency(project.amountOwed)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${project.remainingAmount > 0 ? "text-yellow-600" : "text-emerald-600"}`}>
                            {formatCurrency(project.remainingAmount)}
                          </span>
                        </TableCell>
                        <TableCell>{getSettlementBadge(project.settlementStatus)}</TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-zinc-400" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Creator Balances Tab Content */}
      {activeTab === "balances" && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : creatorBalances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <DollarSign className="w-12 h-12 mb-4 text-zinc-300" />
                <p className="text-lg font-medium">No Creator Balances</p>
                <p className="text-sm">Creators with earnings from Marketplace or IndieKit will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Bank Status</TableHead>
                    <TableHead className="text-right">Project Earnings</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creatorBalances.map((creator) => (
                    <TableRow key={creator.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{creator.name || "Unknown"}</p>
                            <p className="text-xs text-zinc-500">{creator.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {creator.projectCount > 0 ? (
                            <div>
                              <p className="font-medium">{creator.projectCount} project{creator.projectCount !== 1 ? 's' : ''}</p>
                              {creator.projects.slice(0, 2).map((p) => (
                                <p key={p.id} className="text-xs text-zinc-500 truncate max-w-[200px]">
                                  {p.title} ({p.status})
                                </p>
                              ))}
                              {creator.projects.length > 2 && (
                                <p className="text-xs text-zinc-400">+{creator.projects.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400">No projects</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {creator.hasBank ? (
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm">
                              {creator.bankAccount?.bankName} ****{creator.bankAccount?.accountLastFour}
                            </span>
                            {creator.bankVerified && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                          </div>
                        ) : (
                          <Badge variant="destructive" className="text-xs">No Bank</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(creator.projectEarnings)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-teal-600">
                        {formatCurrency(creator.balance)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!creator.hasBank || creator.balance <= 0}
                          onClick={() => {
                            setSelectedCreator(creator);
                            setSettlementAmount(creator.balance.toFixed(2));
                            setShowCreatorBalanceDialog(true);
                          }}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Payout
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Creator Balance Payout Dialog */}
      <Dialog open={showCreatorBalanceDialog} onOpenChange={setShowCreatorBalanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Balance Payout</DialogTitle>
            <DialogDescription>
              Pay out balance to creator&apos;s bank account
            </DialogDescription>
          </DialogHeader>
          {selectedCreator && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-zinc-50">
                <p className="text-sm text-zinc-500">Creator</p>
                <p className="font-medium">{selectedCreator.name || selectedCreator.email}</p>
                <p className="text-xs text-zinc-500">{selectedCreator.email}</p>
              </div>

              <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                <p className="text-sm text-teal-600">Available Balance</p>
                <p className="text-2xl font-bold text-teal-700">{formatCurrency(selectedCreator.balance)}</p>
                <p className="text-xs text-teal-500 mt-1">
                  From {selectedCreator.marketplaceSales.count} marketplace sales
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payout Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  max={selectedCreator.balance}
                />
                <p className="text-xs text-zinc-500">
                  Max: {formatCurrency(selectedCreator.balance)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Admin Notes (optional)</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this payout..."
                  rows={3}
                />
              </div>

              {selectedCreator.bankAccount && (
                <div className="p-4 rounded-lg bg-zinc-50 border">
                  <p className="text-sm text-zinc-500 mb-2">Bank Account</p>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-zinc-500" />
                    <span className="font-medium">{selectedCreator.bankAccount.bankName}</span>
                    <span className="text-zinc-500">****{selectedCreator.bankAccount.accountLastFour}</span>
                    {selectedCreator.bankAccount.isVerified && (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatorBalanceDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={createBalancePayout}
              disabled={processing || !settlementAmount || parseFloat(settlementAmount) <= 0}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setSelectedProject(null)}
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Back
                  </Button>
                </div>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProject.imageUrl && (
                    <Image
                      src={selectedProject.imageUrl}
                      alt={selectedProject.title}
                      width={64}
                      height={48}
                      className="w-16 h-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <span className="block">{selectedProject.title}</span>
                    <span className="text-sm font-normal text-zinc-500">
                      by {selectedProject.creator.name || "Unknown"}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Payout Status */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <div>
                    <p className="text-sm text-zinc-500">Payout Status</p>
                    <div className="mt-1">{getSettlementBadge(selectedProject.settlementStatus)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Remaining to Pay</p>
                    <p className={`text-2xl font-bold ${selectedProject.remainingAmount > 0 ? "text-yellow-600" : "text-emerald-600"}`}>
                      {formatCurrency(selectedProject.remainingAmount)}
                    </p>
                  </div>
                </div>

                {/* No Bank Warning */}
                {!selectedProject.hasBank && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Bank Account</AlertTitle>
                    <AlertDescription>
                      This creator has not added a bank account. Contact them to add their bank details before processing payout.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Fee Breakdown */}
                <div>
                  <h4 className="font-medium mb-3">Financial Summary</h4>
                  <div className="space-y-2 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span>Total Raised</span>
                      <span className="font-medium">{formatCurrency(selectedProject.totalRaised)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>DivinityCoin Partner Fee (6%)</span>
                      <span className="text-red-500">-{formatCurrency(selectedProject.partnerFee)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Platform Fee (3%)</span>
                      <span className="text-red-500">-{formatCurrency(selectedProject.platformFee)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Amount Owed to Creator</span>
                      <span>{formatCurrency(selectedProject.amountOwed)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Already Settled</span>
                      <span>-{formatCurrency(selectedProject.amountSettled)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Remaining</span>
                      <span className={selectedProject.remainingAmount > 0 ? "text-yellow-600" : "text-emerald-600"}>
                        {formatCurrency(selectedProject.remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Creator & Bank Info */}
                <div>
                  <h4 className="font-medium mb-3">Creator Information</h4>
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                        <User className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedProject.creator.name || "Unknown"}</p>
                        <p className="text-sm text-zinc-500">{selectedProject.creator.email}</p>
                      </div>
                    </div>
                    {selectedProject.creator.bankAccount && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewBankDetails(selectedProject.creator.bankAccount!.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Bank Details
                      </Button>
                    )}
                  </div>
                </div>

                {/* Bank Account Preview */}
                {selectedProject.creator.bankAccount && (
                  <div>
                    <h4 className="font-medium mb-3">Bank Account</h4>
                    <div className="p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Building className="w-5 h-5 text-zinc-400" />
                        <div>
                          <p className="font-medium">{selectedProject.creator.bankAccount.bankName || "Bank Account"}</p>
                          <p className="text-sm text-zinc-500">
                            {selectedProject.creator.bankAccount.accountType} ending in ****{selectedProject.creator.bankAccount.accountLastFour}
                          </p>
                        </div>
                        {selectedProject.creator.bankAccount.isVerified ? (
                          <Badge className="ml-auto bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="ml-auto bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Settlement History */}
                {selectedProject.settlements.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Settlement History</h4>
                    <div className="space-y-2">
                      {selectedProject.settlements.map((settlement) => (
                        <div key={settlement.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              settlement.status === "COMPLETED" ? "bg-emerald-100" :
                              settlement.status === "PROCESSING" ? "bg-blue-100" :
                              settlement.status === "FAILED" ? "bg-red-100" : "bg-yellow-100"
                            }`}>
                              {settlement.status === "COMPLETED" ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                              ) : settlement.status === "PROCESSING" ? (
                                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                              ) : settlement.status === "FAILED" ? (
                                <XCircle className="w-4 h-4 text-red-600" />
                              ) : (
                                <Clock className="w-4 h-4 text-yellow-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{formatCurrency(settlement.amount)}</p>
                              <p className="text-xs text-zinc-500">
                                {settlement.completedAt
                                  ? `Completed ${format(new Date(settlement.completedAt), "MMM d, yyyy")}`
                                  : settlement.processedAt
                                  ? `Processing since ${format(new Date(settlement.processedAt), "MMM d, yyyy")}`
                                  : "Pending"
                                }
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {settlement.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6">
                {selectedProject.hasBank && selectedProject.remainingAmount > 0 && (
                  <Button
                    onClick={() => {
                      setSettlementAmount(selectedProject.remainingAmount.toFixed(2));
                      setShowCreateSettlement(true);
                    }}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Create Settlement
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bank Details Dialog */}
      <Dialog open={showBankDetails} onOpenChange={setShowBankDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Bank Account Details
            </DialogTitle>
            <DialogDescription>
              Secure bank account information for wire transfer
            </DialogDescription>
          </DialogHeader>

          {loadingBankDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : bankDetails ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sensitive Information</AlertTitle>
                <AlertDescription>
                  This information is encrypted and should only be used for processing payouts.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                <div>
                  <Label className="text-xs text-zinc-500">Account Holder</Label>
                  <p className="font-medium">{bankDetails.accountHolder}</p>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Bank Name</Label>
                  <p className="font-medium">{bankDetails.bankName}</p>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Routing Number</Label>
                  <p className="font-mono font-medium">{bankDetails.routingNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Account Number</Label>
                  <p className="font-mono font-medium">{bankDetails.accountNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Account Type</Label>
                  <p className="font-medium capitalize">{bankDetails.accountType}</p>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500">Verification Status</Label>
                  <p className="font-medium">{bankDetails.isVerified ? "Verified" : "Unverified"}</p>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs text-zinc-500">
                  Creator: {bankDetails.user.name || "Unknown"} ({bankDetails.user.email})
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-zinc-500">
              Failed to load bank account details
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBankDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Settlement Dialog */}
      <Dialog open={showCreateSettlement} onOpenChange={setShowCreateSettlement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Settlement</DialogTitle>
            <DialogDescription>
              Create a wire transfer settlement for {selectedProject?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Settlement Amount</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Max: {formatCurrency(selectedProject?.remainingAmount || 0)}
              </p>
            </div>

            <div>
              <Label htmlFor="notes">Admin Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this settlement..."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSettlement(false)}>
              Cancel
            </Button>
            <Button
              onClick={createSettlement}
              disabled={processing || !settlementAmount || parseFloat(settlementAmount) <= 0}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Settlement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
