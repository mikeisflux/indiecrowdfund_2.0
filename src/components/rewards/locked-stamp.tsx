"use client";

import { Lock } from "lucide-react";
import {
  amountUntilUnlock,
  formatUnlockAmount,
  UnlockAmount,
} from "@/lib/rewards/unlock";

/**
 * The "LOCKED" stamp laid over a goal-locked reward's artwork.
 *
 * Deliberately a rubber stamp — rotated, heavy outline, slightly translucent —
 * rather than a corner pill. It has to read as "not available yet" at a glance
 * on a grid of covers, and a small badge in a corner does not survive being
 * scanned past. The scrim under it is what makes the stamp legible on light
 * artwork; without it a pale cover swallows the white text entirely.
 *
 * The threshold is printed underneath the stamp and NOT only in the card body,
 * because the image is what a backer looks at. "Locked" on its own invites a
 * support message asking what unlocks it.
 *
 * pointer-events-none throughout: the card underneath stays clickable, so a
 * backer can still open a locked reward and read what they'd be getting.
 */
export function LockedStamp({
  unlockAtAmount,
  raisedAmount,
  currency = "USD",
  size = "default",
}: {
  unlockAtAmount: UnlockAmount;
  raisedAmount: number;
  currency?: string;
  /** "compact" for the smaller add-on tiles, where the full stamp won't fit. */
  size?: "default" | "compact";
}) {
  const label = formatUnlockAmount(unlockAtAmount, currency);
  if (!label) return null;

  const remaining = amountUntilUnlock(unlockAtAmount, raisedAmount);
  const compact = size === "compact";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-black/60 backdrop-blur-[2px] sm:gap-2"
    >
      {/* Scanline wash. Purely atmospheric, and skipped when the viewer has
          asked for less motion — it is a static gradient either way, but the
          sheen that rides over it is not. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40"
      />
      <span
        aria-hidden
        className="shimmer absolute inset-0 opacity-60 motion-reduce:hidden"
      />

      <div
        className={`relative flex -rotate-12 items-center gap-1.5 rounded-md border-2 border-white/85 bg-black/40 font-extrabold uppercase text-white/95 shadow-[0_0_18px_rgba(0,0,0,.55)] sm:gap-2 sm:border-[3px] ${
          compact
            ? "px-2 py-0.5 text-[11px] tracking-[0.15em] sm:px-3 sm:py-1 sm:text-sm"
            : "px-3 py-1 text-sm tracking-[0.15em] sm:px-4 sm:py-1.5 sm:text-base sm:tracking-[0.2em] lg:px-5 lg:py-2 lg:text-xl"
        }`}
      >
        <Lock
          className={
            compact ? "h-3 w-3 sm:h-4 sm:w-4" : "h-3.5 w-3.5 lg:h-5 lg:w-5"
          }
        />
        Locked
      </div>
      <p
        className={`relative px-2 text-center font-semibold text-white drop-shadow ${
          compact
            ? "text-[10px] leading-tight sm:text-[11px]"
            : "text-xs leading-tight sm:text-sm"
        }`}
      >
        Unlocks at {label}
      </p>
      {/* "to go" is the first thing dropped when space is tight: the threshold
          above is the fact a backer needs, this is the nice-to-have. */}
      {remaining > 0 && !compact && (
        <p className="relative hidden px-2 text-center text-xs text-white/80 drop-shadow sm:block">
          {formatUnlockAmount(remaining, currency)} to go
        </p>
      )}
    </div>
  );
}

/**
 * The same information as a text line, for surfaces with no artwork to stamp —
 * an add-on row in the pledge summary, or a reward whose image never loaded.
 */
export function LockedNote({
  unlockAtAmount,
  currency = "USD",
  className = "",
}: {
  unlockAtAmount: UnlockAmount;
  currency?: string;
  className?: string;
}) {
  const label = formatUnlockAmount(unlockAtAmount, currency);
  if (!label) return null;

  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.15)] sm:text-xs dark:text-amber-400 ${className}`}
    >
      <Lock className="h-3 w-3 shrink-0" />
      Unlocks at {label}
    </span>
  );
}
