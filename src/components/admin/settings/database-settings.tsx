"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  Image,
  Server,
  ExternalLink,
} from "lucide-react";

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

export function DatabaseSettings() {
  const [data, setData] = useState<DatabaseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
              <Image className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{data?.stats.mediaFiles.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Media Files</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Database Operations</CardTitle>
          <CardDescription>Manage database maintenance tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col gap-2 p-6" disabled>
              <Zap className="h-6 w-6" />
              <span>Run Migrations</span>
              <span className="text-xs text-muted-foreground">Run via CLI: npx prisma migrate</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6" disabled>
              <RefreshCw className="h-6 w-6" />
              <span>Sync Schema</span>
              <span className="text-xs text-muted-foreground">Run via CLI: npx prisma db push</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6 text-amber-600 hover:text-amber-700" disabled>
              <AlertTriangle className="h-6 w-6" />
              <span>Reset Database</span>
              <span className="text-xs text-muted-foreground">Dangerous - run via CLI only</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup Information */}
      <Card>
        <CardHeader>
          <CardTitle>Backup Management</CardTitle>
          <CardDescription>Database backup configuration and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">Infrastructure-Managed Backups</p>
                  <Badge variant="secondary">Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {data?.backupInfo.message || "Database backups are typically managed by your hosting provider."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Most cloud database providers (Vercel Postgres, Railway, PlanetScale, Supabase, etc.)
                  include automatic point-in-time backups as part of their service.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Vercel Postgres
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Automatic daily backups with 7-day retention on Pro plans.
              </p>
              <a
                href="https://vercel.com/docs/storage/vercel-postgres"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View Documentation →
              </a>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Railway
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Automatic backups every 24 hours with configurable retention.
              </p>
              <a
                href="https://docs.railway.app/databases/backups"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                View Documentation →
              </a>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Manual Backup:</strong> For manual backups, use your database provider&apos;s dashboard
              or run <code className="bg-muted px-1 py-0.5 rounded">pg_dump</code> from your terminal.
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
