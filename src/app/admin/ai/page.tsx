"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  UserCheck,
  Maximize2,
} from "lucide-react";

// Types
import type { AIService, CronJob, RunResults } from "./types";

// Components
import { ResultsViewerDialog, getStatusColor, getStatusBadge } from "./components";

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

  const defaultCronJobs: CronJob[] = [
    { id: "cron-1", service: "auto-tagging", schedule: "0 2 * * *", enabled: false, nextRun: "Tomorrow 2:00 AM" },
    { id: "cron-2", service: "predictive-analytics", schedule: "0 3 * * *", enabled: false, nextRun: "Tomorrow 3:00 AM" },
    { id: "cron-3", service: "smart-segmentation", schedule: "0 4 * * 0", enabled: false, nextRun: "Sunday 4:00 AM" },
    { id: "cron-4", service: "send-time-optimization", schedule: "0 1 * * *", enabled: false, nextRun: "Tomorrow 1:00 AM" },
  ];

  const [cronJobs, setCronJobs] = useState<CronJob[]>(defaultCronJobs);

  const [isLoading, setIsLoading] = useState(true);
  const [runningService, setRunningService] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<"operational" | "degraded" | "offline">("operational");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    behaviorEvents: 0,
    emailsSent: 0,
  });
  const [runResults, setRunResults] = useState<RunResults>({});
  const [showResultsViewer, setShowResultsViewer] = useState(false);
  const [resultsViewerTab, setResultsViewerTab] = useState("predictive");
  // Persisted run history (survives refresh + includes cron runs).
  const [runLog, setRunLog] = useState<Array<{
    id: string;
    action: string;
    serviceId: string;
    success: boolean;
    message: string | null;
    trigger: string;
    durationMs: number | null;
    createdAt: string;
  }>>([]);

  const fetchRunLog = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-marketing/run?limit=50");
      if (res.ok) {
        const data = await res.json();
        setRunLog(data.runs || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Save cron schedules to database
  const saveCronSchedules = useCallback(async (jobs: CronJob[]) => {
    try {
      await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          section: "aiMarketing",
          data: {
            aiCronSchedules: JSON.stringify(jobs.map(j => ({
              id: j.id,
              service: j.service,
              schedule: j.schedule,
              enabled: j.enabled,
            }))),
          },
        }),
      });
    } catch (error) {
      console.error("Failed to save cron schedules:", error);
    }
  }, []);

  // Load initial status
  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load AI status and settings
      const [statusRes, settingsRes] = await Promise.all([
        apiFetch("/api/admin/ai-marketing/run", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({ action: "getStatus" }),
        }),
        fetch("/api/admin/settings"),
      ]);

      const data = await statusRes.json();
      if (data.success && data.stats) {
        setStats(prev => ({
          ...prev,
          totalUsers: data.stats.totalUsers ?? prev.totalUsers,
          totalProjects: data.stats.totalProjects ?? prev.totalProjects,
          behaviorEvents: data.stats.behaviorEvents ?? prev.behaviorEvents,
          emailsSent: data.stats.emailsSent ?? prev.emailsSent,
        }));
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

      // Load cron schedules from settings
      const settingsData = await settingsRes.json();
      if (settingsData.settings?.aiCronSchedules) {
        try {
          const savedSchedules = JSON.parse(settingsData.settings.aiCronSchedules) as Array<{
            id: string;
            service: string;
            schedule: string;
            enabled: boolean;
          }>;
          setCronJobs((prev) =>
            prev.map((job) => {
              const saved = savedSchedules.find((s) => s.id === job.id);
              return saved
                ? { ...job, schedule: saved.schedule, enabled: saved.enabled }
                : job;
            })
          );
        } catch {
          // Use defaults if parse fails
        }
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
    fetchRunLog();
  }, [loadStatus, fetchRunLog]);

  // Run a service
  const runService = async (serviceId: string, action: string) => {
    setRunningService(serviceId);
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, status: "running" } : s))
    );

    try {
      const res = await apiFetch("/api/admin/ai-marketing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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
      // Refresh the persisted run history so the new run shows in
      // the History tab immediately (and survives a refresh).
      fetchRunLog();

      // Reset status after 10 seconds
      setTimeout(() => {
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? { ...s, status: "idle" } : s))
        );
      }, 10000);
    } catch {
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
    setCronJobs((prev) => {
      const updated = prev.map((job) =>
        job.id === jobId ? { ...job, enabled: !job.enabled } : job
      );
      // Save to database
      saveCronSchedules(updated);
      return updated;
    });
  };

  // Update cron schedule
  const updateCronSchedule = (jobId: string, schedule: string) => {
    setCronJobs((prev) => {
      const updated = prev.map((job) =>
        job.id === jobId ? { ...job, schedule } : job
      );
      // Save to database
      saveCronSchedules(updated);
      return updated;
    });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 sm:h-7 sm:w-7 text-violet-600" />
            AI Control Center
          </h1>
          <p className="text-muted-foreground">Manage and trigger AI services</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
              <><CheckCircle className="h-3 w-3 mr-1" /> <span className="hidden sm:inline">All Systems </span>Operational</>
            ) : aiStatus === "degraded" ? (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Degraded</>
            ) : (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Offline</>
            )}
          </Badge>
          <Button onClick={loadStatus} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(stats.totalUsers ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
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
                <p className="text-2xl font-bold">{(stats.totalProjects ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Projects</p>
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
                <p className="text-2xl font-bold">{(stats.behaviorEvents ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Events (30 days)</p>
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
                <p className="text-2xl font-bold">{(stats.emailsSent ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Emails (7 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services">
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max min-w-full">
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
        </div>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id} className={!service.enabled ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-2 ${
                          service.enabled ? "bg-violet-100 text-violet-600" : "bg-muted text-muted-foreground"
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
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge(service.status)}
                  </div>
                  {service.lastRun && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Run</span>
                      <span className="text-xs">{service.lastRun}</span>
                    </div>
                  )}
                  {service.result && (
                    <p className="text-xs text-muted-foreground bg-muted/50 dark:bg-zinc-900 rounded p-2">
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
                            job.enabled ? "bg-violet-100 text-violet-600" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {service?.icon}
                        </div>
                        <div>
                          <p className="font-medium">{service?.name}</p>
                          <p className="text-xs text-muted-foreground">{service?.description}</p>
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
                              <SelectItem value="0 4 * * 0">Weekly (Sunday 4:00 AM)</SelectItem>
                              <SelectItem value="0 0 * * 1">Weekly (Monday midnight)</SelectItem>
                              <SelectItem value="0 0 1 * *">Monthly (1st at midnight)</SelectItem>
                            </SelectContent>
                          </Select>
                          {job.enabled && job.nextRun && (
                            <p className="text-xs text-muted-foreground mt-1">Next: {job.nextRun}</p>
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
              <div className="text-xs text-muted-foreground">
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
          {/* Persisted run log — survives refreshes and includes
              cron-triggered runs. Always shown when any rows exist. */}
          {runLog.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Recent Runs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {runLog.map((run) => (
                    <div key={run.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${run.success ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="font-medium capitalize shrink-0">{run.serviceId.replace(/-/g, " ")}</span>
                        <span className="text-muted-foreground truncate">{run.message}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        {run.trigger === "cron" && (
                          <span className="rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5">cron</span>
                        )}
                        {run.durationMs != null && <span>{run.durationMs}ms</span>}
                        <span>{new Date(run.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(runResults).length === 0 ? (
            runLog.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">No runs yet</p>
                    <p className="text-sm">Click &quot;Run Now&quot; on any service to see results here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : null
          ) : (
            <>
              {/* Results Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {runResults["predictive-analytics"] && (
                  <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => { setResultsViewerTab("predictive"); setShowResultsViewer(true); }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Predictive Analytics</p>
                          <p className="text-xs text-muted-foreground">{services.find(s => s.id === "predictive-analytics")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Analyzed</p>
                          <p className="font-semibold">{((runResults["predictive-analytics"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">High Value</p>
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
                          <p className="text-xs text-muted-foreground">{services.find(s => s.id === "smart-segmentation")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Segments</p>
                          <p className="font-semibold">{((runResults["smart-segmentation"] as { segments?: unknown[] })?.segments || []).length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Users</p>
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
                          <p className="text-xs text-muted-foreground">{services.find(s => s.id === "send-time-optimization")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Analyzed</p>
                          <p className="font-semibold">{((runResults["send-time-optimization"] as { summary?: { totalAnalyzed?: number } })?.summary?.totalAnalyzed) || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Peak Hour</p>
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
                          <p className="text-xs text-muted-foreground">{services.find(s => s.id === "auto-tagging")?.lastRun}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Processed</p>
                          <p className="font-semibold">{((runResults["auto-tagging"] as { results?: unknown[] })?.results || []).length}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Tagged</p>
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
                          <p className="text-xs text-muted-foreground mb-2">{segment.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(segment.criteria) ? segment.criteria : []).slice(0, 2).map((c, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                            {Array.isArray(segment.criteria) && segment.criteria.length > 2 && (
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
                            <span className="text-[10px] text-muted-foreground">{slot.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">Hour of day (0-23) • Peak hour highlighted in amber</p>
                  </CardContent>
                </Card>
              )}

              {/* All Results Raw Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-5 w-5 text-muted-foreground" />
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
                                <p className="text-xs text-muted-foreground">{service?.lastRun}</p>
                              </div>
                            </div>
                            <Badge variant={(result as { success?: boolean })?.success ? "default" : "destructive"}>
                              {(result as { success?: boolean })?.success ? "Success" : "Failed"}
                            </Badge>
                          </div>
                          <pre className="text-xs bg-muted/50 dark:bg-zinc-900 rounded p-3 overflow-auto max-h-32">
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
      <ResultsViewerDialog
        open={showResultsViewer}
        onOpenChange={setShowResultsViewer}
        resultsViewerTab={resultsViewerTab}
        onTabChange={setResultsViewerTab}
        runResults={runResults}
        services={services}
      />
    </div>
  );
}
