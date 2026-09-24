"use client";

import { useEffect } from "react";
import { getConsentPreferences } from "@/lib/consent";

/**
 * Injects a CREATOR's own analytics on their public project page.
 *
 * The campaign builder has collected Google Analytics and Meta Pixel
 * IDs per project for as long as the Promotion step has existed — and
 * nothing ever loaded them, so creators pasted IDs into a black hole.
 * This component makes those fields real: it fires the creator's GA4
 * page_view and Meta Pixel PageView on the project page, gated on the
 * same marketing/analytics consent the platform's own tracking uses.
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_ID_RE = /^G-[A-Z0-9]{4,20}$/i;
const PIXEL_ID_RE = /^\d{5,20}$/;

export function CreatorAnalytics({
  googleAnalyticsId,
  metaPixelId,
}: {
  googleAnalyticsId?: string | null;
  metaPixelId?: string | null;
}) {
  useEffect(() => {
    const consent = getConsentPreferences();
    if (!consent.analytics && !consent.marketing) return;

    // Creator GA4 (analytics consent). Loads gtag if the platform
    // hasn't already, then configures the creator's property.
    const gaId = googleAnalyticsId?.trim();
    if (consent.analytics && gaId && GA_ID_RE.test(gaId)) {
      if (!window.gtag) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = (...args: unknown[]) => {
          window.dataLayer!.push(args);
        };
        window.gtag("js", new Date());
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(s);
      }
      window.gtag("config", gaId, { anonymize_ip: true });
    }

    // Creator Meta Pixel (marketing consent).
    const pixelId = metaPixelId?.trim();
    if (consent.marketing && pixelId && PIXEL_ID_RE.test(pixelId)) {
      if (!window.fbq) {
        const fbq = ((...args: unknown[]) => {
          fbq.queue!.push(args);
        }) as NonNullable<Window["fbq"]>;
        fbq.queue = [];
        fbq.loaded = true;
        window.fbq = fbq;
        window._fbq = fbq;
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(s);
      }
      window.fbq("init", pixelId);
      window.fbq("track", "PageView");
    }
    // IDs are stable per project page load; re-running on consent
    // changes would need a reload anyway (script side effects).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
