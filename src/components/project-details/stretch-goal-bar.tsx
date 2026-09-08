"use client";

import { Check, Lock } from "lucide-react";
import { formatUnlockAmount } from "@/lib/rewards/unlock";

/**
 * The milestone meter: a track with a node per stretch goal, filled up to the
 * campaign's raised total.
 *
 *    ────●────────●──────────○───────○
 *
 * Nodes are positioned by amount, not spread evenly, so the spacing shows how
 * far apart the milestones actually are — a goal at $2k and one at $2.2k sit
 * next to each other, and a jump to $20k reads as a jump. Evenly spaced dots
 * would make every campaign look identically paced and quietly lie about how
 * close the next one is.
 *
 * The track runs to the last milestone rather than to the funding goal: past
 * the final stretch goal there is nothing left to fill toward, and scaling to
 * a goal far below the last milestone would peg the bar at 100% with
 * milestones still ahead of it.
 */

export interface StretchGoalMarker {
  id: string;
  title: string;
  threshold: number;
  unlocked: boolean;
}

export function StretchGoalBar({
  goals,
  raisedAmount,
  currency = "USD",
}: {
  goals: StretchGoalMarker[];
  raisedAmount: number;
  currency?: string;
}) {
  if (goals.length === 0) return null;

  // Sorted defensively: callers pass sorted arrays today, but the node
  // positions and the `max` below are both wrong if that ever stops holding.
  const sorted = [...goals].sort((a, b) => a.threshold - b.threshold);
  const max = sorted[sorted.length - 1].threshold;
  // Guard a single goal at 0 (or a bad row) from dividing by zero.
  const scale = max > 0 ? max : 1;
  const pct = (n: number) => Math.min(100, Math.max(0, (n / scale) * 100));
  const filled = pct(raisedAmount);

  const nextGoal = sorted.find((g) => !g.unlocked);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold">
          {formatUnlockAmount(raisedAmount, currency) || "$0"} raised
        </p>
        {nextGoal ? (
          <p className="text-sm text-muted-foreground">
            Next goal:{" "}
            <span className="font-medium text-foreground">{nextGoal.title}</span> at{" "}
            {formatUnlockAmount(nextGoal.threshold, currency)}
          </p>
        ) : (
          <p className="text-sm font-medium text-[#05ce78]">All stretch goals unlocked</p>
        )}
      </div>

      {/* px gives the end nodes room for their labels: the last milestone sits
          at left:100%, and a centred 6rem label would otherwise hang half
          outside the card. pb leaves room for the labels below the track. */}
      <div className="relative px-12 pb-20 pt-1">
        <div className="relative h-2 rounded-full bg-border">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#05ce78] to-emerald-500"
            style={{ width: `${filled}%` }}
          />

          {sorted.map((goal, i) => {
            const left = pct(goal.threshold);
            return (
              <div
                key={goal.id}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%` }}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    goal.unlocked
                      ? "border-[#05ce78] bg-[#05ce78] text-white shadow-[0_0_12px_rgba(5,206,120,.7)]"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                  title={`${goal.title} — ${formatUnlockAmount(goal.threshold, currency)}`}
                >
                  {goal.unlocked ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </div>

                {/* Labels drop to two staggered rows so adjacent milestones
                    don't overprint each other. Nodes are positioned by amount,
                    so two goals a few hundred dollars apart sit almost on top
                    of one another and a single row of labels becomes an
                    unreadable smear. */}
                <div
                  className={`absolute left-1/2 w-24 -translate-x-1/2 text-center ${
                    i % 2 === 0 ? "top-8" : "top-[4.5rem]"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold tabular-nums ${
                      goal.unlocked ? "text-[#05ce78]" : "text-muted-foreground"
                    }`}
                  >
                    {formatUnlockAmount(goal.threshold, currency)}
                  </p>
                  <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                    {goal.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
