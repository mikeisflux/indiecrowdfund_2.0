// Theming for DivinityCoin's hosted checkout (iframe and redirect).
//
// The checkout is served from divinitycoin.com, so it cannot read our
// styles: we hand it our colours. DC accepts them two ways and we use
// both, as their partner doc asks:
//
//   1. Query params on the checkoutUrl (`bg`, `text`, `accent`, hex with
//      no `#`). These avoid a flash of DC's light theme before the iframe
//      is up, and they are the ONLY thing that survives the iOS
//      "Continue securely" handoff and our own full-page redirect.
//   2. A `theme` postMessage to the iframe, sent on every `ready` and again
//      whenever the visitor flips our light/dark toggle. Each message
//      replaces the previous theme and beats the query params.
//
// Colours are read off the live page (the CSS tokens in globals.css plus
// any admin overrides from /admin/themes) rather than hard-coded, so the
// checkout follows whatever the site actually looks like for this
// visitor. `bg` is the surface the checkout sits on: our card for the
// iframe, the page background for the redirect. Readability is enforced
// on DC's side (they substitute near-black/near-white under 4.5:1), so a
// bad token can never make the checkout unreadable.
//
// Pure module, safe for client bundles.

export interface CheckoutTheme {
  /** Hex without `#`, e.g. "1a1d24". */
  bg: string;
  /** Hex without `#`. */
  text: string;
  /** Hex without `#`: pay button, links, focus rings. */
  accent: string;
}

export type CheckoutSurface = "iframe" | "redirect";

export const DC_CHECKOUT_ORIGIN = "https://divinitycoin.com";
export const DC_CHECKOUT_NAMESPACE = "divinitycoin-checkout";

/** `"152 76% 42%"` (the space-separated HSL triplet our tokens use) -> `"1ab86a"`. */
export function hslTripletToHex(triplet: string): string | null {
  const m = /^\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(triplet);
  if (!m) return null;
  const h = (((parseFloat(m[1]) % 360) + 360) % 360) / 360;
  const s = Math.min(100, Math.max(0, parseFloat(m[2]))) / 100;
  const l = Math.min(100, Math.max(0, parseFloat(m[3]))) / 100;
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Accepts `#abc`, `#aabbcc`, `aabbcc`, `rgb(...)` or an HSL triplet; returns 6-digit hex without `#`. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].toLowerCase();
    return h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.min(255, parseInt(n, 10)).toString(16).padStart(2, "0"))
      .join("");
  }
  return hslTripletToHex(v.replace(/^hsla?\(|\)$/gi, ""));
}

/**
 * The site's current colours for a checkout, read from the live CSS
 * tokens. Returns null when the page is not available (SSR) or a token
 * is missing, in which case we send DC nothing and it renders its
 * default — never a half-theme.
 */
export function readSiteCheckoutTheme(surface: CheckoutSurface): CheckoutTheme | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const style = window.getComputedStyle(document.documentElement);
  const token = (name: string) => normalizeHex(style.getPropertyValue(name));

  const bg = surface === "iframe" ? token("--card") ?? token("--background") : token("--background");
  const text = surface === "iframe" ? token("--card-foreground") ?? token("--foreground") : token("--foreground");
  const accent = token("--primary");
  if (!bg || !text || !accent) return null;
  return { bg, text, accent };
}

/** Whether the page is currently in dark mode (next-themes stamps the class on <html>). */
export function siteIsDark(): boolean {
  if (typeof document === "undefined") return false;
  const cls = document.documentElement.classList;
  if (cls.contains("dark")) return true;
  if (cls.contains("light")) return false;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}

/**
 * Append theme params to a DC checkoutUrl. Any theme params already on
 * the URL are replaced; other params are kept. Joins with `&` when the
 * URL already has a query, as DC's doc requires.
 */
export function withCheckoutTheme(checkoutUrl: string, theme: CheckoutTheme | null): string {
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    return checkoutUrl;
  }
  for (const k of ["theme", "bg", "text", "accent"]) url.searchParams.delete(k);
  if (theme) {
    url.searchParams.set("bg", theme.bg);
    url.searchParams.set("text", theme.text);
    url.searchParams.set("accent", theme.accent);
  } else if (siteIsDark()) {
    // Couldn't read tokens — at least don't blind a dark-mode visitor.
    url.searchParams.set("theme", "dark");
  }
  return url.toString();
}

/** The runtime `theme` message for the iframe's contentWindow. */
export function checkoutThemeMessage(theme: CheckoutTheme | null) {
  if (theme) {
    return {
      namespace: DC_CHECKOUT_NAMESPACE,
      type: "theme" as const,
      bg: `#${theme.bg}`,
      text: `#${theme.text}`,
      accent: `#${theme.accent}`,
    };
  }
  return {
    namespace: DC_CHECKOUT_NAMESPACE,
    type: "theme" as const,
    theme: siteIsDark() ? ("dark" as const) : ("light" as const),
  };
}

export function sameCheckoutTheme(a: CheckoutTheme | null, b: CheckoutTheme | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.bg === b.bg && a.text === b.text && a.accent === b.accent;
}
