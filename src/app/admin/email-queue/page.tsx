"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Clock,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Search,
  RotateCcw,
  ArrowUpCircle,
  Mail,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

interface QueueEmail {
  id: string;
  toEmail: string;
  subject: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
  sentAt: string | null;
  fromEmail: string | null;
  isCreatorEmail: boolean;
}

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  demoted: number;
  enabled: boolean;
  pausedAt: string | null;
}

interface MicrosoftStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
];

function getPriorityLabel(priority: number): string {
  if (priority >= 10) return "System";
  if (priority >= 5) return "Creator";
  if (priority >= 1) return "Marketing";
  return "Retry";
}

function getPriorityColor(priority: number): string {
  if (priority >= 10) return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (priority >= 5) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (priority >= 1) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
}

function getStatusIcon(status: string) {
  switch (status) {
    case "PENDING": return <Clock className="h-4 w-4 text-yellow-500" />;
    case "PROCESSING": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "SENT": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "FAILED": return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <Mail className="h-4 w-4" />;
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PENDING": return "secondary";
    case "PROCESSING": return "default";
    case "SENT": return "outline";
    case "FAILED": return "destructive";
    default: return "secondary";
  }
}

export default function EmailQueuePage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [microsoftStats, setMicrosoftStats] = useState<MicrosoftStats | null>(null);
  const [emails, setEmails] = useState<QueueEmail[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState<"all" | "microsoft">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (queueFilter === "microsoft") params.set("queue", "microsoft");
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", page.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/admin/email-queue?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setStats(data.stats);
      setMicrosoftStats(data.microsoftStats);
      setEmails(data.emails);
      setPagination(data.pagination);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch email queue:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, queueFilter, searchQuery, page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh every 3 seconds for near real-time updates
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchQueue]);

  const doAction = useCallback(async (action: string, emailId?: string) => {
    setIsActioning(true);
    try {
      const res = await fetch("/api/admin/email-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action, emailId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      fetchQueue();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsActioning(false);
    }
  }, [fetchQueue]);

  const clearAllPending = useCallback(async () => {
    if (!confirm("This will permanently delete ALL pending and processing emails. Are you sure?")) return;
    setIsActioning(true);
    try {
      const res = await fetch("/api/admin/email-queue", {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      fetchQueue();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear queue");
    } finally {
      setIsActioning(false);
    }
  }, [fetchQueue]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Queue</h1>
          <p className="text-muted-foreground">
            Monitor and manage the email sending queue in real time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "border-green-500 text-green-600" : ""}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Live (3s)" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchQueue}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Queue Selector */}
      <div className="flex gap-2">
        <Button
          variant={queueFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => { setQueueFilter("all"); setPage(1); }}
        >
          <Mail className="h-4 w-4 mr-1" />
          Main Queue
        </Button>
        <Button
          variant={queueFilter === "microsoft" ? "default" : "outline"}
          size="sm"
          onClick={() => { setQueueFilter("microsoft"); setPage(1); }}
          className={queueFilter === "microsoft" ? "" : "border-blue-300 text-blue-600 hover:bg-blue-50"}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Microsoft Queue
          {microsoftStats && microsoftStats.total > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-xs">{microsoftStats.total}</Badge>
          )}
        </Button>
      </div>

      {/* Microsoft Queue Stats (shown when Microsoft filter is active) */}
      {queueFilter === "microsoft" && microsoftStats && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-medium">Microsoft Domain Emails (Outlook, Hotmail, Live, MSN)</p>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold">{microsoftStats.pending}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Processing</p>
                <p className="text-lg font-bold">{microsoftStats.processing}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-lg font-bold text-green-600">{microsoftStats.sent}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-lg font-bold text-red-600">{microsoftStats.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Queue</p>
                <p className="text-xl font-bold">{stats?.enabled ? "Active" : "Paused"}</p>
              </div>
              {stats?.enabled ? (
                <Play className="h-5 w-5 text-green-500" />
              ) : (
                <Pause className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{stats?.pending ?? 0}</p>
              </div>
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Processing</p>
                <p className="text-xl font-bold">{stats?.processing ?? 0}</p>
              </div>
              <Loader2 className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="text-xl font-bold">{stats?.sent ?? 0}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-xl font-bold text-red-600">{stats?.failed ?? 0}</p>
              </div>
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Demoted</p>
                <p className="text-xl font-bold text-yellow-600">{stats?.demoted ?? 0}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Queue Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {stats?.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => doAction("stop")}
                disabled={isActioning}
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause Queue
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => doAction("start")}
                disabled={isActioning}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-1" />
                Resume Queue
              </Button>
            )}

            {(stats?.processing ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => doAction("unstick-processing")}
                disabled={isActioning}
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset Stuck ({stats?.processing})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("retry-failed")}
              disabled={isActioning || !stats?.failed}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Retry Failed ({stats?.failed ?? 0})
            </Button>

            {(stats?.demoted ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => doAction("promote-demoted")}
                disabled={isActioning}
              >
                <ArrowUpCircle className="h-4 w-4 mr-1" />
                Promote Demoted ({stats?.demoted})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("clear-sent")}
              disabled={isActioning}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Sent (7d+)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("clear-all-sent")}
              disabled={isActioning || !stats?.sent}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All Sent
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllPending}
              disabled={isActioning || !stats?.pending}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Flush Queue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
            >
              {f.label}
              {f.value === "PENDING" && stats?.pending ? ` (${stats.pending})` : ""}
              {f.value === "FAILED" && stats?.failed ? ` (${stats.failed})` : ""}
              {f.value === "SENT" && stats?.sent ? ` (${stats.sent})` : ""}
            </Button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, subject, or error..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setSearchInput(""); setSearchQuery(""); setPage(1); }}
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {/* Email List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Recipient</th>
                  <th className="text-left p-3 font-medium">Subject</th>
                  <th className="text-left p-3 font-medium">Attempts</th>
                  <th className="text-left p-3 font-medium">Error</th>
                  <th className="text-left p-3 font-medium">Created</th>
                  <th className="text-left p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {emails.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No emails found
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr key={email.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(email.status)}
                          <Badge variant={getStatusBadgeVariant(email.status)} className="text-xs">
                            {email.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(email.priority)}`}>
                          {getPriorityLabel(email.priority)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="max-w-[200px] truncate" title={email.toEmail}>
                          {email.toEmail}
                        </div>
                        {email.isCreatorEmail && (
                          <span className="text-xs text-muted-foreground">Creator email</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="max-w-[250px] truncate" title={email.subject}>
                          {email.subject}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={email.attempts >= email.maxAttempts ? "text-red-600 font-medium" : ""}>
                          {email.attempts}/{email.maxAttempts}
                        </span>
                      </td>
                      <td className="p-3">
                        {email.error ? (
                          <div className="max-w-[200px] truncate text-red-600 text-xs" title={email.error}>
                            {email.error}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(email.createdAt), { addSuffix: true })}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {(email.status === "FAILED" || email.status === "PENDING" || email.status === "PROCESSING") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Retry this email"
                              onClick={() => doAction("retry-one", email.id)}
                              disabled={isActioning}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            title="Delete this email"
                            onClick={() => doAction("delete-one", email.id)}
                            disabled={isActioning}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
