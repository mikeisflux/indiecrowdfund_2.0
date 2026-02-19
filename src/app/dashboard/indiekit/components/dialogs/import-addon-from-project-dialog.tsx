"use client";

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
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface ProjectReward {
  id: string;
  title: string;
  description: string;
  amount: number;
  type: "TIER" | "ADDON";
  quantityAvailable: number | null;
  isEnded: boolean;
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
        (r: { id: string; title: string; description?: string; amount: number; type?: string; quantityAvailable?: number | null; isEnded?: boolean }) => ({
          id: r.id,
          title: r.title,
          description: r.description || "",
          amount: Number(r.amount),
          type: r.type || "TIER",
          quantityAvailable: r.quantityAvailable ?? null,
          isEnded: r.isEnded || false,
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
      toast.error("Select at least one reward to import");
      return;
    }

    setIsImporting(true);
    try {
      const selected = rewards.filter((r) => selectedIds.has(r.id));
      let successCount = 0;

      for (const reward of selected) {
        const res = await fetch("/api/creator/indiekit/addons", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
            projectId,
            action: "create",
            title: reward.title,
            description: reward.description,
            amount: reward.amount,
            quantityAvailable: reward.quantityAvailable,
          }),
        });

        if (res.ok) {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} add-on${successCount !== 1 ? "s" : ""}`);
        onImported();
        onOpenChange(false);
      } else {
        toast.error("Failed to import add-ons");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to import add-ons");
    } finally {
      setIsImporting(false);
    }
  };

  // Only show add-ons (not reward tiers), and filter out already imported ones
  const availableRewards = rewards.filter(
    (r) => r.type === "ADDON" && !existingAddonIds.includes(r.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Add-ons from Project</DialogTitle>
          <DialogDescription>
            Select add-ons from your project to import as survey add-ons.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading rewards...</span>
            </div>
          ) : availableRewards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {rewards.filter((r) => r.type === "ADDON").length === 0
                  ? "No add-ons found in this project. Create add-ons in your project first."
                  : "All add-ons have already been imported."}
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
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
