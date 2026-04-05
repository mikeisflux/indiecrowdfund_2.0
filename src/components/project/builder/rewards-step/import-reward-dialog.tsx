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

interface ImportRewardDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onImportReward: (reward: { title: string; description: string; amount: number }) => void;
}

export function ImportRewardDialog({
  isOpen,
  onOpenChange,
  projectId,
  onImportReward,
}: ImportRewardDialogProps) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [previousProjects, setPreviousProjects] = useState<PreviousProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch projects when dialog opens
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `/api/creator/projects-for-import${projectId ? `?exclude=${projectId}` : ""}`;
      console.log("[ImportRewardDialog] Fetching projects from:", url);
      const response = await fetch(url);

      if (!response.ok) {
        console.error("[ImportRewardDialog] API error:", response.status, response.statusText);
        return;
      }

      const data = await response.json();
      console.log("[ImportRewardDialog] API returned projects:", data.projects?.length || 0);

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

      // Only include projects that have rewards (TIER type only for reward import)
      const projectsWithTiers = projectsWithRewards.filter(p =>
        p.rewards.some(r => r.type === "TIER")
      );

      console.log("[ImportRewardDialog] Projects with tiers:", projectsWithTiers.length);
      setPreviousProjects(projectsWithTiers);

      // Auto-select first project if available
      if (projectsWithTiers.length > 0) {
        setSelectedProject(projectsWithTiers[0].id);
      }
    } catch (error) {
      console.error("[ImportRewardDialog] Failed to fetch projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      setSelectedProject("");
    }
  }, [isOpen, fetchProjects]);

  // Get rewards (TIER only) from selected project
  const getRewardsToDisplay = () => {
    if (!selectedProject) return [];
    const project = previousProjects.find((p) => p.id === selectedProject);
    if (!project) return [];
    // Only show TIER type rewards
    return project.rewards
      .filter(r => r.type === "TIER")
      .map((reward, idx) => ({
        title: reward.title,
        amount: reward.amount,
        description: reward.description,
        idx,
      }));
  };

  const rewardsToDisplay = getRewardsToDisplay();

  const handleImport = (reward: { title: string; amount: number; description: string }) => {
    onImportReward({
      title: reward.title,
      description: reward.description,
      amount: reward.amount,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import reward from other project</DialogTitle>
          <DialogDescription>
            Select a reward from another project you&apos;ve created or collaborated on to copy into this project.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Project Selector Dropdown */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-4 px-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Loading projects...</span>
                </div>
              ) : previousProjects.length === 0 ? (
                <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                  No other projects found
                </div>
              ) : (
                previousProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))
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
                    <p className="font-medium">{reward.title}</p>
                    <p className="text-sm text-muted-foreground">${Number(reward.amount).toFixed(2)}</p>
                  </div>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </div>
              ))
            ) : selectedProject ? (
              <p className="text-sm text-muted-foreground p-3 text-center">
                No rewards found in this project.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground p-3 text-center">
                Select a project to see its rewards.
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
