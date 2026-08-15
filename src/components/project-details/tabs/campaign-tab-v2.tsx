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
import { PdfPageFlipReader } from "@/components/PdfPageFlipReader";
import { FundingCurve } from "../funding-curve";
import {
  ALL_CATEGORIES,
  CategoryFilter,
  filterByCategory,
  useCategoryGroups,
} from "@/components/rewards/category-filter";
import { ProjectData, RewardData } from "../types";
import { processStoryHtml, formatDeliveryDate } from "../utils";

// Campaign layout v2 — for projects that had not gone live when this shipped.
//
// v1 splits the page 2 / 6 / 4: a story table-of-contents rail, the story
// itself at 50%, and reward tiers stacked one-per-row in a right rail. On a
// comics platform that inverts the priority — the artwork is the pitch, and
// variant covers end up as thumbnails in a narrow column.
//
// v2 gives the story the full container, moves rewards below it as a grid so
// covers render large, adds a category filter above that grid, and pins a
// funding bar so the CTA never scrolls out of reach.
//
// v1 lives on in campaign-tab.tsx and is not touched: live and finished
// campaigns keep the layout their backers have already seen.

interface CampaignTabV2Props {
  project: ProjectData;
  tiers: RewardData[];
  projectPath: string;
  onViewCreator?: () => void;
}

// The flipbook is canvas-backed and needs explicit pixel dimensions, so its
// size can't come from CSS the way the rest of the page's responsiveness does.
// These mirror the Tailwind breakpoints the surrounding layout uses, so the
// reader steps at the same widths everything else does — including the two
// tablet sizes, where a 7" portrait tablet wants a single page and a 10"+
// landscape one comfortably fits the spread.
//
// `spread` false = one page at a time. A two-page spread below ~700px CSS
// pixels renders each page too small to read the lettering.
//
// `share` is how much of the viewport's *height* the book may occupy. The
// reader sits inline in the page, and page-flip claims a touch gesture the
// moment it reads as horizontal. Scroll to a book that fills a phone screen
// and there is nothing left to grab: every swipe turns a page and the page
// itself won't move. Keeping the book to 70% leaves a band above and below to
// put a thumb on. Pointer devices scroll with a wheel and can't be trapped, so
// the two widest steps only need enough headroom to show the book is inline.
const READER_SIZES = [
  { q: "(min-width: 1280px)", width: 520, height: 780, spread: true, share: 0.9 }, // xl: desktop
  { q: "(min-width: 1024px)", width: 440, height: 660, spread: true, share: 0.8 }, // lg: small laptop / landscape tablet
  { q: "(min-width: 768px)", width: 360, height: 540, spread: true, share: 0.7 }, // md: large tablet
  { q: "(min-width: 640px)", width: 420, height: 630, spread: false, share: 0.7 }, // sm: small tablet / large phone landscape
  { q: "(min-width: 400px)", width: 340, height: 510, spread: false, share: 0.7 }, // most phones
  { q: "(min-width: 0px)", width: 280, height: 420, spread: false, share: 0.7 }, // small phones (SE-class)
] as const;

type ReaderSize = {
  width: number;
  height: number;
  spread: boolean;
  /** Widest a single page may render — this is what bounds the height. */
  maxPageWidth: number;
};

function matchReaderSize(): ReaderSize {
  // Ordered widest-first, so the first match is the most specific one.
  const matched =
    READER_SIZES.find((size) => window.matchMedia(size.q).matches) ??
    READER_SIZES[READER_SIZES.length - 1];

  // A phone held sideways is wide enough to match a tablet step, and would be
  // handed a two-page spread on a 390px-tall screen. Width alone can't tell
  // those apart; a short viewport can.
  const base = window.innerHeight < 520 ? { ...matched, spread: false } : matched;

  // Width can't tell a landscape tablet from a laptop either — a 12.9" iPad
  // sideways is 1366px, same as plenty of desktops. The gesture-trap only
  // exists where scrolling is a swipe, so ask about the pointer instead of
  // guessing from the viewport.
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const share = touch ? Math.min(base.share, 0.7) : base.share;

  // The ladder above only knows the viewport's width, which is why a phone
  // held sideways used to get a book taller than the screen. page-flip derives
  // height from page width via the aspect ratio and ignores maxHeight in
  // stretch mode, so invert that: the widest page whose height still fits the
  // share we're allowing. Floored so a very short window shrinks the book
  // rather than erasing it.
  const fitsHeight = Math.round(
    (window.innerHeight * share * base.width) / base.height
  );

  // Quantised to 10px. A mobile URL bar sliding away changes innerHeight by
  // tens of pixels, and every distinct value here rebuilds the flipbook.
  const capped = Math.max(150, Math.min(1000, fitsHeight));
  return { ...base, maxPageWidth: Math.floor(capped / 10) * 10 };
}

// Section headings. Shared so the rewards, story and preview sections can't
// drift apart, and so the accent rule is defined once.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">
      <span
        aria-hidden
        className="h-6 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#05ce78] to-cyan-500 lg:h-8"
      />
      <span className="m-0">{children}</span>
    </h2>
  );
}

export function CampaignTabV2({ project, tiers, projectPath, onViewCreator }: CampaignTabV2Props) {
  const [pledgeAmount, setPledgeAmount] = useState("1");
  const [activeFilter, setActiveFilter] = useState<string>(ALL_CATEGORIES);

  const projectEnded = project.endDate ? new Date(project.endDate) < new Date() : false;

  const previewPdfUrl = project.previewPdfUrl || null;

  // Reader dimensions, resolved from the breakpoint ladder above. Starts at
  // the smallest size so the server render and the first client render agree
  // (matchMedia doesn't exist during SSR); the effect corrects it before
  // paint. Re-resolved on resize AND orientation change — a tablet turned
  // landscape crosses two of these steps at once.
  const [reader, setReader] = useState<ReaderSize>(() => {
    const smallest = READER_SIZES[READER_SIZES.length - 1];
    return { ...smallest, maxPageWidth: smallest.width };
  });
  useEffect(() => {
    const sync = () => setReader(matchReaderSize());
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
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

  // Pills come from Reward.category, set per reward in the builder. This used
  // to infer groups from a SKU-ish prefix in the title ("PG1-01 …" -> "PG1"),
  // which only worked for creators who happened to name things that way.
  //
  // Shared with the pledge flow's add-on step so the two grids filter and look
  // identical — see components/rewards/category-filter.
  const { groups, uncategorized } = useCategoryGroups(tiers);
  const visibleTiers = useMemo(
    () => filterByCategory(tiers, activeFilter),
    [tiers, activeFilter]
  );

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-16">
      {/* Sticky funding bar. Replaces the job the right rail used to do —
          keeping progress and the primary CTA reachable from anywhere in a
          long story. top-16 clears the site header.

          glass-card rather than a flat panel: it has to sit over scrolling
          artwork without hiding it, and the class already carries its own
          light-mode treatment (see globals.css). */}
      <div className="sticky top-16 z-30 -mx-4 sm:mx-0 glass-card border-y sm:border sm:rounded-xl px-3 py-2.5 shadow-lg shadow-black/5 sm:px-4 sm:py-3 dark:shadow-black/30">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-base font-bold text-[#05ce78] neon-text-green tabular-nums sm:text-lg lg:text-xl">
              ${Number(project.currentAmount).toLocaleString()}
            </span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              raised{pctFunded > 0 && ` · ${pctFunded}%`}
            </span>
          </div>

          {/* Backers/days. Hidden on the narrowest phones, where the row has
              only enough width for the amount and the CTA; the same numbers
              are in the page header above. */}
          <div className="hidden items-center gap-4 text-xs text-muted-foreground min-[420px]:flex sm:text-sm">
            <span>
              <span className="font-semibold text-foreground tabular-nums">
                {project.backerCount}
              </span>{" "}
              backers
            </span>
            {daysLeft !== null && (
              <span className="flex items-center gap-1.5">
                {/* Live dot — only while the clock is actually running. */}
                {!projectEnded && daysLeft > 0 && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#05ce78] opacity-75 live-indicator" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#05ce78]" />
                  </span>
                )}
                <span className="font-semibold text-foreground tabular-nums">{daysLeft}</span>{" "}
                days left
              </span>
            )}
          </div>

          {/* Progress track. From md up it shares the row; below that it drops
              to its own full-width line rather than disappearing — the bar is
              the single most glanceable thing in this bar, and hiding it on
              phones was the wrong trade. The shine sweep only runs on a live
              campaign; an animated bar on a finished one reads as still going. */}
          <div className="order-last h-1.5 w-full overflow-hidden rounded-full bg-muted md:order-none md:h-2 md:w-auto md:min-w-[80px] md:flex-1">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-[#05ce78] to-cyan-500 ${
                projectEnded ? "" : "progress-glow-bar"
              }`}
              style={{ width: `${Math.min(100, pctFunded)}%` }}
            />
          </div>

          {projectEnded ? (
            <Button size="sm" disabled className="ml-auto">
              Campaign ended
            </Button>
          ) : (
            <Link href={`${projectPath}/pledge`} className="ml-auto">
              <Button
                size="sm"
                className="btn-glow bg-gradient-to-r from-[#05ce78] to-emerald-600 text-white shadow-lg shadow-[#05ce78]/20 hover:from-[#05ce78]/90 hover:to-emerald-600/90"
              >
                {/* The full label doesn't fit beside the amount on a phone. */}
                <span className="sm:hidden">Back this</span>
                <span className="hidden sm:inline">Back this project</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Funding curve, directly under the bar whose number it explains. The
          bar says how much; this says how it got there — the launch spike, the
          quiet middle, the day the goal broke. Renders itself as null when
          there isn't enough history to be worth drawing, which is why there's
          no length check here. */}
      <FundingCurve
        series={project.fundingSeries ?? []}
        goalAmount={Number(project.goalAmount) || 0}
        currency={project.currentAmountDisplay?.symbol || "$"}
        className="-mt-4 sm:-mt-6"
      />

      {/* Interior preview, above the story so the artwork leads the pitch.
          Same reader as the Digital Library, pointed at the creator's preview
          PDF. Absent when they haven't uploaded one.

          The stage stays dark in both themes — it's a lightbox for artwork,
          and pages read better against a dark surround either way — but the
          light-mode version is softened so it isn't a black slab on a white
          page. */}
      {previewPdfUrl && (
        <div className="space-y-4">
          <SectionHeading>Preview the interiors</SectionHeading>
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-[#05ce78]/40 via-cyan-500/20 to-purple-500/30">
            <div className="rounded-2xl bg-zinc-100 p-3 sm:p-6 lg:p-8 dark:bg-zinc-950">
              {/* Ambient wash behind the book. Purely decorative. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(5,206,120,0.10),transparent_65%)]"
              />
              <div className="relative">
                <PdfPageFlipReader
                  pdfUrl={previewPdfUrl}
                  fileId={`preview-${project.id}`}
                  singlePage={!reader.spread}
                  width={reader.width}
                  height={reader.height}
                  maxPageWidth={reader.maxPageWidth}
                  // These are pages from the middle of a book, not a book —
                  // there's no cover among them, so nothing should be stiff.
                  showCover={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story — full container width. */}
      <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none sm:max-w-none lg:max-w-none dark:prose-invert prose-img:rounded-lg prose-img:my-6 prose-img:max-w-full prose-img:h-auto prose-a:text-primary prose-a:underline">
        <SectionHeading>Story</SectionHeading>
        <div
          className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:w-auto overflow-hidden"
          dangerouslySetInnerHTML={{ __html: processedDescription }}
        />

        <Separator className="my-8" />

        <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="m-0 font-semibold">Risks and challenges</h3>
          </div>
          <p className="m-0 text-muted-foreground">{project.risks}</p>
        </div>
      </div>

      {/* Rewards — a grid, below the story, at full width. */}
      <div className="space-y-5">
        {/* "Rewards", not "Rewards & add-ons". This grid is fed `tiers` only —
            the project page keeps add-ons in separate state and hands them to
            the Rewards tab. That split is deliberate: add-ons attach to a
            pledge, so a backer only ever sees them once they've chosen a
            reward (RewardsTab gates them behind isSelected, and the pledge
            flow puts them on their own step after reward selection). Naming
            them here promised something this grid does not do. */}
        <SectionHeading>Rewards</SectionHeading>

        <CategoryFilter
          groups={groups}
          uncategorized={uncategorized}
          active={activeFilter}
          onChange={setActiveFilter}
          label="Filter rewards by category"
        />

        {/* Column count steps with the container, not with a device guess:
            one cover on a phone, two from small tablets up, three on a
            landscape tablet / small laptop, four on a desktop and five on a
            wide monitor — so a cover is never smaller than it is on a phone. */}
        <div className="grid gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleTiers.map((reward) => {
            const isLimited = reward.quantityAvailable !== null;
            const remaining =
              isLimited && reward.quantityAvailable !== null
                ? reward.quantityAvailable - reward.quantityClaimed
                : null;
            const isSoldOut = isLimited && remaining === 0;
            const isScarce =
              isLimited && !isSoldOut && remaining !== null && remaining <= 25;

            return (
              <Card
                key={reward.id}
                className={`group relative flex flex-col overflow-hidden glass-card glass-card-hover border-border/60 ${
                  isSoldOut ? "opacity-60 saturate-50" : ""
                }`}
              >
                {/* Portrait aspect — these are comic covers, not banners. */}
                {reward.imageUrl && (
                  <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                    <Image
                      src={reward.imageUrl}
                      alt={reward.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    {/* Scrim so the category chip stays legible over any art. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                    />
                    {/* The reward's own category, shown when the grid isn't
                        already filtered down to it. */}
                    {reward.category?.trim() && activeFilter === ALL_CATEGORIES && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                        {reward.category.trim()}
                      </span>
                    )}
                  </div>
                )}

                <CardContent className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-xl font-bold leading-none text-[#05ce78] neon-text-green tabular-nums">
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

                  {isScarce && (
                    <Badge
                      variant="destructive"
                      className="w-fit shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                    >
                      Only {remaining} left
                    </Badge>
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
                        <Button className="btn-glow w-full bg-gradient-to-r from-[#05ce78] to-emerald-600 text-white hover:from-[#05ce78]/90 hover:to-emerald-600/90">
                          Select
                        </Button>
                      </Link>
                    ) : (
                      <Button className="w-full" disabled>
                        No longer available
                      </Button>
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
      <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
        <Card className="glass-card glass-card-hover border-border/60">
          <CardContent className="p-5">
            <button
              type="button"
              onClick={onViewCreator}
              disabled={!onViewCreator}
              className="group mb-4 flex w-full items-start gap-3 text-left disabled:cursor-default"
              aria-label={`View ${project.creator.name}'s creator profile`}
            >
              {/* Gradient ring around the avatar — the same brand ramp the
                  buttons and headings use. */}
              <span className="rounded-full bg-gradient-to-br from-[#05ce78] via-cyan-500 to-purple-500 p-[2px]">
                <Avatar className="h-12 w-12 border-2 border-background">
                  <AvatarImage src={project.creator.image} />
                  <AvatarFallback className="bg-black text-white">
                    {project.creator?.name?.[0] || "C"}
                  </AvatarFallback>
                </Avatar>
              </span>
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
                variant="outline"
                className="w-full font-medium"
              >
                View Creator Profile
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover border-border/60">
          <CardContent className="space-y-4 p-5">
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

            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#028858] to-emerald-700 p-4 text-white">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl"
              />
              <h5 className="relative mb-1 font-semibold">
                Donate — because you believe in it.
              </h5>
              <p className="relative text-sm opacity-90">
                No reward, no strings — pure support. Help bring this project to life and
                champion western comics and art through our Grant Program.
              </p>
            </div>

            {projectEnded ? (
              <Button className="w-full" disabled>
                Campaign has ended
              </Button>
            ) : (
              <Link href={`${projectPath}/pledge?amount=${pledgeAmount}`} className="block">
                <Button className="btn-glow w-full bg-gradient-to-r from-[#05ce78] to-emerald-600 text-white hover:from-[#05ce78]/90 hover:to-emerald-600/90">
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
