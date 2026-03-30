import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Brain,
  Tag,
  TrendingUp,
  Play,
  RefreshCw,
  Users,
  Clock,
  Maximize2,
  ArrowRight,
  Timer,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface AISettings {
  autoTagging: boolean;
  autoTagConfidence: number;
  maxTags: number;
  emailPersonalization: boolean;
  behaviorTracking: boolean;
  predictiveAnalytics: boolean;
  smartSegmentation: boolean;
  autoOptimization: boolean;
  sendTimeOptimization: boolean;
  contentOptimization: boolean;
  abTesting: boolean;
  emailFrequencyCap: number;
  dailyEmailLimit: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface AIRunResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  success: boolean; message: string; data?: any; timestamp: string
}

interface AutomationStatus {
  lastRun: string | null;
  lastCampaign: {
    id: string;
    name: string;
    sentAt: string;
    recipients: number;
    sent: number;
    opens: number;
    clicks: number;
    type: string;
  } | null;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sentAt: string;
    sent: number;
    opens: number;
    clicks: number;
    type: string;
  }>;
  performance: {
    campaignsSent: number;
    totalEmailsSent: number;
    avgOpenRate: string;
    avgClickRate: string;
  };
}

interface AISettingsTabProps {
  aiSettings: AISettings;
  setAiSettings: (settings: AISettings) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  aiRunResults: Record<string, AIRunResult>;
  setAiRunResults: React.Dispatch<React.SetStateAction<Record<string, AIRunResult>>>;
  setSaveMessage: (message: string | null) => void;
  setShowResultsViewer: (show: boolean) => void;
  setResultsViewerTab: (tab: string) => void;
  setUserSegments: React.Dispatch<React.SetStateAction<Array<{ name: string; count: number; avgSpend: string | number; criteria: string }>>>;
}

export function AISettingsTab({
  aiSettings,
  setAiSettings,
  isProcessing,
  setIsProcessing,
  aiRunResults,
  setAiRunResults,
  setSaveMessage,
  setShowResultsViewer,
  setResultsViewerTab,
  setUserSegments,
}: AISettingsTabProps) {
  const runAllServices = async () => {
    setIsProcessing(true);
    const actions = ["runAutoTagging", "runPredictiveAnalytics", "runSegmentation", "runSendTimeOptimization"];
    for (const action of actions) {
      try {
        const res = await apiFetch("/api/admin/ai-marketing/run", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({ action, params: { limit: 50 } }),
        });
        const data = await res.json();
        setAiRunResults(prev => ({
          ...prev,
          [action]: { success: data.success, message: data.message, data, timestamp: new Date().toLocaleTimeString() }
        }));
      } catch {
        setAiRunResults(prev => ({
          ...prev,
          [action]: { success: false, message: "Failed to run", timestamp: new Date().toLocaleTimeString() }
        }));
      }
    }
    setIsProcessing(false);
    setSaveMessage("All AI services completed");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const runService = async (action: string, params: Record<string, unknown> = {}) => {
    setIsProcessing(true);
    try {
      const res = await apiFetch("/api/admin/ai-marketing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action, params }),
      });
      const data = await res.json();
      setAiRunResults(prev => ({
        ...prev,
        [action]: { success: data.success, message: data.message, data, timestamp: new Date().toLocaleTimeString() }
      }));
      if (action === "runSegmentation" && data.segments) setUserSegments(data.segments);
      setSaveMessage(data.message);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setAiRunResults(prev => ({
        ...prev,
        [action]: { success: false, message: "Failed", timestamp: new Date().toLocaleTimeString() }
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Automation status
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);
  const [automationResult, setAutomationResult] = useState<{ success: boolean; message: string; steps?: Array<{ step: string; success: boolean; message: string }> } | null>(null);

  const fetchAutomationStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/ai-marketing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getAutomationStatus" }),
      });
      const data = await res.json();
      if (data.success) {
        setAutomationStatus(data);
      }
    } catch {
      // Silently fail — status will just show as unknown
    }
  }, []);

  useEffect(() => {
    fetchAutomationStatus();
  }, [fetchAutomationStatus]);

  const triggerAutomation = async () => {
    setIsRunningAutomation(true);
    setAutomationResult(null);
    try {
      const res = await apiFetch("/api/admin/ai-marketing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "runAutomation" }),
      });
      const data = await res.json();
      setAutomationResult({
        success: data.success,
        message: data.message,
        steps: data.steps,
      });
      // Refresh status after run
      fetchAutomationStatus();
    } catch {
      setAutomationResult({ success: false, message: "Failed to run automation" });
    } finally {
      setIsRunningAutomation(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Automated Marketing */}
      <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-emerald-600" />
                Automated Marketing
              </CardTitle>
              <CardDescription>
                AI automatically creates and sends campaigns based on platform activity. Runs daily via cron.
              </CardDescription>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              size="sm"
              disabled={isRunningAutomation || isProcessing}
              onClick={triggerAutomation}
            >
              {isRunningAutomation ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {isRunningAutomation ? "Running..." : "Run Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Automation Result */}
          {automationResult && (
            <div className={`mb-4 rounded-lg border p-4 ${automationResult.success ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30' : 'bg-red-50 border-red-200 dark:bg-red-950/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {automationResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium text-sm">{automationResult.message}</span>
              </div>
              {automationResult.steps && (
                <div className="space-y-1 mt-2">
                  {automationResult.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {step.success ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                      )}
                      <span className="text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium">{step.step}:</span> {step.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Last Run */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 mb-1">Last Run</p>
              <p className="font-semibold text-sm">
                {automationStatus?.lastRun
                  ? new Date(automationStatus.lastRun).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                    })
                  : "Never"}
              </p>
            </div>

            {/* Campaigns Sent (30d) */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 mb-1">Auto Campaigns (30d)</p>
              <p className="font-semibold text-sm">
                {automationStatus?.performance?.campaignsSent ?? 0}
              </p>
            </div>

            {/* Open Rate */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 mb-1">Avg Open Rate</p>
              <p className="font-semibold text-sm">
                {automationStatus?.performance?.avgOpenRate ?? "N/A"}
              </p>
            </div>

            {/* Click Rate */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 mb-1">Avg Click Rate</p>
              <p className="font-semibold text-sm">
                {automationStatus?.performance?.avgClickRate ?? "N/A"}
              </p>
            </div>
          </div>

          {/* Recent automated campaigns */}
          {automationStatus?.recentCampaigns && automationStatus.recentCampaigns.length > 0 && (
            <div className="mt-4 rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-4 py-2 border-b bg-zinc-50 dark:bg-zinc-800">
                <span className="text-sm font-medium">Recent Automated Campaigns</span>
              </div>
              <div className="p-2">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="h-8">Campaign</TableHead>
                      <TableHead className="h-8">Type</TableHead>
                      <TableHead className="h-8 text-right">Sent</TableHead>
                      <TableHead className="h-8 text-right">Opens</TableHead>
                      <TableHead className="h-8 text-right">Clicks</TableHead>
                      <TableHead className="h-8 text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {automationStatus.recentCampaigns.slice(0, 5).map((c) => (
                      <TableRow key={c.id} className="text-xs">
                        <TableCell className="py-2">{c.name}</TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="text-xs">{c.type}</Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right">{c.sent}</TableCell>
                        <TableCell className="py-2 text-right">{c.opens}</TableCell>
                        <TableCell className="py-2 text-right">{c.clicks}</TableCell>
                        <TableCell className="py-2 text-right text-zinc-500">
                          {c.sentAt ? new Date(c.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Cron setup instructions */}
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:bg-zinc-800 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Cron Setup</p>
            <code className="text-xs text-zinc-500 break-all">
              0 10 * * * curl -s -H &quot;Authorization: Bearer $CRON_SECRET&quot; http://localhost:3000/api/cron/ai-marketing
            </code>
            <p className="text-xs text-zinc-400 mt-1">Add this to your crontab to run daily at 10 AM. The AI decides what to send based on platform activity.</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Run Panel */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-600" />
                AI Services Control Panel
              </CardTitle>
              <CardDescription>Run AI services manually and view results</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAiRunResults({})}
              >
                Clear Results
              </Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                size="sm"
                disabled={isProcessing}
                onClick={runAllServices}
              >
                {isProcessing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run All AI Services
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Auto-Tagging */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                  <Tag className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Auto-Tagging</p>
                  <p className="text-xs text-zinc-500">Tag projects with AI</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isProcessing}
                onClick={() => runService("runAutoTagging", { limit: 20 })}
              >
                {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                <span className="ml-2">Run</span>
              </Button>
              {aiRunResults.runAutoTagging && (
                <div className={`mt-2 p-2 rounded text-xs ${aiRunResults.runAutoTagging.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {aiRunResults.runAutoTagging.message}
                </div>
              )}
            </div>

            {/* Predictive Analytics */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Predictive Analytics</p>
                  <p className="text-xs text-zinc-500">Score users</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isProcessing}
                onClick={() => runService("runPredictiveAnalytics", { limit: 100 })}
              >
                {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                <span className="ml-2">Run</span>
              </Button>
              {aiRunResults.runPredictiveAnalytics && (
                <div className={`mt-2 p-2 rounded text-xs ${aiRunResults.runPredictiveAnalytics.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {aiRunResults.runPredictiveAnalytics.message}
                </div>
              )}
            </div>

            {/* Smart Segmentation */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-900/30">
                  <Users className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Smart Segmentation</p>
                  <p className="text-xs text-zinc-500">Create segments</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isProcessing}
                onClick={() => runService("runSegmentation")}
              >
                {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                <span className="ml-2">Run</span>
              </Button>
              {aiRunResults.runSegmentation && (
                <div className={`mt-2 p-2 rounded text-xs ${aiRunResults.runSegmentation.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {aiRunResults.runSegmentation.message}
                </div>
              )}
            </div>

            {/* Send Time Optimization */}
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                  <Timer className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Send Time Optimization</p>
                  <p className="text-xs text-zinc-500">Optimal times</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isProcessing}
                onClick={() => runService("runSendTimeOptimization", { limit: 100 })}
              >
                {isProcessing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                <span className="ml-2">Run</span>
              </Button>
              {aiRunResults.runSendTimeOptimization && (
                <div className={`mt-2 p-2 rounded text-xs ${aiRunResults.runSendTimeOptimization.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {aiRunResults.runSendTimeOptimization.message}
                </div>
              )}
            </div>
          </div>

          {/* Results Summary & Quick View */}
          {Object.keys(aiRunResults).length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Results Summary</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResultsViewer(true)}
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  View Full Results
                </Button>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {/* Predictive Analytics Summary */}
                {aiRunResults.runPredictiveAnalytics?.data && (
                  <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-white p-4 dark:from-blue-950/30 dark:to-zinc-900">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Predictive Analytics</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-zinc-500 text-xs">Analyzed</p>
                        <p className="font-semibold">{(aiRunResults.runPredictiveAnalytics.data as { summary?: { totalAnalyzed?: number } }).summary?.totalAnalyzed || 0}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">High Value</p>
                        <p className="font-semibold text-emerald-600">{(aiRunResults.runPredictiveAnalytics.data as { summary?: { highValueProspects?: number } }).summary?.highValueProspects || 0}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">At Risk</p>
                        <p className="font-semibold text-amber-600">{(aiRunResults.runPredictiveAnalytics.data as { summary?: { atRiskUsers?: number } }).summary?.atRiskUsers || 0}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Predicted LTV</p>
                        <p className="font-semibold">${((aiRunResults.runPredictiveAnalytics.data as { summary?: { predictedRevenue?: number } }).summary?.predictedRevenue || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Segmentation Summary */}
                {aiRunResults.runSegmentation?.data && (
                  <div className="rounded-lg border bg-gradient-to-br from-violet-50 to-white p-4 dark:from-violet-950/30 dark:to-zinc-900">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-violet-600" />
                      <span className="text-sm font-medium">Smart Segments</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Segments Created</span>
                        <span className="font-semibold">{((aiRunResults.runSegmentation.data as { segments?: unknown[] }).segments || []).length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Total Users</span>
                        <span className="font-semibold">{(aiRunResults.runSegmentation.data as { totalUsers?: number }).totalUsers || 0}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Send Time Summary */}
                {aiRunResults.runSendTimeOptimization?.data && (
                  <div className="rounded-lg border bg-gradient-to-br from-amber-50 to-white p-4 dark:from-amber-950/30 dark:to-zinc-900">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Send Time Optimization</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Users Analyzed</span>
                        <span className="font-semibold">{(aiRunResults.runSendTimeOptimization.data as { summary?: { totalAnalyzed?: number } }).summary?.totalAnalyzed || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Peak Hour</span>
                        <span className="font-semibold">{(aiRunResults.runSendTimeOptimization.data as { summary?: { peakHour?: number } }).summary?.peakHour !== undefined ? `${(aiRunResults.runSendTimeOptimization.data as { summary: { peakHour: number } }).summary.peakHour}:00` : "N/A"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-Tagging Summary */}
                {aiRunResults.runAutoTagging?.data && (
                  <div className="rounded-lg border bg-gradient-to-br from-emerald-50 to-white p-4 dark:from-emerald-950/30 dark:to-zinc-900">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium">Auto-Tagging</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Projects Tagged</span>
                        <span className="font-semibold">
                          {((aiRunResults.runAutoTagging.data as { results?: { success: boolean }[] }).results || []).filter(r => r.success).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Status</span>
                        <Badge variant="outline" className="text-xs">
                          {aiRunResults.runAutoTagging.success ? "Complete" : "Failed"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Quick Data Preview */}
              {aiRunResults.runPredictiveAnalytics?.data && (
                <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-zinc-50 dark:bg-zinc-800">
                    <span className="text-sm font-medium">Top High-Value Prospects</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setResultsViewerTab("predictive");
                        setShowResultsViewer(true);
                      }}
                    >
                      View All
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-2">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="h-8">User ID</TableHead>
                          <TableHead className="h-8 text-right">Conversion %</TableHead>
                          <TableHead className="h-8 text-right">Churn Risk</TableHead>
                          <TableHead className="h-8 text-right">Predicted LTV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((aiRunResults.runPredictiveAnalytics.data as { topProspects?: { userId: string; conversionProbability: number; churnRisk: number; predictedLifetimeValue: number }[] }).topProspects || []).slice(0, 3).map((prospect) => (
                          <TableRow key={prospect.userId} className="text-xs">
                            <TableCell className="py-2 font-mono">{prospect.userId.slice(0, 8)}...</TableCell>
                            <TableCell className="py-2 text-right">
                              <Badge variant={prospect.conversionProbability > 0.7 ? "default" : "secondary"} className="text-xs">
                                {(prospect.conversionProbability * 100).toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Badge variant={prospect.churnRisk > 0.5 ? "destructive" : "outline"} className="text-xs">
                                {(prospect.churnRisk * 100).toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right font-medium">${prospect.predictedLifetimeValue.toFixed(0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Engine Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Engine Configuration</CardTitle>
          <CardDescription>Enable/disable AI features globally. Changes are saved automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h4 className="font-semibold">Core Features</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Email Personalization</Label>
                    <p className="text-xs text-zinc-500">Personalize email content per user</p>
                  </div>
                  <Switch
                    checked={aiSettings.emailPersonalization}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, emailPersonalization: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Predictive Analytics</Label>
                    <p className="text-xs text-zinc-500">Predict user behavior and conversion</p>
                  </div>
                  <Switch
                    checked={aiSettings.predictiveAnalytics}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, predictiveAnalytics: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Smart Segmentation</Label>
                    <p className="text-xs text-zinc-500">Auto-create user segments</p>
                  </div>
                  <Switch
                    checked={aiSettings.smartSegmentation}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, smartSegmentation: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Optimization</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Send Time Optimization</Label>
                    <p className="text-xs text-zinc-500">AI picks optimal send time</p>
                  </div>
                  <Switch
                    checked={aiSettings.sendTimeOptimization}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, sendTimeOptimization: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Content Optimization</Label>
                    <p className="text-xs text-zinc-500">A/B test subject lines and content</p>
                  </div>
                  <Switch
                    checked={aiSettings.contentOptimization}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, contentOptimization: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Automatic A/B Testing</Label>
                    <p className="text-xs text-zinc-500">Auto-run A/B tests on campaigns</p>
                  </div>
                  <Switch
                    checked={aiSettings.abTesting}
                    onCheckedChange={(checked) => setAiSettings({ ...aiSettings, abTesting: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Limits & Frequency</CardTitle>
          <CardDescription>Control email sending behavior to prevent spam</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Max Emails Per User Per Week</Label>
              <Slider
                value={[aiSettings.emailFrequencyCap]}
                onValueChange={([v]) => setAiSettings({ ...aiSettings, emailFrequencyCap: v })}
                min={1}
                max={7}
                step={1}
              />
              <p className="text-sm text-zinc-500">{aiSettings.emailFrequencyCap} emails per week</p>
            </div>

            <div className="space-y-2">
              <Label>Daily Email Limit</Label>
              <Input
                type="number"
                value={aiSettings.dailyEmailLimit}
                onChange={(e) => setAiSettings({ ...aiSettings, dailyEmailLimit: parseInt(e.target.value) })}
              />
              <p className="text-xs text-zinc-500">Maximum emails to send per day across all campaigns</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Quiet Hours Start</Label>
              <Input
                type="time"
                value={aiSettings.quietHoursStart}
                onChange={(e) => setAiSettings({ ...aiSettings, quietHoursStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Quiet Hours End</Label>
              <Input
                type="time"
                value={aiSettings.quietHoursEnd}
                onChange={(e) => setAiSettings({ ...aiSettings, quietHoursEnd: e.target.value })}
              />
            </div>
          </div>
          <p className="text-sm text-zinc-500">No emails will be sent during quiet hours (in user&apos;s local timezone)</p>
        </CardContent>
      </Card>
    </div>
  );
}
