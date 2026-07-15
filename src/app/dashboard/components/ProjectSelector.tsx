"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Eye, Settings, Share2, Zap, CheckCircle, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, SelectedProject } from "../types";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: SelectedProject | null;
  onProjectChange: (projectId: string) => void;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  selectedProject,
  onProjectChange,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);

  // Sort alphabetically (case-insensitive, natural-ish) so the picker is
  // scannable no matter what order the API returns projects in.
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
      ),
    [projects]
  );

  const selectedTitle =
    projects.find((p) => p.id === selectedProjectId)?.title ?? "Select project";

  return (
    <div className="border-b bg-background/60 backdrop-blur-sm">
      <div className="container flex flex-wrap items-center gap-2 py-3 md:h-14 md:py-0 md:gap-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full sm:w-[280px] justify-between bg-card/50 backdrop-blur border-border/50 font-normal"
            >
              <span className="truncate">{selectedTitle}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) =>
                value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput placeholder="Search projects..." />
              <CommandList>
                <CommandEmpty>No projects found.</CommandEmpty>
                {sortedProjects.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.title}
                    onSelect={() => {
                      onProjectChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        p.id === selectedProjectId ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{p.title}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedProject && (() => {
          const hasEnded = selectedProject.endDate ? new Date(selectedProject.endDate) < new Date() : false;
          const displayStatus = hasEnded && selectedProject.status === "LIVE" ? "ENDED" : selectedProject.status;
          return (
            <Badge
              className={cn(
                "font-medium",
                displayStatus === "LIVE" && "bg-gradient-to-r from-green-500 to-emerald-600 border-0",
                displayStatus === "ENDED" && "bg-gradient-to-r from-rose-500 to-red-600 border-0",
                displayStatus === "FUNDED" && "bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
              )}
            >
              {displayStatus === "LIVE" && <Zap className="w-3 h-3 mr-1" />}
              {displayStatus === "FUNDED" && <CheckCircle className="w-3 h-3 mr-1" />}
              {displayStatus}
            </Badge>
          );
        })()}
        <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
          {selectedProject && (
            <>
              <Link href={selectedProject.projectUrl} className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="w-full sm:w-auto hover:border-primary/50 bg-card/50 backdrop-blur">
                  <Eye className="mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">View</span>
                  <span className="xs:hidden">View</span>
                </Button>
              </Link>
              <Link href={`${selectedProject.projectUrl}/edit`} className="flex-1 sm:flex-initial">
                <Button variant="outline" size="sm" className="w-full sm:w-auto hover:border-primary/50 bg-card/50 backdrop-blur">
                  <Settings className="mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">Edit</span>
                  <span className="xs:hidden">Edit</span>
                </Button>
              </Link>
              <Button size="sm" className="flex-1 sm:flex-initial bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90">
                <Share2 className="mr-2 h-4 w-4" />
                <span className="hidden xs:inline">Share</span>
                <span className="xs:hidden">Share</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
