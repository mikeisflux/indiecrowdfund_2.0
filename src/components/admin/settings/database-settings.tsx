"use client";

import { apiFetch } from "@/lib/fetch-utils";
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
  HardDrive,
  Calculator,
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

interface BuildBackup {
  name: string;
  timestamp: string;
  size: string;
  createdAt: string;
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

  // Build backup state
  const [buildBackups, setBuildBackups] = useState<BuildBackup[]>([]);
  const [isLoadingBuildBackups, setIsLoadingBuildBackups] = useState(false);
  const [deleteBuildConfirm, setDeleteBuildConfirm] = useState<string | null>(null);

  // Recalculate pledge amounts state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recalcResults, setRecalcResults] = useState<any>(null);
  const [isRecalcScanning, setIsRecalcScanning] = useState(false);
  const [isRecalcApplying, setIsRecalcApplying] = useState(false);
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);

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

  const fetchBuildBackups = useCallback(async () => {
    try {
      setIsLoadingBuildBackups(true);
      const response = await fetch("/api/admin/build-backup");
      if (!response.ok) {
        throw new Error("Failed to fetch build backups");
      }
      const result = await response.json();
      setBuildBackups(result.backups || []);
    } catch (err) {
      console.error("Error fetching build backups:", err);
      // Don't show error toast as this is not critical
    } finally {
      setIsLoadingBuildBackups(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchBackups();
    fetchBuildBackups();
  }, [fetchStatus, fetchBackups, fetchBuildBackups]);

  const createBackup = async () => {
    try {
      setIsCreatingBackup(true);
      toast.info("Creating backup... This may take a moment.");

      const response = await apiFetch("/api/admin/database/backup", {
        method: "POST",
,
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
      const response = await apiFetch(`/api/admin/database/backup?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
,
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

      const response = await apiFetch("/api/admin/database/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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

      const response = await apiFetch("/api/admin/database/backup/restore", {
        method: "PUT",
,
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

  const downloadBuildBackup = (name: string) => {
    window.open(`/api/admin/build-backup/download?name=${encodeURIComponent(name)}`, "_blank");
  };

  const deleteBuildBackup = async (name: string) => {
    try {
      const response = await apiFetch(`/api/admin/build-backup?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete build backup");
      }

      toast.success("Build backup deleted");
      fetchBuildBackups();
    } catch (err) {
      console.error("Error deleting build backup:", err);
      toast.error(String(err));
    } finally {
      setDeleteBuildConfirm(null);
    }
  };

  const recalcScan = async () => {
    try {
      setIsRecalcScanning(true);
      setRecalcResults(null);
      const response = await fetch("/api/admin/recalculate-pledge-amounts");
      if (!response.ok) throw new Error("Failed to scan pledge amounts");
      const result = await response.json();
      setRecalcResults(result);
      if (result.totalFound === 0) {
        toast.success("All pledge amounts are correct!");
      } else {
        toast.info(`Found ${result.totalFound} pledges needing correction`);
      }
    } catch (err) {
      console.error("Error scanning pledge amounts:", err);
      toast.error(String(err));
    } finally {
      setIsRecalcScanning(false);
    }
  };

  const recalcApply = async () => {
    try {
      setIsRecalcApplying(true);
      setShowRecalcConfirm(false);
      const response = await apiFetch("/api/admin/recalculate-pledge-amounts", {
        method: "POST",
,
      });
      if (!response.ok) throw new Error("Failed to apply pledge amount fixes");
      const result = await response.json();
      toast.success(result.message);
      setRecalcResults(null);
    } catch (err) {
      console.error("Error applying pledge amount fixes:", err);
      toast.error(String(err));
    } finally {
      setIsRecalcApplying(false);
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

      {/* Build Backups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Website Build Backups
              </CardTitle>
              <CardDescription>Download .next build backups created during deployments</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBuildBackups()}
              disabled={isLoadingBuildBackups}
            >
              {isLoadingBuildBackups ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBuildBackups ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : buildBackups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No build backups found</p>
              <p className="text-sm mt-1">Build backups are created automatically during deployments</p>
            </div>
          ) : (
            <div className="space-y-2">
              {buildBackups.map((backup) => (
                <div
                  key={backup.name}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{backup.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {backup.size} • {backup.createdAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadBuildBackup(backup.name)}
                      title="Download as tar.gz"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteBuildConfirm(backup.name)}
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

      {/* Recalculate Pledge Amounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Recalculate Pledge Amounts
          </CardTitle>
          <CardDescription>
            Scan for pledges where rewardAmount, addonsAmount, or shippingAmount don&apos;t match
            the actual reward tier price and addon records. Preview changes before applying.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={recalcScan}
              disabled={isRecalcScanning || isRecalcApplying}
            >
              {isRecalcScanning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning...</>
              ) : (
                <><Calculator className="h-4 w-4 mr-2" /> Scan for Mismatches</>
              )}
            </Button>
            {recalcResults && recalcResults.totalFound > 0 && (
              <Button
                variant="default"
                onClick={() => setShowRecalcConfirm(true)}
                disabled={isRecalcApplying}
              >
                {isRecalcApplying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying...</>
                ) : (
                  <>Apply {recalcResults.fixes.filter((f: { warning?: string }) => !f.warning).length} Fixes</>
                )}
              </Button>
            )}
          </div>

          {recalcResults && recalcResults.totalFound > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 text-sm font-medium">
                {recalcResults.totalFound} pledges with mismatched amounts
                {recalcResults.fixes.some((f: { warning?: string }) => f.warning) && (
                  <span className="text-amber-600 ml-2">
                    ({recalcResults.fixes.filter((f: { warning?: string }) => f.warning).length} skipped with warnings)
                  </span>
                )}
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Backer</th>
                      <th className="px-3 py-2 text-left">Project</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-right">Reward</th>
                      <th className="px-3 py-2 text-right">Addons</th>
                      <th className="px-3 py-2 text-right">Shipping</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recalcResults.fixes.map((fix: {
                      pledgeId: string;
                      backerNumber: number | null;
                      backerEmail: string;
                      projectTitle: string;
                      totalAmount: number;
                      current: { rewardAmount: number; addonsAmount: number; shippingAmount: number };
                      corrected: { rewardAmount: number; addonsAmount: number; shippingAmount: number };
                      warning?: string;
                    }) => (
                      <tr key={fix.pledgeId} className={fix.warning ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                        <td className="px-3 py-2">
                          <div className="font-medium">#{fix.backerNumber ?? "?"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">{fix.backerEmail}</div>
                        </td>
                        <td className="px-3 py-2 truncate max-w-[150px]">{fix.projectTitle}</td>
                        <td className="px-3 py-2 text-right font-mono">${fix.totalAmount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fix.current.rewardAmount !== fix.corrected.rewardAmount ? (
                            <><span className="line-through text-red-500">${fix.current.rewardAmount.toFixed(2)}</span> <span className="text-green-600">${fix.corrected.rewardAmount.toFixed(2)}</span></>
                          ) : (
                            <span>${fix.corrected.rewardAmount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fix.current.addonsAmount !== fix.corrected.addonsAmount ? (
                            <><span className="line-through text-red-500">${fix.current.addonsAmount.toFixed(2)}</span> <span className="text-green-600">${fix.corrected.addonsAmount.toFixed(2)}</span></>
                          ) : (
                            <span>${fix.corrected.addonsAmount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fix.current.shippingAmount !== fix.corrected.shippingAmount ? (
                            <><span className="line-through text-red-500">${fix.current.shippingAmount.toFixed(2)}</span> <span className="text-green-600">${fix.corrected.shippingAmount.toFixed(2)}</span></>
                          ) : (
                            <span>${fix.corrected.shippingAmount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {fix.warning ? (
                            <span className="text-amber-600 text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Skip
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Fix
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {recalcResults && recalcResults.totalFound === 0 && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              All pledge amounts are correct. Nothing to fix.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recalculate Confirmation Dialog */}
      <AlertDialog open={showRecalcConfirm} onOpenChange={setShowRecalcConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Pledge Amount Fixes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update <strong>{recalcResults?.fixes.filter((f: { warning?: string }) => !f.warning).length}</strong> pledge
              records with corrected rewardAmount, addonsAmount, and shippingAmount values.
              {recalcResults?.fixes.some((f: { warning?: string }) => f.warning) && (
                <span className="block mt-1 text-amber-600">
                  {recalcResults.fixes.filter((f: { warning?: string }) => f.warning).length} pledges with warnings will be skipped.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={recalcApply}>
              Apply Fixes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Delete Build Backup Confirmation Dialog */}
      <AlertDialog open={!!deleteBuildConfirm} onOpenChange={() => setDeleteBuildConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Build Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteBuildConfirm}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteBuildConfirm && deleteBuildBackup(deleteBuildConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
