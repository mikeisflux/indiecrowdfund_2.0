"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Eye, Link2, PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { Project } from "./types";
import { SetVanityUrlDialog } from "./dialogs";

// ─── Prelaunch Project Card ───────────────────────────────────────

interface PrelaunchProjectCardProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
}

export function PrelaunchProjectCard({ project, isSelected, onClick }: PrelaunchProjectCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-amber-500 shadow-md" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted relative overflow-hidden flex-shrink-0">
            {project.imageUrl ? (
              <Image src={project.imageUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <Sparkles className="h-6 w-6 text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate">{project.title}</h4>
              <Badge variant="default" className="bg-amber-500 text-xs">Prelaunch</Badge>
              <Badge variant="outline" className="text-xs">{project.category}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              by {project.creator.name || project.creator.email}
            </p>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {project._count.followers || 0} followers
              </span>
              {project.launchDate && (
                <span>
                  Launch: {new Date(project.launchDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Prelaunch Detail Panel ───────────────────────────────────────

interface PrelaunchDetailPanelProps {
  selectedProject: Project | null;
  prelaunchVanityUrl: string | null;
  showPrelaunchVanityDialog: boolean;
  onShowPrelaunchVanityDialogChange: (open: boolean) => void;
  onVanityUrlSuccess: (newVanityUrl: string) => void;
  // Refresh the parent projects list after deactivation so the
  // project drops out of the "Prelaunch Active" view.
  onDeactivated?: () => void;
}

export function PrelaunchDetailPanel({
  selectedProject,
  prelaunchVanityUrl,
  showPrelaunchVanityDialog,
  onShowPrelaunchVanityDialogChange,
  onVanityUrlSuccess,
  onDeactivated,
}: PrelaunchDetailPanelProps) {
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleDeactivate = async () => {
    if (!selectedProject) return;
    if (!confirm(`Deactivate the pre-launch page for "${selectedProject.title}"? Followers will no longer see the page.`)) {
      return;
    }
    setIsDeactivating(true);
    try {
      const res = await apiFetch(`/api/projects/${selectedProject.id}/prelaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prelaunchActive: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to deactivate prelaunch");
      }
      toast.success("Pre-launch page deactivated");
      onDeactivated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate prelaunch");
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <Card className="h-fit sticky top-4">
      {selectedProject ? (
        <>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedProject.title}</CardTitle>
                <CardDescription>
                  by {selectedProject.creator.name || selectedProject.creator.email}
                </CardDescription>
              </div>
              <Badge variant="default" className="bg-amber-500">Prelaunch Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProject.imageUrl && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <Image
                  src={selectedProject.imageUrl}
                  alt={selectedProject.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium">{selectedProject.category}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Followers</p>
                <p className="font-medium">{selectedProject._count.followers || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Goal</p>
                <p className="font-medium">${Number(selectedProject.goalAmount).toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Launch Date</p>
                <p className="font-medium">
                  {selectedProject.launchDate
                    ? new Date(selectedProject.launchDate).toLocaleDateString()
                    : "Not set"}
                </p>
              </div>
            </div>

            {selectedProject.subtitle && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Subtitle</p>
                <p className="text-sm">{selectedProject.subtitle}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(
                  prelaunchVanityUrl
                    ? `/projects/${prelaunchVanityUrl}/${selectedProject.slug}/prelaunch`
                    : `/projects/${selectedProject.slug}/prelaunch`,
                  "_blank"
                )}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onShowPrelaunchVanityDialogChange(true)}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {prelaunchVanityUrl ? "Edit Vanity URL" : "Set Vanity URL"}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-full mt-2"
              onClick={handleDeactivate}
              disabled={isDeactivating}
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                <>
                  <PowerOff className="mr-2 h-4 w-4" />
                  Deactivate Pre-Launch Page
                </>
              )}
            </Button>
            {prelaunchVanityUrl && (
              <p className="text-xs text-muted-foreground mt-2">
                Vanity URL: <code className="bg-muted dark:bg-zinc-800 px-1 rounded">{prelaunchVanityUrl}</code>
              </p>
            )}
          </CardContent>

          {/* Set Vanity URL Dialog for Prelaunch */}
          <SetVanityUrlDialog
            open={showPrelaunchVanityDialog}
            onOpenChange={onShowPrelaunchVanityDialogChange}
            creatorId={selectedProject.creator.id}
            creatorName={selectedProject.creator.name}
            currentVanityUrl={prelaunchVanityUrl}
            projectSlug={selectedProject.slug}
            projectTitle={selectedProject.title}
            onSuccess={onVanityUrlSuccess}
          />
        </>
      ) : (
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Select a prelaunch page</h3>
          <p className="text-sm text-muted-foreground">
            Click on a prelaunch page to see details
          </p>
        </CardContent>
      )}
    </Card>
  );
}
