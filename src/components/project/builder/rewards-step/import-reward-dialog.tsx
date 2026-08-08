"use client";

import { useState, useEffect } from "react";
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
import {
  useImportableProjects,
  type ImportableReward,
} from "./use-importable-projects";

interface ImportRewardDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  // Receives the whole source reward — image, items, shipping and all — so
  // the import lands complete instead of as a bare title/price.
  onImportReward: (rewards: ImportableReward[]) => void | Promise<void>;
}

export function ImportRewardDialog({
  isOpen,
  onOpenChange,
  projectId,
  onImportReward,
}: ImportRewardDialogProps) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { projects: allProjects, isLoading } = useImportableProjects(projectId, isOpen);

  // Only projects that actually have tiers are offered here.
  const previousProjects = allProjects.filter((p) =>
    p.rewards.some((r) => r.type === "TIER")
  );

  useEffect(() => {
    if (!isOpen) {
      setSelectedProject("");
      return;
    }
    // Auto-select the first project once the list resolves, but don't
    // clobber a choice the creator already made.
    setSelectedProject((prev) =>
      prev || (previousProjects.length > 0 ? previousProjects[0].id : "")
    );
  }, [isOpen, previousProjects]);

  // Get rewards (TIER only) from selected project
  const getRewardsToDisplay = () => {
    if (!selectedProject) return [];
    const project = previousProjects.find((p) => p.id === selectedProject);
    if (!project) return [];
    // Only show TIER type rewards
    return project.rewards
      .filter((r) => r.type === "TIER")
      .map((reward, idx) => ({
        title: reward.title,
        amount: reward.amount,
        description: reward.description,
        idx,
        itemCount: reward.items.length,
        hasImage: !!reward.imageUrl,
        source: reward,
      }));
  };

  const rewardsToDisplay = getRewardsToDisplay();

  const handleImport = (reward: ImportableReward) => {
    onImportReward([reward]);
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
                  onClick={() => handleImport(reward.source)}
                >
                  <div>
                    <p className="font-medium">{reward.title}</p>
                    <p className="text-sm text-muted-foreground">
                      ${Number(reward.amount).toFixed(2)}
                      {reward.itemCount > 0 &&
                        ` · ${reward.itemCount} item${reward.itemCount > 1 ? "s" : ""}`}
                      {reward.hasImage && " · image"}
                    </p>
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
