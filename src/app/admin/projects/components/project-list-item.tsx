"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, User, DollarSign, Calendar } from "lucide-react";
import { Project } from "./types";
import { getFlags, getFlagBadge, formatDate } from "./utils";

interface ProjectListItemProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
  showStatus?: boolean;
  showFunding?: boolean;
}

export function ProjectListItem({
  project,
  isSelected,
  onClick,
  showStatus = false,
  showFunding = false,
}: ProjectListItemProps) {
  const flags = getFlags(project);

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-emerald-500" : ""
      } ${flags.length > 2 && !showStatus ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Project Image */}
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
            {project.imageUrl ? (
              <Image src={project.imageUrl} alt="" fill className="object-cover" />
            ) : (
              <FolderKanban className="h-6 w-6 text-zinc-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold truncate">{project.title}</h4>
                  {showStatus && (
                    <Badge className={project.status === "LIVE" ? "bg-emerald-600" : "bg-amber-600"}>
                      {project.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-zinc-500 truncate">{project.subtitle || "No subtitle"}</p>
              </div>
              <Badge variant="outline">{project.category}</Badge>
            </div>

            <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {project.creator.name || project.creator.email}
              </span>
              {showFunding ? (
                <>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${project.currentAmount.toLocaleString()} / ${project.goalAmount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {project._count.pledges} backers
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${project.goalAmount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(project.createdAt)}
                  </span>
                </>
              )}
            </div>

            {showFunding && (
              <div className="mt-2">
                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Math.min(100, (project.currentAmount / project.goalAmount) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {Math.round((project.currentAmount / project.goalAmount) * 100)}% funded
                </p>
              </div>
            )}

            {!showStatus && flags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {flags.map((flag) => getFlagBadge(flag))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
