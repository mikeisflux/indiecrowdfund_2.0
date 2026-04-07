"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, RefreshCw, BarChart3 } from "lucide-react";

import { ErrorFilters } from "./components/ErrorFilters";
import { ErrorTable } from "./components/ErrorTable";
import { ErrorDetailDialog } from "./components/ErrorDetailDialog";
import type {
  ErrorGroup,
  ErrorOccurrence,
  ErrorStats,
  FrequencyPoint,
} from "./components/types";

export default function ErrorLogsPage() {
  // ── List state ──────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState("UNRESOLVED");
  const [levelFilter, setLevelFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("lastSeen");
  const [sortOrder, setSortOrder] = useState("desc");

  // ── Selection ───────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Detail view ─────────────────────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState<ErrorGroup | null>(null);
  const [occurrences, setOccurrences] = useState<ErrorOccurrence[]>([]);
  const [frequencyChart, setFrequencyChart] = useState<FrequencyPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // ── Auto-refresh ────────────────────────────────────────────────────────────
  const [autoRefresh, setAutoRefresh] = useState(true);
  const autoRefreshRef = useRef(autoRefresh);
  autoRefreshRef.current = autoRefresh;

  // ── Data fetching ───────────────────────────────────────────────────────────
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
      if (loading) toast.error("Failed to load error logs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, levelFilter, sourceFilter, searchQuery, page, sortBy, sortOrder, loading]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (autoRefreshRef.current) fetchErrors();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchErrors]);

  // ── Detail dialog ───────────────────────────────────────────────────────────
  const openDetail = useCallback(async (group: ErrorGroup) => {
    setSelectedGroup(group);
    setShowDetail(true);
    setDetailLoading(true);
    setOccurrences([]);
    setFrequencyChart([]);
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

  // ── Bulk mutations ──────────────────────────────────────────────────────────
  const updateStatus = useCallback(
    async (ids: string[], status: string) => {
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
    },
    [fetchErrors]
  );

  const deleteErrors = useCallback(
    async (ids: string[]) => {
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
    },
    [fetchErrors]
  );

  const updateSingleStatus = useCallback(
    async (id: string, status: string) => {
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
    },
    [fetchErrors]
  );

  // ── Selection helpers ───────────────────────────────────────────────────────
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

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Error Logs</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Real-time error tracking and monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <Eye className="h-4 w-4 sm:mr-1" />
            ) : (
              <EyeOff className="h-4 w-4 sm:mr-1" />
            )}
            <span className="hidden sm:inline">
              {autoRefresh ? "Live" : "Paused"}
            </span>
          </Button>
          <Button variant="outline" size="sm" onClick={fetchErrors}>
            <RefreshCw className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <Card className="border-red-500/30">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                Unresolved
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-red-500">
                {stats.unresolved}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-amber-500">
                {stats.inProgress}
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                Resolved
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-emerald-500">
                {stats.resolved}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                Ignored
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-muted-foreground">
                {stats.ignored}
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-600/30">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground font-medium">
                Fatal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold text-red-600">
                {stats.fatal}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <BarChart3 className="h-3 w-3" /> 24h Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-2xl font-bold">{stats.last24hEvents}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + bulk actions */}
      <ErrorFilters
        statusFilter={statusFilter}
        levelFilter={levelFilter}
        sourceFilter={sourceFilter}
        searchQuery={searchQuery}
        selectedIds={selectedIds}
        onStatusChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onLevelChange={(v) => {
          setLevelFilter(v);
          setPage(1);
        }}
        onSourceChange={(v) => {
          setSourceFilter(v);
          setPage(1);
        }}
        onSearchChange={(v) => {
          setSearchQuery(v);
          setPage(1);
        }}
        onBulkResolve={() => updateStatus(Array.from(selectedIds), "RESOLVED")}
        onBulkIgnore={() => updateStatus(Array.from(selectedIds), "IGNORED")}
        onBulkInProgress={() =>
          updateStatus(Array.from(selectedIds), "IN_PROGRESS")
        }
        onBulkDelete={() => deleteErrors(Array.from(selectedIds))}
      />

      {/* Error table (desktop) + card list (mobile) */}
      <ErrorTable
        groups={groups}
        selectedIds={selectedIds}
        sortBy={sortBy}
        sortOrder={sortOrder}
        page={page}
        totalPages={totalPages}
        total={total}
        statusFilter={statusFilter}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onSort={toggleSort}
        onOpenDetail={openDetail}
        onUpdateStatus={updateSingleStatus}
        onPageChange={setPage}
      />

      {/* Detail dialog */}
      <ErrorDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        group={selectedGroup}
        occurrences={occurrences}
        frequencyChart={frequencyChart}
        loading={detailLoading}
        onUpdateStatus={updateSingleStatus}
      />
    </div>
  );
}
