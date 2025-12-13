"use client";

import { sanitizeHtml } from "@/lib/utils/sanitize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FolderKanban,
  CheckCircle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Video,
  Image as ImageIcon,
  Flag,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Project } from "./types";
import { getFlags, formatDate, formatDuration } from "./utils";

interface ProjectDetailPanelProps {
  project: Project | null;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
}

export function ProjectDetailPanel({
  project,
  onApprove,
  onReject,
  onRequestChanges,
}: ProjectDetailPanelProps) {
  if (!project) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
          <p className="font-medium">Select a project to review</p>
          <p className="text-sm">Click on a project from the queue to see details</p>
        </div>
      </Card>
    );
  }

  const flags = getFlags(project);

  return (
    <Card className="h-fit sticky top-6">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{project.title}</CardTitle>
            <CardDescription>{project.subtitle || "No subtitle"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" defaultValue={["overview", "creator"]} className="w-full">
          {/* Overview */}
          <AccordionItem value="overview">
            <AccordionTrigger className="px-4">Project Overview</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Goal</p>
                  <p className="font-semibold">${project.goalAmount.toLocaleString()} {project.currency}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Duration</p>
                  <p className="font-semibold">{formatDuration(project)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Category</p>
                  <p className="font-semibold">{project.category}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Rewards</p>
                  <p className="font-semibold">{project.rewards.length} tiers</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                {project.videoUrl ? (
                  <Badge variant="outline" className="text-emerald-600">
                    <Video className="mr-1 h-3 w-3" /> Has Video
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600">
                    <Video className="mr-1 h-3 w-3" /> No Video
                  </Badge>
                )}
                {project.imageUrl && (
                  <Badge variant="outline">
                    <ImageIcon className="mr-1 h-3 w-3" /> Has Cover
                  </Badge>
                )}
              </div>

              {project.description && (
                <div className="mt-4">
                  <p className="text-xs text-zinc-500 mb-1">Description Preview</p>
                  <div
                    className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.description) }}
                  />
                </div>
              )}

              {project.risks && (
                <div className="mt-4">
                  <p className="text-xs text-zinc-500 mb-1">Risks & Challenges</p>
                  <div
                    className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.risks) }}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Creator Info */}
          <AccordionItem value="creator">
            <AccordionTrigger className="px-4">Creator Information</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600">
                  {(project.creator.name || project.creator.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{project.creator.name || "No name"}</p>
                    {project.creator.emailVerified ? (
                      <Badge className="bg-blue-100 text-blue-700">
                        <CheckCircle className="mr-1 h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" /> Unverified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">{project.creator.email}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Total Projects</p>
                  <p className="font-semibold">{project.creator._count.createdProjects}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Member Since</p>
                  <p className="font-semibold">{formatDate(project.creator.createdAt)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Flags */}
          {flags.length > 0 && (
            <AccordionItem value="flags">
              <AccordionTrigger className="px-4">
                Flags
                <Badge variant="destructive" className="ml-2">
                  {flags.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {flags.map((flag) => (
                    <div key={flag} className="flex items-center gap-2 text-sm text-amber-700">
                      <Flag className="h-4 w-4" />
                      <span className="capitalize">{flag.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" className="flex-1" asChild>
              <a href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                Preview Project
              </a>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onApprove}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={onRequestChanges}
              className="flex-1"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Request Changes
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              className="flex-1"
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
