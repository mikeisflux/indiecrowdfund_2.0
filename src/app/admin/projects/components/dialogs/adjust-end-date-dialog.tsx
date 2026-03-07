"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface AdjustEndDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  currentEndDate: string | null;
  onSuccess?: (newEndDate: string) => void;
}

function toLocalDateTimeString(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDisplayDate(isoString: string | null): string {
  if (!isoString) return "Not set";
  return new Date(isoString).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function AdjustEndDateDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  currentEndDate,
  onSuccess,
}: AdjustEndDateDialogProps) {
  const [newEndDate, setNewEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNewEndDate(toLocalDateTimeString(currentEndDate));
    }
  }, [open, currentEndDate]);

  const handleSave = async () => {
    if (!newEndDate) {
      toast.error("Please select a date and time");
      return;
    }

    const parsed = new Date(newEndDate);
    if (isNaN(parsed.getTime())) {
      toast.error("Invalid date");
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/api/admin/projects/${projectId}/adjust-end-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ endDate: parsed.toISOString() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update end date");
      }

      const data = await response.json();
      toast.success(`End date updated to ${formatDisplayDate(data.project.endDate)}`);
      onSuccess?.(data.project.endDate);
      onOpenChange(false);
    } catch (error) {
      console.error("Error adjusting end date:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update end date");
    } finally {
      setSaving(false);
    }
  };

  const isPast = newEndDate ? new Date(newEndDate) < new Date() : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            Adjust End Date
          </DialogTitle>
          <DialogDescription>
            Change the end date and time for <strong>{projectTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border p-3 bg-zinc-50 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-500 mb-1">Current End Date</p>
            <p className="text-sm font-medium">{formatDisplayDate(currentEndDate)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newEndDate">New End Date & Time</Label>
            <Input
              id="newEndDate"
              type="datetime-local"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="block w-full"
            />
          </div>

          {isPast && (
            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                The selected date is in the past. The campaign will end immediately.
              </p>
            </div>
          )}

          {newEndDate && !isPast && (
            <div className="rounded-lg border p-3">
              <p className="text-xs text-zinc-500 mb-1">New End Date Preview</p>
              <p className="text-sm font-medium">{formatDisplayDate(new Date(newEndDate).toISOString())}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !newEndDate}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CalendarClock className="mr-2 h-4 w-4" />
                Update End Date
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
