"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface ProjectReward {
  id: string;
  title: string;
  description: string;
  amount: number;
  type: "TIER" | "ADDON";
  showInSurvey: boolean;
}

interface ImportAddonFromProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingAddonIds: string[];
  onImported: () => void;
}

export function ImportAddonFromProjectDialog({
  open,
  onOpenChange,
  projectId,
  existingAddonIds,
  onImported,
}: ImportAddonFromProjectDialogProps) {
  const [rewards, setRewards] = useState<ProjectReward[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fetchRewards = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/rewards`);
      if (!response.ok) return;

      const data = await response.json();
      const projectRewards: ProjectReward[] = (data.rewards || []).map(
        (r: { id: string; title: string; description?: string; amount: number; type?: string; showInSurvey?: boolean }) => ({
          id: r.id,
          title: r.title,
          description: r.description || "",
          amount: Number(r.amount),
          type: r.type || "TIER",
          showInSurvey: r.showInSurvey || false,
        })
      );

      setRewards(projectRewards);
    } catch (error) {
      console.error("Failed to fetch project rewards:", error);
      toast.error("Failed to load project rewards");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchRewards();
      setSelectedIds(new Set());
    }
  }, [open, fetchRewards]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one add-on to link");
      return;
    }

    setIsImporting(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "link",
          addonIds: Array.from(selectedIds),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Linked ${data.linked} add-on${data.linked !== 1 ? "s" : ""} to survey`);
        onImported();
        onOpenChange(false);
      } else {
        toast.error("Failed to link add-ons");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to link add-ons");
    } finally {
      setIsImporting(false);
    }
  };

  // Only show add-ons not already linked to the survey
  const existingSet = new Set(existingAddonIds);
  const availableRewards = rewards.filter(
    (r) => r.type === "ADDON" && !existingSet.has(r.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Link Add-ons to Survey</DialogTitle>
          <DialogDescription>
            Select add-ons from your project to show in the survey. Sales will count toward your campaign totals.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading add-ons...</span>
            </div>
          ) : availableRewards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {rewards.filter((r) => r.type === "ADDON").length === 0
                  ? "No add-ons found in this project. Create add-ons in your project first."
                  : "All add-ons are already linked to the survey."}
              </p>
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto space-y-2">
              {availableRewards.map((reward) => (
                <label
                  key={reward.id}
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.has(reward.id)}
                    onCheckedChange={() => toggleSelection(reward.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{reward.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">${reward.amount.toFixed(2)}</p>
                    {reward.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reward.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleImport}
            disabled={isImporting || selectedIds.size === 0}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4 mr-2" />
                Link {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
