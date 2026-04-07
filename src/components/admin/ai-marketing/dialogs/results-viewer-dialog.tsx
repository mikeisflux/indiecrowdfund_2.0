"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  Mail,
  Users,
  Tag,
  TrendingUp,
  Eye,
  UserCheck,
  ChevronUp,
  ChevronDown,
  Clock,
  AlertTriangle,
  Download,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AIRunResult = { success: boolean; message: string; data?: any; timestamp: string };

interface ResultsViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  aiRunResults: Record<string, AIRunResult>;
  sortConfig: { key: string; direction: "asc" | "desc" };
  onSortConfigChange: (config: { key: string; direction: "asc" | "desc" }) => void;
}

export function ResultsViewerDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  aiRunResults,
  sortConfig,
  onSortConfigChange,
}: ResultsViewerDialogProps) {
  const handleSort = (key: string) => {
    const newDirection = sortConfig.key === key && sortConfig.direction === "desc" ? "asc" : "desc";
    onSortConfigChange({ key, direction: newDirection });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-600" />
            AI Analysis Results Viewer
          </DialogTitle>
          <DialogDescription>
            Explore, sort, and analyze the detailed results from AI services
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="inline-flex w-max min-w-full">
            <TabsTrigger value="predictive" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Predictive
            </TabsTrigger>
            <TabsTrigger value="segments" className="gap-2">
              <Users className="h-4 w-4" />
              Segments
            </TabsTrigger>
            <TabsTrigger value="sendtime" className="gap-2">
              <Clock className="h-4 w-4" />
              Send Times
            </TabsTrigger>
            <TabsTrigger value="tagging" className="gap-2">
              <Tag className="h-4 w-4" />
              Tagging
            </TabsTrigger>
          </TabsList>

          {/* Predictive Analytics Tab */}
          <TabsContent value="predictive" className="flex-1 overflow-hidden mt-4">
            {aiRunResults.runPredictiveAnalytics?.data ? (
              <PredictiveAnalyticsContent
                data={aiRunResults.runPredictiveAnalytics.data}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            ) : (
              <EmptyState icon={TrendingUp} title="No Predictive Analytics Data" subtitle="Run the Predictive Analytics service to see results here" />
            )}
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments" className="flex-1 overflow-hidden mt-4">
            {aiRunResults.runSegmentation?.data ? (
              <SegmentationContent data={aiRunResults.runSegmentation.data} />
            ) : (
              <EmptyState icon={Users} title="No Segmentation Data" subtitle="Run the Smart Segmentation service to see results here" />
            )}
          </TabsContent>

          {/* Send Time Tab */}
          <TabsContent value="sendtime" className="flex-1 overflow-hidden mt-4">
            {aiRunResults.runSendTimeOptimization?.data ? (
              <SendTimeContent data={aiRunResults.runSendTimeOptimization.data} timestamp={aiRunResults.runSendTimeOptimization.timestamp} />
            ) : (
              <EmptyState icon={Clock} title="No Send Time Data" subtitle="Run the Send Time Optimization service to see results here" />
            )}
          </TabsContent>

          {/* Tagging Tab */}
          <TabsContent value="tagging" className="flex-1 overflow-hidden mt-4">
            {aiRunResults.runAutoTagging?.data ? (
              <TaggingContent data={aiRunResults.runAutoTagging.data} />
            ) : (
              <EmptyState icon={Tag} title="No Auto-Tagging Data" subtitle="Run the Auto-Tagging service to see results here" />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
      <Icon className="h-12 w-12 mb-4 text-zinc-300" />
      <p className="font-medium">{title}</p>
      <p className="text-sm">{subtitle}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PredictiveAnalyticsContent({ data, sortConfig, onSort }: { data: any; sortConfig: { key: string; direction: "asc" | "desc" }; onSort: (key: string) => void }) {
  const summary = data.summary || {};
  const topProspects = data.topProspects || [];
  const atRiskUsers = data.atRiskUsers || [];

  return (
    <div className="space-y-4 h-full">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Total Analyzed</p>
          <p className="text-xl font-bold">{summary.totalAnalyzed || 0}</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
          <p className="text-xs text-zinc-500">High Value Prospects</p>
          <p className="text-xl font-bold text-emerald-600">{summary.highValueProspects || 0}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
          <p className="text-xs text-zinc-500">At Risk Users</p>
          <p className="text-xl font-bold text-amber-600">{summary.atRiskUsers || 0}</p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
          <p className="text-xs text-zinc-500">Predicted Revenue</p>
          <p className="text-xl font-bold text-blue-600">${Number(summary.predictedRevenue || 0).toFixed(2)}</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 flex-1">
        {/* High Value Prospects */}
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-emerald-50 border-b flex items-center justify-between dark:bg-emerald-900/30">
            <span className="font-medium text-sm flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              High-Value Prospects
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onSort("conversionProbability")}>
              Sort
              {sortConfig.key === "conversionProbability" ? (
                sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
              ) : null}
            </Button>
          </div>
          <ScrollArea className="h-48">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="h-8">User ID</TableHead>
                  <TableHead className="h-8 text-right cursor-pointer hover:bg-zinc-100" onClick={() => onSort("conversionProbability")}>
                    Conversion %
                    {sortConfig.key === "conversionProbability" && (sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3 inline ml-1" /> : <ChevronUp className="h-3 w-3 inline ml-1" />)}
                  </TableHead>
                  <TableHead className="h-8 text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProspects
                  .sort((a: { conversionProbability: number }, b: { conversionProbability: number }) =>
                    sortConfig.direction === "desc" ? b.conversionProbability - a.conversionProbability : a.conversionProbability - b.conversionProbability)
                  .map((prospect: { userId: string; conversionProbability: number; predictedLifetimeValue: number }) => (
                    <TableRow key={prospect.userId} className="text-xs">
                      <TableCell className="py-2 font-mono text-xs">{prospect.userId.slice(0, 12)}...</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={prospect.conversionProbability * 100} className="w-16 h-1.5" />
                          <span className="w-10 text-right">{(prospect.conversionProbability * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right font-medium">${prospect.predictedLifetimeValue.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* At Risk Users */}
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-amber-50 border-b flex items-center justify-between dark:bg-amber-900/30">
            <span className="font-medium text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              At-Risk Users (Churn)
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onSort("churnRisk")}>
              Sort
              {sortConfig.key === "churnRisk" ? (
                sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
              ) : null}
            </Button>
          </div>
          <ScrollArea className="h-48">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="h-8">User ID</TableHead>
                  <TableHead className="h-8 text-right cursor-pointer hover:bg-zinc-100" onClick={() => onSort("churnRisk")}>
                    Churn Risk
                    {sortConfig.key === "churnRisk" && (sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3 inline ml-1" /> : <ChevronUp className="h-3 w-3 inline ml-1" />)}
                  </TableHead>
                  <TableHead className="h-8 text-right">Conv %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskUsers
                  .sort((a: { churnRisk: number }, b: { churnRisk: number }) =>
                    sortConfig.direction === "desc" ? b.churnRisk - a.churnRisk : a.churnRisk - b.churnRisk)
                  .map((user: { userId: string; conversionProbability: number; churnRisk: number }) => (
                    <TableRow key={user.userId} className="text-xs">
                      <TableCell className="py-2 font-mono text-xs">{user.userId.slice(0, 12)}...</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={user.churnRisk * 100} className="w-16 h-1.5 [&>div]:bg-amber-500" />
                          <span className="w-10 text-right text-amber-600">{(user.churnRisk * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">{(user.conversionProbability * 100).toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SegmentationContent({ data }: { data: any }) {
  const segments = data.segments || [];
  const totalUsers = data.totalUsers || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{segments.length} Segments Generated</p>
          <p className="text-sm text-zinc-500">{totalUsers} total users segmented</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const jsonData = JSON.stringify(segments, null, 2);
          const blob = new Blob([jsonData], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "segments.json";
          a.click();
        }}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
      <ScrollArea className="h-80">
        <div className="grid gap-3 md:grid-cols-2">
          {segments.map((segment: { name: string; description: string; userCount: number; avgEngagement: number; criteria: string[] }, i: number) => (
            <div key={i} className="rounded-lg border p-4 hover:border-violet-300 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-sm">{segment.name}</h4>
                  <p className="text-xs text-zinc-500">{segment.description}</p>
                </div>
                <Badge variant="secondary">{segment.userCount} users</Badge>
              </div>
              <div className="flex items-center gap-4 mb-2">
                <div className="text-xs">
                  <span className="text-zinc-500">Engagement:</span>
                  <span className="ml-1 font-medium">{(segment.avgEngagement * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(Array.isArray(segment.criteria) ? segment.criteria : []).slice(0, 3).map((c: string, j: number) => (
                  <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                ))}
                {Array.isArray(segment.criteria) && segment.criteria.length > 3 && (
                  <Badge variant="outline" className="text-xs">+{segment.criteria.length - 3} more</Badge>
                )}
              </div>
              <div className="mt-3 pt-3 border-t flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                  <Mail className="mr-1 h-3 w-3" />
                  Email Segment
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                  <Eye className="mr-1 h-3 w-3" />
                  View Users
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SendTimeContent({ data, timestamp }: { data: any; timestamp: string }) {
  const summary = data.summary || {};
  const hourlyDistribution = data.hourlyDistribution || [];
  const maxCount = Math.max(...hourlyDistribution.map((h: { count: number }) => h.count), 1);
  const total = summary.totalAnalyzed || 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-3">
        <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Users Analyzed</p>
          <p className="text-xl font-bold">{summary.totalAnalyzed || 0}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
          <p className="text-xs text-zinc-500">Peak Hour</p>
          <p className="text-xl font-bold text-amber-600">
            {summary.peakHour !== undefined ? `${summary.peakHour}:00` : "N/A"}
          </p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
          <p className="text-xs text-zinc-500">Timestamp</p>
          <p className="text-sm font-medium text-blue-600">{timestamp}</p>
        </div>
      </div>

      {/* Hourly Distribution Chart */}
      <div className="rounded-lg border p-4">
        <h4 className="font-medium mb-4">Hourly Distribution</h4>
        <div className="flex items-end gap-1 h-40">
          {hourlyDistribution.map((slot: { hour: number; count: number }) => {
            const heightPercent = maxCount > 0 ? (slot.count / maxCount) * 100 : 0;
            const isPeak = summary.peakHour === slot.hour;
            return (
              <div key={slot.hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t transition-all ${isPeak ? "bg-amber-500" : "bg-blue-400"}`}
                  style={{ height: `${heightPercent}%`, minHeight: slot.count > 0 ? "4px" : "0" }}
                  title={`${slot.hour}:00 - ${slot.count} users`}
                />
                <span className="text-[10px] text-zinc-500">{slot.hour}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500 mt-2 text-center">Hour of day (0-23)</p>
      </div>

      {/* Distribution Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-2 bg-zinc-50 border-b dark:bg-zinc-800">
          <span className="font-medium text-sm">Detailed Distribution</span>
        </div>
        <ScrollArea className="h-32">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="h-8">Hour</TableHead>
                <TableHead className="h-8 text-right">Users</TableHead>
                <TableHead className="h-8">Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...hourlyDistribution]
                .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
                .map((slot: { hour: number; count: number }) => {
                  const percent = (slot.count / total) * 100;
                  return (
                    <TableRow key={slot.hour} className="text-xs">
                      <TableCell className="py-2">{slot.hour}:00</TableCell>
                      <TableCell className="py-2 text-right font-medium">{slot.count}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <Progress value={percent} className="flex-1 h-1.5" />
                          <span className="w-10 text-right text-zinc-500">{percent.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TaggingContent({ data }: { data: any }) {
  const results = data.results || [];
  const successCount = results.filter((r: { success: boolean }) => r.success).length;
  const failedCount = results.filter((r: { success: boolean }) => !r.success).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-3">
        <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Projects Processed</p>
          <p className="text-xl font-bold">{results.length}</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
          <p className="text-xs text-zinc-500">Successfully Tagged</p>
          <p className="text-xl font-bold text-emerald-600">{successCount}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-900/30">
          <p className="text-xs text-zinc-500">Failed / Skipped</p>
          <p className="text-xl font-bold text-red-600">{failedCount}</p>
        </div>
      </div>

      <ScrollArea className="h-64">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags Applied</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result: { projectId: string; success: boolean; tags?: string[]; reason?: string }) => (
              <TableRow key={result.projectId} className="text-sm">
                <TableCell className="py-2 font-mono text-xs">{result.projectId.slice(0, 16)}...</TableCell>
                <TableCell className="py-2">
                  {result.success ? (
                    <Badge variant="default" className="bg-emerald-600 text-xs">Tagged</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Skipped</Badge>
                  )}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {(result.tags || []).slice(0, 3).map((tag: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                    {(result.tags || []).length > 3 && (
                      <Badge variant="outline" className="text-xs">+{(result.tags || []).length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2 text-xs text-zinc-500 max-w-xs truncate">
                  {result.reason || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
