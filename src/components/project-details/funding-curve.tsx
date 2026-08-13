"use client";

import { useId, useMemo } from "react";
import type { FundingPoint } from "@/lib/stats";

// The funding curve on the campaign page (layout v2).
//
// Hand-drawn SVG rather than recharts, which the dashboards use. recharts is
// ~100KB and this is the public campaign page — the one page on the site whose
// load time affects conversion. One monotonic series with a fill and two
// markers doesn't justify a charting library in that bundle.
//
// What it encodes, all of it real:
//   - the cumulative committed total, day by day, from launch
//   - the goal, as a horizontal rule
//   - the day the goal was crossed, marked — on a crowdfunding page that's the
//     single most meaningful moment in the run
//   - today's total, as the endpoint
//
// The last point equals the "raised" figure in the funding bar above it,
// because both come from the same counting rule in lib/stats.ts.

interface FundingCurveProps {
  series: FundingPoint[];
  goalAmount: number;
  currency?: string;
  className?: string;
}

// Viewbox units. The SVG scales to its container; these only set the aspect
// ratio and the coordinate space the path maths works in.
const VW = 1000;
const VH = 220;
const PAD_T = 18;
const PAD_B = 22;
const PAD_R = 14;

function money(n: number, currency = "$") {
  if (n >= 1_000_000) return `${currency}${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${currency}${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${currency}${(n / 1000).toFixed(1)}k`;
  return `${currency}${Math.round(n)}`;
}

function formatDay(iso: string) {
  // Parsed as UTC to match how the series is bucketed; a local-time parse
  // shifts every label back a day for anyone west of Greenwich.
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function FundingCurve({
  series,
  goalAmount,
  currency = "$",
  className,
}: FundingCurveProps) {
  const uid = useId().replace(/:/g, "");

  const model = useMemo(() => {
    if (series.length < 2) return null;

    const finalTotal = series[series.length - 1].cumulative;
    if (finalTotal <= 0) return null;

    // Y scale. Two cases pull in opposite directions:
    //
    //   Past goal — scale to the total, so the curve fills the box and the goal
    //   rule sits low. That's the honest picture of blowing past it.
    //
    //   Short of goal — scaling to the goal would flatten a campaign at 10%
    //   into a line along the floor, which says nothing about whether it's
    //   still climbing. So the goal only stretches the axis while it's within
    //   reach (2x the total); beyond that the axis follows the data and the
    //   goal rule is simply off-canvas and not drawn.
    const reachableGoal = goalAmount > 0 && goalAmount <= finalTotal * 2 ? goalAmount : 0;
    const yMax = Math.max(finalTotal, reachableGoal) * 1.12;

    const x = (i: number) => (i / (series.length - 1)) * (VW - PAD_R);
    const y = (v: number) => PAD_T + (1 - v / yMax) * (VH - PAD_T - PAD_B);

    const line = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.cumulative).toFixed(2)}`)
      .join(" ");

    const baseline = y(0).toFixed(2);
    const area = `${line} L${x(series.length - 1).toFixed(2)},${baseline} L0,${baseline} Z`;

    // First day the running total reached the goal.
    let goalIndex = -1;
    if (goalAmount > 0) {
      goalIndex = series.findIndex((p) => p.cumulative >= goalAmount);
    }

    // Best single day, used only for the screen-reader summary — drawing a
    // marker for it as well would clutter a chart this small.
    let bestDay = series[0];
    for (const p of series) if (p.amount > bestDay.amount) bestDay = p;

    return {
      line,
      area,
      finalTotal,
      yMax,
      // Drawn only when it's on the canvas — see the y-scale note above.
      goalY: reachableGoal > 0 ? y(reachableGoal) : null,
      goalIndex,
      // Marker positions as percentages of the box. The dots are HTML, not
      // SVG: preserveAspectRatio="none" is what lets one fixed viewBox stretch
      // to any container width, but it scales x and y by different factors, so
      // an SVG <circle> would render as an ellipse. Percentages sidestep that.
      goalLeft: goalIndex >= 0 ? (x(goalIndex) / VW) * 100 : null,
      goalTop: goalIndex >= 0 ? (y(series[goalIndex].cumulative) / VH) * 100 : null,
      endLeft: (x(series.length - 1) / VW) * 100,
      endTop: (y(finalTotal) / VH) * 100,
      bestDay,
    };
  }, [series, goalAmount]);

  // Nothing meaningful to draw: a campaign on its first day, or one with no
  // committed money yet. The section is omitted entirely rather than showing
  // an empty chart.
  if (!model) return null;

  const first = series[0];
  const last = series[series.length - 1];
  const pct = goalAmount > 0 ? Math.round((model.finalTotal / goalAmount) * 100) : 0;

  const summary =
    `Funding from ${formatDay(first.date)} to ${formatDay(last.date)}: ` +
    `${currency}${Math.round(model.finalTotal).toLocaleString()} committed across ` +
    `${series.length} days` +
    (goalAmount > 0 ? `, ${pct}% of the ${currency}${Math.round(goalAmount).toLocaleString()} goal` : "") +
    (model.goalIndex >= 0
      ? `. Goal reached on ${formatDay(series[model.goalIndex].date)}, day ${model.goalIndex + 1}.`
      : ".") +
    ` Best day was ${formatDay(model.bestDay.date)} at ${currency}${Math.round(model.bestDay.amount).toLocaleString()}.`;

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Funding so far
        </h3>
        <p className="text-xs text-muted-foreground">
          {model.goalIndex >= 0 ? (
            <>
              Goal met on{" "}
              <span className="font-medium text-foreground">
                day {model.goalIndex + 1}
              </span>{" "}
              of {series.length}
            </>
          ) : (
            <>
              <span className="font-medium text-foreground tabular-nums">{pct}%</span> of goal
              over {series.length} days
            </>
          )}
        </p>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
        // Fills the container width; the fixed viewBox keeps the aspect ratio
        // so the curve reads the same on a phone and a wide monitor.
          className="block h-[110px] w-full sm:h-[130px] lg:h-[150px]"
          role="img"
          aria-label={summary}
          preserveAspectRatio="none"
        >
          <title>{summary}</title>
          <defs>
            <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#05ce78" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#05ce78" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`stroke-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#05ce78" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Goal rule. Drawn under the curve so the fill reads over it. */}
          {model.goalY !== null && (
            <line
              x1="0"
              y1={model.goalY}
              x2={VW - PAD_R}
              y2={model.goalY}
              stroke="currentColor"
              strokeOpacity="0.28"
              strokeWidth="1"
              strokeDasharray="4 5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <path d={model.area} fill={`url(#fill-${uid})`} />
          <path
            d={model.line}
            fill="none"
            stroke={`url(#stroke-${uid})`}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

  </svg>

        {model.goalLeft !== null && model.goalTop !== null && (
          <span
            aria-hidden
            title="Goal reached"
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-amber-400"
            style={{ left: `${model.goalLeft}%`, top: `${model.goalTop}%` }}
          />
        )}

        <span
          aria-hidden
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[#05ce78] shadow-[0_0_12px_rgba(5,206,120,.9)]"
          style={{ left: `${model.endLeft}%`, top: `${model.endTop}%` }}
        />
      </div>

      {/* Axis labels live outside the SVG. preserveAspectRatio="none" is what
          lets the curve stretch to any container width without recalculating
          the path, but it would stretch text with it. */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground sm:text-[11px]">
        <span>{formatDay(first.date)}</span>
        {goalAmount > 0 && (
          <span className="hidden sm:inline">
            Goal {money(goalAmount, currency)}
          </span>
        )}
        <span className="tabular-nums">
          {money(model.finalTotal, currency)} · {formatDay(last.date)}
        </span>
      </div>
    </div>
  );
}
