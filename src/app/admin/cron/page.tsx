"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { fetchWithRetry, apiFetch } from "@/lib/fetch-utils";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  MoreVertical,
  Terminal,
  Play,
  Pause,
  Code,
  AlertTriangle,
  Copy,
  Undo2,
} from "lucide-react";

interface CronJob {
  id: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  command: string;
  comment: string;
  enabled: boolean;
  raw: string;
}

interface ParsedCrontab {
  jobs: CronJob[];
  headerLines: string[];
}

const COMMON_SCHEDULES = [
  { label: "Every minute", cron: "* * * * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
  { label: "Every 15 minutes", cron: "*/15 * * * *" },
  { label: "Every 30 minutes", cron: "*/30 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Every 12 hours", cron: "0 */12 * * *" },
  { label: "Daily at midnight", cron: "0 0 * * *" },
  { label: "Daily at 3 AM", cron: "0 3 * * *" },
  { label: "Weekly (Sunday midnight)", cron: "0 0 * * 0" },
  { label: "Monthly (1st at midnight)", cron: "0 0 1 * *" },
];

const MONTH_NAMES: Record<string, string> = {
  "1": "Jan", "2": "Feb", "3": "Mar", "4": "Apr",
  "5": "May", "6": "Jun", "7": "Jul", "8": "Aug",
  "9": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const DAY_NAMES: Record<string, string> = {
  "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
  "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun",
};

function describeSchedule(
  minute: string,
  hour: string,
  dayOfMonth: string,
  month: string,
  dayOfWeek: string
): string {
  const parts: string[] = [];

  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute";
  }

  // Handle */N patterns
  if (minute.startsWith("*/")) {
    return `Every ${minute.slice(2)} minutes`;
  }

  if (minute !== "*" && hour === "*") {
    return `Every hour at minute ${minute}`;
  }

  if (hour.startsWith("*/")) {
    parts.push(`Every ${hour.slice(2)} hours`);
    if (minute !== "*" && minute !== "0") parts.push(`at minute ${minute}`);
    return parts.join(" ");
  }

  if (minute !== "*" && hour !== "*") {
    const h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    parts.push(`At ${h12}:${minute.padStart(2, "0")} ${ampm}`);
  }

  if (dayOfWeek !== "*") {
    const days = dayOfWeek.split(",").map((d) => DAY_NAMES[d] || d).join(", ");
    parts.push(`on ${days}`);
  }

  if (dayOfMonth !== "*") {
    parts.push(`on day ${dayOfMonth}`);
  }

  if (month !== "*") {
    const months = month.split(",").map((m) => MONTH_NAMES[m] || m).join(", ");
    parts.push(`in ${months}`);
  }

  return parts.length > 0 ? parts.join(" ") : `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

function parseCrontab(raw: string): ParsedCrontab {
  const lines = raw.split("\n");
  const jobs: CronJob[] = [];
  const headerLines: string[] = [];
  let pendingComment = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Collect comments (but not disabled jobs)
    if (trimmed.startsWith("#") && !trimmed.match(/^#\s*[\*0-9]/)) {
      // This is a regular comment, not a disabled cron job
      if (jobs.length === 0) {
        headerLines.push(trimmed);
      } else {
        pendingComment = trimmed.replace(/^#\s*/, "");
      }
      continue;
    }

    let enabled = true;
    let jobLine = trimmed;

    // Check if it's a disabled job (commented out cron expression)
    if (trimmed.startsWith("#")) {
      enabled = false;
      jobLine = trimmed.replace(/^#\s*/, "");
    }

    // Try to parse as a cron job (5 schedule fields + command)
    const match = jobLine.match(
      /^([\S]+)\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+(.+)$/
    );

    if (match) {
      jobs.push({
        id: crypto.randomUUID(),
        minute: match[1],
        hour: match[2],
        dayOfMonth: match[3],
        month: match[4],
        dayOfWeek: match[5],
        command: match[6],
        comment: pendingComment,
        enabled,
        raw: line,
      });
      pendingComment = "";
    } else if (trimmed.startsWith("#")) {
      // It was a comment after all
      if (jobs.length === 0) {
        headerLines.push(trimmed);
      } else {
        pendingComment = trimmed.replace(/^#\s*/, "");
      }
    } else {
      // Environment variable or unknown line - treat as header
      headerLines.push(trimmed);
    }
  }

  return { jobs, headerLines };
}

function buildCrontab(parsed: ParsedCrontab): string {
  const lines: string[] = [];

  // Preserve header lines (env vars, comments at top)
  for (const h of parsed.headerLines) {
    lines.push(h);
  }

  if (parsed.headerLines.length > 0) {
    lines.push("");
  }

  for (const job of parsed.jobs) {
    if (job.comment) {
      lines.push(`# ${job.comment}`);
    }
    const schedule = `${job.minute} ${job.hour} ${job.dayOfMonth} ${job.month} ${job.dayOfWeek}`;
    const prefix = job.enabled ? "" : "# ";
    lines.push(`${prefix}${schedule} ${job.command}`);
  }

  return lines.join("\n");
}

const defaultJob: Omit<CronJob, "id" | "raw"> = {
  minute: "0",
  hour: "0",
  dayOfMonth: "*",
  month: "*",
  dayOfWeek: "*",
  command: "",
  comment: "",
  enabled: true,
};

export default function CronManagementPage() {
  const [rawCrontab, setRawCrontab] = useState("");
  const [parsed, setParsed] = useState<ParsedCrontab>({ jobs: [], headerLines: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [rawEditorContent, setRawEditorContent] = useState("");
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [jobForm, setJobForm] = useState(defaultJob);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const fetchCrontab = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithRetry("/api/admin/cron");
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setRawCrontab(data.crontab || "");
      setParsed(parseCrontab(data.crontab || ""));
    } catch (error) {
      console.error("Error fetching crontab:", error);
      toast.error("Failed to load crontab");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCrontab();
  }, [fetchCrontab]);

  const saveCrontab = async (content: string) => {
    try {
      setSaving(true);
      const res = await apiFetch("/api/admin/cron", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ crontab: content }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.backup) {
        setLastBackup(data.backup);
      }

      setRawCrontab(content);
      setParsed(parseCrontab(content));
      toast.success("Crontab saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save crontab");
    } finally {
      setSaving(false);
    }
  };

  const handleAddJob = () => {
    setEditingJob(null);
    setJobForm({ ...defaultJob });
    setShowJobDialog(true);
  };

  const handleEditJob = (job: CronJob) => {
    setEditingJob(job);
    setJobForm({
      minute: job.minute,
      hour: job.hour,
      dayOfMonth: job.dayOfMonth,
      month: job.month,
      dayOfWeek: job.dayOfWeek,
      command: job.command,
      comment: job.comment,
      enabled: job.enabled,
    });
    setShowJobDialog(true);
  };

  const handleSaveJob = async () => {
    if (!jobForm.command.trim()) {
      toast.error("Command is required");
      return;
    }

    const newJob: CronJob = {
      id: editingJob?.id || crypto.randomUUID(),
      minute: jobForm.minute,
      hour: jobForm.hour,
      dayOfMonth: jobForm.dayOfMonth,
      month: jobForm.month,
      dayOfWeek: jobForm.dayOfWeek,
      command: jobForm.command.trim(),
      comment: jobForm.comment.trim(),
      enabled: jobForm.enabled,
      raw: "",
    };

    let updatedJobs: CronJob[];
    if (editingJob) {
      updatedJobs = parsed.jobs.map((j) => (j.id === editingJob.id ? newJob : j));
    } else {
      updatedJobs = [...parsed.jobs, newJob];
    }

    const updated = { ...parsed, jobs: updatedJobs };
    const content = buildCrontab(updated);
    await saveCrontab(content);
    setShowJobDialog(false);
  };

  const handleDeleteJob = async (jobId: string) => {
    const updatedJobs = parsed.jobs.filter((j) => j.id !== jobId);
    const updated = { ...parsed, jobs: updatedJobs };
    const content = buildCrontab(updated);
    await saveCrontab(content);
    setDeleteConfirm(null);
  };

  const handleToggleJob = async (jobId: string) => {
    const updatedJobs = parsed.jobs.map((j) =>
      j.id === jobId ? { ...j, enabled: !j.enabled } : j
    );
    const updated = { ...parsed, jobs: updatedJobs };
    const content = buildCrontab(updated);
    await saveCrontab(content);
  };

  const handleSaveRaw = async () => {
    await saveCrontab(rawEditorContent);
    setShowRawEditor(false);
  };

  const handleRestoreBackup = async () => {
    if (!lastBackup) return;
    await saveCrontab(lastBackup);
    setLastBackup(null);
    toast.success("Backup restored");
  };

  const handleApplyPreset = (cron: string) => {
    const parts = cron.split(" ");
    if (parts.length === 5) {
      setJobForm((f) => ({
        ...f,
        minute: parts[0],
        hour: parts[1],
        dayOfMonth: parts[2],
        month: parts[3],
        dayOfWeek: parts[4],
      }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const activeJobs = parsed.jobs.filter((j) => j.enabled).length;
  const disabledJobs = parsed.jobs.filter((j) => !j.enabled).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Clock className="h-8 w-8 text-emerald-500" />
            Cron Jobs
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage scheduled tasks on the server
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastBackup && (
            <Button variant="outline" size="sm" onClick={handleRestoreBackup} disabled={saving}>
              <Undo2 className="h-4 w-4 mr-2" />
              Restore Backup
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRawEditorContent(rawCrontab);
              setShowRawEditor(true);
            }}
          >
            <Code className="h-4 w-4 mr-2" />
            Raw Editor
          </Button>
          <Button variant="outline" size="icon" onClick={fetchCrontab} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleAddJob} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{parsed.jobs.length}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-emerald-500">{activeJobs}</p>
              </div>
              <Play className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Disabled</p>
                <p className="text-2xl font-bold text-amber-500">{disabledJobs}</p>
              </div>
              <Pause className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Direct Server Crontab Access
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Changes here modify the server&apos;s crontab directly. A backup is saved before each
                change. Use the &quot;Restore Backup&quot; button to undo the last change if needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      {parsed.jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Terminal className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No cron jobs found</h3>
            <p className="text-muted-foreground mb-4">
              The crontab is empty. Add a scheduled job to get started.
            </p>
            <Button onClick={handleAddJob}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Job
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden lg:table-cell">Command</TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.jobs.map((job) => (
                  <TableRow key={job.id} className={!job.enabled ? "opacity-50" : ""}>
                    <TableCell>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={() => handleToggleJob(job.id)}
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          {job.minute} {job.hour} {job.dayOfMonth} {job.month} {job.dayOfWeek}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {describeSchedule(job.minute, job.hour, job.dayOfMonth, job.month, job.dayOfWeek)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {job.comment || <span className="text-muted-foreground italic">No description</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate block">
                          {job.command}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => copyToClipboard(job.command)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditJob(job)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyToClipboard(job.command)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Command
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => setDeleteConfirm(job.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Job Dialog */}
      <Dialog open={showJobDialog} onOpenChange={setShowJobDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingJob ? "Edit Cron Job" : "Add Cron Job"}
            </DialogTitle>
            <DialogDescription>
              Configure the schedule and command for this job.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Quick Schedule Presets */}
            <div>
              <Label className="mb-2 block">Quick Schedule</Label>
              <Select onValueChange={handleApplyPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a common schedule..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SCHEDULES.map((s) => (
                    <SelectItem key={s.cron} value={s.cron}>
                      {s.label} ({s.cron})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Fields */}
            <div>
              <Label className="mb-2 block">Schedule (Cron Expression)</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Minute</Label>
                  <Input
                    value={jobForm.minute}
                    onChange={(e) => setJobForm((f) => ({ ...f, minute: e.target.value }))}
                    placeholder="*"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hour</Label>
                  <Input
                    value={jobForm.hour}
                    onChange={(e) => setJobForm((f) => ({ ...f, hour: e.target.value }))}
                    placeholder="*"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Day (Month)</Label>
                  <Input
                    value={jobForm.dayOfMonth}
                    onChange={(e) => setJobForm((f) => ({ ...f, dayOfMonth: e.target.value }))}
                    placeholder="*"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Month</Label>
                  <Input
                    value={jobForm.month}
                    onChange={(e) => setJobForm((f) => ({ ...f, month: e.target.value }))}
                    placeholder="*"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Day (Week)</Label>
                  <Input
                    value={jobForm.dayOfWeek}
                    onChange={(e) => setJobForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                    placeholder="*"
                    className="font-mono"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Preview:{" "}
                <span className="font-medium">
                  {describeSchedule(jobForm.minute, jobForm.hour, jobForm.dayOfMonth, jobForm.month, jobForm.dayOfWeek)}
                </span>
              </p>
            </div>

            {/* Command */}
            <div>
              <Label htmlFor="command">Command</Label>
              <Textarea
                id="command"
                value={jobForm.command}
                onChange={(e) => setJobForm((f) => ({ ...f, command: e.target.value }))}
                placeholder="e.g., /usr/bin/node /home/user/scripts/cleanup.js >> /var/log/cleanup.log 2>&1"
                className="font-mono text-sm"
                rows={3}
              />
            </div>

            {/* Comment/Description */}
            <div>
              <Label htmlFor="comment">Description (optional)</Label>
              <Input
                id="comment"
                value={jobForm.comment}
                onChange={(e) => setJobForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="What does this job do?"
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center gap-2">
              <Switch
                checked={jobForm.enabled}
                onCheckedChange={(checked) => setJobForm((f) => ({ ...f, enabled: checked }))}
              />
              <Label>Enabled</Label>
            </div>

            {/* Preview */}
            <div className="bg-muted rounded-lg p-3">
              <Label className="text-xs text-muted-foreground mb-1 block">Crontab Line Preview</Label>
              <code className="text-sm font-mono break-all">
                {jobForm.enabled ? "" : "# "}
                {jobForm.minute} {jobForm.hour} {jobForm.dayOfMonth} {jobForm.month} {jobForm.dayOfWeek}{" "}
                {jobForm.command || "<command>"}
              </code>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveJob} disabled={saving || !jobForm.command.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingJob ? (
                "Update Job"
              ) : (
                "Add Job"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw Editor Dialog */}
      <Dialog open={showRawEditor} onOpenChange={setShowRawEditor}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Raw Crontab Editor</DialogTitle>
            <DialogDescription>
              Edit the crontab file directly. Be careful — invalid syntax will be rejected.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rawEditorContent}
            onChange={(e) => setRawEditorContent(e.target.value)}
            className="font-mono text-sm min-h-[400px]"
            placeholder="# m h dom mon dow command"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRawEditor(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRaw} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Crontab"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cron Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this cron job? This will update the server crontab immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDeleteJob(deleteConfirm)}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Job"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
