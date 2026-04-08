"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Zap,
  Clock,
  Copy,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";
import { SeoCronLog } from "./types";
import { StatusBadge, EmptyState, formatDate, formatDuration } from "./helpers";

interface CronTabProps {
  cronLogs: SeoCronLog[];
  isRunningCron: boolean;
  onRunCron: () => void;
}

export function CronTab({ cronLogs, isRunningCron, onRunCron }: CronTabProps) {
  const [expandedCronRow, setExpandedCronRow] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cron Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Cron Job Status
            </CardTitle>
            <CardDescription>SEO automation runs daily at 3:00 AM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">Daily SEO Audit</p>
                <p className="text-sm text-muted-foreground">
                  Audits all pages, checks project/book meta, logs results
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Scheduled
              </Badge>
            </div>

            <Button
              onClick={onRunCron}
              disabled={isRunningCron}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {isRunningCron ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Run Cron Now
            </Button>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Cron Setup
            </CardTitle>
            <CardDescription>Add this to your server crontab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="p-3 rounded-lg bg-muted/50 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {`0 3 * * * curl -s "https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY" -X POST > /dev/null 2>&1`}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1"
                onClick={() => {
                  navigator.clipboard.writeText(
                    '0 3 * * * curl -s "https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY" -X POST > /dev/null 2>&1'
                  );
                  toast.info("Crontab command copied to clipboard");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-sm font-medium text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Required .env variable
              </p>
              <div className="relative mt-2">
                <pre className="p-2 rounded bg-muted/30 text-xs font-mono">
                  SEO_CRON_API_KEY=your_secure_api_key_here
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0"
                  onClick={() => {
                    navigator.clipboard.writeText("SEO_CRON_API_KEY=your_secure_api_key_here");
                    toast.info("Env variable copied to clipboard");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cron Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cron Run History</CardTitle>
          <CardDescription>Recent automated and manual cron runs</CardDescription>
        </CardHeader>
        <CardContent>
          {cronLogs.length > 0 ? (
            <div className="space-y-2">
              {cronLogs.map((log) => (
                <div key={log.id} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() =>
                      setExpandedCronRow(expandedCronRow === log.id ? null : log.id)
                    }
                  >
                    <div className="flex items-center gap-3">
                      <StatusBadge status={log.status} />
                      <span className="text-sm">{formatDate(log.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{log.pagesProcessed} pages</span>
                      <span>{log.issuesFound} issues</span>
                      <span>{log.autoFixed} auto-fixed</span>
                      <span>{formatDuration(log.duration)}</span>
                      {expandedCronRow === log.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {expandedCronRow === log.id && (
                    <div className="border-t p-4 bg-muted/10 space-y-3">
                      {log.output && (
                        <div>
                          <p className="text-sm font-medium mb-1">Output:</p>
                          <pre className="text-xs text-muted-foreground p-2 rounded bg-muted/30 whitespace-pre-wrap">
                            {log.output}
                          </pre>
                        </div>
                      )}
                      {log.errors && log.errors.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-red-400 mb-1">
                            Errors ({log.errors.length}):
                          </p>
                          <div className="space-y-1">
                            {log.errors.map((err, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-red-300">
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="No Cron Logs"
              description="Run the cron job manually or set up automated scheduling to see logs here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
