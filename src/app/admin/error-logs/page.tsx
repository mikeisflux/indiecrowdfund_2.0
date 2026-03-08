"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  AlertCircle,
  Bug,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  Monitor,
  Server,
  Globe,
  Zap,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  BarChart3,
} from "lucide-react";

// Types
interface ErrorGroup {
  id: string;
  fingerprint: string;
  title: string;
  type: string;
  level: string;
  source: string;
  endpoint: string | null;
  status: string;
  assignedTo: string | null;
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
  latestMessage: string;
  latestStack: string | null;
  latestMetadata: unknown;
}

interface ErrorOccurrence {
  id: string;
  groupId: string;
  message: string;
  stack: string | null;
  url: string | null;
  method: string | null;
  statusCode: number | null;
  userId: string | null;
  userAgent: string | null;
  ip: string | null;
  metadata: unknown;
  timestamp: string;
}

interface ErrorStats {
  unresolved: number;
  inProgress: number;
  resolved: number;
  ignored: number;
  fatal: number;
  last24hEvents: number;
}

interface FrequencyPoint {
  hour: string;
  count: number;
}

export default function ErrorLogsPage() {
  // List state
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("UNRESOLVED");
  const [levelFilter, setLevelFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("lastSeen");
  const [sortOrder, setSortOrder] = useState("desc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail view
  const [selectedGroup, setSelectedGroup] = useState<ErrorGroup | null>(null);
  const [occurrences, setOccurrences] = useState<ErrorOccurrence[]>([]);
  const [frequencyChart, setFrequencyChart] = useState<FrequencyPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;

  const fetchErrors = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        limit: "25",
        sortBy,
        sortOrder,
      });
      if (levelFilter) params.set("level", levelFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await apiFetch(`/api/admin/error-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setGroups(data.groups);
      setStats(data.stats);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // Only show toast on initial load
      if (loading) {
        toast.error("Failed to load error logs");
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, levelFilter, sourceFilter, searchQuery, page, sortBy, sortOrder, loading]);

  // Initial load + auto-refresh every 10s
  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (autoRefreshRef.current) {
        fetchErrors();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchErrors]);

  // Fetch detail
  const openDetail = useCallback(async (group: ErrorGroup) => {
    setSelectedGroup(group);
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/admin/error-logs/${group.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setOccurrences(data.group.occurrences);
      setFrequencyChart(data.frequencyChart);
    } catch {
      toast.error("Failed to load error details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Bulk actions
  const updateStatus = useCallback(async (ids: string[], status: string) => {
    try {
      const res = await apiFetch("/api/admin/error-logs", {
        method: "PATCH",
        headers: { ...getCSRFHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      toast.success(`Updated ${data.updated} error(s)`);
      setSelectedIds(new Set());
      fetchErrors();
    } catch {
      toast.error("Failed to update errors");
    }
  }, [fetchErrors]);

  const deleteErrors = useCallback(async (ids: string[]) => {
    try {
      const res = await apiFetch("/api/admin/error-logs", {
        method: "DELETE",
        headers: { ...getCSRFHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      const data = await res.json();
      toast.success(`Deleted ${data.deleted} error(s)`);
      setSelectedIds(new Set());
      fetchErrors();
    } catch {
      toast.error("Failed to delete errors");
    }
  }, [fetchErrors]);

  const updateSingleStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await apiFetch(`/api/admin/error-logs/${id}`, {
        method: "PATCH",
        headers: { ...getCSRFHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`Marked as ${status.toLowerCase().replace("_", " ")}`);
      setShowDetail(false);
      fetchErrors();
    } catch {
      toast.error("Failed to update error");
    }
  }, [fetchErrors]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === groups.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(groups.map((g) => g.id)));
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Helpers
  const levelIcon = (level: string) => {
    switch (level) {
      case "FATAL": return <XCircle className="h-4 w-4 text-red-600" />;
      case "ERROR": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "WARNING": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "INFO": return <Bug className="h-4 w-4 text-blue-500" />;
      default: return <Bug className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const levelBadgeColor = (level: string) => {
    switch (level) {
      case "FATAL": return "bg-red-600 text-white";
      case "ERROR": return "bg-red-500/20 text-red-600 dark:text-red-400";
      case "WARNING": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
      case "INFO": return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const sourceIcon = (source: string) => {
    switch (source) {
      case "CLIENT": return <Monitor className="h-3 w-3" />;
      case "SERVER": return <Server className="h-3 w-3" />;
      case "API": return <Zap className="h-3 w-3" />;
      case "EDGE": case "MIDDLEWARE": return <Globe className="h-3 w-3" />;
      default: return <Server className="h-3 w-3" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "UNRESOLVED": return "bg-red-500/20 text-red-600 dark:text-red-400";
      case "IN_PROGRESS": return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
      case "RESOLVED": return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
      case "IGNORED": return "bg-zinc-500/20 text-zinc-600 dark:text-zinc-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Simple bar chart renderer (no recharts dependency)
  const renderMiniChart = (data: FrequencyPoint[]) => {
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
      <div className="flex items-end gap-[2px] h-12">
        {data.map((point, i) => (
          <div
            key={i}
            className="flex-1 bg-red-500/60 hover:bg-red-500 transition-colors rounded-t-sm min-w-[3px]"
            style={{ height: `${(point.count / max) * 100}%`, minHeight: point.count > 0 ? "2px" : "0" }}
            title={`${new Date(point.hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${point.count} events`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Error Logs</h1>
          <p className="text-muted-foreground">Real-time error tracking and monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {autoRefresh ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchErrors}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Unresolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.unresolved}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{stats.resolved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Ignored</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-500">{stats.ignored}</div>
            </CardContent>
          </Card>
          <Card className="border-red-600/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Fatal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.fatal}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> 24h Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.last24hEvents}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="UNRESOLVED">Unresolved</TabsTrigger>
            <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
            <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
            <TabsTrigger value="IGNORED">Ignored</TabsTrigger>
            <TabsTrigger value="ALL">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search errors..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>

        <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            <SelectItem value="FATAL">Fatal</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v === "ALL" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SERVER">Server</SelectItem>
            <SelectItem value="API">API</SelectItem>
            <SelectItem value="EDGE">Edge</SelectItem>
            <SelectItem value="MIDDLEWARE">Middleware</SelectItem>
            <SelectItem value="CRON">Cron</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => updateStatus(Array.from(selectedIds), "RESOLVED")}>
            <CheckCircle className="h-3 w-3 mr-1" /> Resolve
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateStatus(Array.from(selectedIds), "IGNORED")}>
            <EyeOff className="h-3 w-3 mr-1" /> Ignore
          </Button>
          <Button size="sm" variant="outline" onClick={() => updateStatus(Array.from(selectedIds), "IN_PROGRESS")}>
            <Clock className="h-3 w-3 mr-1" /> In Progress
          </Button>
          <Button size="sm" variant="destructive" onClick={() => deleteErrors(Array.from(selectedIds))}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      )}

      {/* Error List */}
      <Card>
        <div className="border-b px-4 py-2 flex items-center text-xs text-muted-foreground font-medium">
          <div className="w-8">
            <Checkbox
              checked={groups.length > 0 && selectedIds.size === groups.length}
              onCheckedChange={toggleSelectAll}
            />
          </div>
          <div className="flex-1">Error</div>
          <button onClick={() => toggleSort("eventCount")} className="w-20 text-right flex items-center justify-end gap-1 hover:text-foreground">
            Events <ArrowUpDown className="h-3 w-3" />
          </button>
          <button onClick={() => toggleSort("lastSeen")} className="w-24 text-right flex items-center justify-end gap-1 hover:text-foreground">
            Last Seen <ArrowUpDown className="h-3 w-3" />
          </button>
          <div className="w-24 text-right">First Seen</div>
        </div>

        {groups.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500/50" />
            <p className="text-lg font-medium">No errors found</p>
            <p className="text-sm">
              {statusFilter === "UNRESOLVED" ? "All clear! No unresolved errors." : "No errors match your filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <div className="w-8" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(group.id)}
                    onCheckedChange={() => toggleSelect(group.id)}
                  />
                </div>
                <div className="flex-1 min-w-0" onClick={() => openDetail(group)}>
                  <div className="flex items-center gap-2 mb-1">
                    {levelIcon(group.level)}
                    <span className="font-medium text-sm truncate">{group.type}: {group.title}</span>
                    <Badge className={`${levelBadgeColor(group.level)} text-xs`}>{group.level}</Badge>
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      {sourceIcon(group.source)} {group.source}
                    </Badge>
                    <Badge className={`${statusColor(group.status)} text-xs`}>
                      {group.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {group.endpoint && <span className="font-mono mr-2">{group.endpoint}</span>}
                    {group.latestMessage.slice(0, 120)}
                  </div>
                </div>
                <div className="w-20 text-right text-sm font-medium tabular-nums">
                  {group.eventCount.toLocaleString()}
                </div>
                <div className="w-24 text-right text-xs text-muted-foreground">
                  {timeAgo(group.lastSeen)}
                </div>
                <div className="w-24 text-right text-xs text-muted-foreground">
                  {timeAgo(group.firstSeen)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Error Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {levelIcon(selectedGroup.level)}
                  <span className="truncate">{selectedGroup.type}: {selectedGroup.title}</span>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${levelBadgeColor(selectedGroup.level)} text-xs`}>{selectedGroup.level}</Badge>
                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                    {sourceIcon(selectedGroup.source)} {selectedGroup.source}
                  </Badge>
                  <Badge className={`${statusColor(selectedGroup.status)} text-xs`}>
                    {selectedGroup.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs">
                    {selectedGroup.eventCount.toLocaleString()} events &middot; First seen {timeAgo(selectedGroup.firstSeen)} &middot; Last seen {timeAgo(selectedGroup.lastSeen)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => updateSingleStatus(selectedGroup.id, "RESOLVED")}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateSingleStatus(selectedGroup.id, "IN_PROGRESS")}>
                  <Clock className="h-3 w-3 mr-1" /> In Progress
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateSingleStatus(selectedGroup.id, "IGNORED")}>
                  <EyeOff className="h-3 w-3 mr-1" /> Ignore
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateSingleStatus(selectedGroup.id, "UNRESOLVED")}>
                  <AlertCircle className="h-3 w-3 mr-1" /> Unresolve
                </Button>
              </div>

              {/* Frequency Chart */}
              {frequencyChart.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Events (last 24h)</h3>
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    {renderMiniChart(frequencyChart)}
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>24h ago</span>
                      <span>Now</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {selectedGroup.latestStack && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Stack Trace</h3>
                  <pre className="p-3 rounded-lg bg-zinc-950 text-zinc-300 text-xs overflow-x-auto font-mono leading-5 max-h-64 overflow-y-auto">
                    {selectedGroup.latestStack}
                  </pre>
                </div>
              )}

              {/* Full Error Message */}
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">Full Message</h3>
                <pre className="p-3 rounded-lg bg-muted/50 text-sm overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {selectedGroup.latestMessage}
                </pre>
              </div>

              {/* Metadata */}
              {selectedGroup.latestMetadata && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground">Additional Data</h3>
                  <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto font-mono max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedGroup.latestMetadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Recent Occurrences */}
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : occurrences.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Recent Occurrences ({occurrences.length})</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {occurrences.map((occ) => (
                      <div key={occ.id} className="p-3 rounded-lg border bg-muted/20 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {new Date(occ.timestamp).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {occ.statusCode && (
                              <Badge variant="secondary" className="text-xs">{occ.statusCode}</Badge>
                            )}
                            {occ.method && (
                              <Badge variant="secondary" className="text-xs font-mono">{occ.method}</Badge>
                            )}
                          </div>
                        </div>
                        {occ.url && (
                          <div className="font-mono text-muted-foreground truncate">{occ.url}</div>
                        )}
                        {occ.userId && (
                          <div className="text-muted-foreground">User: {occ.userId}</div>
                        )}
                        {occ.userAgent && (
                          <div className="text-muted-foreground truncate">UA: {occ.userAgent}</div>
                        )}
                        {occ.ip && (
                          <div className="text-muted-foreground">IP: {occ.ip}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
