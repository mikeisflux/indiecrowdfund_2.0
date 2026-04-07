"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  showValue = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const display = hovered ?? value ?? 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(null)}
          className={cn(
            "transition-transform focus:outline-none",
            !readonly && "hover:scale-110 cursor-pointer",
            readonly && "cursor-default"
          )}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
        >
          <svg
            className={cn(sizeClasses[size], "transition-colors duration-100")}
            viewBox="0 0 24 24"
            fill={star <= display ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
              className={cn(
                star <= display
                  ? "text-amber-400"
                  : "text-muted-foreground/30"
              )}
            />
          </svg>
        </button>
      ))}
      {showValue && value !== null && (
        <span className="ml-1 text-sm font-medium text-amber-500">{value}.0</span>
      )}
    </div>
  );
}

// Display-only aggregate rating with decimal support
export function AggregateRating({
  value,
  count,
  size = "md",
}: {
  value: number | null;
  count: number;
  size?: "sm" | "md" | "lg";
}) {
  if (!value || count === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.min(1, Math.max(0, value - (star - 1)));
          return (
            <span key={star} className="relative inline-block">
              {/* Background (empty) star */}
              <svg
                className={cn(sizeClasses[size], "text-muted-foreground/20")}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              {/* Filled star overlay clipped to fill% */}
              {fill > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <svg
                    className={cn(sizeClasses[size], "text-amber-400")}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                  </svg>
                </span>
              )}
            </span>
          );
        })}
      </div>
      <span className="font-semibold text-amber-500 text-sm">{value}</span>
      <span className="text-muted-foreground text-xs">({count.toLocaleString()})</span>
    </div>
  );
}
