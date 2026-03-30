"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Bug,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  AlertTriangle,
  PlayCircle,
  MessageCircle,
  Ban,
  Monitor,
  Smartphone,
  Globe,
  ArrowUpDown,
} from "lucide-react";

interface BugReport {
  id: string;
  userId: string | null;
  name: string | null;
  email: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  pageUrl: string | null;
  browser: string | null;
  device: string | null;
  steps: string | null;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  screenshot: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  user: { id: string; name: string | null; email: string } | null;
}

interface Stats {
  new: number;
  inProgress: number;
  resolved: number;
}

const categoryLabels: Record<string, string> = {
  UI_VISUAL: "UI / Visual",
  FUNCTIONALITY: "Functionality",
  PERFORMANCE: "Performance",
  SECURITY: "Security",
  PAYMENT: "Payment",
  ACCOUNT: "Account",
  PROJECT: "Project",
  REWARDS: "Rewards",
  OTHER: "Other",
};

const statusLabels: Record<string, string> = {
  NEW: "New",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In Progress",
  NEEDS_INFO: "Needs Info",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  WONT_FIX: "Won't Fix",
};

export default function BugReportsPage() {
  const [activeTab, setActiveTab] = useState("open");
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [stats, setStats] = useState<Stats>({ new: 0, inProgress: 0, resolved: 0 });
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPriority, setNewPriority] = useState("");

  const fetchBugReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(categoryFilter !== "all" && { category: categoryFilter }),
        ...(priorityFilter !== "all" && { priority: priorityFilter }),
      });
      const response = await fetch(`/api/bug-reports?${params}`);
      if (response.ok) {
        const data = await response.json();
        setBugReports(data.bugReports || []);
        setStats(data.stats || { new: 0, inProgress: 0, resolved: 0 });
      }
    } catch (error) {
      console.error("Error fetching bug reports:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, priorityFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchBugReports();
  }, [fetchBugReports]);

  const handleUpdateReport = async () => {
    if (!selectedReport) return;
    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/bug-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          id: selectedReport.id,
          status: newStatus || undefined,
          priority: newPriority || undefined,
          resolution: resolutionNotes || undefined,
        }),
      });

      if (response.ok) {
        await fetchBugReports();
        setShowReportDialog(false);
        setSelectedReport(null);
        setResolutionNotes("");
        setNewStatus("");
        setNewPriority("");
        toast.success("Bug report updated");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update bug report");
      }
    } catch (error) {
      console.error("Error updating bug report:", error);
      toast.error("Failed to update bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickStatusUpdate = async (reportId: string, status: string) => {
    try {
      const response = await apiFetch("/api/bug-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ id: reportId, status }),
      });

      if (response.ok) {
        await fetchBugReports();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge className="bg-red-500 text-white">Critical</Badge>;
      case "HIGH":
        return <Badge className="bg-red-100 text-red-700">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-100 text-amber-700">Medium</Badge>;
      default:
        return <Badge className="bg-zinc-100 text-zinc-700">Low</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge className="bg-red-500 text-white">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-red-100 text-red-700">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-100 text-amber-700">Medium</Badge>;
      default:
        return <Badge className="bg-zinc-100 text-zinc-700">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="h-3 w-3 mr-1" /> New</Badge>;
      case "ACKNOWLEDGED":
        return <Badge className="bg-purple-100 text-purple-700"><Eye className="h-3 w-3 mr-1" /> Acknowledged</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-amber-100 text-amber-700"><PlayCircle className="h-3 w-3 mr-1" /> In Progress</Badge>;
      case "NEEDS_INFO":
        return <Badge className="bg-cyan-100 text-cyan-700"><MessageCircle className="h-3 w-3 mr-1" /> Needs Info</Badge>;
      case "RESOLVED":
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Resolved</Badge>;
      case "CLOSED":
        return <Badge className="bg-zinc-100 text-zinc-700"><XCircle className="h-3 w-3 mr-1" /> Closed</Badge>;
      case "WONT_FIX":
        return <Badge className="bg-zinc-100 text-zinc-700"><Ban className="h-3 w-3 mr-1" /> Won&apos;t Fix</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    return <Badge variant="outline">{categoryLabels[category] || category}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredReports = bugReports.filter((report) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        report.title.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const openReports = filteredReports.filter(r =>
    ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "NEEDS_INFO"].includes(r.status)
  );
  const closedReports = filteredReports.filter(r =>
    ["RESOLVED", "CLOSED", "WONT_FIX"].includes(r.status)
  );

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Bug Reports</h1>
          <p className="text-zinc-500">Track and resolve user-reported issues</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchBugReports()} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.new}</p>
                <p className="text-xs text-zinc-500">New Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <PlayCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs text-zinc-500">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-xs text-zinc-500">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {bugReports.filter(r => r.severity === "CRITICAL" && !["RESOLVED", "CLOSED", "WONT_FIX"].includes(r.status)).length}
                </p>
                <p className="text-xs text-zinc-500">Critical Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open">
            <Bug className="mr-2 h-4 w-4" />
            Open
            {openReports.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {openReports.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">
            <History className="mr-2 h-4 w-4" />
            Closed
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center mt-6">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search bug reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="NEEDS_INFO">Needs Info</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="WONT_FIX">Won&apos;t Fix</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px] sm:w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[130px] sm:w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => toggleSort("createdAt")}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Open Reports Tab */}
        <TabsContent value="open" className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : openReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Bug className="h-12 w-12 text-emerald-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No open bug reports</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  All caught up! No pending bug reports at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {openReports.map((report) => (
                <Card key={report.id} className={`${
                  report.severity === "CRITICAL"
                    ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                    : ""
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <Bug className={`h-5 w-5 ${
                          report.severity === "CRITICAL" ? "text-red-500" : "text-zinc-500"
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{report.title}</h4>
                          {getCategoryBadge(report.category)}
                          {getSeverityBadge(report.severity)}
                          {getStatusBadge(report.status)}
                        </div>

                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {report.description}
                        </p>

                        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            {report.device === "Mobile" ? (
                              <Smartphone className="h-3 w-3" />
                            ) : (
                              <Monitor className="h-3 w-3" />
                            )}
                            {report.device || "Unknown"}
                          </span>
                          <span>•</span>
                          <span>{report.name || report.email}</span>
                          <span>•</span>
                          <span>{formatDate(report.createdAt)}</span>
                          {report.pageUrl && (
                            <>
                              <span>•</span>
                              <a
                                href={report.pageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <Globe className="h-3 w-3" />
                                Page
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {report.status === "NEW" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => quickStatusUpdate(report.id, "ACKNOWLEDGED")}
                          >
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            setNewStatus(report.status);
                            setNewPriority(report.priority);
                            setResolutionNotes(report.resolution || "");
                            setShowReportDialog(true);
                          }}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Closed Reports Tab */}
        <TabsContent value="closed" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resolved Bug Reports</CardTitle>
              <CardDescription>Previously resolved or closed bug reports</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                </div>
              ) : closedReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-zinc-300 mb-4" />
                  <p className="text-sm text-zinc-500">No closed bug reports yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {closedReports.map((report) => (
                    <div key={report.id} className="flex items-center gap-4 rounded-lg border p-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        report.status === "RESOLVED" ? "bg-emerald-100" : "bg-zinc-100"
                      }`}>
                        {report.status === "RESOLVED" ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-zinc-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{report.title}</p>
                          {getCategoryBadge(report.category)}
                          {getStatusBadge(report.status)}
                        </div>
                        <p className="text-sm text-zinc-500 line-clamp-1">
                          {report.resolution || "No resolution notes"}
                        </p>
                      </div>

                      <div className="text-right text-sm text-zinc-500">
                        <p>{report.resolvedAt ? formatDate(report.resolvedAt) : formatDate(report.updatedAt)}</p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setNewStatus(report.status);
                          setNewPriority(report.priority);
                          setResolutionNotes(report.resolution || "");
                          setShowReportDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Detail Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
            <DialogDescription>
              Review the bug report and update its status.
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getCategoryBadge(selectedReport.category)}
                {getSeverityBadge(selectedReport.severity)}
                {getPriorityBadge(selectedReport.priority)}
                {getStatusBadge(selectedReport.status)}
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <div>
                  <p className="text-sm text-zinc-500">Title</p>
                  <p className="font-semibold text-lg">{selectedReport.title}</p>
                </div>

                <div>
                  <p className="text-sm text-zinc-500">Description</p>
                  <p className="whitespace-pre-wrap">{selectedReport.description}</p>
                </div>

                {selectedReport.steps && (
                  <div>
                    <p className="text-sm text-zinc-500">Steps to Reproduce</p>
                    <p className="whitespace-pre-wrap">{selectedReport.steps}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedReport.expectedBehavior && (
                    <div>
                      <p className="text-sm text-zinc-500">Expected Behavior</p>
                      <p>{selectedReport.expectedBehavior}</p>
                    </div>
                  )}
                  {selectedReport.actualBehavior && (
                    <div>
                      <p className="text-sm text-zinc-500">Actual Behavior</p>
                      <p>{selectedReport.actualBehavior}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Reporter</p>
                    <p className="font-medium">{selectedReport.name || "Anonymous"}</p>
                    <p className="text-zinc-600">{selectedReport.email}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Device</p>
                    <p className="font-medium flex items-center gap-1">
                      {selectedReport.device === "Mobile" ? (
                        <Smartphone className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                      {selectedReport.device || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Submitted</p>
                    <p className="font-medium">{formatDate(selectedReport.createdAt)}</p>
                  </div>
                </div>

                {selectedReport.pageUrl && (
                  <div>
                    <p className="text-sm text-zinc-500">Page URL</p>
                    <a
                      href={selectedReport.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {selectedReport.pageUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {selectedReport.browser && (
                  <div>
                    <p className="text-sm text-zinc-500">Browser / User Agent</p>
                    <p className="text-xs text-zinc-600 break-all">{selectedReport.browser}</p>
                  </div>
                )}
              </div>

              {/* Update Status Section */}
              <div className="rounded-lg border p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900">
                <h4 className="font-semibold">Update Bug Report</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Resolution Notes</Label>
                  <Textarea
                    placeholder="Add notes about the resolution, fix applied, or reason for closing..."
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowReportDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-emerald-600"
                onClick={() => {
                  setNewStatus("RESOLVED");
                  handleUpdateReport();
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Mark Resolved
              </Button>
              <Button
                onClick={handleUpdateReport}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
