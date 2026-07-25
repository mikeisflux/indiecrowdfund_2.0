"use client";

import { useState, Children } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

interface ShowMoreGridProps {
  children: React.ReactNode;
  /** Cards visible on mobile before tapping "Show more". Desktop always shows all. */
  initialMobileCount?: number;
  className?: string;
  label?: string;
}

// Homepage project sections render every card in a single column on mobile,
// which made the page so tall that the sections further down (prelaunch,
// past projects) were effectively unreachable. Cap the initial mobile render
// and reveal the rest behind a "Show more" tap; >= sm screens are unaffected.
export function ShowMoreGrid({
  children,
  initialMobileCount = 4,
  className,
  label = "Show more projects",
}: ShowMoreGridProps) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const hiddenCount = items.length - initialMobileCount;

  return (
    <>
      <div className={className}>
        {items.map((child, i) => (
          <div
            key={i}
            className={!expanded && i >= initialMobileCount ? "hidden sm:block" : undefined}
          >
            {child}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && !expanded && (
        <div className="mt-4 sm:hidden">
          <Button
            variant="outline"
            className="w-full glass-card border-border/50"
            onClick={() => setExpanded(true)}
          >
            {label} ({hiddenCount})
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
