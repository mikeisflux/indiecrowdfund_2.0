"use client";

/**
 * Pointer-tracked 3D tilt with a moving glare highlight.
 *
 * The card rotates a few degrees toward the cursor and a soft light spot
 * follows it, so the surface reads as physical — this is the interaction
 * people mean when they say a site feels "expensive". Implemented with two
 * CSS custom properties written on pointermove; no animation library, no
 * re-renders (state never changes — the DOM node is mutated directly, which
 * is the entire trick to keeping it at 60fps inside a grid of cards).
 *
 * Self-disabling where it would be wrong:
 * - coarse pointers (touch): there is no cursor to track, and a tilt snapped
 *   to a tap point just looks broken
 * - prefers-reduced-motion: tilt is exactly the kind of decorative motion
 *   that setting exists to switch off
 * Both fall back to rendering children in a plain div.
 */

import { useRef, useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const QUERY = "(pointer: fine) and (prefers-reduced-motion: no-preference)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function useTiltEnabled(): boolean {
  // useSyncExternalStore keeps server and first client render identical
  // (disabled), so hydration never mismatches; capable devices upgrade
  // immediately after mount.
  return useSyncExternalStore(
    subscribe,
    () =>
      window.matchMedia(QUERY).matches &&
      // Admin kill switch (/admin/themes -> Effects), written on <body> by
      // the layout. Checked at snapshot time; a change applies on the next
      // page load, which is the right cost for a taste setting.
      document.body.dataset.fxTilt !== "off",
    () => false
  );
}

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Peak rotation in degrees. Past ~10 it stops reading as physical. */
  max?: number;
}

export function TiltCard({ children, className, max = 7 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useTiltEnabled();

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height; // 0..1
      el.style.setProperty("--tilt-rx", `${(0.5 - py) * max * 2}deg`);
      el.style.setProperty("--tilt-ry", `${(px - 0.5) * max * 2}deg`);
      el.style.setProperty("--glare-x", `${px * 100}%`);
      el.style.setProperty("--glare-y", `${py * 100}%`);
      el.style.setProperty("--glare-o", "1");
    },
    [max]
  );

  const handleLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-rx", "0deg");
    el.style.setProperty("--tilt-ry", "0deg");
    el.style.setProperty("--glare-o", "0");
  }, []);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn("tilt-card", className)}
    >
      {children}
      <div className="tilt-glare" aria-hidden="true" />
    </div>
  );
}
