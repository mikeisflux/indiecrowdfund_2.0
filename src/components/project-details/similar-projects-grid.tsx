"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bookmark, Clock, Heart } from "lucide-react";
import { formatTimeRemaining } from "@/lib/utils";
import { SimilarProject } from "./types";

interface SimilarProjectsGridProps {
  projects: SimilarProject[];
}

// Shared card grid used by the Comments, FAQ, and Updates tabs.
// Previously each tab duplicated the card layout inline with a
// hard-coded gray gradient placeholder and an `href="#"` that went
// nowhere — consolidating them here so the image/link/format rules
// only live in one place and can't drift apart again.
export function SimilarProjectsGrid({ projects }: SimilarProjectsGridProps) {
  if (projects.length === 0) return null;

  return (
    // These are OTHER creators' books, so nothing overlaying the campaign is
    // allowed to paint onto them. The banned-creator stamp on the project page
    // is `sticky` inside the whole main-content section, which means it travels
    // the full height of the tab — including down here — and parks itself over
    // this grid. On a short mobile viewport that reads as though these unrelated
    // campaigns are the banned ones.
    //
    // `relative z-40` puts the grid above the stamp's z-30, an opaque
    // background stops it showing through, and `isolate` gives the grid its own
    // stacking context so the stamp's mix-blend-multiply can't blend into these
    // covers. Any future block appended after the campaign body needs the same
    // treatment.
    <div className="relative z-40 isolate bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-lg font-semibold">Similar projects to check out</h3>
        <Button variant="outline" size="sm">
          See more
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {projects.map((project) => {
          const projectHref = project.vanityUrl
            ? `/projects/${project.vanityUrl}/${project.slug}`
            : `/projects/${project.slug}`;
          return (
            <Link key={project.id} href={projectHref} className="group">
              <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-3">
                {project.imageUrl ? (
                  <Image
                    src={project.imageUrl}
                    alt={project.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                )}
              </div>
              <div className="flex items-start gap-2">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-muted">
                    {project.creator?.[0] || "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    {project.isProjectWeLove && (
                      <Heart className="h-3 w-3 fill-[#05ce78] text-[#05ce78]" />
                    )}
                    <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {project.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{project.creator}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>
                      {project.endDate
                        ? formatTimeRemaining(new Date(project.endDate))
                        : `${project.daysLeft} days left`}
                    </span>
                    <span>•</span>
                    <span>{project.fundedPercent}% funded</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" aria-label="Bookmark">
                  <Bookmark className="h-4 w-4" />
                </Button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
