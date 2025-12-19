"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
  CheckCircle,
  Database,
  Clock,
  RefreshCw,
  Zap,
  AlertTriangle,
  XCircle,
  Loader2,
  Users,
  FolderOpen,
  CreditCard,
  Image as ImageIcon,
  Server,
  Download,
  Upload,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface DatabaseStatus {
  status: "connected" | "disconnected";
  responseTime: number;
  provider: string;
  stats: {
    users: number;
    projects: number;
    pledges: number;
    mediaFiles: number;
  };
  backupInfo: {
    provider: string;
    message: string;
    lastBackup: string | null;
  };
}

interface Backup {
  id: string;
  filename: string;
  size: string;
  sizeBytes: number;
  createdAt: string;
  createdAtFormatted: string;
}

export function DatabaseSettings() {
  const [data, setData] = useState<DatabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Backup state
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch("/api/admin/database/status");
      if (!response.ok) {
        throw new Error("Failed to fetch database status");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching database status:", err);
      setError("Failed to load database status");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      setIsLoadingBackups(true);
      const response = await fetch("/api/admin/database/backup");
      if (!response.ok) {
        throw new Error("Failed to fetch backups");
      }
      const result = await response.json();
      setBackups(result.backups || []);
    } catch (err) {
      console.error("Error fetching backups:", err);
      toast.error("Failed to load backups");
    } finally {
      setIsLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchBackups();
  }, [fetchStatus, fetchBackups]);

  const createBackup = async () => {
    try {
      setIsCreatingBackup(true);
      toast.info("Creating backup... This may take a moment.");

      const response = await fetch("/api/admin/database/backup", {
        method: "POST",
        headers: getCSRFHeaders(),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create backup");
      }

      toast.success(`Backup created: ${result.backup.filename} (${result.backup.size})`);
      fetchBackups();
    } catch (err) {
      console.error("Error creating backup:", err);
      toast.error(String(err));
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = (filename: string) => {
    window.open(`/api/admin/database/backup/download?filename=${encodeURIComponent(filename)}`, "_blank");
  };

  const deleteBackup = async (filename: string) => {
    try {
      const response = await fetch(`/api/admin/database/backup?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete backup");
      }

      toast.success("Backup deleted");
      fetchBackups();
    } catch (err) {
      console.error("Error deleting backup:", err);
      toast.error(String(err));
    } finally {
      setDeleteConfirm(null);
    }
  };

  const restoreBackup = async (filename: string) => {
    try {
      setIsRestoring(true);
      toast.info("Restoring database... This may take a moment.");

      const response = await fetch("/api/admin/database/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ filename }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to restore backup");
      }

      toast.success(`Database restored from ${filename} (${result.duration})`);
    } catch (err) {
      console.error("Error restoring backup:", err);
      toast.error(String(err));
    } finally {
      setIsRestoring(false);
      setRestoreConfirm(null);
    }
  };

  const uploadBackup = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      toast.info("Uploading backup file...");

      const response = await fetch("/api/admin/database/backup/restore", {
        method: "PUT",
        headers: getCSRFHeaders(),
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload backup");
      }

      toast.success(`Backup uploaded: ${result.backup.filename}`);
      fetchBackups();
    } catch (err) {
      console.error("Error uploading backup:", err);
      toast.error(String(err));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadBackup(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <TabsContent value="database" className="mt-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </TabsContent>
    );
  }

  if (error && !data) {
    return (
      <TabsContent value="database" className="mt-6 space-y-6">
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchStatus()}>
            Try Again
          </Button>
        </div>
      </TabsContent>
    );
  }

  const isConnected = data?.status === "connected";

  return (
    <TabsContent value="database" className="mt-6 space-y-6">
      {/* Connection Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${isConnected ? "bg-emerald-100" : "bg-red-100"}`}>
                {isConnected ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-zinc-500">Status</p>
                <p className={`text-lg font-semibold ${isConnected ? "text-emerald-600" : "text-red-600"}`}>
                  {isConnected ? "Connected" : "Disconnected"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Server className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Provider</p>
                <p className="text-lg font-semibold">{data?.provider || "Unknown"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-violet-100 p-3">
                <Clock className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Response Time</p>
                <p className="text-lg font-semibold">{data?.responseTime || 0}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Database Statistics</CardTitle>
              <CardDescription>Current record counts across tables</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStatus(true)}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{data?.stats.users.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Users</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <FolderOpen className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{data?.stats.projects.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Projects</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <CreditCard className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{data?.stats.pledges.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Pledges</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <ImageIcon className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{data?.stats.mediaFiles.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Media Files</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Backups
              </CardTitle>
              <CardDescription>Create, download, and restore database backups</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".sql,.sql.gz"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                size="sm"
                onClick={createBackup}
                disabled={isCreatingBackup}
              >
                {isCreatingBackup ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Backup
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBackups ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No backups found</p>
              <p className="text-sm mt-1">Click &quot;Create Backup&quot; to create your first backup</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{backup.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {backup.size} • {backup.createdAtFormatted}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadBackup(backup.filename)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRestoreConfirm(backup.filename)}
                      disabled={isRestoring}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteConfirm(backup.filename)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Database Operations</CardTitle>
          <CardDescription>Manage database maintenance tasks (run via CLI)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col gap-2 p-6" disabled>
              <Zap className="h-6 w-6" />
              <span>Run Migrations</span>
              <span className="text-xs text-muted-foreground">npx prisma migrate deploy</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6" disabled>
              <RefreshCw className="h-6 w-6" />
              <span>Sync Schema</span>
              <span className="text-xs text-muted-foreground">npx prisma db push</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6 text-amber-600 hover:text-amber-700" disabled>
              <AlertTriangle className="h-6 w-6" />
              <span>Reset Database</span>
              <span className="text-xs text-muted-foreground">Dangerous - run via CLI only</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteConfirm && deleteBackup(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Restore Database?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to restore the database from <strong>{restoreConfirm}</strong>?
              </p>
              <p className="text-amber-600 font-medium">
                Warning: This will overwrite your current database. It is strongly recommended to create a backup first.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => restoreConfirm && restoreBackup(restoreConfirm)}
            >
              Restore Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
