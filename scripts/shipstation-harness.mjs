#!/usr/bin/env node
// End-to-end exercise of the ShipStation integration's real code against
// scripts/shipstation-mock.mjs — no database, no ShipStation account.
//
//   node scripts/shipstation-mock.mjs &          # in another terminal
//   node scripts/shipstation-harness.mjs
//
// Loads src/lib/fulfillment/shipstation-order.ts (the dependency-free module
// that decides exactly what we send) via Node's native TypeScript stripping,
// builds orders for realistic pledges — including the messy addresses
// creators actually get — posts them to the mock with the same headers the
// app uses, simulates the warehouse shipping one, and pulls tracking back the
// way shipstation-tracking.ts does. Exits non-zero on any failed expectation.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE = process.env.SHIPSTATION_API_BASE || "http://127.0.0.1:4545";
const KEY = process.env.MOCK_KEY || "testkey";
const SECRET = process.env.MOCK_SECRET || "testsecret";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src", "lib", "fulfillment", "shipstation-order.ts");
// Copy to .mts so Node treats it as an ES module regardless of package type.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ss-harness-")), "shipstation-order.mts");
fs.copyFileSync(src, tmp);
process.env.SHIPSTATION_API_BASE = BASE;
const mod = await import(pathToFileURL(tmp).href);
const { buildShipStationOrder, parseShipStationError, normalizeCountryCode, normalizeStateCode } = mod;

const AUTH = `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString("base64")}`;
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}
async function api(pathname, init = {}) {
  const res = await fetch(`${BASE}${pathname}`, { ...init, headers: { Authorization: AUTH, "Content-Type": "application/json", ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  return { res, body };
}

await fetch(`${BASE}/__mock/reset`);

// ── 1. Normalisation ────────────────────────────────────────────────────────
check("country: 'United States' → US", normalizeCountryCode("United States") === "US");
check("country: 'usa' → US", normalizeCountryCode("usa") === "US");
check("country: 'UK' → GB", normalizeCountryCode("UK") === "GB");
check("country: 'WW' (worldwide pseudo-code) rejected", normalizeCountryCode("WW") === null);
check("country: gibberish rejected", normalizeCountryCode("Narnia") === null);
check("state: 'Texas' → TX", normalizeStateCode("US", "Texas") === "TX");
check("state: 'ontario' → ON", normalizeStateCode("CA", "ontario") === "ON");
check("state: non-US left alone", normalizeStateCode("GB", "Greater London") === "Greater London");

// ── 2. Order building ───────────────────────────────────────────────────────
const products = new Map([
  ["REWARD-r1", { weightOz: 6, customsCode: "490199", customsDescription: "Printed comic book", countryOfOrigin: "US", declaredValue: 25 }],
  ["ADDON-a1", { weightOz: 2.5, customsCode: null, customsDescription: null, countryOfOrigin: null, declaredValue: null }],
]);
const base = {
  pledgeId: "cmxtest0000000000000abcd",
  backerNumber: 12,
  createdAt: new Date("2026-09-20T12:00:00Z"),
  amount: 47.5,
  email: "backer@example.com",
  backerName: "Alex Backer",
  reward: { id: "r1", title: "Dead Sexy #3 Box Set", amount: 35 },
  addons: [{ id: "a1", title: "Art Print", amount: 12.5, quantity: 2 }],
  products,
  projectTitle: "Dead Sexy 3",
  storeId: 2,
};

const messyUs = buildShipStationOrder({ ...base, address: { name: "Alex Backer", line1: "1 Main St", line2: "", city: "Austin", state: "Texas", postalCode: "78701", country: "United States", phone: "555-0100" } });
check("messy US address builds", messyUs.ok, messyUs.ok ? "" : messyUs.error);
if (messyUs.ok) {
  check("  country normalised to US", messyUs.order.shipTo.country === "US");
  check("  state normalised to TX", messyUs.order.shipTo.state === "TX");
  check("  phone carried", messyUs.order.shipTo.phone === "555-0100");
  check("  orderNumber uses backer number", messyUs.orderNumber === "ICF-12");
  check("  orderKey upsert key", messyUs.order.orderKey === "icf-cmxtest0000000000000abcd");
  check("  storeId in advancedOptions", messyUs.order.advancedOptions?.storeId === 2);
  check("  item weights attached", messyUs.order.items[0].weight?.value === 6 && messyUs.order.items[1].weight?.value === 2.5);
  check("  order weight = 6 + 2×2.5 = 11 oz", messyUs.order.weight?.value === 11);
  check("  no customs for domestic", messyUs.order.customsItems === undefined);
}

const intl = buildShipStationOrder({ ...base, pledgeId: "cmxtest0000000000000wxyz", backerNumber: 13, address: { name: "Sam", line1: "10 Downing St", line2: "", city: "London", state: "", postalCode: "SW1A 2AA", country: "United Kingdom", phone: "" } });
check("UK address builds", intl.ok, intl.ok ? "" : intl.error);
if (intl.ok) {
  check("  country GB", intl.order.shipTo.country === "GB");
  check("  customs items present for international", Array.isArray(intl.order.customsItems) && intl.order.customsItems.length === 2);
  check("  HS code carried", intl.order.customsItems[0].harmonizedTariffCode === "490199");
  check("  declared value used", intl.order.customsItems[0].value === 25);
  check("  internationalOptions set", intl.order.internationalOptions?.contents === "merchandise");
}

const bad = buildShipStationOrder({ ...base, address: { name: "X", line1: "1 St", line2: "", city: "Nowhere", state: "", postalCode: "0", country: "Narnia", phone: "" } });
check("unknown country refused with a specific reason", !bad.ok && /Narnia/.test(bad.error), bad.ok ? "" : bad.error);
const noAddr = buildShipStationOrder({ ...base, address: null });
check("missing address refused", !noAddr.ok && /No shipping address/.test(noAddr.error));
const noBacker = buildShipStationOrder({ ...base, backerNumber: null, address: { name: "Y", line1: "2 St", line2: "", city: "Reno", state: "NV", postalCode: "89501", country: "US", phone: "" } });
check("no backer number → id-based orderNumber", noBacker.ok && /^ICF-[0-9A-Z]{8}$/.test(noBacker.orderNumber));

// ── 3. Wire: push, upsert, ship, sync ───────────────────────────────────────
const push1 = await api("/orders/createorder", { method: "POST", body: JSON.stringify(messyUs.order) });
check("createorder accepted by mock (real API rules)", push1.res.ok, push1.res.ok ? `orderId ${push1.body.orderId}` : parseShipStationError(push1.body, push1.res.status));
const push2 = await api("/orders/createorder", { method: "POST", body: JSON.stringify(messyUs.order) });
check("re-push upserts (same orderId, no duplicate)", push2.res.ok && push2.body.orderId === push1.body.orderId);
const pushIntl = await api("/orders/createorder", { method: "POST", body: JSON.stringify(intl.order) });
check("international order accepted", pushIntl.res.ok, pushIntl.res.ok ? "" : parseShipStationError(pushIntl.body, pushIntl.res.status));

// The raw address the app used to send (no normalisation) must fail — proves the mock enforces what bit real creators.
const rawFail = await api("/orders/createorder", { method: "POST", body: JSON.stringify({ ...messyUs.order, orderKey: "raw", shipTo: { ...messyUs.order.shipTo, country: "United States", state: "Texas" }, billTo: { ...messyUs.order.billTo, country: "United States", state: "Texas" } }) });
check("un-normalised address is rejected (what production used to send)", rawFail.res.status === 400, parseShipStationError(rawFail.body, rawFail.res.status));

// Warehouse ships order 1; tracking sync (paged /shipments) finds it.
await fetch(`${BASE}/__mock/ship`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: push1.body.orderId, trackingNumber: "1Z999AA10123456784", carrierCode: "ups" }) });
await fetch(`${BASE}/__mock/ship`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: pushIntl.body.orderId, voided: true }) });
const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
const shipments = await api(`/shipments?shipDateStart=${since}&includeShipmentItems=false&pageSize=500&page=1&storeId=2`);
check("paged shipments lookup works", shipments.res.ok && Array.isArray(shipments.body.shipments));
const live = (shipments.body.shipments || []).filter((s) => !s.voided && s.trackingNumber);
check("  shipped order matched by orderId with tracking", live.some((s) => String(s.orderId) === String(push1.body.orderId) && s.trackingNumber === "1Z999AA10123456784"));
check("  voided shipment ignored", !live.some((s) => String(s.orderId) === String(pushIntl.body.orderId)));

// ── 4. Rates + credential failure surfacing ────────────────────────────────
const ratesNoState = await api("/shipments/getrates", { method: "POST", body: JSON.stringify({ carrierCode: "ups", fromPostalCode: "78701", toCountry: "US", toPostalCode: "90210", weight: { value: 11, units: "ounces" } }) });
check("US rate quote without toState is rejected (what production used to send)", ratesNoState.res.status === 400);
const rates = await api("/shipments/getrates", { method: "POST", body: JSON.stringify({ carrierCode: "ups", fromPostalCode: "78701", toCountry: "US", toState: "CA", toPostalCode: "90210", weight: { value: 11, units: "ounces" } }) });
check("US rate quote with toState returns rates", rates.res.ok && Array.isArray(rates.body) && rates.body.length > 0);
const badAuth = await fetch(`${BASE}/carriers`, { headers: { Authorization: `Basic ${Buffer.from("nope:nope").toString("base64")}` } });
check("bad credentials → 401 → actionable message", badAuth.status === 401 && /reconnect/i.test(parseShipStationError(await badAuth.json().catch(() => null), 401)));
check("ModelState error surfaced", /shipTo\.country: bad/.test(parseShipStationError({ Message: "The request is invalid.", ModelState: { "shipTo.country": ["bad"] } }, 400)));

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
