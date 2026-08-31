"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

/**
 * A reward's description and included items, expandable in place.
 *
 * Reported by a backer: the description was clamped to three lines and the
 * item list cut to three entries with "+N more", so on a tier with a long
 * description and several items you could not find out what you were buying
 * without pledging. There was no expand, no scroll, and no full copy anywhere
 * else on the page — the campaign description does not necessarily repeat it.
 *
 * Cards stay compact by default because the grid reads better when they align.
 * The toggle only appears when something is actually hidden, and whether the
 * description is truncated is MEASURED rather than guessed from a character
 * count: clamping depends on font, card width and the words themselves, so a
 * length threshold shows a useless "Show more" on some cards and hides a
 * needed one on others.
 */

const COLLAPSED_ITEM_COUNT = 3;

export interface RewardDetailsItem {
  title: string;
}

export function RewardDetails({
  description,
  items,
  descriptionClassName = "text-sm text-muted-foreground",
  clampLines = 3,
}: {
  description?: string | null;
  items?: RewardDetailsItem[];
  descriptionClassName?: string;
  clampLines?: 1 | 2 | 3;
}) {
  const [expanded, setExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  const list = items ?? [];
  const hiddenItemCount = Math.max(0, list.length - COLLAPSED_ITEM_COUNT);

  const measure = useCallback(() => {
    const el = descriptionRef.current;
    if (!el) return;
    // Only meaningful while collapsed — expanded, the clamp is off and
    // scrollHeight always equals clientHeight.
    if (expanded) return;
    setDescriptionOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [expanded]);

  useEffect(() => {
    measure();
    if (!descriptionRef.current) return;
    // Card width changes with the viewport, and so does whether the text
    // clamps. Without this the toggle is right on first paint and wrong after
    // a resize or an orientation change.
    const observer = new ResizeObserver(measure);
    observer.observe(descriptionRef.current);
    return () => observer.disconnect();
  }, [measure, description]);

  const canExpand = descriptionOverflows || hiddenItemCount > 0;
  const clamp = clampLines === 1 ? "line-clamp-1" : clampLines === 2 ? "line-clamp-2" : "line-clamp-3";
  const visibleItems = expanded ? list : list.slice(0, COLLAPSED_ITEM_COUNT);

  return (
    <>
      {description && (
        <p
          ref={descriptionRef}
          className={`${descriptionClassName} ${expanded ? "whitespace-pre-line" : clamp}`}
        >
          {description}
        </p>
      )}

      {list.length > 0 && (
        <div className="space-y-1">
          {visibleItems.map((item, index) => (
            <div key={index} className="flex items-start gap-1.5 text-xs">
              <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-[#05ce78]" />
              <span className="min-w-0">{item.title}</span>
            </div>
          ))}
          {!expanded && hiddenItemCount > 0 && (
            <p className="pl-[18px] text-xs text-muted-foreground">
              +{hiddenItemCount} more
            </p>
          )}
        </div>
      )}

      {canExpand && (
        <button
          type="button"
          // The card is wrapped in a link to the pledge flow, so a bare click
          // would navigate away instead of expanding.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </>
  );
}
