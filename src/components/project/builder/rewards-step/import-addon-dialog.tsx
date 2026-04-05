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
import { Copy, Loader2 } from "lucide-react";
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
    }
  }, [isOpen, fetchProjects]);

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

  const handleImport = (reward: { title: string; amount: number; description: string; idx: number; isCurrent: boolean }) => {
    if (reward.isCurrent) {
      onImportFromCurrentProject(reward.idx);
    } else {
      onImportAddon({
        title: reward.title,
        description: reward.description,
        amount: reward.amount,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import add-on from project</DialogTitle>
          <DialogDescription>
            Copy a reward tier from this project as an add-on, or import a reward/add-on from another project.
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

          {/* Rewards List */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {rewardsToDisplay.length > 0 ? (
              rewardsToDisplay.map((reward, displayIdx) => (
                <div
                  key={displayIdx}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleImport(reward)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{reward.title}</p>
                      {!reward.isCurrent && (
                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                          {reward.type === "ADDON" ? "Add-on" : "Reward"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">${Number(reward.amount).toFixed(2)}</p>
                  </div>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
