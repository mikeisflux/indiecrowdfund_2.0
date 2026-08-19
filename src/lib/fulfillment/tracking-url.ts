/**
 * Turning a tracking number into something a backer can click.
 *
 * Three sources of truth, in descending order of trust:
 *
 *   1. A URL the carrier itself gave us. Shopify returns tracking_url on a
 *      fulfillment; nothing beats that, so it is stored and used verbatim.
 *   2. A carrier name the service told us — ShipStation's carrierCode,
 *      Shopify's tracking_company. Normalised to a known carrier and turned
 *      into that carrier's tracking URL.
 *   3. The shape of the number itself. Only reached for rows recorded before
 *      the carrier was being stored, and deliberately conservative: a wrong
 *      link is worse than a plain number, so anything ambiguous returns null
 *      and the number renders as text.
 */

export interface CarrierDefinition {
  key: string;
  label: string;
  /** Where {n} is the tracking number, already URL-encoded. */
  url: (n: string) => string;
}

const CARRIERS: CarrierDefinition[] = [
  { key: "ups", label: "UPS", url: (n) => `https://www.ups.com/track?loc=en_US&tracknum=${n}` },
  { key: "usps", label: "USPS", url: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` },
  { key: "fedex", label: "FedEx", url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
  { key: "dhl_express", label: "DHL Express", url: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}` },
  { key: "dhl_ecommerce", label: "DHL eCommerce", url: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}` },
  { key: "canada_post", label: "Canada Post", url: (n) => `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${n}` },
  { key: "royal_mail", label: "Royal Mail", url: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}` },
  { key: "australia_post", label: "Australia Post", url: (n) => `https://auspost.com.au/mypost/track/details/${n}` },
  { key: "evri", label: "Evri", url: (n) => `https://www.evri.com/track/parcel/${n}` },
  { key: "dpd", label: "DPD", url: (n) => `https://track.dpd.co.uk/search?reference=${n}` },
  { key: "gls", label: "GLS", url: (n) => `https://gls-group.com/track?match=${n}` },
  { key: "purolator", label: "Purolator", url: (n) => `https://www.purolator.com/en/shipping/tracker?pins=${n}` },
  { key: "ontrac", label: "OnTrac", url: (n) => `https://www.ontrac.com/tracking/?number=${n}` },
  { key: "sendle", label: "Sendle", url: (n) => `https://track.sendle.com/tracking?ref=${n}` },
  { key: "asendia", label: "Asendia", url: (n) => `https://tracking.asendia.com/tracking/${n}` },
  { key: "globalpost", label: "GlobalPost", url: (n) => `https://tracking.goglobalpost.com/${n}` },
];

const BY_KEY = new Map(CARRIERS.map((c) => [c.key, c]));

// Free text from two different services, mapped onto the list above.
// ShipStation sends codes like "stamps_com" and "dhl_global_mail"; Shopify
// sends display names like "DHL Express". Matching is on a squashed form so
// "DHL Express", "dhl_express" and "dhl-express" all land in one place.
const ALIASES: Record<string, string> = {
  ups: "ups",
  upsmailinnovations: "ups",
  usps: "usps",
  stampscom: "usps",
  endicia: "usps",
  uspsfirstclass: "usps",
  uspspriority: "usps",
  fedex: "fedex",
  fedexsmartpost: "fedex",
  fedexground: "fedex",
  dhlexpress: "dhl_express",
  dhl: "dhl_express",
  dhlecommerce: "dhl_ecommerce",
  dhlglobalmail: "dhl_ecommerce",
  canadapost: "canada_post",
  royalmail: "royal_mail",
  australiapost: "australia_post",
  auspost: "australia_post",
  evri: "evri",
  hermes: "evri",
  dpd: "dpd",
  gls: "gls",
  purolator: "purolator",
  ontrac: "ontrac",
  lasership: "ontrac",
  sendle: "sendle",
  asendia: "asendia",
  globalpost: "globalpost",
};

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeCarrier(raw: string | null | undefined): CarrierDefinition | null {
  if (!raw) return null;
  const squashed = squash(raw);
  const key = ALIASES[squashed] ?? (BY_KEY.has(squashed) ? squashed : null);
  return key ? BY_KEY.get(key) ?? null : null;
}

/**
 * Guess the carrier from the number's shape.
 *
 * Only the patterns that are genuinely distinctive. Bare 12-digit numbers are
 * FedEx *and* several others, so they are left unmatched rather than linked
 * somewhere that will show "not found" — a backer clicking through to a dead
 * page is worse than reading the number and searching it themselves.
 */
export function inferCarrier(trackingNumber: string): CarrierDefinition | null {
  const n = trackingNumber.replace(/\s+/g, "").toUpperCase();

  if (/^1Z[0-9A-Z]{16}$/.test(n)) return BY_KEY.get("ups") ?? null;
  // USPS IMpb: 20-22 digits, and the 9xxx families are unambiguous.
  if (/^(94|93|92|95|82)\d{18,20}$/.test(n)) return BY_KEY.get("usps") ?? null;
  if (/^[A-Z]{2}\d{9}US$/.test(n)) return BY_KEY.get("usps") ?? null;
  // Canada Post: 16 digits, or 2 letters + 9 digits + CA.
  if (/^[A-Z]{2}\d{9}CA$/.test(n)) return BY_KEY.get("canada_post") ?? null;
  if (/^[A-Z]{2}\d{9}GB$/.test(n)) return BY_KEY.get("royal_mail") ?? null;
  if (/^[A-Z]{2}\d{9}AU$/.test(n)) return BY_KEY.get("australia_post") ?? null;

  return null;
}

export interface ResolvedTracking {
  number: string;
  /** Display name, or null when the carrier could not be determined. */
  carrier: string | null;
  /** Clickable URL, or null when there is nothing safe to link to. */
  url: string | null;
}

export function resolveTracking(input: {
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackingUrl?: string | null;
}): ResolvedTracking | null {
  const number = input.trackingNumber?.trim();
  if (!number) return null;

  const carrier = normalizeCarrier(input.trackingCarrier) ?? inferCarrier(number);

  // A stored URL wins, but only if it is http(s) — this string reaches an
  // anchor's href, and a javascript: or data: URL there would be an
  // injection route straight from whatever the carrier API returned.
  let url: string | null = null;
  const stored = input.trackingUrl?.trim();
  if (stored && /^https?:\/\//i.test(stored)) {
    url = stored;
  } else if (carrier) {
    url = carrier.url(encodeURIComponent(number));
  }

  return {
    number,
    carrier: carrier?.label ?? (input.trackingCarrier?.trim() || null),
    url,
  };
}
