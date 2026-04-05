"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, Tag, AlertTriangle, BarChart3, Clock, Wrench, Pencil } from "lucide-react";
import { DashboardData, SeoAudit, SeoPageMeta } from "./types";
import { ScoreGauge, ScoreBadge, StatusBadge, EmptyState, formatDate, formatDuration } from "./helpers";

interface DashboardTabProps {
  dashboardData: DashboardData | null;
  auditHistory: SeoAudit[];
  isFixingAll: boolean;
  isFixingPage: string | null;
  isRunningAudit: boolean;
  onFixPage: (path: string) => void;
  onFixAll: (overwriteExisting?: boolean) => void;
  onEditMeta: (page: SeoPageMeta) => void;
}

export function DashboardTab({
  dashboardData,
  auditHistory,
  isFixingAll,
  isFixingPage,
  onFixPage,
  onFixAll,
  onEditMeta,
}: DashboardTabProps) {
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20 bg-gradient-to-br from-background to-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall SEO Score</p>
                <p className="text-3xl font-bold text-emerald-500">
                  {dashboardData?.overallScore ?? "--"}
                </p>
              </div>
              <ScoreGauge score={dashboardData?.overallScore ?? 0} size={80} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pages Tracked</p>
                <p className="text-3xl font-bold">{dashboardData?.totalPages ?? 0}</p>
              </div>
              <div className="rounded-full bg-blue-500/10 p-3">
                <Globe className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Keywords Tracked</p>
                <p className="text-3xl font-bold">{dashboardData?.trackedKeywords ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {dashboardData?.totalKeywords ?? 0} total
                </p>
              </div>
              <div className="rounded-full bg-purple-500/10 p-3">
                <Tag className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Issues Found</p>
                <p className="text-3xl font-bold">{dashboardData?.issueStats.total ?? 0}</p>
                <p className="text-xs text-red-400 mt-1">
                  {dashboardData?.issueStats.critical ?? 0} critical
                </p>
              </div>
              <div className="rounded-full bg-red-500/10 p-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Audit Summary + Score History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest Audit Summary</CardTitle>
            <CardDescription>
              {dashboardData?.latestAudit?.completedAt
                ? `Last run: ${formatDate(dashboardData.latestAudit.completedAt)}`
                : "No audits run yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardData?.latestAudit ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <StatusBadge status={dashboardData.latestAudit.status} />
                  <span className="text-sm text-muted-foreground">
                    {dashboardData.latestAudit.pagesAudited} pages audited
                  </span>
                  {dashboardData.latestAudit.duration && (
                    <span className="text-sm text-muted-foreground">
                      in {formatDuration(dashboardData.latestAudit.duration)}
                    </span>
                  )}
                </div>
                <p className="text-sm">{dashboardData.latestAudit.summary}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-red-500/10">
                    <p className="text-2xl font-bold text-red-400">{dashboardData.issueStats.critical}</p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                    <p className="text-2xl font-bold text-yellow-400">{dashboardData.issueStats.warnings}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                    <p className="text-2xl font-bold text-emerald-400">{dashboardData.issueStats.passed}</p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No Audits Yet"
                description="Run your first SEO audit to see results here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audit Score History</CardTitle>
            <CardDescription>Last {auditHistory.length} audits</CardDescription>
          </CardHeader>
          <CardContent>
            {auditHistory.length > 0 ? (
              <div className="flex items-end gap-2 h-40">
                {auditHistory
                  .filter((a) => a.status === "completed" && a.overallScore !== null)
                  .reverse()
                  .map((audit) => {
                    const score = audit.overallScore ?? 0;
                    const height = Math.max(score, 5);
                    const color =
                      score >= 80
                        ? "bg-emerald-500"
                        : score >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500";
                    return (
                      <div key={audit.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">{score}</span>
                        <div
                          className={`w-full rounded-t-sm ${color} transition-all duration-500`}
                          style={{ height: `${height}%` }}
                          title={`Score: ${score} - ${formatDate(audit.createdAt)}`}
                        />
                        <span className="text-[10px] text-muted-foreground truncate max-w-full">
                          {new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No History"
                description="Run audits to see score trends over time."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Cron Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Cron Logs</CardTitle>
          <CardDescription>Last 10 automated runs</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboardData?.recentCronLogs && dashboardData.recentCronLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Timestamp</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pages</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Issues</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentCronLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3">{formatDate(log.createdAt)}</td>
                      <td className="py-2 px-3"><StatusBadge status={log.status} /></td>
                      <td className="py-2 px-3">{log.pagesProcessed}</td>
                      <td className="py-2 px-3">{log.issuesFound}</td>
                      <td className="py-2 px-3">{formatDuration(log.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No Cron Logs"
              description="Cron jobs haven't been run yet. Use the Cron tab to set up automated audits."
            />
          )}
        </CardContent>
      </Card>

      {/* Low Score Pages */}
      {dashboardData?.lowScorePages && dashboardData.lowScorePages.length > 0 && (
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Pages Needing Attention
            </CardTitle>
            <CardDescription>Pages with audit scores below 60</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.lowScorePages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ScoreBadge score={page.lastAuditScore ?? 0} />
                    <span className="font-mono text-sm">{page.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => onFixPage(page.path)}
                      disabled={isFixingPage === page.path || isFixingAll}
                      className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                      {isFixingPage === page.path ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Wrench className="h-3 w-3 mr-1" />
                      )}
                      Fix
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditMeta(page)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
