"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { ProjectUpdate, SimilarProject } from "../types";
import { formatDate } from "../utils";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { SimilarProjectsGrid } from "../similar-projects-grid";
import { UpdateComments } from "../update-comments";

interface UpdatesTabProps {
  updates: ProjectUpdate[];
  similarProjects: SimilarProject[];
  // Gate for the per-update comment thread. Mirrors the project-level
  // Comments tab: committed backer OR follower OR creator OR
  // collaborator can post; everyone else can read.
  canComment?: boolean;
  currentUserName?: string;
  currentUserAvatar?: string;
}

export function UpdatesTab({
  updates,
  similarProjects,
  canComment = false,
  currentUserName,
  currentUserAvatar,
}: UpdatesTabProps) {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold mb-6">Updates</h2>
        {updates.map((update) => (
          <Card key={update.id} id={`update-${update.id}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                {formatDate(update.createdAt)}
              </div>
              <h3 className="font-semibold mb-2">{update.title}</h3>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(update.content) }}
              />
              <UpdateComments
                updateId={update.id}
                canComment={canComment}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <SimilarProjectsGrid projects={similarProjects} />
    </div>
  );
}
