"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Settings,
  AlertTriangle,
  Pause,
  History,
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
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-violet-600" />
                Recent Run Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(runResults).length === 0 ? (
                <p className="text-center text-zinc-500 py-8">
                  No runs yet. Click &quot;Run Now&quot; on any service to see results here.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(runResults).map(([serviceId, result]) => {
                    const service = services.find((s) => s.id === serviceId);
                    return (
                      <div key={serviceId} className="rounded-lg border p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="rounded-lg bg-violet-100 p-2 text-violet-600">
                            {service?.icon}
                          </div>
                          <div>
                            <p className="font-medium">{service?.name}</p>
                            <p className="text-xs text-zinc-500">{service?.lastRun}</p>
                          </div>
                        </div>
                        <pre className="text-xs bg-zinc-50 dark:bg-zinc-900 rounded p-3 overflow-auto max-h-48">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
