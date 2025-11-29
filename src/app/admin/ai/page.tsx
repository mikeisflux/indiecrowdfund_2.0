"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Target,
  Mail,
  Users,
  Tag,
  Sparkles,
  TrendingUp,
  Play,
  RefreshCw,
  CheckCircle,
  Clock,
  Calendar,
  Zap,
  BarChart3,
  Timer,
  Wand2,
  AlertTriangle,
  History,
  ChevronUp,
  ChevronDown,
  UserCheck,
  Maximize2,
  Download,
  Eye,
} from "lucide-react";

interface AIService {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  enabled: boolean;
  lastRun?: string;
  status: "idle" | "running" | "success" | "error";
  result?: string;
}

interface CronJob {
  id: string;
  service: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export default function AIControlPage() {
  const [services, setServices] = useState<AIService[]>([
    {
      id: "auto-tagging",
      name: "Auto-Tagging",
      description: "Automatically tag projects using AI analysis",
      icon: <Tag className="h-5 w-5" />,
      action: "runAutoTagging",
      enabled: true,
      status: "idle",
    },
    {
      id: "predictive-analytics",
      name: "Predictive Analytics",
      description: "Analyze users and predict conversion likelihood",
      icon: <TrendingUp className="h-5 w-5" />,
      action: "runPredictiveAnalytics",
      enabled: true,
      status: "idle",
    },
    {
      id: "smart-segmentation",
      name: "Smart Segmentation",
      description: "Create user segments based on behavior patterns",
      icon: <Users className="h-5 w-5" />,
      action: "runSegmentation",
      enabled: true,
      status: "idle",
    },
    {
      id: "send-time-optimization",
      name: "Send Time Optimization",
      description: "Calculate optimal email send times per user",
      icon: <Timer className="h-5 w-5" />,
      action: "runSendTimeOptimization",
      enabled: true,
      status: "idle",
    },
    {
      id: "email-personalization",
      name: "Email Personalization",
      description: "Generate personalized email content",
      icon: <Mail className="h-5 w-5" />,
      action: "testEmailPersonalization",
      enabled: true,
      status: "idle",
    },
    {
      id: "content-optimization",
      name: "Content Optimization",
      description: "Generate A/B test variants for content",
      icon: <Wand2 className="h-5 w-5" />,
      action: "testContentOptimization",
      enabled: true,
      status: "idle",
    },
  ]);

  const [cronJobs, setCronJobs] = useState<CronJob[]>([
    { id: "cron-1", service: "auto-tagging", schedule: "0 2 * * *", enabled: false, nextRun: "Tomorrow 2:00 AM" },
    { id: "cron-2", service: "predictive-analytics", schedule: "0 3 * * *", enabled: false, nextRun: "Tomorrow 3:00 AM" },
    { id: "cron-3", service: "smart-segmentation", schedule: "0 4 * * 0", enabled: false, nextRun: "Sunday 4:00 AM" },
    { id: "cron-4", service: "send-time-optimization", schedule: "0 1 * * *", enabled: false, nextRun: "Tomorrow 1:00 AM" },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [runningService, setRunningService] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"operational" | "degraded" | "offline">("operational");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    behaviorEvents: 0,
    emailsSent: 0,
  });
  const [runResults, setRunResults] = useState<Record<string, unknown>>({});
  const [showResultsViewer, setShowResultsViewer] = useState(false);
  const [resultsViewerTab, setResultsViewerTab] = useState("predictive");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "conversionProbability", direction: "desc" });
  const [selectedResultService, setSelectedResultService] = useState<string | null>(null);

  // Load initial status
  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/ai-marketing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getStatus" }),
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        // Update service enabled states from settings
        setServices((prev) =>
          prev.map((s) => ({
            ...s,
            enabled:
              s.id === "auto-tagging" ? data.settings.autoTagging :
              s.id === "predictive-analytics" ? data.settings.predictiveAnalytics :
              s.id === "smart-segmentation" ? data.settings.smartSegmentation :
              s.id === "send-time-optimization" ? data.settings.sendTimeOptimization :
              s.id === "email-personalization" ? data.settings.emailPersonalization :
              s.id === "content-optimization" ? data.settings.contentOptimization :
              s.enabled,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to load status:", error);
      setAiStatus("degraded");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Run a service
  const runService = async (serviceId: string, action: string) => {
    setRunningService(serviceId);
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, status: "running" } : s))
    );

    try {
      const res = await fetch("/api/admin/ai-marketing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params: { limit: 100 } }),
      });
      const data = await res.json();

      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? {
                ...s,
                status: data.success ? "success" : "error",
                lastRun: new Date().toLocaleString(),
                result: data.message,
              }
            : s
        )
      );

      setRunResults((prev) => ({ ...prev, [serviceId]: data }));

      // Reset status after 10 seconds
      setTimeout(() => {
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? { ...s, status: "idle" } : s))
        );
      }, 10000);
    } catch (error) {
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? { ...s, status: "error", result: "Failed to run service" }
            : s
        )
      );
    } finally {
      setRunningService(null);
    }
  };

  // Run all services
  const runAllServices = async () => {
    for (const service of services) {
      if (service.enabled) {
        await runService(service.id, service.action);
        // Wait a bit between services
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };

  // Toggle cron job
  const toggleCronJob = (jobId: string) => {
    setCronJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, enabled: !job.enabled } : job
      )
    );
    // TODO: Save to database
  };

  // Update cron schedule
  const updateCronSchedule = (jobId: string, schedule: string) => {
    setCronJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, schedule } : job))
    );
    // TODO: Save to database
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-blue-500";
      case "success":
        return "bg-emerald-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-zinc-300";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-blue-100 text-blue-700">Running</Badge>;
      case "success":
        return <Badge className="bg-emerald-100 text-emerald-700">Success</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-violet-600" />
            AI Control Center
          </h1>
          <p className="text-zinc-500">Manage and trigger AI services</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            className={
              aiStatus === "operational"
                ? "bg-emerald-100 text-emerald-700"
                : aiStatus === "degraded"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            }
          >
            {aiStatus === "operational" ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> All Systems Operational</>
            ) : aiStatus === "degraded" ? (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Degraded Performance</>
            ) : (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
          <Button onClick={loadStatus} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalProjects.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Total Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.behaviorEvents.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Events (30 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-pink-100 p-2">
                <Mail className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.emailsSent.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Emails (7 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            AI Services
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Scheduled Jobs
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Run History
          </TabsTrigger>
        </TabsList>

        {/* AI Services Tab */}
        <TabsContent value="services" className="mt-6 space-y-6">
          {/* Quick Actions */}
          <Card className="border-violet-200 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button
                  onClick={runAllServices}
                  disabled={runningService !== null}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {runningService ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run All Enabled Services
                </Button>
                <Button variant="outline" onClick={loadStatus}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Services Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id} className={!service.enabled ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          service.enabled ? "bg-violet-100 text-violet-600" : "bg-zinc-100 text-zinc-400"
                        }`}
                      >
                        {service.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{service.name}</CardTitle>
                        <CardDescription className="text-xs">{service.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(service.status)}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Status</span>
                    {getStatusBadge(service.status)}
                  </div>
                  {service.lastRun && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Last Run</span>
                      <span className="text-xs">{service.lastRun}</span>
                    </div>
                  )}
                  {service.result && (
                    <p className="text-xs text-zinc-600 bg-zinc-50 dark:bg-zinc-900 rounded p-2">
                      {service.result}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    variant={service.enabled ? "default" : "secondary"}
                    disabled={!service.enabled || runningService !== null}
                    onClick={() => runService(service.id, service.action)}
                  >
                    {runningService === service.id ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Scheduled Jobs Tab */}
        <TabsContent value="schedule" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-violet-600" />
                CRON Job Scheduler
              </CardTitle>
              <CardDescription>
                Schedule AI services to run automatically at specific times
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cronJobs.map((job) => {
                  const service = services.find((s) => s.id === job.service);
                  return (
                    <div
                      key={job.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        job.enabled ? "" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={job.enabled}
                          onCheckedChange={() => toggleCronJob(job.id)}
                        />
                        <div
                          className={`rounded-lg p-2 ${
                            job.enabled ? "bg-violet-100 text-violet-600" : "bg-zinc-100 text-zinc-400"
                          }`}
                        >
                          {service?.icon}
                        </div>
                        <div>
                          <p className="font-medium">{service?.name}</p>
                          <p className="text-xs text-zinc-500">{service?.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Select
                            value={job.schedule}
                            onValueChange={(value) => updateCronSchedule(job.id, value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0 * * * *">Every hour</SelectItem>
                              <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                              <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                              <SelectItem value="0 1 * * *">Daily at 1:00 AM</SelectItem>
                              <SelectItem value="0 2 * * *">Daily at 2:00 AM</SelectItem>
                              <SelectItem value="0 3 * * *">Daily at 3:00 AM</SelectItem>
                              <SelectItem value="0 4 * * *">Daily at 4:00 AM</SelectItem>
                              <SelectItem value="0 0 * * 0">Weekly (Sunday midnight)</SelectItem>
                              <SelectItem value="0 0 * * 1">Weekly (Monday midnight)</SelectItem>
                              <SelectItem value="0 0 1 * *">Monthly (1st at midnight)</SelectItem>
                            </SelectContent>
                          </Select>
                          {job.enabled && job.nextRun && (
                            <p className="text-xs text-zinc-500 mt-1">Next: {job.nextRun}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!job.enabled || runningService !== null}
                          onClick={() => service && runService(service.id, service.action)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">Note on CRON Jobs</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      CRON jobs require a background job processor (like Vercel Cron, AWS Lambda, or a dedicated worker).
                      The schedules shown here are saved but need external infrastructure to execute automatically.
                      You can use the &quot;Run Now&quot; buttons to trigger jobs manually.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CRON Expression Helper */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom CRON Expression</CardTitle>
              <CardDescription>Enter a custom CRON expression for advanced scheduling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Service</Label>
                  <Select defaultValue="auto-tagging">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CRON Expression</Label>
                  <Input placeholder="0 2 * * *" />
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                <p className="font-medium mb-1">CRON Format: minute hour day month weekday</p>
                <p>Examples:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code>0 2 * * *</code> - Every day at 2:00 AM</li>
                  <li><code>0 */6 * * *</code> - Every 6 hours</li>
                  <li><code>0 0 * * 0</code> - Every Sunday at midnight</li>
                  <li><code>0 0 1 * *</code> - First day of every month</li>
                </ul>
              </div>
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                Add Custom Schedule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="history" className="mt-6 space-y-6">
          {Object.keys(runResults).length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-zinc-500">
                  <History className="h-12 w-12 mx-auto mb-4 text-zinc-300" />
                  <p className="font-medium">No runs yet</p>
                  <p className="text-sm">Click &quot;Run Now&quot; on any service to see results here.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Results Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {runResults["predictive-analytics"] && (
                  <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => { setResultsViewerTab("predictive"); setShowResultsViewer(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Predictive Analytics</p>
                          <p className="text-xs text-zinc-500">{services.find(s => s.id === "predictive-analytics")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs">Analyzed</p>
                          <p className="font-semibold">{((runResults["predictive-analytics"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 0}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">High Value</p>
                          <p className="font-semibold text-emerald-600">{((runResults["predictive-analytics"] as { summary?: { highValueProspects?: number } })?.summary?.highValueProspects) || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {runResults["smart-segmentation"] && (
                  <Card className="cursor-pointer hover:border-violet-300 transition-colors" onClick={() => { setResultsViewerTab("segments"); setShowResultsViewer(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-violet-100 p-2">
                          <Users className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Smart Segmentation</p>
                          <p className="text-xs text-zinc-500">{services.find(s => s.id === "smart-segmentation")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs">Segments</p>
                          <p className="font-semibold">{((runResults["smart-segmentation"] as { segments?: unknown[] })?.segments || []).length}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Users</p>
                          <p className="font-semibold">{((runResults["smart-segmentation"] as { totalUsers?: number })?.totalUsers) || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {runResults["send-time-optimization"] && (
                  <Card className="cursor-pointer hover:border-amber-300 transition-colors" onClick={() => { setResultsViewerTab("sendtime"); setShowResultsViewer(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-amber-100 p-2">
                          <Timer className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Send Time Optimization</p>
                          <p className="text-xs text-zinc-500">{services.find(s => s.id === "send-time-optimization")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs">Analyzed</p>
                          <p className="font-semibold">{((runResults["send-time-optimization"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 0}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Peak Hour</p>
                          <p className="font-semibold text-amber-600">
                            {((runResults["send-time-optimization"] as { summary?: { peakHour?: number } })?.summary?.peakHour) !== undefined
                              ? `${(runResults["send-time-optimization"] as { summary: { peakHour: number } }).summary.peakHour}:00`
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {runResults["auto-tagging"] && (
                  <Card className="cursor-pointer hover:border-emerald-300 transition-colors" onClick={() => { setResultsViewerTab("tagging"); setShowResultsViewer(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-emerald-100 p-2">
                          <Tag className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Auto-Tagging</p>
                          <p className="text-xs text-zinc-500">{services.find(s => s.id === "auto-tagging")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs">Processed</p>
                          <p className="font-semibold">{((runResults["auto-tagging"] as { results?: unknown[] })?.results || []).length}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 text-xs">Tagged</p>
                          <p className="font-semibold text-emerald-600">
                            {((runResults["auto-tagging"] as { results?: { success: boolean }[] })?.results || []).filter(r => r.success).length}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Quick Data Preview */}
              {runResults["predictive-analytics"] && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-emerald-600" />
                        Top High-Value Prospects
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => { setResultsViewerTab("predictive"); setShowResultsViewer(true); }}>
                        <Maximize2 className="mr-2 h-4 w-4" />
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead className="text-right">Conversion %</TableHead>
                          <TableHead className="text-right">Churn Risk</TableHead>
                          <TableHead className="text-right">Predicted LTV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((runResults["predictive-analytics"] as { topProspects?: { userId: string; conversionProbability: number; churnRisk: number; predictedLifetimeValue: number }[] })?.topProspects || []).slice(0, 5).map((prospect) => (
                          <TableRow key={prospect.userId}>
                            <TableCell className="font-mono text-xs">{prospect.userId.slice(0, 12)}...</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress value={prospect.conversionProbability * 100} className="w-16 h-1.5" />
                                <span className="w-12 text-right">{(prospect.conversionProbability * 100).toFixed(0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={prospect.churnRisk > 0.5 ? "destructive" : "outline"} className="text-xs">
                                {(prospect.churnRisk * 100).toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">${prospect.predictedLifetimeValue.toFixed(0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Segments Quick View */}
              {runResults["smart-segmentation"] && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-5 w-5 text-violet-600" />
                        Generated Segments
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => { setResultsViewerTab("segments"); setShowResultsViewer(true); }}>
                        <Maximize2 className="mr-2 h-4 w-4" />
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {((runResults["smart-segmentation"] as { segments?: { name: string; description: string; userCount: number; avgEngagement: number; criteria: string[] }[] })?.segments || []).slice(0, 6).map((segment, i) => (
                        <div key={i} className="rounded-lg border p-3 hover:border-violet-300 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-sm">{segment.name}</p>
                            <Badge variant="secondary" className="text-xs">{segment.userCount}</Badge>
                          </div>
                          <p className="text-xs text-zinc-500 mb-2">{segment.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {segment.criteria.slice(0, 2).map((c, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                            {segment.criteria.length > 2 && (
                              <Badge variant="outline" className="text-xs">+{segment.criteria.length - 2}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Send Time Distribution */}
              {runResults["send-time-optimization"] && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                        Optimal Send Time Distribution
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => { setResultsViewerTab("sendtime"); setShowResultsViewer(true); }}>
                        <Maximize2 className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 h-32">
                      {((runResults["send-time-optimization"] as { hourlyDistribution?: { hour: number; count: number }[] })?.hourlyDistribution || []).map((slot) => {
                        const maxCount = Math.max(...((runResults["send-time-optimization"] as { hourlyDistribution?: { count: number }[] })?.hourlyDistribution || [{ count: 1 }]).map(h => h.count));
                        const heightPercent = maxCount > 0 ? (slot.count / maxCount) * 100 : 0;
                        const isPeak = ((runResults["send-time-optimization"] as { summary?: { peakHour?: number } })?.summary?.peakHour) === slot.hour;
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
                    <p className="text-xs text-zinc-500 mt-2 text-center">Hour of day (0-23) • Peak hour highlighted in amber</p>
                  </CardContent>
                </Card>
              )}

              {/* All Results Raw Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-5 w-5 text-zinc-600" />
                    All Run Results (Raw Data)
                  </CardTitle>
                  <CardDescription>Click on any service card above to view detailed results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(runResults).map(([serviceId, result]) => {
                      const service = services.find((s) => s.id === serviceId);
                      return (
                        <div key={serviceId} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-violet-100 p-2 text-violet-600">
                                {service?.icon}
                              </div>
                              <div>
                                <p className="font-medium">{service?.name}</p>
                                <p className="text-xs text-zinc-500">{service?.lastRun}</p>
                              </div>
                            </div>
                            <Badge variant={(result as { success?: boolean })?.success ? "default" : "destructive"}>
                              {(result as { success?: boolean })?.success ? "Success" : "Failed"}
                            </Badge>
                          </div>
                          <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 rounded p-3 overflow-auto max-h-32">
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Full Results Viewer Dialog */}
      <Dialog open={showResultsViewer} onOpenChange={setShowResultsViewer}>
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

          <Tabs value={resultsViewerTab} onValueChange={setResultsViewerTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-4">
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
                  <div className="grid gap-3 grid-cols-4">
                    <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500">Total Analyzed</p>
                      <p className="text-xl font-bold">{((runResults["predictive-analytics"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
                      <p className="text-xs text-zinc-500">High Value Prospects</p>
                      <p className="text-xl font-bold text-emerald-600">{((runResults["predictive-analytics"] as { summary?: { highValueProspects?: number } })?.summary?.highValueProspects) || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
                      <p className="text-xs text-zinc-500">At Risk Users</p>
                      <p className="text-xl font-bold text-amber-600">{((runResults["predictive-analytics"] as { summary?: { atRiskUsers?: number } })?.summary?.atRiskUsers) || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
                      <p className="text-xs text-zinc-500">Predicted Revenue</p>
                      <p className="text-xl font-bold text-blue-600">${(((runResults["predictive-analytics"] as { summary?: { predictedRevenue?: number } })?.summary?.predictedRevenue) || 0).toLocaleString()}</p>
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
                            {((runResults["predictive-analytics"] as { topProspects?: { userId: string; conversionProbability: number; predictedLifetimeValue: number }[] })?.topProspects || [])
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
                            {((runResults["predictive-analytics"] as { atRiskUsers?: { userId: string; conversionProbability: number; churnRisk: number }[] })?.atRiskUsers || [])
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
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <TrendingUp className="h-12 w-12 mb-4 text-zinc-300" />
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
                      <p className="font-medium">{((runResults["smart-segmentation"] as { segments?: unknown[] })?.segments || []).length} Segments Generated</p>
                      <p className="text-sm text-zinc-500">{((runResults["smart-segmentation"] as { totalUsers?: number })?.totalUsers) || 0} total users segmented</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      const data = JSON.stringify((runResults["smart-segmentation"] as { segments?: unknown[] })?.segments || [], null, 2);
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
                      {((runResults["smart-segmentation"] as { segments?: { name: string; description: string; userCount: number; avgEngagement: number; criteria: string[] }[] })?.segments || []).map((segment, i) => (
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
                            {segment.criteria.slice(0, 3).map((c, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                            {segment.criteria.length > 3 && (
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
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Users className="h-12 w-12 mb-4 text-zinc-300" />
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
                    <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500">Users Analyzed</p>
                      <p className="text-xl font-bold">{((runResults["send-time-optimization"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
                      <p className="text-xs text-zinc-500">Peak Hour</p>
                      <p className="text-xl font-bold text-amber-600">
                        {((runResults["send-time-optimization"] as { summary?: { peakHour?: number } })?.summary?.peakHour) !== undefined
                          ? `${(runResults["send-time-optimization"] as { summary: { peakHour: number } }).summary.peakHour}:00`
                          : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
                      <p className="text-xs text-zinc-500">Run Time</p>
                      <p className="text-sm font-medium text-blue-600">{services.find(s => s.id === "send-time-optimization")?.lastRun || "N/A"}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-4">Hourly Distribution</h4>
                    <div className="flex items-end gap-1 h-40">
                      {((runResults["send-time-optimization"] as { hourlyDistribution?: { hour: number; count: number }[] })?.hourlyDistribution || []).map((slot) => {
                        const maxCount = Math.max(...((runResults["send-time-optimization"] as { hourlyDistribution?: { count: number }[] })?.hourlyDistribution || [{ count: 1 }]).map(h => h.count));
                        const heightPercent = maxCount > 0 ? (slot.count / maxCount) * 100 : 0;
                        const isPeak = ((runResults["send-time-optimization"] as { summary?: { peakHour?: number } })?.summary?.peakHour) === slot.hour;
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
                          {((runResults["send-time-optimization"] as { hourlyDistribution?: { hour: number; count: number }[] })?.hourlyDistribution || [])
                            .sort((a, b) => b.count - a.count)
                            .map((slot) => {
                              const total = ((runResults["send-time-optimization"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 1;
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
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Clock className="h-12 w-12 mb-4 text-zinc-300" />
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
                    <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500">Projects Processed</p>
                      <p className="text-xl font-bold">{((runResults["auto-tagging"] as { results?: unknown[] })?.results || []).length}</p>
                    </div>
                    <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
                      <p className="text-xs text-zinc-500">Successfully Tagged</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {((runResults["auto-tagging"] as { results?: { success: boolean }[] })?.results || []).filter(r => r.success).length}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-900/30">
                      <p className="text-xs text-zinc-500">Failed / Skipped</p>
                      <p className="text-xl font-bold text-red-600">
                        {((runResults["auto-tagging"] as { results?: { success: boolean }[] })?.results || []).filter(r => !r.success).length}
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
                        {((runResults["auto-tagging"] as { results?: { projectId: string; success: boolean; tags?: string[]; reason?: string }[] })?.results || []).map((result) => (
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
                            <TableCell className="py-2 text-xs text-zinc-500 max-w-xs truncate">
                              {result.reason || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Tag className="h-12 w-12 mb-4 text-zinc-300" />
                  <p className="font-medium">No Auto-Tagging Data</p>
                  <p className="text-sm">Run the Auto-Tagging service to see results here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowResultsViewer(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
