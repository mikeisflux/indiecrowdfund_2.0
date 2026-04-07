"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp,
  Users,
  Clock,
  Tag,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  UserCheck,
  Download,
  Mail,
  Eye,
} from "lucide-react";
import type { AIService, RunResults } from "../types";

interface ResultsViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultsViewerTab: string;
  onTabChange: (tab: string) => void;
  runResults: RunResults;
  services: AIService[];
}

export function ResultsViewerDialog({
  open,
  onOpenChange,
  resultsViewerTab,
  onTabChange,
  runResults,
  services,
}: ResultsViewerDialogProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "conversionProbability",
    direction: "desc",
  });

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

        <Tabs value={resultsViewerTab} onValueChange={onTabChange} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
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
            {runResults["predictive-analytics"] ? (
              <div className="space-y-4 h-full">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-muted-foreground">Total Analyzed</p>
                    <p className="text-xl font-bold">{runResults["predictive-analytics"]?.summary?.totalAnalyzed || 0}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
                    <p className="text-xs text-muted-foreground">High Value Prospects</p>
                    <p className="text-xl font-bold text-emerald-600">{runResults["predictive-analytics"]?.summary?.highValueProspects || 0}</p>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
                    <p className="text-xs text-muted-foreground">At Risk Users</p>
                    <p className="text-xl font-bold text-amber-600">{runResults["predictive-analytics"]?.summary?.atRiskUsers || 0}</p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
                    <p className="text-xs text-muted-foreground">Predicted Revenue</p>
                    <p className="text-xl font-bold text-blue-600">${(runResults["predictive-analytics"]?.summary?.predictedRevenue || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-2 flex-1">
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-4 py-2 bg-emerald-50 border-b flex items-center justify-between dark:bg-emerald-900/30">
                      <span className="font-medium text-sm flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                        High-Value Prospects
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        const newDirection = sortConfig.key === "conversionProbability" && sortConfig.direction === "desc" ? "asc" : "desc";
                        setSortConfig({ key: "conversionProbability", direction: newDirection });
                      }}>
                        Sort
                        {sortConfig.key === "conversionProbability" && (
                          sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="h-48">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-8">User ID</TableHead>
                            <TableHead className="h-8 text-right">Conv %</TableHead>
                            <TableHead className="h-8 text-right">LTV</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(runResults["predictive-analytics"]?.topProspects || [])
                            .sort((a, b) => sortConfig.direction === "desc" ? b.conversionProbability - a.conversionProbability : a.conversionProbability - b.conversionProbability)
                            .map((prospect) => (
                            <TableRow key={prospect.userId} className="text-xs">
                              <TableCell className="py-2 font-mono">{prospect.userId.slice(0, 12)}...</TableCell>
                              <TableCell className="py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Progress value={prospect.conversionProbability * 100} className="w-12 h-1.5" />
                                  <span className="w-8">{(prospect.conversionProbability * 100).toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-right font-medium">${prospect.predictedLifetimeValue.toFixed(0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>

                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-4 py-2 bg-amber-50 border-b flex items-center justify-between dark:bg-amber-900/30">
                      <span className="font-medium text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        At-Risk Users (Churn)
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        const newDirection = sortConfig.key === "churnRisk" && sortConfig.direction === "desc" ? "asc" : "desc";
                        setSortConfig({ key: "churnRisk", direction: newDirection });
                      }}>
                        Sort
                        {sortConfig.key === "churnRisk" && (
                          sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <ScrollArea className="h-48">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-8">User ID</TableHead>
                            <TableHead className="h-8 text-right">Churn Risk</TableHead>
                            <TableHead className="h-8 text-right">Conv %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(runResults["predictive-analytics"]?.atRiskUsers || [])
                            .sort((a, b) => sortConfig.direction === "desc" ? b.churnRisk - a.churnRisk : a.churnRisk - b.churnRisk)
                            .map((user) => (
                            <TableRow key={user.userId} className="text-xs">
                              <TableCell className="py-2 font-mono">{user.userId.slice(0, 12)}...</TableCell>
                              <TableCell className="py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Progress value={user.churnRisk * 100} className="w-12 h-1.5 [&>div]:bg-amber-500" />
                                  <span className="w-8 text-amber-600">{(user.churnRisk * 100).toFixed(0)}%</span>
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
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="font-medium">No Predictive Analytics Data</p>
                <p className="text-sm">Run the Predictive Analytics service to see results here</p>
              </div>
            )}
          </TabsContent>

          {/* Segments Tab */}
          <TabsContent value="segments" className="flex-1 overflow-hidden mt-4">
            {runResults["smart-segmentation"] ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{(runResults["smart-segmentation"]?.segments || []).length} Segments Generated</p>
                    <p className="text-sm text-muted-foreground">{runResults["smart-segmentation"]?.totalUsers || 0} total users segmented</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    const data = JSON.stringify(runResults["smart-segmentation"]?.segments || [], null, 2);
                    const blob = new Blob([data], { type: "application/json" });
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
                    {(runResults["smart-segmentation"]?.segments || []).map((segment, i) => (
                      <div key={i} className="rounded-lg border p-4 hover:border-violet-300 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-sm">{segment.name}</h4>
                            <p className="text-xs text-muted-foreground">{segment.description}</p>
                          </div>
                          <Badge variant="secondary">{segment.userCount} users</Badge>
                        </div>
                        <div className="flex items-center gap-4 mb-2">
                          <div className="text-xs">
                            <span className="text-muted-foreground">Engagement:</span>
                            <span className="ml-1 font-medium">{(segment.avgEngagement * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(Array.isArray(segment.criteria) ? segment.criteria : []).slice(0, 3).map((c, j) => (
                            <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                          {Array.isArray(segment.criteria) && segment.criteria.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{segment.criteria.length - 3}</Badge>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                            <Mail className="mr-1 h-3 w-3" />
                            Email
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="font-medium">No Segmentation Data</p>
                <p className="text-sm">Run the Smart Segmentation service to see results here</p>
              </div>
            )}
          </TabsContent>

          {/* Send Time Tab */}
          <TabsContent value="sendtime" className="flex-1 overflow-hidden mt-4">
            {runResults["send-time-optimization"] ? (
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-3">
                  <div className="rounded-lg border bg-muted/50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-muted-foreground">Users Analyzed</p>
                    <p className="text-xl font-bold">{runResults["send-time-optimization"]?.summary?.totalAnalyzed || 0}</p>
                  </div>
                  <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
                    <p className="text-xs text-muted-foreground">Peak Hour</p>
                    <p className="text-xl font-bold text-amber-600">
                      {runResults["send-time-optimization"]?.summary?.peakHour !== undefined
                        ? `${runResults["send-time-optimization"].summary.peakHour}:00`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
                    <p className="text-xs text-muted-foreground">Run Time</p>
                    <p className="text-sm font-medium text-blue-600">{services.find(s => s.id === "send-time-optimization")?.lastRun || "N/A"}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-4">Hourly Distribution</h4>
                  <div className="flex items-end gap-1 h-40">
                    {(runResults["send-time-optimization"]?.hourlyDistribution || []).map((slot) => {
                      const maxCount = Math.max(...(runResults["send-time-optimization"]?.hourlyDistribution || [{ count: 1 }]).map(h => h.count));
                      const heightPercent = maxCount > 0 ? (slot.count / maxCount) * 100 : 0;
                      const isPeak = runResults["send-time-optimization"]?.summary?.peakHour === slot.hour;
                      return (
                        <div key={slot.hour} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t transition-all ${isPeak ? "bg-amber-500" : "bg-blue-400"}`}
                            style={{ height: `${heightPercent}%`, minHeight: slot.count > 0 ? "4px" : "0" }}
                            title={`${slot.hour}:00 - ${slot.count} users`}
                          />
                          <span className="text-[10px] text-muted-foreground">{slot.hour}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">Hour of day (0-23)</p>
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50 border-b dark:bg-zinc-800">
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
                        {(runResults["send-time-optimization"]?.hourlyDistribution || [])
                          .sort((a, b) => b.count - a.count)
                          .map((slot) => {
                            const total = runResults["send-time-optimization"]?.summary?.totalAnalyzed || 1;
                            const percent = (slot.count / total) * 100;
                            return (
                              <TableRow key={slot.hour} className="text-xs">
                                <TableCell className="py-2">{slot.hour}:00</TableCell>
                                <TableCell className="py-2 text-right font-medium">{slot.count}</TableCell>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-2">
                                    <Progress value={percent} className="flex-1 h-1.5" />
                                    <span className="w-10 text-right text-muted-foreground">{percent.toFixed(1)}%</span>
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
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="font-medium">No Send Time Data</p>
                <p className="text-sm">Run the Send Time Optimization service to see results here</p>
              </div>
            )}
          </TabsContent>

          {/* Tagging Tab */}
          <TabsContent value="tagging" className="flex-1 overflow-hidden mt-4">
            {runResults["auto-tagging"] ? (
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-3">
                  <div className="rounded-lg border bg-muted/50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-muted-foreground">Projects Processed</p>
                    <p className="text-xl font-bold">{(runResults["auto-tagging"]?.results || []).length}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
                    <p className="text-xs text-muted-foreground">Successfully Tagged</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {(runResults["auto-tagging"]?.results || []).filter(r => r.success).length}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-900/30">
                    <p className="text-xs text-muted-foreground">Failed / Skipped</p>
                    <p className="text-xl font-bold text-red-600">
                      {(runResults["auto-tagging"]?.results || []).filter(r => !r.success).length}
                    </p>
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
                      {(runResults["auto-tagging"]?.results || []).map((result) => (
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
                              {(result.tags || []).slice(0, 3).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                              {(result.tags || []).length > 3 && (
                                <Badge variant="outline" className="text-xs">+{(result.tags || []).length - 3}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground max-w-xs truncate">
                            {result.reason || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Tag className="h-12 w-12 mb-4 text-muted-foreground" />
                <p className="font-medium">No Auto-Tagging Data</p>
                <p className="text-sm">Run the Auto-Tagging service to see results here</p>
              </div>
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
