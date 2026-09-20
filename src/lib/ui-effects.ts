import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Sitewide visual-effects configuration, edited in /admin/themes → Effects.
 *
 * Every flag here was hardcoded during the Sept 2026 design push and then
 * tuned by redeploying (the scanline height alone shipped at five different
 * values). This moves the knobs to the admin so taste changes stop being
 * commits.
 *
 * Read paths and how each flag is enforced:
 * - scanlines / coverMarquee / liveTicker: conditional render on the homepage
 * - scanlineHeight: --scanline-h CSS variable set on <body>
 * - odometerStats: prop into HomeStatsPoller
 * - filmGrain / auroraWash: data-fx-* attributes on <body>, consumed by CSS
 * - tiltCards / viewTransitions: data-fx-* attributes on <body>, consumed by
 *   the client components (they check once — an admin change applies on the
 *   visitor's next page load, which is the right cost for a taste setting)
 * - scrollProgress: conditional render in the layout
 */

export interface UiEffects {
  scanlines: boolean;
  /** px; the comet bar's overall height. The rail inside stays slim. */
  scanlineHeight: number;
  coverMarquee: boolean;
  liveTicker: boolean;
  odometerStats: boolean;
  tiltCards: boolean;
  viewTransitions: boolean;
  filmGrain: boolean;
  auroraWash: boolean;
  scrollProgress: boolean;
}

export const UI_EFFECTS_DEFAULTS: UiEffects = {
  scanlines: true,
  scanlineHeight: 8,
  coverMarquee: true,
  liveTicker: true,
  odometerStats: true,
  tiltCards: true,
  viewTransitions: true,
  filmGrain: true,
  auroraWash: true,
  scrollProgress: true,
};

export function normalizeUiEffects(raw: unknown): UiEffects {
  const src =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const bool = (key: keyof UiEffects) =>
    typeof src[key] === "boolean"
      ? (src[key] as boolean)
      : (UI_EFFECTS_DEFAULTS[key] as boolean);

  const height = Number(src.scanlineHeight);
  return {
    scanlines: bool("scanlines"),
    // Clamped: 0 would hide the line while claiming it is on, and past ~32px
    // a divider becomes a banner.
    scanlineHeight:
      Number.isFinite(height) && height >= 2 && height <= 32
        ? Math.round(height)
        : UI_EFFECTS_DEFAULTS.scanlineHeight,
    coverMarquee: bool("coverMarquee"),
    liveTicker: bool("liveTicker"),
    odometerStats: bool("odometerStats"),
    tiltCards: bool("tiltCards"),
    viewTransitions: bool("viewTransitions"),
    filmGrain: bool("filmGrain"),
    auroraWash: bool("auroraWash"),
    scrollProgress: bool("scrollProgress"),
  };
}

/**
 * Per-request cached read. Falls back to defaults on ANY failure — including
 * the window where this code is deployed but the uiEffects column migration
 * has not run yet, when the select itself throws. The site must never lose
 * its homepage because a taste toggle could not be read.
 */
export const getUiEffects = cache(async (): Promise<UiEffects> => {
  try {
    const row = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { uiEffects: true },
    });
    return normalizeUiEffects(row?.uiEffects);
  } catch {
    return UI_EFFECTS_DEFAULTS;
  }
});
