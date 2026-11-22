"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarClock, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/fetch-utils";

export interface SurveyReminderValues {
  autoRemind?: boolean;
  reminderIntervalDays?: number;
  maxReminders?: number;
  dueAt?: string | null;
}

/**
 * Automatic reminder cadence for an unfinished survey. Runs daily on the
 * server (cron/survey-reminders); this is just the knobs. Shown on the
 * Sent Surveys card so the creator sets it where they see the pending count.
 */
export function SurveyReminderSettings({
  projectId,
  survey,
  onSaved,
}: {
  projectId: string;
  survey: SurveyReminderValues;
  onSaved?: () => void;
}) {
  const [autoRemind, setAutoRemind] = useState(survey.autoRemind ?? true);
  const [interval, setInterval] = useState(String(survey.reminderIntervalDays ?? 7));
  const [max, setMax] = useState(String(survey.maxReminders ?? 4));
  const [dueAt, setDueAt] = useState(survey.dueAt ? survey.dueAt.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAutoRemind(survey.autoRemind ?? true);
    setInterval(String(survey.reminderIntervalDays ?? 7));
    setMax(String(survey.maxReminders ?? 4));
    setDueAt(survey.dueAt ? survey.dueAt.slice(0, 10) : "");
  }, [survey.autoRemind, survey.reminderIntervalDays, survey.maxReminders, survey.dueAt]);

  const dirty =
    autoRemind !== (survey.autoRemind ?? true) ||
    Number(interval) !== (survey.reminderIntervalDays ?? 7) ||
    Number(max) !== (survey.maxReminders ?? 4) ||
    dueAt !== (survey.dueAt ? survey.dueAt.slice(0, 10) : "");

  const save = async () => {
    const intervalDays = Number(interval);
    const maxReminders = Number(max);
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 60) return toast.error("Interval must be 1–60 days");
    if (!Number.isInteger(maxReminders) || maxReminders < 0 || maxReminders > 20) return toast.error("Max reminders must be 0–20");
    setSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/surveys", {
        method: "PATCH",
        json: {
          projectId,
          action: "reminder_settings",
          settings: {
            autoRemind,
            reminderIntervalDays: intervalDays,
            maxReminders,
            // End of the chosen day, local to the creator's browser.
            dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null,
          },
        },
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Failed to save reminder settings");
      toast.success("Reminder settings saved");
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save reminder settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-5 w-5 text-amber-600" />
          Automatic reminders
        </CardTitle>
        <CardDescription>
          Backers who haven&apos;t finished their survey are emailed on this schedule, each time with exactly what is still missing
          (an upgrade that needs an item, a shipping address). Set a deadline and they get one final overdue notice when it passes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>
            <span className="font-medium">Send reminders automatically</span>
            <span className="block text-xs text-muted-foreground">Off = only the manual &ldquo;Send Survey Reminders&rdquo; button</span>
          </span>
          <Switch checked={autoRemind} onCheckedChange={setAutoRemind} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Every (days)</Label>
            <Input type="number" min={1} max={60} value={interval} onChange={(e) => setInterval(e.target.value)} disabled={!autoRemind} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max reminders per backer</Label>
            <Input type="number" min={0} max={20} value={max} onChange={(e) => setMax(e.target.value)} disabled={!autoRemind} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Due date
            </Label>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={!dirty || saving} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save reminder settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
