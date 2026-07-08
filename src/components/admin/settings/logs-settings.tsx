"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Trash2,
  RefreshCw,
  Eye,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface LogEntry {
  path: string;
  name: string;
  group: string;
  size: number;
  sizeFormatted: string;
  modifiedAt: string;
}

interface ViewResult {
  path: string;
  size: number;
  bytesReturned: number;
  truncatedFromStart: boolean;
  content: string;
}

export function LogsSettings() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<ViewResult | null>(null);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/logs");
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      setLogs(data.logs || []);
      setExpandedGroups((prev) => {
        // Default-expand any groups we haven't seen before so a fresh load
        // shows everything, but a refresh preserves whatever the user had
        // collapsed.
        const next = { ...prev };
        for (const log of data.logs || []) {
          if (next[log.group] === undefined) next[log.group] = true;
        }
        return next;
      });
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError("Failed to load logs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const viewLog = async (filePath: string) => {
    try {
      setIsViewLoading(true);
      const response = await fetch(`/api/admin/logs/view?path=${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to read log");
      }
      const data = await response.json();
      setViewing(data);
    } catch (err) {
      console.error("Error viewing log:", err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsViewLoading(false);
    }
  };

  const deleteLog = async (filePath: string) => {
    try {
      const response = await apiFetch(`/api/admin/logs?path=${encodeURIComponent(filePath)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to clear log");
      }
      toast.success(`Cleared ${filePath.split("/").pop()}`);
      fetchLogs();
    } catch (err) {
      console.error("Error clearing log:", err);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteConfirm(null);
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const groupedLogs = logs.reduce<Record<string, LogEntry[]>>((acc, log) => {
    if (!acc[log.group]) acc[log.group] = [];
    acc[log.group].push(log);
    return acc;
  }, {});

  const totalSize = logs.reduce((sum, log) => sum + log.size, 0);
  const totalSizeFormatted =
    totalSize < 1024 * 1024
      ? `${(totalSize / 1024).toFixed(1)} KB`
      : totalSize < 1024 * 1024 * 1024
        ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
        : `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;

  if (isLoading) {
    return (
      <TabsContent value="logs" className="mt-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="logs" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Server Logs
              </CardTitle>
              <CardDescription>
                View and clear server log files. <strong>Clear</strong> truncates a file to 0 bytes
                — safe for live logs because the inode is preserved (the process writing to the
                file keeps working without interruption), and frees disk space.
                {logs.length > 0 && (
                  <span className="block mt-1">
                    {logs.length} file{logs.length === 1 ? "" : "s"} • {totalSizeFormatted} total
                  </span>
                )}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
              <p>{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No log files found.</p>
              <p className="text-sm mt-1">
                Expected: /var/log/nginx, /var/log/postgresql, /var/log/pm2, /var/log/ic-snapshots, /var/log/syslog
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedLogs).map(([group, items]) => (
                <div key={group} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="flex items-center w-full px-4 py-2 bg-muted/50 hover:bg-muted text-left text-sm font-medium"
                    onClick={() => toggleGroup(group)}
                  >
                    {expandedGroups[group] ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    <span className="font-mono">{group}</span>
                    <span className="ml-2 text-muted-foreground font-normal">
                      ({items.length} file{items.length === 1 ? "" : "s"})
                    </span>
                  </button>
                  {expandedGroups[group] && (
                    <div className="divide-y">
                      {items.map((log) => (
                        <div
                          key={log.path}
                          className="flex items-center justify-between px-4 py-2 hover:bg-muted/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm truncate">{log.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.sizeFormatted} • modified{" "}
                              {new Date(log.modifiedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewLog(log.path)}
                              disabled={isViewLoading}
                              title="View tail"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => setDeleteConfirm(log.path)}
                              title="Clear contents (truncate to 0 bytes)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Viewer Dialog */}
      <AlertDialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <AlertDialogContent className="max-w-5xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm break-all">
              {viewing?.path}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {viewing && (
                <>
                  Showing {Math.round(viewing.bytesReturned / 1024)} KB of{" "}
                  {viewing.size < 1024 * 1024
                    ? `${(viewing.size / 1024).toFixed(1)} KB`
                    : `${(viewing.size / (1024 * 1024)).toFixed(1)} MB`}
                  {viewing.truncatedFromStart && " (tail only — older entries omitted)"}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <pre className="bg-black/90 text-green-200 text-xs font-mono p-4 rounded max-h-[60vh] overflow-auto whitespace-pre-wrap break-all">
            {viewing?.content || "(empty)"}
          </pre>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Log File?</AlertDialogTitle>
            <AlertDialogDescription>
              This truncates <span className="font-mono break-all">{deleteConfirm}</span> to 0
              bytes. Existing log content is permanently removed; the file itself is kept so any
              process writing to it continues without interruption.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && deleteLog(deleteConfirm)}
            >
              Clear Log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
