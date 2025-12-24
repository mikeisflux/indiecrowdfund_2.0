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
  Banknote,
  User,
  Calendar,
  DollarSign,
  ChevronRight,
  ArrowLeft,
  Send,
  FileText,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

// Payout interface matching API response
interface Payout {
  id: string;
  payoutId: string | null;
  projectId: string;
  grossAmount: number;
  amount: number;
  platformFees: number;
  processorFees: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  type: "CAMPAIGN" | "LATE_PLEDGE" | "PLEDGE_MANAGER";
  sentAt: string | null;
  bankAccountLast4: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    goalAmount: number;
    currentAmount: number;
    creator: {
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

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    pendingAmount: 0,
    completedAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch payouts from API
  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      params.set("limit", "100");

      const response = await fetch(`/api/admin/payouts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch payouts");
      }

      const data = await response.json();
      setPayouts(data.payouts || []);
      setStats(data.stats || {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        pendingAmount: 0,
        completedAmount: 0,
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

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
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Handle payout action
  const handleAction = async (action: string) => {
    if (!selectedPayout) return;
    setProcessing(true);

    try {
      const response = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({
          payoutId: selectedPayout.id,
          action: action,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update payout");
      }

      toast.success(`Payout ${action.toLowerCase()}ed successfully`);
      setSelectedPayout(null);
      fetchPayouts();
    } catch (error) {
      console.error("Error updating payout:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update payout");
    } finally {
      setProcessing(false);
    }
  };

  // Export as CSV
  const exportCSV = () => {
    const csv = [
      ["Payout ID", "Project", "Creator", "Email", "Gross Amount", "Net Amount", "Status", "Type", "Created", "Sent"].join(","),
      ...payouts.map((p) =>
        [
          p.payoutId || p.id,
          `"${p.project.title}"`,
          `"${p.project.creator.name || "Unknown"}"`,
          p.project.creator.email,
          p.grossAmount,
          p.amount,
          p.status,
          p.type,
          format(new Date(p.createdAt), "yyyy-MM-dd"),
          p.sentAt ? format(new Date(p.sentAt), "yyyy-MM-dd") : "",
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
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Banknote className="h-6 w-6 text-white" />
            </div>
            Creator Payouts
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage creator payouts for funded campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchPayouts} disabled={loading} className="flex-1 sm:flex-none">
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={payouts.length === 0} className="flex-1 sm:flex-none">
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
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.pendingAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Processing</CardTitle>
            <Send className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processing}</div>
            <p className="text-xs text-zinc-500 mt-1">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Completed</CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.completedAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Failed</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-zinc-500 mt-1">Need attention</p>
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
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
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
              <p className="text-sm">Payouts will appear here when campaigns are funded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">Net Payout</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow
                    key={payout.id}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    onClick={() => {
                      setSelectedPayout(payout);
                      setAdminNotes("");
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {payout.project.imageUrl ? (
                          <Image
                            src={payout.project.imageUrl}
                            alt={payout.project.title}
                            width={48}
                            height={36}
                            className="w-12 h-9 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-9 rounded bg-zinc-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{payout.project.title}</p>
                          <p className="text-xs text-zinc-500">
                            {formatCurrency(Number(payout.project.currentAmount))} raised
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
                          <p className="font-medium text-sm">{payout.project.creator.name || "Unknown"}</p>
                          <p className="text-xs text-zinc-500">{payout.project.creator.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {payout.type.toLowerCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-zinc-600">
                        {formatCurrency(Number(payout.grossAmount))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(Number(payout.amount))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        <span className="text-sm">{format(new Date(payout.createdAt), "MMM d")}</span>
                      </div>
                    </TableCell>
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

      {/* Payout Detail Dialog */}
      <Dialog open={!!selectedPayout} onOpenChange={() => setSelectedPayout(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedPayout && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setSelectedPayout(null)}
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Back
                  </Button>
                </div>
                <DialogTitle className="flex items-center gap-3">
                  {selectedPayout.project.imageUrl && (
                    <Image
                      src={selectedPayout.project.imageUrl}
                      alt={selectedPayout.project.title}
                      width={64}
                      height={48}
                      className="w-16 h-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <span className="block">{selectedPayout.project.title}</span>
                    <span className="text-sm font-normal text-zinc-500">
                      by {selectedPayout.project.creator.name || "Unknown"}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Payout Status */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <div>
                    <p className="text-sm text-zinc-500">Payout Status</p>
                    <div className="mt-1">{getStatusBadge(selectedPayout.status)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Net Payout</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(Number(selectedPayout.amount))}
                    </p>
                  </div>
                </div>

                {/* Failed Alert */}
                {selectedPayout.status === "FAILED" && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Payout Failed</AlertTitle>
                    <AlertDescription>
                      This payout failed to process. Please verify the creator&apos;s bank details and retry.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Fee Breakdown */}
                <div>
                  <h4 className="font-medium mb-3">Fee Breakdown</h4>
                  <div className="space-y-2 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span>Gross Amount</span>
                      <span className="font-medium">{formatCurrency(Number(selectedPayout.grossAmount))}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Platform Fee (3%)</span>
                      <span className="text-red-500">-{formatCurrency(Number(selectedPayout.platformFees))}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Processor Fee</span>
                      <span className="text-red-500">-{formatCurrency(Number(selectedPayout.processorFees))}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Creator Payout</span>
                      <span className="text-emerald-600">{formatCurrency(Number(selectedPayout.amount))}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="font-medium mb-3">Payout Timeline</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-zinc-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Payout Created</p>
                        <p className="text-xs text-zinc-500">{format(new Date(selectedPayout.createdAt), "PPP")}</p>
                      </div>
                    </div>
                    {selectedPayout.sentAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Payout Sent</p>
                          <p className="text-xs text-zinc-500">
                            {format(new Date(selectedPayout.sentAt), "PPP")}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedPayout.status === "PENDING" && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Awaiting Processing</p>
                          <p className="text-xs text-zinc-500">
                            Created {formatDistanceToNow(new Date(selectedPayout.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Creator Info */}
                <div>
                  <h4 className="font-medium mb-3">Creator Information</h4>
                  <div className="flex items-center gap-4 p-4 rounded-lg border">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                      <User className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedPayout.project.creator.name || "Unknown"}</p>
                      <p className="text-sm text-zinc-500">{selectedPayout.project.creator.email}</p>
                    </div>
                  </div>
                </div>

                {/* Bank Account */}
                {selectedPayout.bankAccountLast4 && (
                  <div>
                    <h4 className="font-medium mb-3">Bank Account</h4>
                    <div className="p-4 rounded-lg border">
                      <p className="text-sm text-zinc-500">Account ending in</p>
                      <p className="font-mono text-lg">****{selectedPayout.bankAccountLast4}</p>
                    </div>
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <Label htmlFor="admin-notes">Admin Notes</Label>
                  <Textarea
                    id="admin-notes"
                    placeholder="Add notes about this payout..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                {selectedPayout.status === "PENDING" && (
                  <Button
                    onClick={() => handleAction("PROCESS")}
                    disabled={processing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Start Processing
                      </>
                    )}
                  </Button>
                )}
                {selectedPayout.status === "PROCESSING" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAction("FAIL")}
                      disabled={processing}
                      variant="destructive"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Mark Failed
                    </Button>
                    <Button
                      onClick={() => handleAction("COMPLETE")}
                      disabled={processing}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Mark Completed
                    </Button>
                  </div>
                )}
                {selectedPayout.status === "FAILED" && (
                  <Button
                    onClick={() => handleAction("RETRY")}
                    disabled={processing}
                    variant="outline"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Payout
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
