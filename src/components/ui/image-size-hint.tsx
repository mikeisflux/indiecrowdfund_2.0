"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ImageSpec } from "@/lib/image-specs";

/**
 * Size recommendation plus the where/crop tooltip, for upload controls that
 * are not the shared ImageUpload dropzone.
 *
 * The profile page rolls its own file inputs behind camera buttons, so it had
 * no slot for a recommendation and showed no size at all. Rather than convert
 * those controls — the overlay-button interaction is deliberate there — this
 * carries the same guidance from the same spec, so the two never drift.
 */
export function ImageSizeHint({
  spec,
  className = "",
  prefix = "Recommended:",
}: {
  spec: ImageSpec;
  className?: string;
  prefix?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
      {prefix} {spec.label}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${spec.where} ${spec.crop}`}
              className="inline-flex text-muted-foreground hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            <p className="mb-1">{spec.where}</p>
            <p className="text-muted-foreground">{spec.crop}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
