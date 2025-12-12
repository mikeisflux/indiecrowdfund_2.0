"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Database,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Backup {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
}

interface DatabaseSettingsSectionProps {
  status?: "connected" | "disconnected";
  size?: string;
  lastBackup?: string;
  backups?: Backup[];
  onCreateBackup?: () => void;
  onRestoreBackup?: (id: string) => void;
  onRunMigrations?: () => void;
  onClearCache?: () => void;
  onDownloadBackup?: (id: string) => void;
}

export function DatabaseSettingsSection({
  status = "connected",
  size = "2.4 GB",
  lastBackup = "2 hours ago",
  backups = [],
  onCreateBackup,
  onRestoreBackup,
  onRunMigrations,
  onClearCache,
  onDownloadBackup,
}: DatabaseSettingsSectionProps) {
  // Default backups if none provided
  const displayBackups = backups.length > 0 ? backups : [
    { id: "1", filename: "backup_2024_03_19.sql.gz", size: "146 MB", createdAt: "2 hours ago" },
    { id: "2", filename: "backup_2024_03_18.sql.gz", size: "136 MB", createdAt: "2 days ago" },
    { id: "3", filename: "backup_2024_03_17.sql.gz", size: "126 MB", createdAt: "3 days ago" },
    { id: "4", filename: "backup_2024_03_16.sql.gz", size: "116 MB", createdAt: "4 days ago" },
    { id: "5", filename: "backup_2024_03_15.sql.gz", size: "106 MB", createdAt: "5 days ago" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${status === "connected" ? "bg-emerald-100" : "bg-red-100"}`}>
                <CheckCircle className={`h-6 w-6 ${status === "connected" ? "text-emerald-600" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Status</p>
                <p className={`text-lg font-semibold ${status === "connected" ? "text-emerald-600" : "text-red-600"}`}>
                  {status === "connected" ? "Connected" : "Disconnected"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Size</p>
                <p className="text-lg font-semibold">{size}</p>
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
                <p className="text-sm text-zinc-500">Last Backup</p>
                <p className="text-lg font-semibold">{lastBackup}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Database Operations</CardTitle>
          <CardDescription>Manage database backups and maintenance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6"
              onClick={onCreateBackup}
            >
              <Database className="h-6 w-6" />
              <span>Create Backup</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6"
              onClick={() => onRestoreBackup?.("latest")}
            >
              <RefreshCw className="h-6 w-6" />
              <span>Restore Backup</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6"
              onClick={onRunMigrations}
            >
              <Zap className="h-6 w-6" />
              <span>Run Migrations</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 p-6 text-red-500 hover:text-red-700"
              onClick={onClearCache}
            >
              <AlertTriangle className="h-6 w-6" />
              <span>Clear Cache</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Backups */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {displayBackups.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium">{backup.filename}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <span className="hidden sm:inline">{backup.size}</span>
                  <span>{backup.createdAt}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownloadBackup?.(backup.id)}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
