"use client";

import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FolderKanban, Eye } from "lucide-react";
import { Project } from "./types";
import { getFlags, getFlagBadge } from "./utils";

interface FlaggedTabProps {
  flaggedProjects: Project[];
  onReviewProject: (project: Project) => void;
}

export function FlaggedTab({ flaggedProjects, onReviewProject }: FlaggedTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flagged Projects</CardTitle>
        <CardDescription>Projects with issues requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        {flaggedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-300 mb-4" />
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No flagged projects</h3>
            <p className="text-sm text-muted-foreground">All projects look good!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {flaggedProjects.map((project) => {
              const flags = getFlags(project);
              return (
                <div key={project.id} className="flex items-center gap-4 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:bg-red-950/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted relative overflow-hidden">
                    {project.imageUrl ? (
                      <Image src={project.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      <FolderKanban className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{project.title}</h4>
                      <Badge variant="outline">{project.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">by {project.creator.name || project.creator.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {flags.map((flag) => getFlagBadge(flag))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReviewProject(project)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Review
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
