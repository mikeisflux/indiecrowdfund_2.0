"use client";

import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileEdit, Eye } from "lucide-react";
import { Project } from "./types";

// ─── Unsubmitted Project Card ─────────────────────────────────────

interface UnsubmittedProjectCardProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
}

export function UnsubmittedProjectCard({ project, isSelected, onClick }: UnsubmittedProjectCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-zinc-400 shadow-md" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted relative overflow-hidden flex-shrink-0">
            {project.imageUrl ? (
              <Image src={project.imageUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <FileEdit className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate">{project.title}</h4>
              <Badge variant="secondary" className="text-xs">Draft</Badge>
              {project.category && (
                <Badge variant="outline" className="text-xs">{project.category}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              by {project.creator.name || project.creator.email}
            </p>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </span>
              {project.goalAmount && Number(project.goalAmount) > 0 && (
                <span>
                  Goal: ${Number(project.goalAmount).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Unsubmitted Detail Panel ─────────────────────────────────────

interface UnsubmittedDetailPanelProps {
  selectedProject: Project | null;
}

export function UnsubmittedDetailPanel({ selectedProject }: UnsubmittedDetailPanelProps) {
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
              <Badge variant="secondary">Draft</Badge>
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
                <p className="font-medium">{selectedProject.category || "Not set"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Goal</p>
                <p className="font-medium">
                  {selectedProject.goalAmount && Number(selectedProject.goalAmount) > 0
                    ? `$${Number(selectedProject.goalAmount).toLocaleString()}`
                    : "Not set"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(selectedProject.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Creator Email</p>
                <p className="font-medium text-xs truncate">{selectedProject.creator.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rewards</p>
                <p className="font-medium">{selectedProject.rewards?.length || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email Verified</p>
                <p className="font-medium">{selectedProject.creator.emailVerified ? "Yes" : "No"}</p>
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
                onClick={() => window.open(`/projects/${selectedProject.slug}`, "_blank")}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Project
              </Button>
            </div>
          </CardContent>
        </>
      ) : (
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <FileEdit className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Select a project</h3>
          <p className="text-sm text-muted-foreground">
            Click on a project to see details
          </p>
        </CardContent>
      )}
    </Card>
  );
}
