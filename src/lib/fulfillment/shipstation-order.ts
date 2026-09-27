// Pure ShipStation V1 helpers: no database, no framework, no imports.
//
// Kept dependency-free on purpose so scripts/shipstation-harness.mjs can load
// this exact code under Node and run it against scripts/shipstation-mock.mjs.
// Everything that decides WHAT we send to ShipStation lives here; the push and
// tracking libraries only add the database reads around it.

/** API base. Overridable so the harness can point the real code at the mock. */
export const SHIPSTATION_API_BASE = (
  process.env.SHIPSTATION_API_BASE || "https://ssapi.shipstation.com"
).replace(/\/+$/, "");

// ── Country / state normalisation ──────────────────────────────────────────
//
// ShipStation requires ISO-3166 alpha-2 country codes and 2-letter US/CA
// state/province codes. Addresses reach us from three flows (checkout,
// survey, order lock), two of them free text, so "United States" / "usa" /
// "Texas" all show up. Sent raw, every one of those orders is a 400.

const COUNTRY_ALIASES: Record<string, string> = {
  "UNITED STATES": "US", "UNITED STATES OF AMERICA": "US", USA: "US", "U.S.": "US",
  "U.S.A.": "US", "U.S.A": "US", AMERICA: "US", "UNITED STATES (US)": "US",
  CANADA: "CA", CAN: "CA",
  "UNITED KINGDOM": "GB", UK: "GB", GBR: "GB", "GREAT BRITAIN": "GB", ENGLAND: "GB",
  SCOTLAND: "GB", WALES: "GB", "NORTHERN IRELAND": "GB", BRITAIN: "GB",
  AUSTRALIA: "AU", AUS: "AU", "NEW ZEALAND": "NZ", NZL: "NZ",
  GERMANY: "DE", DEU: "DE", DEUTSCHLAND: "DE", FRANCE: "FR", FRA: "FR", ITALY: "IT", ITA: "IT",
  SPAIN: "ES", ESP: "ES", PORTUGAL: "PT", NETHERLANDS: "NL", "THE NETHERLANDS": "NL", HOLLAND: "NL",
  BELGIUM: "BE", SWEDEN: "SE", NORWAY: "NO", DENMARK: "DK", FINLAND: "FI", IRELAND: "IE",
  SWITZERLAND: "CH", AUSTRIA: "AT", POLAND: "PL", "CZECH REPUBLIC": "CZ", CZECHIA: "CZ",
  GREECE: "GR", HUNGARY: "HU", ROMANIA: "RO", JAPAN: "JP", JPN: "JP", "SOUTH KOREA": "KR",
  KOREA: "KR", "REPUBLIC OF KOREA": "KR", CHINA: "CN", TAIWAN: "TW", "HONG KONG": "HK",
  SINGAPORE: "SG", PHILIPPINES: "PH", INDIA: "IN", MEXICO: "MX", MEX: "MX", BRAZIL: "BR",
  BRA: "BR", ARGENTINA: "AR", CHILE: "CL", COLOMBIA: "CO", "SOUTH AFRICA": "ZA",
  ISRAEL: "IL", "UNITED ARAB EMIRATES": "AE", UAE: "AE", TURKEY: "TR", TÜRKIYE: "TR",
};

const US_STATES: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO",
  CONNECTICUT: "CT", DELAWARE: "DE", "DISTRICT OF COLUMBIA": "DC", "WASHINGTON DC": "DC",
  "WASHINGTON D.C.": "DC", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL",
  INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME",
  MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
  MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH",
  "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA",
  "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX",
  UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV",
  WISCONSIN: "WI", WYOMING: "WY", "PUERTO RICO": "PR", GUAM: "GU", "U.S. VIRGIN ISLANDS": "VI",
  "AMERICAN SAMOA": "AS", "NORTHERN MARIANA ISLANDS": "MP",
};

const CA_PROVINCES: Record<string, string> = {
  ALBERTA: "AB", "BRITISH COLUMBIA": "BC", MANITOBA: "MB", "NEW BRUNSWICK": "NB",
  "NEWFOUNDLAND AND LABRADOR": "NL", NEWFOUNDLAND: "NL", "NOVA SCOTIA": "NS", ONTARIO: "ON",
  "PRINCE EDWARD ISLAND": "PE", QUEBEC: "QC", QUÉBEC: "QC", SASKATCHEWAN: "SK",
  "NORTHWEST TERRITORIES": "NT", NUNAVUT: "NU", YUKON: "YT",
};

/** ISO-2 country code for any of the spellings we store, or null if unknown. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  const v = (raw || "").trim().toUpperCase();
  if (!v) return null;
  // Aliases first: "UK" is two letters but not an ISO code (GB is).
  const alias = COUNTRY_ALIASES[v];
  if (alias) return alias;
  // "WW" is this platform's "worldwide" pseudo-code, never a real country.
  if (/^[A-Z]{2}$/.test(v)) return v === "WW" ? null : v;
  return null;
}

/** 2-letter US state / CA province code where we can determine one; else the trimmed input. */
export function normalizeStateCode(country: string | null, raw: string | null | undefined): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const upper = v.toUpperCase().replace(/\s+/g, " ");
  if (country === "US") {
    if (/^[A-Z]{2}$/.test(upper)) return upper;
    return US_STATES[upper] ?? v;
  }
  if (country === "CA") {
    if (/^[A-Z]{2}$/.test(upper)) return upper;
    return CA_PROVINCES[upper] ?? v;
  }
  return v;
}

// ── Order building ─────────────────────────────────────────────────────────

export interface ShipStationAddressInput {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

/** Weight + customs data saved on the Products tab, keyed by generated SKU. */
export interface ShipStationProductInfo {
  weightOz: number | null;
  customsCode: string | null;
  customsDescription: string | null;
  countryOfOrigin: string | null;
  declaredValue: number | null;
}

export interface ShipStationOrderInput {
  pledgeId: string;
  backerNumber: number | null;
  createdAt: Date | string;
  amount: number;
  email: string | null;
  backerName: string | null;
  address: ShipStationAddressInput | null;
  reward: { id: string; title: string; amount: number } | null;
  addons: Array<{ id: string; title: string; amount: number; quantity: number }>;
  products: Map<string, ShipStationProductInfo>;
  projectTitle: string;
  storeId: number | null;
}

export type ShipStationOrderBuild =
  | { ok: true; order: Record<string, unknown>; orderNumber: string; weightOz: number }
  | { ok: false; error: string };

export function rewardSku(rewardId: string): string {
  return `REWARD-${rewardId}`;
}
export function addonSku(addonId: string): string {
  return `ADDON-${addonId}`;
}

/**
 * Build the createorder payload for one pledge, or say precisely why it can't
 * be built. Every rule ShipStation enforces that we can check ourselves is
 * checked here so the creator gets "Backer #12: country 'Narnia' isn't a
 * valid country" instead of ShipStation's "The request is invalid.".
 */
export function buildShipStationOrder(input: ShipStationOrderInput): ShipStationOrderBuild {
  const a = input.address;
  if (!a || (!a.line1 && !a.city && !a.postalCode)) {
    return { ok: false, error: "No shipping address" };
  }
  const country = normalizeCountryCode(a.country);
  if (!country) {
    return {
      ok: false,
      error: `Country "${a.country || "(blank)"}" isn't a recognised country — fix the backer's address`,
    };
  }
  const state = normalizeStateCode(country, a.state);
  if (country === "US" && !/^[A-Z]{2}$/.test(state)) {
    return { ok: false, error: `State "${a.state || "(blank)"}" isn't a valid US state — fix the backer's address` };
  }
  const missing: string[] = [];
  if (!a.line1) missing.push("street");
  if (!a.city) missing.push("city");
  if (!a.postalCode) missing.push("postal code");
  if (missing.length) return { ok: false, error: `Address is missing ${missing.join(", ")}` };

  const name = (a.name || input.backerName || "").trim() || "Backer";
  const shipTo: Record<string, unknown> = {
    name,
    street1: a.line1,
    street2: a.line2 || "",
    city: a.city,
    state,
    postalCode: a.postalCode,
    country,
    ...(a.phone ? { phone: a.phone } : {}),
  };

  const items: Array<Record<string, unknown>> = [];
  const customsItems: Array<Record<string, unknown>> = [];
  let totalWeightOz = 0;

  const pushItem = (sku: string, title: string, quantity: number, unitPrice: number) => {
    const p = input.products.get(sku);
    const item: Record<string, unknown> = {
      lineItemKey: sku.toLowerCase(),
      sku,
      name: title,
      quantity,
      unitPrice,
    };
    if (p?.weightOz && p.weightOz > 0) {
      item.weight = { value: Math.round(p.weightOz * 100) / 100, units: "ounces" };
      totalWeightOz += p.weightOz * quantity;
    }
    items.push(item);
    if (country !== "US") {
      customsItems.push({
        description: (p?.customsDescription || title).slice(0, 200),
        quantity,
        value: p?.declaredValue != null && p.declaredValue > 0 ? p.declaredValue : unitPrice,
        ...(p?.customsCode ? { harmonizedTariffCode: p.customsCode } : {}),
        countryOfOrigin: normalizeCountryCode(p?.countryOfOrigin) || "US",
      });
    }
  };

  if (input.reward) pushItem(rewardSku(input.reward.id), input.reward.title, 1, input.reward.amount);
  for (const ad of input.addons) pushItem(addonSku(ad.id), ad.title, Math.max(1, ad.quantity), ad.amount);

  // Backer number is what the creator sees everywhere in IndieKit, so it's
  // what they search for in ShipStation. The cuid's first 8 characters were
  // a timestamp prefix shared by every pledge created in the same ~36 ms.
  const orderNumber = input.backerNumber
    ? `ICF-${input.backerNumber}`
    : `ICF-${input.pledgeId.slice(-8).toUpperCase()}`;

  const createdAt = typeof input.createdAt === "string" ? input.createdAt : input.createdAt.toISOString();

  const order: Record<string, unknown> = {
    orderNumber,
    // createorder is an upsert keyed on orderKey — re-pushing a backer updates
    // the same ShipStation order instead of creating a duplicate to pick twice.
    orderKey: `icf-${input.pledgeId}`,
    orderDate: createdAt,
    orderStatus: "awaiting_shipment",
    ...(input.email ? { customerEmail: input.email } : {}),
    billTo: shipTo,
    shipTo,
    items,
    amountPaid: input.amount,
    ...(totalWeightOz > 0
      ? { weight: { value: Math.round(totalWeightOz * 100) / 100, units: "ounces" } }
      : {}),
    ...(country !== "US" && customsItems.length > 0
      ? {
          customsItems,
          internationalOptions: { contents: "merchandise", nonDelivery: "return_to_sender" },
        }
      : {}),
    internalNotes: `IndieCrowdfund · ${input.projectTitle} · ${orderNumber}`,
    // Omitted entirely when unset so ShipStation uses the account default
    // rather than receiving a null and rejecting the order.
    ...(input.storeId ? { advancedOptions: { storeId: input.storeId } } : {}),
  };

  return { ok: true, order, orderNumber, weightOz: totalWeightOz };
}

// ── Error surfacing ────────────────────────────────────────────────────────

/**
 * The human-readable reason from a ShipStation error body. V1 puts the
 * generic "The request is invalid." in Message and the actual problem in
 * ExceptionMessage or ModelState ({"order.shipTo.country": ["..."]}).
 */
export function parseShipStationError(body: unknown, status: number): string {
  // Whatever the body says, a 401/403 means one thing to the creator.
  if (status === 401 || status === 403) {
    return "ShipStation rejected the API credentials (reconnect under Settings → Integrations)";
  }
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const parts: string[] = [];
    if (b.ModelState && typeof b.ModelState === "object") {
      for (const [field, msgs] of Object.entries(b.ModelState as Record<string, unknown>)) {
        const list = Array.isArray(msgs) ? msgs : [msgs];
        parts.push(`${field}: ${list.map(String).join("; ")}`);
      }
    }
    if (typeof b.ExceptionMessage === "string" && b.ExceptionMessage) parts.push(b.ExceptionMessage);
    if (parts.length === 0 && typeof b.Message === "string" && b.Message) parts.push(b.Message);
    if (parts.length > 0) return parts.join(" — ");
  }
  if (status === 429) return "ShipStation rate limit hit — try again in a minute";
  return `ShipStation returned HTTP ${status}`;
}

/** Convert a Products-tab weight to ounces. */
export function toOunces(weight: number | null | undefined, unit: string | null | undefined): number | null {
  if (weight == null || !(weight > 0)) return null;
  switch ((unit || "oz").toLowerCase()) {
    case "lb":
    case "lbs":
    case "pounds":
      return weight * 16;
    case "g":
    case "grams":
      return weight / 28.3495;
    case "kg":
      return weight * 35.274;
    default:
      return weight;
  }
}
