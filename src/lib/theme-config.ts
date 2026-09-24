import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Admin theme overrides (/admin/themes) — the consumption side.
 *
 * The Themes & Styling page spent its life sending a payload the
 * settings API rejected, into columns nothing read. Now the page saves
 * one JSON blob (PlatformSettings.themeConfig) holding ONLY values the
 * site genuinely consumes, and this module turns it into CSS custom
 * property overrides the root layout injects.
 *
 * Overrides are scoped to the LIGHT theme (`.light` / `:root`): the
 * admin picks light-mode brand colors; the dark palette stays the
 * designed dark theme. --radius applies to both. Same failure posture
 * as uiEffects/branding: anything wrong -> null -> site defaults.
 */

export interface ThemeConfig {
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    textMuted?: string;
    border?: string;
  };
  /** Corner radius in px, mapped to --radius. */
  borderRadius?: number;
  /** Default theme for first-time visitors. */
  defaultMode?: "light" | "dark" | "system";
  preset?: string | null;
}

let cached: { value: ThemeConfig | null; at: number } | null = null;
const TTL_MS = 60 * 1000;

export const getThemeConfig = cache(async (): Promise<ThemeConfig | null> => {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const settings = await db.platformSettings.findFirst({
      select: { themeConfig: true },
    });
    const raw = settings?.themeConfig;
    const value =
      raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as unknown as ThemeConfig) : null;
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return null;
  }
});

export function invalidateThemeConfig(): void {
  cached = null;
}

/** #rrggbb -> "H S% L%" (the space-separated triplet globals.css tokens use). */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const COLOR_TOKEN_MAP: Array<[keyof ThemeConfig["colors"], string]> = [
  ["primary", "--primary"],
  ["secondary", "--secondary"],
  ["accent", "--accent"],
  ["background", "--background"],
  ["text", "--foreground"],
  ["textMuted", "--muted-foreground"],
  ["border", "--border"],
];

/**
 * CSS text injected by the root layout. Empty string when there is
 * nothing to override.
 *
 * Scoped to `html.light` ONLY: globals.css is dark-first (bare :root
 * holds the DARK palette, `.light` overrides it), so a selector that
 * includes bare `:root` would repaint dark mode with the admin's light
 * colors. next-themes stamps the class before first paint, and
 * html.light (0,1,1) outranks globals' `.light` (0,1,0).
 */
export function buildThemeCssOverrides(theme: ThemeConfig | null): string {
  if (!theme) return "";
  const lightVars: string[] = [];
  for (const [key, token] of COLOR_TOKEN_MAP) {
    const hex = theme.colors?.[key];
    if (typeof hex !== "string") continue;
    const triplet = hexToHslTriplet(hex);
    if (triplet) lightVars.push(`${token}: ${triplet};`);
  }
  const parts: string[] = [];
  if (lightVars.length > 0) {
    parts.push(`html.light { ${lightVars.join(" ")} }`);
  }
  if (typeof theme.borderRadius === "number" && theme.borderRadius >= 0 && theme.borderRadius <= 32) {
    parts.push(`:root { --radius: ${theme.borderRadius}px; }`);
  }
  return parts.join("\n");
}
