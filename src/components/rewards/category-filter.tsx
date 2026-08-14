"use client";

import { useMemo } from "react";

// Category filter pills, shared by the campaign page's reward grid and the
// pledge flow's add-on step.
//
// Both grids filter the same way and should look identical — the add-on step
// is deliberately the reward grid again with a different heading, so a backer
// who has just learned how to browse rewards already knows how to browse
// add-ons. Keeping one implementation is what stops the two drifting.
//
// Tiers and add-ons are filtered separately by their callers, so their
// categories are separate vocabularies. The database distinction is
// Reward.type, already on the row — nothing is encoded into the stored string,
// so a creator's exact wording survives round-tripping.

export const ALL_CATEGORIES = "__all__";

// Sentinel for items with no category. Deliberately not a real category
// string, so a creator who literally types "Other" still gets their own tab.
export const UNCATEGORIZED = "__other__";

export interface Categorized {
  category?: string | null;
}

export interface CategoryGroups {
  /** Distinct categories, in first-seen order, empty when pills add nothing. */
  groups: string[];
  /** Whether an "Other" pill is needed. */
  uncategorized: boolean;
}

/**
 * Distinct categories across a list.
 *
 * Grouped case-insensitively but displayed with the first spelling the creator
 * used, so "Covers" and "covers" are one tab rather than two.
 *
 * Returns no groups unless they genuinely partition the list into 2+ buckets —
 * a single pill next to "All" is a control that can't change anything.
 * Uncategorized items only get an "Other" pill when categorised ones also
 * exist; without that, filtering would strand them behind a tab that isn't
 * offered.
 */
export function useCategoryGroups(items: Categorized[]): CategoryGroups {
  return useMemo(() => {
    const named: string[] = [];
    const seen = new Set<string>();
    let hasUncategorized = false;

    for (const item of items) {
      const c = item.category?.trim();
      if (!c) {
        hasUncategorized = true;
        continue;
      }
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      named.push(c);
    }

    const buckets = named.length + (hasUncategorized ? 1 : 0);
    if (named.length === 0 || buckets < 2) {
      return { groups: [], uncategorized: false };
    }
    return { groups: named, uncategorized: hasUncategorized };
  }, [items]);
}

/** Apply the active filter. `ALL_CATEGORIES` passes everything through. */
export function filterByCategory<T extends Categorized>(items: T[], active: string): T[] {
  if (active === ALL_CATEGORIES) return items;
  if (active === UNCATEGORIZED) return items.filter((i) => !i.category?.trim());
  return items.filter(
    (i) => i.category?.trim().toLowerCase() === active.toLowerCase()
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-all sm:px-4 sm:text-sm ${
        active
          ? "border-transparent bg-gradient-to-r from-[#05ce78] to-emerald-600 font-medium text-white shadow-[0_0_18px_-4px_rgba(5,206,120,0.8)]"
          : "border-border/70 text-muted-foreground hover:border-[#05ce78]/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

interface CategoryFilterProps extends CategoryGroups {
  active: string;
  onChange: (next: string) => void;
  /** Accessible name — "Filter rewards" / "Filter add-ons". */
  label: string;
}

/**
 * Renders nothing when the groups don't partition the list, so callers can
 * drop this in without guarding.
 */
export function CategoryFilter({
  groups,
  uncategorized,
  active,
  onChange,
  label,
}: CategoryFilterProps) {
  if (groups.length === 0) return null;

  return (
    // Scrolls sideways on a phone and wraps from sm up. A catalogue with eight
    // categories would otherwise eat four stacked rows before a backer sees a
    // single cover. The negative margin lets the strip bleed to the screen
    // edge so it reads as scrollable.
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
    >
      <Pill active={active === ALL_CATEGORIES} onClick={() => onChange(ALL_CATEGORIES)}>
        All
      </Pill>
      {groups.map((g) => (
        <Pill key={g} active={active === g} onClick={() => onChange(g)}>
          {g}
        </Pill>
      ))}
      {uncategorized && (
        <Pill active={active === UNCATEGORIZED} onClick={() => onChange(UNCATEGORIZED)}>
          Other
        </Pill>
      )}
    </div>
  );
}
