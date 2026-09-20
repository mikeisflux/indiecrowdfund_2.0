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
    <div
      className="mb-6 flex items-center justify-center gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Rotating marketing copy, not information anyone is waiting on — a
      // screen reader should not announce every 4s tick.
      aria-live="off"
    >
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 live-indicator" />
        Live
      </span>
      {/* key swap re-runs the entry animation per item */}
      <Link
        key={item.id}
        href={item.href}
        className="animate-fade-in-up text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:animate-none"
      >
        {item.lead}{" "}
        <span className="font-semibold text-foreground">{item.title}</span>
        {" — "}
        <span className="font-semibold text-primary">{item.amount}</span>
        <span className="text-xs"> · {item.when}</span>
      </Link>
    </div>
  );
}
