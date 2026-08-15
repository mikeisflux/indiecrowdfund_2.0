"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock } from "lucide-react";
import {
  ALL_CATEGORIES,
  CategoryFilter,
  filterByCategory,
  useCategoryGroups,
} from "@/components/rewards/category-filter";
import { RewardData } from "./types";
import { formatDeliveryDate } from "./utils";
import { useState } from "react";

// The layout-v2 reward grid: portrait covers, category pills, one card per
// tier.
//
// Lifted out of campaign-tab-v2 so the Rewards *tab* can show the same thing.
// The tab had been left on v1 — a sidebar plus expand-in-place cards — so a v2
// campaign switched design the moment a backer clicked "Rewards", and that
// older view also listed add-ons inside each expanded reward, which is exactly
// what v2 moved into the pledge flow.
//
// Tiers only, deliberately. Add-ons attach to a pledge, so a backer sees them
// after they've chosen a reward, never alongside one.
export function RewardGrid({
  tiers,
  projectPath,
  projectEnded,
}: {
  tiers: RewardData[];
  projectPath: string;
  projectEnded: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<string>(ALL_CATEGORIES);
  const { groups, uncategorized } = useCategoryGroups(tiers);
  const visibleTiers = filterByCategory(tiers, activeFilter);

  return (
    <div className="space-y-5">
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
  );
}
