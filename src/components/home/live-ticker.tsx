"use client";

/**
 * Live pledge ticker — real money moving, shown moving.
 *
 * Rotates through the most recent completed pledges: "Someone in Ohio backed
 * Dead Sexy 3 — $39 · 4m ago". Deliberately anonymous — region and amount
 * sell the platform; a backer's name is theirs. The items arrive
 * server-rendered (the page's 60s ISR keeps them fresh); this component only
 * does the rotation, so there is no client fetching and nothing to fail.
 *
 * Hover pauses it, reduced-motion swaps the slide for a plain swap, and the
 * region is dropped server-side rather than trusted here.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export interface TickerItem {
  id: string;
  /** "Someone in Ohio backed" / "Someone just backed" */
  lead: string;
  title: string;
  amount: string;
  when: string;
  href: string;
}

export function LiveTicker({ items }: { items: TickerItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [paused, items.length]);

  if (items.length === 0) return null;
  const item = items[index];

  return (
    // Full-width bar spanning the stats tiles below it, sized as a headline
    // rather than a caption — the ticker earned the promotion.
    <div
      className="mb-6 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 md:gap-4 md:px-6 md:py-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Rotating marketing copy, not information anyone is waiting on — a
      // screen reader should not announce every 4s tick.
      aria-live="off"
    >
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-indicator" />
        Live
      </span>
      {/* key swap re-runs the entry animation per item; min-w-0 + truncate
          keeps a long campaign title on one line on phones instead of
          blowing the bar open (mobile is mandatory on this page). */}
      <Link
        key={item.id}
        href={item.href}
        className="animate-fade-in-up min-w-0 flex-1 truncate text-base font-medium text-muted-foreground transition-colors hover:text-foreground motion-reduce:animate-none md:text-xl"
      >
        {item.lead}{" "}
        <span className="font-bold text-foreground">{item.title}</span>
        {" — "}
        <span className="font-bold text-primary">{item.amount}</span>
        <span className="text-sm text-muted-foreground md:text-base"> · {item.when}</span>
      </Link>
    </div>
  );
}
