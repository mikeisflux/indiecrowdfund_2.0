// Display-time currency conversion for campaign totals.
//
// Source of truth for "where is this campaign based" is the
// Project.location free-text field captured at project creation
// (e.g. "Doncaster, England", "Brooklyn, NY", "Tokyo, Japan").
// We parse the trailing country / state token at render time to
// derive a currency, then fetch a USD-to-X exchange rate from the
// European Central Bank via Frankfurter (zero auth, zero rate
// limits, daily ECB updates).
//
// Storage stays USD: pledges keep getting summed into
// Project.currentAmount as the cents the processor charged
// (effectively USD for all current campaigns). Display computes
// the local-currency amount on the fly and shows USD below.
//
// 24-hour rate cache lives in the existing PlatformSettings JSON
// blob, so no new table or migration. Falls back to a stale
// cached rate if Frankfurter is briefly unreachable.

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "currency" });

// ISO-4217 currency code by country. Only countries we have or
// expect to have campaigns from. Anything not on this list falls
// through to USD.
const COUNTRY_TO_CURRENCY: Record<string, { currency: string; symbol: string }> = {
  US: { currency: "USD", symbol: "$" },
  CA: { currency: "CAD", symbol: "CA$" },
  GB: { currency: "GBP", symbol: "£" },
  IE: { currency: "EUR", symbol: "€" },
  IT: { currency: "EUR", symbol: "€" },
  FR: { currency: "EUR", symbol: "€" },
  DE: { currency: "EUR", symbol: "€" },
  ES: { currency: "EUR", symbol: "€" },
  PT: { currency: "EUR", symbol: "€" },
  NL: { currency: "EUR", symbol: "€" },
  BE: { currency: "EUR", symbol: "€" },
  AT: { currency: "EUR", symbol: "€" },
  FI: { currency: "EUR", symbol: "€" },
  GR: { currency: "EUR", symbol: "€" },
  JP: { currency: "JPY", symbol: "¥" },
  AU: { currency: "AUD", symbol: "AU$" },
  NZ: { currency: "NZD", symbol: "NZ$" },
  MX: { currency: "MXN", symbol: "MX$" },
  BR: { currency: "BRL", symbol: "R$" },
  IN: { currency: "INR", symbol: "₹" },
  CN: { currency: "CNY", symbol: "¥" },
  KR: { currency: "KRW", symbol: "₩" },
  SG: { currency: "SGD", symbol: "S$" },
  HK: { currency: "HKD", symbol: "HK$" },
  CH: { currency: "CHF", symbol: "CHF" },
  SE: { currency: "SEK", symbol: "kr" },
  NO: { currency: "NOK", symbol: "kr" },
  DK: { currency: "DKK", symbol: "kr" },
  PL: { currency: "PLN", symbol: "zł" },
};

// Lowercase tokens that uniquely identify each country in the
// trailing portion of Project.location. Matched against the
// last comma-separated segment of the location string (case-
// insensitive, whole-word). US state names go here too because
// US creators almost always write "Brooklyn, NY" not "Brooklyn,
// NY, USA".
const LOCATION_TOKENS: Record<string, string[]> = {
  US: [
    "united states", "usa", "u.s.a.", "u.s.", "us",
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
    "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
    "rhode island", "south carolina", "south dakota", "tennessee", "texas",
    "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming", "d.c.", "dc", "district of columbia",
    "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id",
    "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms",
    "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok",
    "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv",
    "wi", "wy",
  ],
  GB: [
    "united kingdom", "uk", "u.k.", "great britain", "britain",
    "england", "scotland", "wales", "northern ireland",
  ],
  IE: ["ireland", "republic of ireland"],
  IT: ["italy", "italia"],
  FR: ["france"],
  DE: ["germany", "deutschland"],
  ES: ["spain", "españa", "espana"],
  PT: ["portugal"],
  NL: ["netherlands", "the netherlands", "holland"],
  BE: ["belgium", "belgique", "belgië"],
  AT: ["austria", "österreich", "osterreich"],
  FI: ["finland", "suomi"],
  GR: ["greece"],
  JP: ["japan", "nihon", "nippon"],
  AU: ["australia"],
  NZ: ["new zealand"],
  CA: [
    "canada",
    "ontario", "quebec", "british columbia", "alberta", "manitoba",
    "saskatchewan", "nova scotia", "new brunswick", "newfoundland",
    "prince edward island",
  ],
  MX: ["mexico", "méxico"],
  BR: ["brazil", "brasil"],
  IN: ["india"],
  CN: ["china"],
  KR: ["south korea", "korea, south", "republic of korea"],
  SG: ["singapore"],
  HK: ["hong kong"],
  CH: ["switzerland", "schweiz", "suisse"],
  SE: ["sweden", "sverige"],
  NO: ["norway", "norge"],
  DK: ["denmark", "danmark"],
  PL: ["poland", "polska"],
};

/**
 * Parse the country from a Project.location string. Looks at the
 * trailing comma-separated segment first ("Tokyo, Japan" → JP),
 * then falls back to scanning the whole string for any known
 * token. Returns null when nothing matches so the caller can
 * decide a default (which for our needs is always US/USD).
 */
export function parseCountryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const segments = location.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (segments.length === 0) return null;

  // Try the last segment first (most reliable — "City, Country" pattern).
  const last = segments[segments.length - 1];
  for (const [cc, tokens] of Object.entries(LOCATION_TOKENS)) {
    if (tokens.includes(last)) return cc;
  }

  // Fall back: scan every segment. Necessary for entries like
  // "Brooklyn, NY" where the last segment is a state code.
  for (const segment of segments) {
    for (const [cc, tokens] of Object.entries(LOCATION_TOKENS)) {
      if (tokens.includes(segment)) return cc;
    }
  }

  // Last resort: any token appearing anywhere in the raw string
  // (handles odd inputs like "based in london, uk and remote").
  const lower = location.toLowerCase();
  for (const [cc, tokens] of Object.entries(LOCATION_TOKENS)) {
    for (const token of tokens) {
      // Only multi-character country tokens here — single-letter
      // state codes ("al", "ar") would false-positive against
      // unrelated substrings.
      if (token.length >= 4 && lower.includes(token)) return cc;
    }
  }

  return null;
}

/**
 * Currency info for a given location string. Falls back to USD when
 * the location is empty / unparseable.
 */
export function currencyForLocation(location: string | null | undefined): {
  country: string;
  currency: string;
  symbol: string;
} {
  const country = parseCountryFromLocation(location);
  const entry = country ? COUNTRY_TO_CURRENCY[country] : null;
  if (country && entry) return { country, currency: entry.currency, symbol: entry.symbol };
  return { country: "US", currency: "USD", symbol: "$" };
}

// ============================================================
// Exchange rates — Frankfurter (api.frankfurter.app)
// ============================================================
//
// Frankfurter is a free no-auth wrapper over the ECB's official
// daily reference rates. Updated ~16:00 CET on every TARGET
// business day. We cache USD→X for each target currency for 24h
// in PlatformSettings.fxRatesUsd JSON so we hit the network at
// most once per day per currency.

interface FxRateCache {
  // ISO currency code -> { rate (per 1 USD), fetchedAt ISO }
  [currency: string]: { rate: number; fetchedAt: string };
}

const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FX_FETCH_TIMEOUT_MS = 5000;

async function readCache(): Promise<FxRateCache> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { fxRatesUsd: true },
    });
    const raw = settings?.fxRatesUsd as unknown;
    if (raw && typeof raw === "object") return raw as FxRateCache;
  } catch (err) {
    log.warn({ err: String(err) }, "[currency] readCache failed; treating as empty");
  }
  return {};
}

async function writeCache(cache: FxRateCache): Promise<void> {
  try {
    await db.platformSettings.upsert({
      where: { id: "default" },
      update: { fxRatesUsd: cache as unknown as object },
      create: { id: "default", fxRatesUsd: cache as unknown as object },
    });
  } catch (err) {
    log.warn({ err: String(err) }, "[currency] writeCache failed; rate will refetch next call");
  }
}

async function fetchFromFrankfurter(currency: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FX_FETCH_TIMEOUT_MS);
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(currency)}`,
      { signal: controller.signal }
    ).finally(() => clearTimeout(timeout));
    if (!res.ok) {
      log.warn({ status: res.status, currency }, "[currency] Frankfurter non-2xx");
      return null;
    }
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[currency];
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch (err) {
    log.warn({ err: String(err), currency }, "[currency] Frankfurter fetch failed");
    return null;
  }
}

/**
 * USD → target currency multiplier (multiply USD amount by this to
 * get the target-currency amount). Uses a 24h cache; on cache miss
 * fetches Frankfurter; on Frankfurter failure returns the most-
 * recent cached rate even if stale; returns null if we have
 * nothing at all.
 *
 * USD → USD always returns 1 without touching the cache or network.
 */
export async function getUsdRateTo(currency: string): Promise<number | null> {
  if (currency === "USD") return 1;

  const cache = await readCache();
  const entry = cache[currency];
  const now = Date.now();

  if (entry && now - new Date(entry.fetchedAt).getTime() < FX_CACHE_TTL_MS) {
    return entry.rate;
  }

  const fresh = await fetchFromFrankfurter(currency);
  if (fresh != null) {
    cache[currency] = { rate: fresh, fetchedAt: new Date().toISOString() };
    await writeCache(cache);
    return fresh;
  }

  // Frankfurter unreachable — fall back to whatever stale value
  // we have rather than crashing the page.
  return entry?.rate ?? null;
}

// ============================================================
// Formatting
// ============================================================

/**
 * Format an amount in the given currency using the browser /
 * server's Intl support. Strips fraction digits for currencies
 * that don't use sub-units (JPY, KRW). Falls back to a basic
 * "{symbol}{amount}" if Intl rejects the currency.
 */
export function formatInCurrency(amount: number, currency: string): string {
  const minFraction = currency === "JPY" || currency === "KRW" ? 0 : 0;
  const maxFraction = currency === "JPY" || currency === "KRW" ? 0 : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: minFraction,
      maximumFractionDigits: maxFraction,
    }).format(amount);
  } catch {
    // Unknown ISO code — render with our local symbol table.
    const symbol = Object.values(COUNTRY_TO_CURRENCY).find((c) => c.currency === currency)?.symbol || "";
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }
}

export interface CampaignDisplay {
  currency: string;
  symbol: string;
  primaryFormatted: string;
  usdFormatted: string;
  showUsdSecondary: boolean;
}

function buildDisplay(usdAmount: number, currency: string, symbol: string, rate: number | null): CampaignDisplay {
  const usdFormatted = formatInCurrency(usdAmount, "USD");
  if (currency === "USD") {
    return { currency, symbol, primaryFormatted: usdFormatted, usdFormatted, showUsdSecondary: false };
  }
  if (rate == null) {
    // No rate available — show USD only rather than make up a
    // number. Logged in getUsdRateTo / batchGetUsdRates when this
    // happens.
    return { currency: "USD", symbol: "$", primaryFormatted: usdFormatted, usdFormatted, showUsdSecondary: false };
  }
  return {
    currency,
    symbol,
    primaryFormatted: formatInCurrency(usdAmount * rate, currency),
    usdFormatted,
    showUsdSecondary: true,
  };
}

/**
 * Convenience server-side resolver: given a Project location +
 * a USD amount, return the data needed by the display component
 * (target currency, the converted amount, formatted strings,
 * whether to show the USD-below row).
 *
 * For list pages rendering many projects, prefer
 * batchResolveCampaignDisplays — single-call variant does one
 * fxRatesUsd cache read per call.
 */
export async function resolveCampaignDisplay(
  location: string | null | undefined,
  usdAmount: number
): Promise<CampaignDisplay> {
  const { currency, symbol } = currencyForLocation(location);
  const rate = currency === "USD" ? 1 : await getUsdRateTo(currency);
  return buildDisplay(usdAmount, currency, symbol, rate);
}

/**
 * Batch version for list pages. Reads the fxRatesUsd cache once,
 * fetches each unique missing currency in parallel, then formats
 * every item synchronously. For a 20-project discover page this
 * is ~1 DB read + at most a few Frankfurter calls (most are
 * already cached after the first non-USD render), instead of 20
 * cache reads.
 *
 * Inputs are { location, usdAmount } pairs; output preserves the
 * input order so callers can `inputs[i] -> outputs[i]`.
 */
export async function batchResolveCampaignDisplays(
  inputs: Array<{ location: string | null | undefined; usdAmount: number }>
): Promise<CampaignDisplay[]> {
  if (inputs.length === 0) return [];

  // Resolve currency per input first (cheap, no IO).
  const resolved = inputs.map((i) => ({
    usdAmount: i.usdAmount,
    ...currencyForLocation(i.location),
  }));

  const neededCurrencies = Array.from(
    new Set(resolved.map((r) => r.currency).filter((c) => c !== "USD"))
  );

  if (neededCurrencies.length === 0) {
    return resolved.map((r) => buildDisplay(r.usdAmount, r.currency, r.symbol, 1));
  }

  const cache = await readCache();
  const now = Date.now();
  const rates: Record<string, number | null> = { USD: 1 };
  const toFetch: string[] = [];

  for (const cur of neededCurrencies) {
    const entry = cache[cur];
    if (entry && now - new Date(entry.fetchedAt).getTime() < FX_CACHE_TTL_MS) {
      rates[cur] = entry.rate;
    } else {
      toFetch.push(cur);
    }
  }

  if (toFetch.length > 0) {
    const fetched = await Promise.all(
      toFetch.map(async (cur) => ({ cur, rate: await fetchFromFrankfurter(cur) }))
    );
    let cacheChanged = false;
    for (const { cur, rate } of fetched) {
      if (rate != null) {
        rates[cur] = rate;
        cache[cur] = { rate, fetchedAt: new Date().toISOString() };
        cacheChanged = true;
      } else {
        // Fall back to stale cache for this currency if any.
        rates[cur] = cache[cur]?.rate ?? null;
      }
    }
    if (cacheChanged) {
      await writeCache(cache);
    }
  }

  return resolved.map((r) => buildDisplay(r.usdAmount, r.currency, r.symbol, rates[r.currency] ?? null));
}
