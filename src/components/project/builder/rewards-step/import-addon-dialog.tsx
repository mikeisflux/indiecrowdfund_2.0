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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RewardData } from "@/types";
import {
  useImportableProjects,
  type ImportableReward,
} from "./use-importable-projects";

interface ImportAddonDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  currentProjectTiers: RewardData[];
  onImportFromCurrentProject: (tierIndex: number) => void;
  // Receives the whole source reward — image, items, shipping and all — so
  // the import lands complete instead of as a bare title/price.
  onImportAddon: (addons: ImportableReward[]) => void | Promise<void>;
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
  // Which rows (by display index) are checked for import.
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const { projects: previousProjects, isLoading } = useImportableProjects(
    projectId,
    isOpen
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedProject("current");
      setSelectedRows(new Set());
    }
  }, [isOpen]);

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
        itemCount: (tier.items ?? []).length,
        hasImage: !!tier.imageUrl,
        source: undefined as ImportableReward | undefined,
      }));
    }

    const project = previousProjects.find((p) => p.id === selectedProject);
    if (!project) return [];

    // Show ALL rewards (both TIER and ADDON) from other projects. `source`
    // carries the full reward through to the import handler — the row only
    // renders a few fields, but everything else has to survive the trip.
    return project.rewards.map((reward, idx) => ({
      title: reward.title,
      amount: reward.amount,
      description: reward.description,
      type: reward.type,
      idx,
      isCurrent: false,
      itemCount: reward.items.length,
      hasImage: !!reward.imageUrl,
      source: reward,
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

  const handleImportSelected = async () => {
    // Import in display order so the resulting add-ons keep the same ordering.
    const selected = rewardsToDisplay.filter((_, i) => selectedRows.has(i));
    if (selected.length === 0) return;

    selected
      .filter((reward) => reward.isCurrent)
      .forEach((reward) => onImportFromCurrentProject(reward.idx));

    // Cross-project rewards go over in one batch so two rewards sharing an
    // item resolve to a single ProjectItem instead of duplicating it.
    const fromOtherProject = selected
      .filter((reward) => !reward.isCurrent && reward.source)
      .map((reward) => reward.source as ImportableReward);
    if (fromOtherProject.length > 0) {
      await onImportAddon(fromOtherProject);
    }

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
            project, or pull rewards/add-ons from another project. Images, items,
            shipping, and delivery dates come with them.
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
                      <p className="text-sm text-muted-foreground">
                        ${Number(reward.amount).toFixed(2)}
                        {reward.itemCount > 0 &&
                          ` · ${reward.itemCount} item${reward.itemCount > 1 ? "s" : ""}`}
                        {reward.hasImage && " · image"}
                      </p>
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
