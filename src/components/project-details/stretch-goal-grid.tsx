"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { RewardDetails } from "@/components/rewards/reward-details";
import { LockedStamp, LockedNote } from "@/components/rewards/locked-stamp";
import { formatUnlockAmount, unlockThreshold } from "@/lib/rewards/unlock";
import { StretchGoalBar, StretchGoalMarker } from "./stretch-goal-bar";
import { RewardData } from "./types";

/**
 * The Stretch Goals row, laid out like the reward grid above it.
 *
 * Same card, same portrait cover, same column steps — a backer should read
 * these as part of the same catalogue. What differs is that there is nothing
 * to select: a stretch goal is granted, not bought, so the card carries either
 * a LOCKED stamp and its threshold, or an "Unlocked" badge. A Select button
 * would invite a click that has to be refused.
 *
 * No prices anywhere. A stretch goal costs nothing, and rendering "$0.00"
 * where the tier grid shows a price reads as a bug.
 */
export function StretchGoalGrid({
  goals,
  raisedAmount,
  currency = "USD",
}: {
  goals: RewardData[];
  raisedAmount: number;
  currency?: string;
}) {
  const withThresholds = goals
    .map((g) => ({ goal: g, threshold: unlockThreshold(g.unlockAtAmount) ?? 0 }))
    .filter((g) => g.threshold > 0)
    .sort((a, b) => a.threshold - b.threshold);

  if (withThresholds.length === 0) return null;

  const markers: StretchGoalMarker[] = withThresholds.map(({ goal, threshold }) => ({
    id: goal.id,
    title: goal.title,
    threshold,
    unlocked: raisedAmount >= threshold,
  }));

  return (
    <div className="space-y-5">
      <StretchGoalBar goals={markers} raisedAmount={raisedAmount} currency={currency} />

      <div className="grid gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {withThresholds.map(({ goal, threshold }) => {
          const unlocked = raisedAmount >= threshold;

          return (
            <Card
              key={goal.id}
              className={`group relative flex flex-col overflow-hidden glass-card glass-card-hover ${
                unlocked ? "border-[#05ce78]/60" : "border-border/60"
              }`}
            >
              {goal.imageUrl && (
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  <Image
                    src={goal.imageUrl}
                    alt={goal.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  {unlocked ? (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#05ce78] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-[0_0_12px_rgba(5,206,120,.8)]">
                      <Check className="h-3 w-3" />
                      Unlocked
                    </span>
                  ) : (
                    <LockedStamp
                      unlockAtAmount={goal.unlockAtAmount}
                      raisedAmount={raisedAmount}
                      currency={currency}
                    />
                  )}
                </div>
              )}

              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <p
                  className={`text-sm font-bold uppercase tracking-wide tabular-nums ${
                    unlocked ? "text-[#05ce78] neon-text-green" : "text-muted-foreground"
                  }`}
                >
                  {formatUnlockAmount(threshold, currency)}
                </p>
                <p className="font-semibold leading-snug">{goal.title}</p>

                <RewardDetails description={goal.description} items={goal.items} />

                {/* No artwork to stamp — the state has to be said in words. */}
                {!goal.imageUrl &&
                  (unlocked ? (
                    <Badge className="w-fit bg-[#05ce78] text-white hover:bg-[#05ce78]">
                      <Check className="mr-1 h-3 w-3" />
                      Unlocked
                    </Badge>
                  ) : (
                    <LockedNote unlockAtAmount={goal.unlockAtAmount} currency={currency} />
                  ))}

                <div className="mt-auto pt-2">
                  <p className="text-xs text-muted-foreground">
                    {unlocked
                      ? "Added to every backer's order automatically."
                      : "Unlocks for every backer when the campaign reaches this total."}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
