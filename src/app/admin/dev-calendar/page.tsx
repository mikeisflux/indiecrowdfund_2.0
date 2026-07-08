"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import {
  Calendar,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Clock,
  StickyNote,
  Bell,
  Repeat,
  CheckCircle2,
  Circle,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type EntryType = "NOTE" | "REMINDER" | "JOB_SCHEDULE";
type EntryStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";

interface Entry {
  id: string;
  type: EntryType;
  title: string;
  description: string | null;
  scheduledFor: string | null;
  cronExpression: string | null;
  link: string | null;
  status: EntryStatus;
  tags: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  type: EntryType;
  title: string;
  description: string;
  scheduledFor: string; // datetime-local format
  cronExpression: string;
  link: string;
  tags: string;
  status: EntryStatus;
}

const blankForm: FormState = {
  type: "NOTE",
  title: "",
  description: "",
  scheduledFor: "",
  cronExpression: "",
  link: "",
  tags: "",
  status: "PENDING",
};

const TYPE_ICON: Record<EntryType, React.ComponentType<{ className?: string }>> = {
  NOTE: StickyNote,
  REMINDER: Bell,
  JOB_SCHEDULE: Repeat,
};

const STATUS_ICON: Record<EntryStatus, React.ComponentType<{ className?: string }>> = {
  PENDING: Circle,
  IN_PROGRESS: PlayCircle,
  DONE: CheckCircle2,
  SKIPPED: XCircle,
};

const STATUS_LABEL: Record<EntryStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  SKIPPED: "Skipped",
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function bucketForEntry(e: Entry): "today" | "thisWeek" | "later" | "past" | "done" {
  if (e.status === "DONE" || e.status === "SKIPPED") return "done";
  if (!e.scheduledFor) return "later";
  const d = new Date(e.scheduledFor);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (d < startOfToday) return "past";
  if (d < startOfTomorrow) return "today";
  if (d < startOfNextWeek) return "thisWeek";
  return "later";
}

export default function DevCalendarPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"ALL" | EntryType>("ALL");
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/admin/dev-calendar?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("Failed to load entries", err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const openNew = () => {
    setForm(blankForm);
    setEditingId(null);
    setShowDialog(true);
  };

  const openEdit = (entry: Entry) => {
    setForm({
      type: entry.type,
      title: entry.title,
      description: entry.description || "",
      scheduledFor: toLocalInput(entry.scheduledFor),
      cronExpression: entry.cronExpression || "",
      link: entry.link || "",
      tags: entry.tags.join(", "),
      status: entry.status,
    });
    setEditingId(entry.id);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        scheduledFor: fromLocalInput(form.scheduledFor),
        cronExpression: form.cronExpression.trim() || null,
        link: form.link.trim() || null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: form.status,
      };
      const res = editingId
        ? await apiFetch(`/api/admin/dev-calendar/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiFetch("/api/admin/dev-calendar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      toast.success(editingId ? "Entry updated" : "Entry created");
      setShowDialog(false);
      fetchEntries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (entry: Entry, status: EntryStatus) => {
    try {
      const res = await apiFetch(`/api/admin/dev-calendar/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      fetchEntries();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const deleteEntry = async (entry: Entry) => {
    if (!confirm(`Delete "${entry.title}"?`)) return;
    try {
      const res = await apiFetch(`/api/admin/dev-calendar/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Entry deleted");
      fetchEntries();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiFetch("/api/admin/dev-calendar/seed", { method: "POST" });
      if (!res.ok) throw new Error("Seed failed");
      const data = await res.json();
      const created = (data.results || []).filter((r: { created: boolean }) => r.created).length;
      toast.success(created > 0 ? `Seeded ${created} entries` : "Already seeded");
      fetchEntries();
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const buckets = useMemo(() => {
    const out: Record<"past" | "today" | "thisWeek" | "later" | "done", Entry[]> = {
      past: [],
      today: [],
      thisWeek: [],
      later: [],
      done: [],
    };
    for (const e of entries) {
      out[bucketForEntry(e)].push(e);
    }
    return out;
  }, [entries]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" /> Dev Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Engineering notes, reminders, and cron-job documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="NOTE">Notes</SelectItem>
              <SelectItem value="REMINDER">Reminders</SelectItem>
              <SelectItem value="JOB_SCHEDULE">Job schedules</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSeed} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Seed defaults"}
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> New entry
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Past due" entries={buckets.past} accent="border-red-300" onEdit={openEdit} onDelete={deleteEntry} onStatus={updateStatus} />
          <Section title="Today" entries={buckets.today} accent="border-amber-300" onEdit={openEdit} onDelete={deleteEntry} onStatus={updateStatus} />
          <Section title="This week" entries={buckets.thisWeek} accent="border-blue-300" onEdit={openEdit} onDelete={deleteEntry} onStatus={updateStatus} />
          <Section title="Later" entries={buckets.later} accent="border-emerald-300" onEdit={openEdit} onDelete={deleteEntry} onStatus={updateStatus} />
          <Section title="Done / skipped" entries={buckets.done} accent="border-zinc-300" onEdit={openEdit} onDelete={deleteEntry} onStatus={updateStatus} muted />
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit entry" : "New entry"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update an existing calendar entry." : "Pin a note, reminder, or document a cron schedule."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as EntryType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTE">Note</SelectItem>
                    <SelectItem value="REMINDER">Reminder</SelectItem>
                    <SelectItem value="JOB_SCHEDULE">Job schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EntryStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="SKIPPED">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What is this?"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Details, runbook, links, or notes — markdown not rendered."
                className="font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Scheduled for (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledFor}
                  onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cron expression (job schedules)</Label>
                <Input
                  value={form.cronExpression}
                  onChange={(e) => setForm({ ...form, cronExpression: e.target.value })}
                  placeholder="*/10 * * * *"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link (optional)</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://... or /docs/foo.md"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="chargeback, ops, deploy"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  entries,
  accent,
  onEdit,
  onDelete,
  onStatus,
  muted = false,
}: {
  title: string;
  entries: Entry[];
  accent: string;
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
  onStatus: (e: Entry, s: EntryStatus) => void;
  muted?: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 ${muted ? "opacity-70" : ""}`}>
        {title} <span className="ml-1 text-xs opacity-60">({entries.length})</span>
      </h2>
      <div className="grid gap-3">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} accent={accent} muted={muted} onEdit={onEdit} onDelete={onDelete} onStatus={onStatus} />
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  accent,
  muted,
  onEdit,
  onDelete,
  onStatus,
}: {
  entry: Entry;
  accent: string;
  muted: boolean;
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
  onStatus: (e: Entry, s: EntryStatus) => void;
}) {
  const TypeIcon = TYPE_ICON[entry.type];
  const StatusIcon = STATUS_ICON[entry.status];
  return (
    <Card className={`border-l-4 ${accent} ${muted ? "opacity-70" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            <TypeIcon className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-base leading-snug">{entry.title}</CardTitle>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onDelete(entry)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" /> {STATUS_LABEL[entry.status]}
          </span>
          {entry.scheduledFor && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmtDateTime(entry.scheduledFor)}
            </span>
          )}
          {entry.cronExpression && (
            <span className="flex items-center gap-1">
              <Repeat className="h-3 w-3" />{" "}
              <code className="text-xs bg-muted px-1 rounded">{entry.cronExpression}</code>
            </span>
          )}
          {entry.tags.map((t) => (
            <Badge key={t} variant="secondary" className="text-xs">
              {t}
            </Badge>
          ))}
          {entry.link && (
            <a
              href={entry.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 underline hover:no-underline"
            >
              <ExternalLink className="h-3 w-3" /> link
            </a>
          )}
        </div>
      </CardHeader>
      {entry.description && (
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
            {entry.description}
          </pre>
        </CardContent>
      )}
      <CardContent className="pt-0">
        <div className="flex gap-2">
          {entry.status !== "DONE" && (
            <Button variant="outline" size="sm" onClick={() => onStatus(entry, "DONE")}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark done
            </Button>
          )}
          {entry.status === "PENDING" && (
            <Button variant="outline" size="sm" onClick={() => onStatus(entry, "IN_PROGRESS")}>
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Start
            </Button>
          )}
          {entry.status !== "PENDING" && entry.status !== "DONE" && (
            <Button variant="outline" size="sm" onClick={() => onStatus(entry, "PENDING")}>
              <Circle className="h-3.5 w-3.5 mr-1.5" /> Reset to pending
            </Button>
          )}
          {entry.status !== "SKIPPED" && entry.status !== "DONE" && (
            <Button variant="outline" size="sm" onClick={() => onStatus(entry, "SKIPPED")}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Skip
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
