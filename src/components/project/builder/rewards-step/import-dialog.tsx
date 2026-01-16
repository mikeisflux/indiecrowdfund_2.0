"use client";

import { useState } from "react";
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
import { PreviousProjectForImport } from "./constants";

interface ImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: "items" | "tiers" | "addons";
  tiers: RewardData[];
  previousProjects: PreviousProjectForImport[];
  isLoadingPreviousProjects: boolean;
  onFetchPreviousProjects: () => void;
  onImportFromCurrentProject: (tierIndex: number) => void;
  onImportReward: (sourceProjectId: string, rewardIndex: number) => void;
}

export function ImportDialog({
  isOpen,
  onOpenChange,
  activeTab,
  tiers,
  previousProjects,
  isLoadingPreviousProjects,
  onFetchPreviousProjects,
  onImportFromCurrentProject,
  onImportReward,
}: ImportDialogProps) {
  const [selectedProject, setSelectedProject] = useState<string>("current");

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (open) {
      onFetchPreviousProjects();
      setSelectedProject("current");
    }
  };

  // Get rewards to display based on selected project
  const getRewardsToDisplay = () => {
    if (selectedProject === "current") {
      return tiers.map((tier, idx) => ({
        title: tier.title,
        amount: tier.amount,
        idx,
        isCurrent: true,
      }));
    }
    const project = previousProjects.find((p) => p.id === selectedProject);
    if (!project) return [];
    return project.rewards.map((reward, idx) => ({
      title: reward.title,
      amount: reward.amount,
      idx,
      isCurrent: false,
    }));
  };

  const rewardsToDisplay = getRewardsToDisplay();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {activeTab === "addons" ? "Copy add-on from project" : "Copy reward from other project"}
          </DialogTitle>
          <DialogDescription>
            {activeTab === "addons"
              ? "Copy a reward tier from this project as an add-on, or import from another project."
              : "Select a reward from another project of yours to copy into this project. Copying rewards will also copy included items."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Project Selector Dropdown */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {activeTab === "addons" && (
                <SelectItem value="current">Current Project</SelectItem>
              )}
              {isLoadingPreviousProjects ? (
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
                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
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
                  onClick={() => {
                    if (reward.isCurrent) {
                      onImportFromCurrentProject(reward.idx);
                    } else {
                      onImportReward(selectedProject, reward.idx);
                    }
                    onOpenChange(false);
                  }}
                >
                  <div>
                    <p className="font-medium">{reward.title}</p>
                    <p className="text-sm text-muted-foreground">${reward.amount}</p>
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
