"use client";

import { ExternalLink, Truck } from "lucide-react";
import { resolveTracking } from "@/lib/fulfillment/tracking-url";

/**
 * A backer's tracking number, as a link to the carrier when we can build one.
 *
 * Falls back to plain selectable text when the carrier is unknown. That is a
 * deliberate floor rather than a gap: linking a number to the wrong carrier
 * sends someone to a "not found" page, which is worse than showing them the
 * number to search themselves.
 */
export function TrackingLink({
  trackingNumber,
  trackingCarrier,
  trackingUrl,
  className = "",
  compact = false,
}: {
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
  className?: string;
  /** Inline single line, for dense lists. */
  compact?: boolean;
}) {
  const tracking = resolveTracking({ trackingNumber, trackingCarrier, trackingUrl });
  if (!tracking) return null;

  const label = tracking.carrier ? `${tracking.carrier} · ${tracking.number}` : tracking.number;

  if (!tracking.url) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}
      >
        <Truck className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono text-xs select-all break-all">{label}</span>
      </span>
    );
  }

  return (
    <a
      href={tracking.url}
      target="_blank"
      // noopener is the one that matters — without it the carrier's page gets
      // a handle on this window via window.opener.
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline ${className}`}
      title={`Track this shipment with ${tracking.carrier ?? "the carrier"} (opens in a new tab)`}
    >
      <Truck className="h-3.5 w-3.5 shrink-0" />
      <span className={compact ? "font-mono text-xs break-all" : "font-mono text-xs break-all"}>
        {label}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  );
}
