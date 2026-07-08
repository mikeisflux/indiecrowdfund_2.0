"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tag,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Wand2,
} from "lucide-react";

export interface PendingTagUpdate {
  projectId: string;
  projectTitle: string;
  currentTags: string[];
  suggestedTags: string[];
  primaryCategory: string | null;
  suggestedCategories: string[];
  confidence: number;
  status: "pending" | "approved" | "rejected" | "error";
  error?: string;
  selectedTags: string[];
  applyCategory: boolean;
}

interface TagReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingTagUpdates: PendingTagUpdate[];
  isApplyingTags: boolean;
  onClose: () => void;
  onApplyTags: () => void;
  onApproveAll: () => void;
  onSetProjectApproval: (projectId: string, status: "approved" | "rejected") => void;
  onToggleTagSelection: (projectId: string, tag: string) => void;
}

export function TagReviewDialog({
  open,
  onOpenChange,
  pendingTagUpdates,
  isApplyingTags,
  onClose,
  onApplyTags,
  onApproveAll,
  onSetProjectApproval,
  onToggleTagSelection,
}: TagReviewDialogProps) {
  const approvedCount = pendingTagUpdates.filter(p => p.status === "approved").length;
  const rejectedCount = pendingTagUpdates.filter(p => p.status === "rejected").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-violet-600" />
            Review AI-Generated Tags
          </DialogTitle>
          <DialogDescription>
            Review and approve the AI-suggested tags before applying them to projects.
            You can toggle individual tags on/off and approve or reject each project.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {pendingTagUpdates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No tags to review</p>
          ) : (
            <>
              {/* Summary stats */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 dark:bg-card">
                <div className="text-sm">
                  <span className="font-medium">{pendingTagUpdates.length}</span> projects analyzed
                  {" • "}
                  <span className="text-emerald-600 font-medium">{approvedCount}</span> approved
                  {" • "}
                  <span className="text-red-600 font-medium">{rejectedCount}</span> rejected
                </div>
                <Button variant="outline" size="sm" onClick={onApproveAll}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve All
                </Button>
              </div>

              {/* Project list */}
              {pendingTagUpdates.map((project) => (
                <div
                  key={project.projectId}
                  className={`rounded-lg border p-4 ${
                    project.status === "approved"
                      ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                      : project.status === "rejected"
                      ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                      : project.status === "error"
                      ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  {/* Project header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{project.projectTitle}</h4>
                        <Badge
                          variant={project.confidence >= 80 ? "default" : project.confidence >= 60 ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {project.confidence}% confidence
                        </Badge>
                        {project.status === "error" && (
                          <Badge variant="destructive" className="text-xs">Error</Badge>
                        )}
                      </div>
                      {project.primaryCategory && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Suggested category: <span className="font-medium">{project.primaryCategory}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={project.status === "approved" ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSetProjectApproval(project.projectId, "approved")}
                        disabled={project.status === "error"}
                        className={project.status === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={project.status === "rejected" ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => onSetProjectApproval(project.projectId, "rejected")}
                        disabled={project.status === "error"}
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Error message */}
                  {project.error && (
                    <div className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                      {project.error}
                    </div>
                  )}

                  {/* Current tags */}
                  {project.currentTags.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-1">Current tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {project.currentTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested tags (toggleable) */}
                  {project.suggestedTags.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">AI-suggested tags (click to toggle):</p>
                      <div className="flex flex-wrap gap-2">
                        {project.suggestedTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={project.selectedTags.includes(tag) ? "default" : "outline"}
                            className={`cursor-pointer transition-colors ${
                              project.selectedTags.includes(tag)
                                ? "bg-violet-600 hover:bg-violet-700"
                                : "hover:bg-muted dark:hover:bg-muted"
                            }`}
                            onClick={() => onToggleTagSelection(project.projectId, tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {project.selectedTags.length} tags selected
                      </p>
                    </div>
                  )}

                  {project.suggestedTags.length === 0 && !project.error && (
                    <p className="text-sm text-muted-foreground">
                      No tags met the confidence threshold
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isApplyingTags}>
            Cancel
          </Button>
          <Button onClick={onApplyTags} disabled={isApplyingTags || approvedCount === 0}>
            {isApplyingTags ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Applying Tags...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Apply {approvedCount} Approved
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
