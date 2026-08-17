import { cn } from "@/lib/utils";

// The "BANNED" rubber stamp shown over a banned creator's tiles and campaign.
//
// Built to read as ink pressed onto the page rather than a UI badge: rotated
// off-axis, a heavy double rule, wide letter-spacing, and a slightly uneven
// edge. mix-blend-mode: multiply is what sells it — the artwork underneath
// shows through the ink the way a real stamp behaves, instead of the mark
// sitting on top like a sticker.
//
// pointer-events-none throughout, so the stamp never swallows a click meant
// for the card beneath it, and aria-hidden with a visually-hidden line of text
// so a screen reader hears "banned" once rather than reading decoration.

export function BannedStamp({
  className,
  label = "Banned",
  size = "md",
}: {
  className?: string;
  label?: string;
  /** md for cards in a grid, lg for a full campaign page. */
  size?: "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <span className="sr-only">This creator has been banned from the platform.</span>

      <div
        aria-hidden
        className={cn(
          "select-none rotate-[-14deg] rounded-[6px] border-[6px] font-extrabold uppercase tracking-[0.18em]",
          // Multiply lets the cover art read through the ink. The colour is a
          // faded stamp-pad red rather than a UI red — a pure #ff0000 reads as
          // an error state, not as something pressed onto paper.
          "border-[#b3231f] text-[#b3231f] mix-blend-multiply",
          // The ink is never perfectly opaque, and the edge is never perfectly
          // clean. A tiny blur on the shadow does the second part cheaply.
          "opacity-80 shadow-[0_0_0_2px_rgba(179,35,31,0.15)]",
          "dark:border-[#ff5a54] dark:text-[#ff5a54] dark:mix-blend-screen dark:opacity-90",
          // Clamped so the mark never runs off the edge of what it is
          // stamping. A stamp wider than the card reads as a rendering bug
          // rather than as ink.
          "max-w-[92%] whitespace-nowrap",
          size === "lg"
            ? "px-6 py-3 text-3xl sm:px-10 sm:py-4 sm:text-5xl lg:text-6xl"
            : "px-3 py-1 text-lg sm:px-4 sm:py-1.5 sm:text-2xl"
        )}
        style={{
          // A second inset rule, the way a real stamp has an outer frame and an
          // inner one. Done as a box-shadow so it costs no extra element.
          boxShadow: "inset 0 0 0 3px currentColor",
          fontFamily:
            "ui-serif, Georgia, 'Times New Roman', serif",
        }}
      >
        {label}
      </div>
    </div>
  );
}
