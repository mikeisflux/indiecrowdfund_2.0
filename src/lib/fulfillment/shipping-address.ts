// Canonical shipping-address handling for all fulfillment surfaces.
//
// A pledge's shipping address can be written by three different flows, each
// using a different JSON shape:
//   - Checkout       -> { name, address1, address2, city, state, zip, country, phone }
//   - Order Lock     -> { fullName/firstName/lastName, line1, line2, city, region, postalCode, country, phone }
//   - Survey submit  -> { name, line1, line2, city, state, postalCode, country, phone }
//
// Readers (carriers, exports, dashboards) historically expected exactly one of
// these shapes, so an address written by a different flow read as blank/missing.
// normalizeShippingAddress() coalesces all three into one canonical shape.

export interface NormalizedShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Coalesce any of the historical address shapes into the canonical shape.
// Returns null when there's no usable address (no street, city, or postal code).
export function normalizeShippingAddress(raw: unknown): NormalizedShippingAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const name =
    str(a.name) ||
    str(a.fullName) ||
    [str(a.firstName), str(a.lastName)].filter(Boolean).join(" ");
  const line1 = str(a.line1) || str(a.address1);
  const line2 = str(a.line2) || str(a.address2);
  const city = str(a.city);
  const state = str(a.state) || str(a.region) || str(a.province);
  const postalCode = str(a.postalCode) || str(a.zip);
  const country = str(a.country);
  const phone = str(a.phone);

  if (!line1 && !city && !postalCode) return null;

  return { name, line1, line2, city, state, postalCode, country, phone };
}

// Resolve the best shipping address for a pledge: prefer the survey response's
// address, fall back to the address stored on the pledge itself (Order Lock or
// checkout), then normalize. Returns null when neither is usable.
export function resolvePledgeShippingAddress(
  surveyAddress: unknown,
  pledgeAddress: unknown
): NormalizedShippingAddress | null {
  return normalizeShippingAddress(surveyAddress) ?? normalizeShippingAddress(pledgeAddress);
}
