import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Admin-uploaded site branding (logo + favicon), consumed by the root
 * layout (favicon via generateMetadata, logo via SiteHeader). Same
 * shape as getUiEffects: React-cached per request, and ANY failure —
 * missing row, missing column mid-deploy, DB hiccup — falls back to
 * the built-in branding rather than breaking the page.
 */

export interface Branding {
  logoUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
  siteDescription: string | null;
}

const DEFAULTS: Branding = {
  logoUrl: null,
  faviconUrl: null,
  siteName: null,
  siteDescription: null,
};

// Module-level TTL cache on top of the per-request React cache: the
// root layout runs for every page view, and branding changes about
// never. invalidateBranding() drops it after an admin upload (same
// process only — other PM2 workers pick it up when the TTL lapses).
let cached: { value: Branding; at: number } | null = null;
const TTL_MS = 60 * 1000;

export const getBranding = cache(async (): Promise<Branding> => {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const settings = await db.platformSettings.findFirst({
      select: { logoUrl: true, faviconUrl: true, siteName: true, siteDescription: true },
    });
    const value: Branding = {
      logoUrl: settings?.logoUrl || null,
      faviconUrl: settings?.faviconUrl || null,
      siteName: settings?.siteName?.trim() || null,
      siteDescription: settings?.siteDescription?.trim() || null,
    };
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULTS;
  }
});

export function invalidateBranding(): void {
  cached = null;
}
