"use client";

import { Lock } from "lucide-react";
import { amountUntilUnlock, formatUnlockAmount, UnlockAmount } from "@/lib/rewards/unlock";

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
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-[1px]"
    >
      <div
        className={`flex -rotate-12 items-center gap-2 rounded-md border-[3px] border-white/85 bg-black/35 font-extrabold uppercase tracking-[0.2em] text-white/95 shadow-lg ${
          compact ? "px-3 py-1 text-sm" : "px-5 py-2 text-xl"
        }`}
      >
        <Lock className={compact ? "h-4 w-4" : "h-5 w-5"} />
        Locked
      </div>
      <p
        className={`px-2 text-center font-semibold text-white drop-shadow ${
          compact ? "text-[11px] leading-tight" : "text-sm"
        }`}
      >
        Unlocks at {label}
      </p>
      {remaining > 0 && !compact && (
        <p className="px-2 text-center text-xs text-white/80 drop-shadow">
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
      className={`inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 ${className}`}
    >
      <Lock className="h-3 w-3" />
      Unlocks at {label}
    </span>
  );
}
