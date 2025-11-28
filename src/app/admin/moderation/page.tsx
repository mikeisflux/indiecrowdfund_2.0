"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Flag,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
  FileText,
  Users,
  FolderKanban,
  Search,
  Ban,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string;
  status: string;
  priority: string;
  reporterId: string | null;
  reporterEmail: string | null;
  projectId: string | null;
  userId: string | null;
  evidence: string[];
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  actionTaken: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  pending: number;
  underReview: number;
  resolved: number;
  dismissed: number;
  escalated: number;
}

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, underReview: 0, resolved: 0, dismissed: 0, escalated: 0 });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderatorNotes, setModeratorNotes] = useState("");

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        ...(priorityFilter !== "all" && { priority: priorityFilter }),
      });
      const response = await fetch(`/api/admin/reports?${params}`);
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
        setStats(data.stats || { pending: 0, underReview: 0, resolved: 0, dismissed: 0, escalated: 0 });
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleReportAction = async (action: string) => {
    if (!selectedReport) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: selectedReport.id,
          action,
          resolution: moderatorNotes,
          actionTaken: action === "RESOLVE" ? "ACTION_TAKEN" : action === "DISMISS" ? "NO_ACTION" : undefined,
        }),
      });

      if (response.ok) {
        await fetchReports();
        setShowReportDialog(false);
        setSelectedReport(null);
        setModeratorNotes("");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update report");
      }
    } catch (error) {
      console.error("Error updating report:", error);
      alert("Failed to update report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge className="bg-red-100 text-red-700">Urgent</Badge>;
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
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-blue-100 text-blue-700"><Eye className="h-3 w-3 mr-1" /> Under Review</Badge>;
      case "RESOLVED":
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Resolved</Badge>;
      case "DISMISSED":
        return <Badge className="bg-zinc-100 text-zinc-700"><XCircle className="h-3 w-3 mr-1" /> Dismissed</Badge>;
      case "ESCALATED":
        return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" /> Escalated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "PROJECT":
        return <Badge variant="outline"><FolderKanban className="h-3 w-3 mr-1" /> Project</Badge>;
      case "USER":
        return <Badge variant="outline"><Users className="h-3 w-3 mr-1" /> User</Badge>;
      case "COMMENT":
        return <Badge variant="outline"><MessageSquare className="h-3 w-3 mr-1" /> Comment</Badge>;
      case "UPDATE":
        return <Badge variant="outline"><FileText className="h-3 w-3 mr-1" /> Update</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredReports = reports.filter((report) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        report.reason.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query) ||
        report.targetId.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Moderation</h1>
          <p className="text-zinc-500">Review reports and moderate content</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchReports()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-zinc-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.underReview}</p>
                <p className="text-xs text-zinc-500">Under Review</p>
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
              <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                <XCircle className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.dismissed}</p>
                <p className="text-xs text-zinc-500">Dismissed</p>
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
                <p className="text-2xl font-bold">{stats.escalated}</p>
                <p className="text-xs text-zinc-500">Escalated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports">
            <Flag className="mr-2 h-4 w-4" />
            Reports
            {stats.pending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-6 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
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
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Shield className="h-12 w-12 text-emerald-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No reports found</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  {statusFilter === "PENDING"
                    ? "No pending reports at this time. The platform is clean!"
                    : "No reports match your current filters."}
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Reports List */
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <Card key={report.id} className={`${
                  (report.priority === "HIGH" || report.priority === "URGENT") && report.status === "PENDING"
                    ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                    : ""
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <Flag className={`h-5 w-5 ${
                          report.priority === "HIGH" || report.priority === "URGENT" ? "text-red-500" : "text-zinc-500"
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{report.reason}</h4>
                          {getTypeBadge(report.targetType)}
                          {getPriorityBadge(report.priority)}
                          {getStatusBadge(report.status)}
                        </div>

                        <p className="mt-1 text-sm">
                          <span className="text-zinc-500">Target ID:</span>{" "}
                          <span className="font-medium">{report.targetId}</span>
                        </p>

                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                          {report.description}
                        </p>

                        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                          <span>Reporter: {report.reporterEmail || report.reporterId || "Anonymous"}</span>
                          <span>•</span>
                          <span>{formatDate(report.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            setShowReportDialog(true);
                          }}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resolved Reports</CardTitle>
              <CardDescription>Previously handled reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === "RESOLVED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("RESOLVED")}
                  >
                    Resolved
                  </Button>
                  <Button
                    variant={statusFilter === "DISMISSED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("DISMISSED")}
                  >
                    Dismissed
                  </Button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="h-12 w-12 text-zinc-300 mb-4" />
                    <p className="text-sm text-zinc-500">No reports in this category</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((report) => (
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
                            <p className="font-medium">{report.reason}</p>
                            {getTypeBadge(report.targetType)}
                          </div>
                          <p className="text-sm text-zinc-500">
                            {report.resolution || "No resolution notes"}
                          </p>
                        </div>

                        <div className="text-right text-sm text-zinc-500">
                          <p>{report.resolvedAt ? formatDate(report.resolvedAt) : "-"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Review Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getTypeBadge(selectedReport.targetType)}
                {getPriorityBadge(selectedReport.priority)}
                {getStatusBadge(selectedReport.status)}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm text-zinc-500">Reason</p>
                  <p className="font-semibold">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Target ID</p>
                  <p className="font-medium">{selectedReport.targetId}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Description</p>
                  <p>{selectedReport.description}</p>
                </div>
                {selectedReport.evidence && selectedReport.evidence.length > 0 && (
                  <div>
                    <p className="text-sm text-zinc-500">Evidence</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedReport.evidence.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">
                          Evidence {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-zinc-500">Reported By</p>
                    <p>{selectedReport.reporterEmail || selectedReport.reporterId || "Anonymous"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Reported At</p>
                    <p>{formatDate(selectedReport.createdAt)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Resolution Notes</p>
                <Textarea
                  placeholder="Add notes about this report and the action taken..."
                  rows={3}
                  value={moderatorNotes}
                  onChange={(e) => setModeratorNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={`/${selectedReport.targetType.toLowerCase()}s/${selectedReport.targetId}`} target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Content
                  </a>
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowReportDialog(false)} disabled={isSubmitting}>
              Close
            </Button>
            <div className="flex gap-2">
              {selectedReport?.status === "PENDING" && (
                <Button
                  variant="outline"
                  className="text-blue-600"
                  onClick={() => handleReportAction("REVIEW")}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  Start Review
                </Button>
              )}
              <Button
                variant="outline"
                className="text-zinc-600"
                onClick={() => handleReportAction("DISMISS")}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Dismiss
              </Button>
              <Button
                variant="outline"
                className="text-amber-600"
                onClick={() => handleReportAction("ESCALATE")}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                Escalate
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleReportAction("RESOLVE")}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Mark Resolved
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
