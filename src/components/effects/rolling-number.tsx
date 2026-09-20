"use client";

/**
 * Gas-pump odometer for stat values.
 *
 * Takes the final, already-formatted string ("$12,005+") and renders every
 * digit as a vertical strip of 0-9 that rolls to its target the first time
 * the number scrolls into view. Non-digits ($ , + .) stay put, which is what
 * keeps the currency formatting the caller chose intact.
 *
 * The roll happens once (IntersectionObserver disconnects after firing) —
 * a number that re-rolls on every scroll-past turns from delightful to
 * carnival. Reduced-motion renders the plain string with no observers at all.
 */

import { useEffect, useRef, useState } from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function RollingNumber({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [rolled, setRolled] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setRolled(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRolled(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (reduced) {
    return <span>{text}</span>;
  }

  return (
    <span
      ref={ref}
      className="inline-flex overflow-hidden align-baseline"
      aria-label={text}
    >
      {text.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <span
            key={i}
            aria-hidden="true"
            className="inline-block h-[1.15em] overflow-hidden"
          >
            <span
              className="flex flex-col transition-transform duration-1000 ease-out"
              style={{
                transform: rolled
                  ? `translateY(-${Number(ch) * 1.15}em)`
                  : "translateY(0)",
                // Stagger the columns slightly so the roll ripples across the
                // number instead of landing as one block.
                transitionDelay: `${i * 60}ms`,
              }}
            >
              {DIGITS.map((d) => (
                <span key={d} className="h-[1.15em] leading-[1.15em]">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true" className="h-[1.15em] leading-[1.15em]">
            {ch}
          </span>
        )
      )}
    </span>
  );
}
