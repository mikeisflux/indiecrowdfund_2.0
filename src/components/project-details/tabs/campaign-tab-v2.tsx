"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { PageFlipReader } from "@/components/PageFlipReader";
import { ProjectData, RewardData } from "../types";
import { processStoryHtml, formatDeliveryDate } from "../utils";

// Campaign layout v2 — for projects that had not gone live when this shipped.
//
// v1 splits the page 2 / 6 / 4: a reward-category rail, the story at 50%, and
// reward tiers stacked one-per-row in a right rail. On a comics platform that
// inverts the priority — the artwork is the pitch, and variant covers are
// portrait art being shown at thumbnail size.
//
// v2 gives the story the full container, moves rewards below it as a grid so
// covers render large, turns the category rail into a horizontal filter above
// that grid, and pins a funding bar so the CTA never scrolls out of reach.
//
// v1 lives on in campaign-tab.tsx and is not touched: live and finished
// campaigns keep the layout their backers have already seen.

interface CampaignTabV2Props {
  project: ProjectData;
  tiers: RewardData[];
  projectPath: string;
  onViewCreator?: () => void;
}

const ALL = "__all__";

export function CampaignTabV2({ project, tiers, projectPath, onViewCreator }: CampaignTabV2Props) {
  const [pledgeAmount, setPledgeAmount] = useState("1");
  const [activeFilter, setActiveFilter] = useState<string>(ALL);

  const projectEnded = project.endDate ? new Date(project.endDate) < new Date() : false;

  const previewImages = useMemo(() => project.previewImages ?? [], [project.previewImages]);

  // The flipbook needs explicit pixel dimensions, so the spread/single choice
  // can't be made in CSS. Matches Tailwind's sm breakpoint.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const daysLeft = useMemo(() => {
    if (!project.endDate) return null;
    const ms = new Date(project.endDate).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
  }, [project.endDate]);

  const pctFunded = useMemo(() => {
    const goal = Number(project.goalAmount) || 0;
    if (goal <= 0) return 0;
    return Math.round((Number(project.currentAmount) / goal) * 100);
  }, [project.currentAmount, project.goalAmount]);

  const { processedDescription } = useMemo(() => {
    if (!project.description) return { processedDescription: "" };
    if (typeof window === "undefined") return { processedDescription: project.description };
    const { processedHtml } = processStoryHtml(project.description);
    return { processedDescription: processedHtml };
  }, [project.description]);

  // Filter pills are derived from the reward titles' leading SKU-style group
  // (e.g. "PG1-01 …" -> "PG1"). Creators already name tiers this way, so this
  // reproduces what the old left rail listed without asking them for anything
  // new. Falls back to no filter bar when the titles don't group.
  const groups = useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of tiers) {
      const m = t.title?.trim().match(/^([A-Za-z]+\d*)[-\s]/);
      if (!m) continue;
      const key = m[1].toUpperCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    // Only worth showing when it actually partitions the list.
    return seen.size >= 2 ? Array.from(seen.keys()) : [];
  }, [tiers]);

  const visibleTiers = useMemo(() => {
    if (activeFilter === ALL) return tiers;
    return tiers.filter((t) =>
      t.title?.trim().toUpperCase().startsWith(activeFilter)
    );
  }, [tiers, activeFilter]);

  return (
    <div className="space-y-10">
      {/* Sticky funding bar. Replaces the job the right rail used to do —
          keeping progress and the primary CTA reachable from anywhere in a
          long story. top-16 clears the site header. */}
      <div className="sticky top-16 z-30 -mx-4 sm:mx-0 border-y sm:border sm:rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-lg font-bold text-[#05ce78] tabular-nums">
              ${Number(project.currentAmount).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              raised{pctFunded > 0 && ` · ${pctFunded}%`}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground tabular-nums">{project.backerCount}</span> backers</span>
            {daysLeft !== null && (
              <span><span className="font-semibold text-foreground tabular-nums">{daysLeft}</span> days left</span>
            )}
          </div>
          <div className="hidden md:block flex-1 min-w-[80px] h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-[#05ce78] rounded-full"
              style={{ width: `${Math.min(100, pctFunded)}%` }}
            />
          </div>
          {projectEnded ? (
            <Button size="sm" disabled className="ml-auto">Campaign ended</Button>
          ) : (
            <Link href={`${projectPath}/pledge`} className="ml-auto">
              <Button size="sm" className="bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                Back this project
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Interior preview, above the story so the artwork leads the pitch.
          Uses the same flipbook as the Digital Library reader, fed with the
          creator's chosen pages. Absent when they haven't added any. */}
      {previewImages.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-2xl font-serif">Preview the interiors</h2>
          <div className="rounded-lg bg-zinc-900 p-4 sm:p-6">
            <PageFlipReader
              images={previewImages}
              bookId={`preview-${project.id}`}
              singlePage={isNarrow}
              width={isNarrow ? 320 : 420}
              height={isNarrow ? 480 : 630}
            />
          </div>
        </div>
      )}

      {/* Story — full container width. */}
      <div className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-img:rounded-lg prose-img:my-6 prose-img:max-w-full prose-img:h-auto prose-a:text-primary prose-a:underline">
        <h2 className="text-2xl font-serif">Story</h2>
        <div
          className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:w-auto overflow-hidden"
          dangerouslySetInnerHTML={{ __html: processedDescription }}
        />

        <Separator className="my-8" />

        <div>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold m-0">Risks and challenges</h3>
          </div>
          <p className="text-muted-foreground">{project.risks}</p>
        </div>
      </div>

      {/* Rewards — a grid, below the story, at full width. */}
      <div className="space-y-4">
        <h2 className="text-2xl font-serif">Rewards &amp; add-ons</h2>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter(ALL)}
              aria-pressed={activeFilter === ALL}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                activeFilter === ALL
                  ? "bg-foreground text-background border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setActiveFilter(g)}
                aria-pressed={activeFilter === g}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  activeFilter === g
                    ? "bg-foreground text-background border-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleTiers.map((reward) => {
            const isLimited = reward.quantityAvailable !== null;
            const remaining =
              isLimited && reward.quantityAvailable !== null
                ? reward.quantityAvailable - reward.quantityClaimed
                : null;
            const isSoldOut = isLimited && remaining === 0;

            return (
              <Card
                key={reward.id}
                className={`flex flex-col overflow-hidden transition-all hover:border-primary ${
                  isSoldOut ? "opacity-60" : ""
                }`}
              >
                {/* Portrait aspect — these are comic covers, not banners. */}
                {reward.imageUrl && (
                  <div className="relative aspect-[2/3] bg-muted">
                    <Image
                      src={reward.imageUrl}
                      alt={reward.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <CardContent className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-xl font-bold leading-none text-[#05ce78] tabular-nums">
                    ${Number(reward.amount).toFixed(2)}
                  </p>
                  <p className="font-semibold leading-snug">{reward.title}</p>

                  {reward.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {reward.description}
                    </p>
                  )}

                  {reward.items.length > 0 && (
                    <div className="space-y-1">
                      {reward.items.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex items-start gap-1.5 text-xs">
                          <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-[#05ce78]" />
                          <span className="min-w-0">{item.title}</span>
                        </div>
                      ))}
                      {reward.items.length > 3 && (
                        <p className="pl-[18px] text-xs text-muted-foreground">
                          +{reward.items.length - 3} more
                        </p>
                      )}
                    </div>
                  )}

                  {isLimited && !isSoldOut && remaining !== null && remaining <= 25 && (
                    <Badge variant="destructive" className="w-fit">Only {remaining} left</Badge>
                  )}

                  <div className="mt-auto space-y-2 pt-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDeliveryDate(reward.estimatedDelivery)}
                      </span>
                      {reward.shippingType !== "NO_SHIPPING" && <span>Ships worldwide</span>}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground tabular-nums">
                          {reward.backerCount || 0}
                        </span>{" "}
                        backers
                        {isLimited && !isSoldOut && remaining !== null && remaining > 25 && (
                          <span> · {remaining} left</span>
                        )}
                      </span>
                      {(isSoldOut || projectEnded) && (
                        <Badge variant="secondary">
                          {projectEnded ? "Ended" : "Sold out"}
                        </Badge>
                      )}
                    </div>

                    {!isSoldOut && !projectEnded ? (
                      <Link href={`${projectPath}/pledge?reward=${reward.id}`} className="block">
                        <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                          Select
                        </Button>
                      </Link>
                    ) : (
                      <Button className="w-full" disabled>No longer available</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {visibleTiers.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No rewards in this group.
          </p>
        )}
      </div>

      {/* Creator + no-reward pledge. Below the rewards in v2 — the rail these
          lived in is gone, and they're supporting information rather than the
          primary path. */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              onClick={onViewCreator}
              disabled={!onViewCreator}
              className="group mb-4 flex w-full items-start gap-3 text-left disabled:cursor-default"
              aria-label={`View ${project.creator.name}'s creator profile`}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={project.creator.image} />
                <AvatarFallback className="bg-black text-white">
                  {project.creator?.name?.[0] || "C"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-semibold transition-colors group-hover:text-primary group-hover:underline">
                  {project.creator.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {project.creator.projectsCreated} created • {project.creator.projectsBacked} backed
                </p>
              </div>
            </button>
            <p className="mb-4 text-sm text-muted-foreground">{project.creator.bio}</p>
            {onViewCreator && (
              <Button
                onClick={onViewCreator}
                className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                View Creator Profile
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div>
              <h4 className="mb-1 font-medium">Make a pledge without a reward</h4>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">$</span>
                <Input
                  type="number"
                  value={pledgeAmount}
                  onChange={(e) => setPledgeAmount(e.target.value)}
                  className="w-24"
                  min="1"
                  aria-label="Pledge amount"
                />
              </div>
            </div>

            <div className="rounded-lg bg-[#028858] p-4 text-white">
              <h5 className="mb-1 font-semibold">Donate — because you believe in it.</h5>
              <p className="text-sm opacity-90">
                No reward, no strings — pure support. Help bring this project to life and
                champion western comics and art through our Grant Program.
              </p>
            </div>

            {projectEnded ? (
              <Button className="w-full" disabled>Campaign has ended</Button>
            ) : (
              <Link href={`${projectPath}/pledge?amount=${pledgeAmount}`} className="block">
                <Button className="w-full bg-[#05ce78] text-white hover:bg-[#05ce78]/90">
                  Continue
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
