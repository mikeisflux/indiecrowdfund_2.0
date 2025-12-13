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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (open) {
      onFetchPreviousProjects();
    }
  };

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

        <div className="py-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            {/* Current Project - only show when on add-ons tab */}
            {activeTab === "addons" && (
              <Collapsible
                open={expandedProject === "current"}
                onOpenChange={(open) => setExpandedProject(open ? "current" : null)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50">
                  <span className="font-medium">Current Project</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      expandedProject === "current" && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 ml-4 space-y-2">
                  {tiers.length > 0 ? (
                    tiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          onImportFromCurrentProject(idx);
                          onOpenChange(false);
                        }}
                      >
                        <div>
                          <p className="font-medium">{tier.title}</p>
                          <p className="text-sm text-muted-foreground">${tier.amount}</p>
                        </div>
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground p-3">
                      No reward tiers to copy. Create reward tiers first.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Previous Projects */}
            {isLoadingPreviousProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading projects...</span>
              </div>
            ) : previousProjects.length > 0 ? (
              previousProjects.map((project) => (
                <Collapsible
                  key={project.id}
                  open={expandedProject === project.id}
                  onOpenChange={(open) => setExpandedProject(open ? project.id : null)}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border rounded-lg hover:bg-muted/50">
                    <span className="font-medium">{project.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedProject === project.id && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 ml-4 space-y-2">
                    {project.rewards.map((reward, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          onImportReward(project.id, idx);
                          onOpenChange(false);
                        }}
                      >
                        <div>
                          <p className="font-medium">{reward.title}</p>
                          <p className="text-sm text-muted-foreground">${reward.amount}</p>
                        </div>
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : activeTab !== "addons" ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No previous projects with rewards found.</p>
                <p className="text-sm">Create rewards in other projects first to import them here.</p>
              </div>
            ) : null}
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
