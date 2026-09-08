"use client";

import { Check, Lock } from "lucide-react";
import { formatUnlockAmount } from "@/lib/rewards/unlock";

/**
 * The milestone meter: every stretch goal, and how close the campaign is.
 *
 * Three layouts, because one does not survive all three screens.
 *
 *   Phone   — a vertical stepper. The horizontal track below is positioned by
 *             amount, and on a 360px screen four milestones collapse into a
 *             smear of overlapping labels. Stacking is the only honest way to
 *             show four dollar figures and four titles in that width.
 *   Tablet  — the horizontal track with compact labels.
 *   Desktop — the horizontal track with full labels.
 *
 *    ────●────────●──────────○───────○
 *
 * On the track, nodes are positioned BY AMOUNT rather than spread evenly, so
 * the spacing shows how far apart the milestones actually are — a goal at $2k
 * and one at $2.2k sit next to each other, and a jump to $20k reads as a jump.
 * Evenly spaced dots would make every campaign look identically paced and
 * quietly lie about how close the next one is.
 *
 * The track runs to the last milestone rather than to the funding goal: past
 * the final stretch goal there is nothing left to fill toward, and scaling to
 * a goal far below the last milestone would peg the bar at 100% with
 * milestones still ahead of it.
 *
 * Motion is decorative here — the pulse on the next node, the sheen on the
 * fill — so all of it is dropped under prefers-reduced-motion.
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
  const unlockedCount = sorted.filter((g) => g.unlocked).length;

  return (
    <div className="glass-card glass-card-hover relative overflow-hidden rounded-xl border-border/60 p-4 sm:p-5 lg:p-6">
      {/* Ambient wash behind the meter. Sits under everything and is inert. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#05ce78]/10 blur-3xl"
      />

      <Summary
        raisedAmount={raisedAmount}
        nextGoal={nextGoal}
        unlockedCount={unlockedCount}
        total={sorted.length}
        currency={currency}
      />

      {/* Phone: vertical stepper. */}
      <ol className="relative mt-5 space-y-0 md:hidden">
        {sorted.map((goal, i) => (
          <MilestoneRow
            key={goal.id}
            goal={goal}
            currency={currency}
            raisedAmount={raisedAmount}
            previousThreshold={i === 0 ? 0 : sorted[i - 1].threshold}
            isNext={nextGoal?.id === goal.id}
            isLast={i === sorted.length - 1}
          />
        ))}
      </ol>

      {/* Tablet and up: the amount-positioned track. px gives the end nodes
          room for their labels — the last milestone sits at left:100%, and a
          centred label would otherwise hang outside the card. */}
      {/* pb has to clear the LOWER of the two staggered label rows, not the
          upper one: row two starts ~4.75rem below the node and runs two lines,
          and the card is overflow-hidden, so an underestimate clips the labels
          rather than merely crowding them. */}
      <div className="relative mt-6 hidden px-10 pb-28 pt-1 md:block lg:px-14 lg:pb-32">
        <div className="relative h-2 rounded-full bg-border/80">
          <div
            className="progress-glow absolute inset-y-0 left-0 overflow-hidden rounded-full bg-gradient-to-r from-[#05ce78] via-emerald-400 to-emerald-500 transition-[width] duration-1000 ease-out motion-reduce:transition-none motion-reduce:animate-none"
            style={{ width: `${filled}%` }}
          >
            <span
              aria-hidden
              className="shimmer absolute inset-0 motion-reduce:animate-none"
            />
          </div>

          {sorted.map((goal, i) => {
            const left = pct(goal.threshold);
            const isNext = nextGoal?.id === goal.id;
            return (
              <div
                key={goal.id}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%` }}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-500 lg:h-7 lg:w-7 ${
                    goal.unlocked
                      ? "border-[#05ce78] bg-[#05ce78] text-white shadow-[0_0_14px_rgba(5,206,120,.75)]"
                      : isNext
                        ? "glow-pulse border-[#05ce78]/70 bg-background text-[#05ce78] motion-reduce:animate-none"
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

                {/* Labels stagger across two rows so adjacent milestones don't
                    overprint each other. Nodes are positioned by amount, so two
                    goals a few hundred dollars apart sit almost on top of one
                    another and a single row becomes unreadable. */}
                <div
                  className={`absolute left-1/2 w-20 -translate-x-1/2 text-center lg:w-24 ${
                    i % 2 === 0 ? "top-9" : "top-[4.75rem]"
                  }`}
                >
                  <p
                    className={`text-[11px] font-semibold tabular-nums transition-colors lg:text-xs ${
                      goal.unlocked
                        ? "neon-text-green text-[#05ce78]"
                        : isNext
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {formatUnlockAmount(goal.threshold, currency)}
                  </p>
                  <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground lg:text-[11px]">
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

function Summary({
  raisedAmount,
  nextGoal,
  unlockedCount,
  total,
  currency,
}: {
  raisedAmount: number;
  nextGoal?: StretchGoalMarker;
  unlockedCount: number;
  total: number;
  currency: string;
}) {
  return (
    <div className="relative flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-4">
      <p className="text-base font-bold tabular-nums sm:text-lg">
        <span className="neon-text-green text-[#05ce78]">
          {formatUnlockAmount(raisedAmount, currency) || "$0"}
        </span>{" "}
        <span className="text-sm font-medium text-muted-foreground">
          raised
        </span>
      </p>
      {nextGoal ? (
        <p className="text-xs text-muted-foreground sm:text-sm">
          Next:{" "}
          <span className="font-medium text-foreground">{nextGoal.title}</span>{" "}
          at{" "}
          <span className="tabular-nums">
            {formatUnlockAmount(nextGoal.threshold, currency)}
          </span>
        </p>
      ) : (
        <p className="text-xs font-semibold text-[#05ce78] sm:text-sm">
          All {total} stretch goals unlocked
        </p>
      )}
      {nextGoal && unlockedCount > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground sm:hidden">
          {unlockedCount} of {total} unlocked
        </p>
      )}
    </div>
  );
}

/**
 * One row of the phone stepper.
 *
 * The connector above each node fills with progress through THAT segment —
 * from the previous milestone to this one — rather than with the campaign's
 * overall percentage. On a phone this is the only progress indicator there is,
 * and "how close am I to the next one" is the question a backer is asking.
 */
function MilestoneRow({
  goal,
  currency,
  raisedAmount,
  previousThreshold,
  isNext,
  isLast,
}: {
  goal: StretchGoalMarker;
  currency: string;
  raisedAmount: number;
  previousThreshold: number;
  isNext: boolean;
  isLast: boolean;
}) {
  const span = Math.max(1, goal.threshold - previousThreshold);
  const segment = Math.min(
    100,
    Math.max(0, ((raisedAmount - previousThreshold) / span) * 100),
  );

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* Rail: node plus the connector down to the next row. */}
      <div className="flex flex-col items-center">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
            goal.unlocked
              ? "border-[#05ce78] bg-[#05ce78] text-white shadow-[0_0_14px_rgba(5,206,120,.75)]"
              : isNext
                ? "glow-pulse border-[#05ce78]/70 bg-background text-[#05ce78] motion-reduce:animate-none"
                : "border-border bg-background text-muted-foreground"
          }`}
        >
          {goal.unlocked ? (
            <Check className="h-4 w-4" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
        </span>
        {!isLast && (
          <span className="relative mt-1 w-0.5 flex-1 rounded-full bg-border">
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 rounded-full bg-[#05ce78] transition-[height] duration-700 ease-out motion-reduce:transition-none"
              style={{ height: `${goal.unlocked ? 100 : 0}%` }}
            />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p
            className={`text-sm font-bold tabular-nums ${
              goal.unlocked
                ? "neon-text-green text-[#05ce78]"
                : "text-foreground"
            }`}
          >
            {formatUnlockAmount(goal.threshold, currency)}
          </p>
          {goal.unlocked && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#05ce78]">
              Unlocked
            </span>
          )}
        </div>
        <p className="text-sm leading-snug text-muted-foreground">
          {goal.title}
        </p>

        {isNext && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="progress-glow h-full rounded-full bg-gradient-to-r from-[#05ce78] to-emerald-400 transition-[width] duration-1000 ease-out motion-reduce:transition-none motion-reduce:animate-none"
                style={{ width: `${segment}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              {formatUnlockAmount(
                Math.max(0, goal.threshold - raisedAmount),
                currency,
              ) || "$0"}{" "}
              to go
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
