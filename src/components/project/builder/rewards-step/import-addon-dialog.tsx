"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RewardData } from "@/types";

interface ProjectReward {
  title: string;
  amount: number;
  description: string;
  type: "TIER" | "ADDON";
}

interface PreviousProject {
  id: string;
  title: string;
  rewards: ProjectReward[];
}

interface ImportAddonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  currentProjectTiers: RewardData[];
  onImportFromCurrentProject: (tierIndex: number) => void;
  onImportAddon: (addon: { title: string; description: string; amount: number }) => void;
}

export function ImportAddonDialog({
  isOpen,
  onOpenChange,
  projectId,
  currentProjectTiers,
  onImportFromCurrentProject,
  onImportAddon,
}: ImportAddonDialogProps) {
  const [selectedProject, setSelectedProject] = useState<string>("current");
  const [previousProjects, setPreviousProjects] = useState<PreviousProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Which rows (by display index) are checked for import.
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Fetch projects when dialog opens
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `/api/creator/projects-for-import${projectId ? `?exclude=${projectId}` : ""}`;
      console.log("[ImportAddonDialog] Fetching projects from:", url);
      const response = await fetch(url);

      if (!response.ok) {
        console.error("[ImportAddonDialog] API error:", response.status, response.statusText);
        return;
      }

      const data = await response.json();
      console.log("[ImportAddonDialog] API returned projects:", data.projects?.length || 0);

      if (!data.projects || data.projects.length === 0) {
        setPreviousProjects([]);
        return;
      }

      // Fetch rewards for each project
      const projectsWithRewards: PreviousProject[] = await Promise.all(
        data.projects.map(async (p: { id: string; title: string }) => {
          const rewardsRes = await fetch(`/api/projects/${p.id}/rewards`);
          let projectRewards: ProjectReward[] = [];
          if (rewardsRes.ok) {
            const rewardsData = await rewardsRes.json();
            // Get ALL rewards (both TIER and ADDON)
            projectRewards = (rewardsData.rewards || []).map((r: { title: string; amount: number; description?: string; type?: string }) => ({
              title: r.title,
              amount: r.amount,
              description: r.description || "",
              type: r.type || "TIER",
            }));
          }
          return {
            id: p.id,
            title: p.title,
            rewards: projectRewards,
          };
        })
      );

      // Include projects that have any rewards (TIER or ADDON)
      const projectsWithRewardsFiltered = projectsWithRewards.filter(p => p.rewards.length > 0);

      console.log("[ImportAddonDialog] Projects with rewards:", projectsWithRewardsFiltered.length);
      setPreviousProjects(projectsWithRewardsFiltered);
    } catch (error) {
      console.error("[ImportAddonDialog] Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setSelectedProject("current");
      setSelectedRows(new Set());
    }
  }, [isOpen, fetchProjects]);

  // Clear the selection whenever the source project changes — the display
  // indices no longer point at the same rewards.
  useEffect(() => {
    setSelectedRows(new Set());
  }, [selectedProject]);

  // Get rewards to display based on selected project
  const getRewardsToDisplay = () => {
    if (selectedProject === "current") {
      // Show current project's tiers that can be copied as add-ons
      return currentProjectTiers.map((tier, idx) => ({
        title: tier.title,
        amount: tier.amount,
        description: tier.description || "",
        type: "TIER" as const,
        idx,
        isCurrent: true,
      }));
    }

    const project = previousProjects.find((p) => p.id === selectedProject);
    if (!project) return [];

    // Show ALL rewards (both TIER and ADDON) from other projects
    return project.rewards.map((reward, idx) => ({
      title: reward.title,
      amount: reward.amount,
      description: reward.description,
      type: reward.type,
      idx,
      isCurrent: false,
    }));
  };

  const rewardsToDisplay = getRewardsToDisplay();

  const toggleRow = (displayIdx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(displayIdx)) next.delete(displayIdx);
      else next.add(displayIdx);
      return next;
    });
  };

  const allSelected = rewardsToDisplay.length > 0 && selectedRows.size === rewardsToDisplay.length;

  const toggleSelectAll = () => {
    setSelectedRows(
      allSelected ? new Set() : new Set(rewardsToDisplay.map((_, i) => i)),
    );
  };

  const handleImportSelected = () => {
    // Import in display order so the resulting add-ons keep the same ordering.
    const selected = rewardsToDisplay.filter((_, i) => selectedRows.has(i));
    if (selected.length === 0) return;

    selected.forEach((reward) => {
      if (reward.isCurrent) {
        onImportFromCurrentProject(reward.idx);
      } else {
        onImportAddon({
          title: reward.title,
          description: reward.description,
          amount: reward.amount,
        });
      }
    });

    toast.success(`Imported ${selected.length} add-on${selected.length > 1 ? "s" : ""}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import add-on from project</DialogTitle>
          <DialogDescription>
            Select one or more rewards to import as add-ons — copy reward tiers from this
            project, or pull rewards/add-ons from another project.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Project Selector Dropdown */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Project (copy tier as add-on)</SelectItem>
              {isLoading ? (
                <div className="flex items-center justify-center py-4 px-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Loading projects...</span>
                </div>
              ) : (
                <>
                  {previousProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                  {previousProjects.length === 0 && (
                    <div className="py-2 px-2 text-center text-sm text-muted-foreground">
                      No other projects found
                    </div>
                  )}
                </>
              )}
            </SelectContent>
          </Select>

          {/* Select-all header */}
          {rewardsToDisplay.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="import-addon-select-all"
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
              />
              <label
                htmlFor="import-addon-select-all"
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                {allSelected ? "Deselect all" : "Select all"}
                {selectedRows.size > 0 && ` (${selectedRows.size} selected)`}
              </label>
            </div>
          )}

          {/* Rewards List */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {rewardsToDisplay.length > 0 ? (
              rewardsToDisplay.map((reward, displayIdx) => {
                const checked = selectedRows.has(displayIdx);
                return (
                  <div
                    key={displayIdx}
                    role="button"
                    tabIndex={0}
                    aria-pressed={checked}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleRow(displayIdx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleRow(displayIdx);
                      }
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleRow(displayIdx)}
                      // Row onClick already toggles; stop the inner control from
                      // firing a second toggle that would cancel it out.
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${reward.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{reward.title}</p>
                        {!reward.isCurrent && (
                          <span className="text-xs px-1.5 py-0.5 bg-muted rounded shrink-0">
                            {reward.type === "ADDON" ? "Add-on" : "Reward"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">${Number(reward.amount).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })
            ) : selectedProject === "current" ? (
              <p className="text-sm text-muted-foreground p-3 text-center">
                No reward tiers to copy. Create reward tiers first.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground p-3 text-center">
                No rewards found in this project.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImportSelected} disabled={selectedRows.size === 0}>
            Import{selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
