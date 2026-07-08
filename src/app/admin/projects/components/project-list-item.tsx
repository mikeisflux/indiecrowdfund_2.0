"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, User, DollarSign, Calendar, Package } from "lucide-react";
import { Project } from "./types";
import { getFlags, getFlagBadge, formatDate } from "./utils";

interface ProjectListItemProps {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
  showStatus?: boolean;
  showFunding?: boolean;
  badge?: React.ReactNode;
}

export function ProjectListItem({
  project,
  isSelected,
  onClick,
  showStatus = false,
  showFunding = false,
  badge,
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
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted dark:bg-zinc-800 relative overflow-hidden">
            {project.imageUrl ? (
              <Image src={project.imageUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <FolderKanban className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold truncate">{project.title}</h4>
                  {badge}
                  {showStatus && (
                    <Badge className={project.status === "LIVE" ? "bg-emerald-600" : "bg-amber-600"}>
                      {project.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{project.subtitle || "No subtitle"}</p>
              </div>
              <Badge variant="outline">{project.category}</Badge>
            </div>

            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {project.creator.name || project.creator.email}
              </span>
              {showFunding ? (
                <>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${Number(project.currentAmount).toLocaleString()} / ${Number(project.goalAmount).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {project.backerCount} backers
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${Number(project.goalAmount).toLocaleString()}
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
                    style={{ width: `${Math.min(100, Number(project.goalAmount) > 0 ? (Number(project.currentAmount) / Number(project.goalAmount)) * 100 : 0)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Number(project.goalAmount) > 0 ? Math.round((Number(project.currentAmount) / Number(project.goalAmount)) * 100) : 0}% funded
                </p>
              </div>
            )}

            {/* Fulfillment Status */}
            {project.fulfillment && project.fulfillment.total > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Fulfillment: {Math.round(((project.fulfillment.shipped + project.fulfillment.delivered) / project.fulfillment.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-200 rounded-full overflow-hidden flex">
                  {project.fulfillment.delivered > 0 && (
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${(project.fulfillment.delivered / project.fulfillment.total) * 100}%` }}
                    />
                  )}
                  {project.fulfillment.shipped > 0 && (
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(project.fulfillment.shipped / project.fulfillment.total) * 100}%` }}
                    />
                  )}
                  {project.fulfillment.inProgress > 0 && (
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${(project.fulfillment.inProgress / project.fulfillment.total) * 100}%` }}
                    />
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  {project.fulfillment.delivered > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />{project.fulfillment.delivered} delivered</span>}
                  {project.fulfillment.shipped > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />{project.fulfillment.shipped} shipped</span>}
                  {project.fulfillment.inProgress > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />{project.fulfillment.inProgress} in progress</span>}
                  {project.fulfillment.notStarted > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />{project.fulfillment.notStarted} pending</span>}
                </div>
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
