#!/usr/bin/env node
// Mock ShipStation V1 API for exercising the integration without an account.
//
// Implements the subset of https://ssapi.shipstation.com the app calls, with
// the same auth, envelopes and validation rules the real API applies, so a
// request that would 400 in production 400s here. Run it, then point the app
// at it with SHIPSTATION_API_BASE=http://127.0.0.1:4545 (see
// scripts/shipstation-harness.mjs for an end-to-end exercise).
//
//   node scripts/shipstation-mock.mjs            # port 4545
//   MOCK_KEY=k MOCK_SECRET=s node scripts/shipstation-mock.mjs
//
// Accepted credentials: MOCK_KEY / MOCK_SECRET (default "testkey"/"testsecret").
// Rate limit: 40 requests per rolling minute → 429 with X-Rate-Limit-Reset.

import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4545);
const KEY = process.env.MOCK_KEY || "testkey";
const SECRET = process.env.MOCK_SECRET || "testsecret";
const RATE_LIMIT = Number(process.env.MOCK_RATE_LIMIT || 40);

const orders = new Map(); // orderKey -> order
const shipments = new Map(); // orderId -> shipment[]
let nextOrderId = 100001;
let nextShipmentId = 500001;
const requestLog = [];
const calls = [];

const ISO2 = /^[A-Z]{2}$/;
const US_STATE = /^[A-Z]{2}$/;

function send(res, status, body, extraHeaders = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-Rate-Limit-Limit": String(RATE_LIMIT),
    ...extraHeaders,
  });
  res.end(payload);
}

function badRequest(res, message) {
  // Real V1 error envelope.
  send(res, 400, { Message: message, ExceptionMessage: message });
}

function validateAddress(addr, label, problems) {
  if (!addr || typeof addr !== "object") {
    problems.push(`${label} is required`);
    return;
  }
  for (const f of ["name", "street1", "city", "postalCode", "country"]) {
    if (typeof addr[f] !== "string" || !addr[f].trim()) problems.push(`${label}.${f} is required`);
  }
  if (typeof addr.country === "string" && !ISO2.test(addr.country)) {
    problems.push(`${label}.country must be a 2-character ISO code (got "${addr.country}")`);
  }
  if (addr.country === "US" && typeof addr.state === "string" && addr.state && !US_STATE.test(addr.state)) {
    problems.push(`${label}.state must be a 2-character code for US (got "${addr.state}")`);
  }
}

function validateOrder(o) {
  const problems = [];
  if (typeof o.orderNumber !== "string" || !o.orderNumber) problems.push("orderNumber is required");
  if (typeof o.orderDate !== "string" || Number.isNaN(Date.parse(o.orderDate))) problems.push("orderDate must be an ISO date");
  const statuses = ["awaiting_payment", "awaiting_shipment", "shipped", "on_hold", "cancelled"];
  if (!statuses.includes(o.orderStatus)) problems.push(`orderStatus must be one of ${statuses.join(", ")}`);
  validateAddress(o.billTo, "billTo", problems);
  validateAddress(o.shipTo, "shipTo", problems);
  if (o.items !== undefined) {
    if (!Array.isArray(o.items)) problems.push("items must be an array");
    else
      o.items.forEach((it, i) => {
        if (typeof it.name !== "string" || !it.name) problems.push(`items[${i}].name is required`);
        if (!Number.isInteger(it.quantity) || it.quantity < 1) problems.push(`items[${i}].quantity must be a positive integer`);
        if (it.unitPrice !== undefined && typeof it.unitPrice !== "number") problems.push(`items[${i}].unitPrice must be a number`);
        if (it.weight !== undefined) {
          if (typeof it.weight?.value !== "number" || !["ounces", "pounds", "grams"].includes(it.weight?.units))
            problems.push(`items[${i}].weight must be {value:number, units:ounces|pounds|grams}`);
        }
      });
  }
  if (o.weight !== undefined) {
    if (typeof o.weight?.value !== "number" || !["ounces", "pounds", "grams"].includes(o.weight?.units))
      problems.push("weight must be {value:number, units:ounces|pounds|grams}");
  }
  if (o.advancedOptions !== undefined && o.advancedOptions !== null) {
    if (o.advancedOptions.storeId !== undefined && !Number.isInteger(o.advancedOptions.storeId))
      problems.push("advancedOptions.storeId must be an integer");
  }
  return problems;
}

const windowHits = [];
function rateLimited(res) {
  const now = Date.now();
  while (windowHits.length && now - windowHits[0] > 60_000) windowHits.shift();
  if (windowHits.length >= RATE_LIMIT) {
    const reset = Math.ceil((60_000 - (now - windowHits[0])) / 1000);
    send(res, 429, { Message: "Too Many Requests" }, { "X-Rate-Limit-Remaining": "0", "X-Rate-Limit-Reset": String(reset) });
    return true;
  }
  windowHits.push(now);
  res.setHeader?.("X-Rate-Limit-Remaining", String(RATE_LIMIT - windowHits.length));
  return false;
}

function authorized(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [k, s] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
  return k === KEY && s === SECRET;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  calls.push({ method: req.method, path, at: Date.now() });

  // Control endpoints (not part of ShipStation) for the harness.
  if (path === "/__mock/state") return send(res, 200, { orders: [...orders.values()], shipments: Object.fromEntries(shipments), calls });
  if (path === "/__mock/reset") {
    orders.clear(); shipments.clear(); calls.length = 0; windowHits.length = 0;
    return send(res, 200, { ok: true });
  }
  if (path === "/__mock/ship" && req.method === "POST") {
    // Simulate the warehouse shipping an order: creates a shipment with tracking.
    const body = await readBody(req);
    const order = [...orders.values()].find((o) => String(o.orderId) === String(body.orderId));
    if (!order) return send(res, 404, { Message: "no such order" });
    const shipment = {
      shipmentId: nextShipmentId++,
      orderId: order.orderId,
      orderKey: order.orderKey,
      orderNumber: order.orderNumber,
      trackingNumber: body.trackingNumber || `1Z${String(order.orderId).padStart(16, "0")}`,
      carrierCode: body.carrierCode || "ups",
      serviceCode: body.serviceCode || "ups_ground",
      shipDate: new Date().toISOString().slice(0, 10),
      voided: !!body.voided,
      shipmentCost: 8.45,
    };
    shipments.set(String(order.orderId), [...(shipments.get(String(order.orderId)) || []), shipment]);
    order.orderStatus = "shipped";
    return send(res, 200, shipment);
  }

  if (!authorized(req)) return send(res, 401, { Message: "Unauthorized" });
  if (rateLimited(res)) return;

  if (req.method === "GET" && path === "/carriers") {
    return send(res, 200, [
      { code: "ups", name: "UPS", accountNumber: "X", requiresFundedAccount: false, balance: 0 },
      { code: "stamps_com", name: "Stamps.com", accountNumber: "Y", requiresFundedAccount: true, balance: 12.5 },
    ]);
  }
  if (req.method === "GET" && path === "/stores") {
    return send(res, 200, [
      { storeId: 1, storeName: "Manual Orders", marketplaceName: "ShipStation", active: true },
      { storeId: 2, storeName: "Comics Store", marketplaceName: "Custom", active: true },
    ]);
  }
  if (req.method === "POST" && path === "/orders/createorder") {
    const body = await readBody(req);
    if (!body) return badRequest(res, "Invalid JSON");
    const problems = validateOrder(body);
    if (problems.length) return badRequest(res, problems.join("; "));
    const key = body.orderKey || `auto-${body.orderNumber}`;
    const existing = orders.get(key);
    const order = { ...(existing || {}), ...body, orderKey: key, orderId: existing?.orderId ?? nextOrderId++ };
    orders.set(key, order);
    return send(res, 200, { orderId: order.orderId, orderKey: order.orderKey, orderNumber: order.orderNumber, orderStatus: order.orderStatus });
  }
  if (req.method === "GET" && path === "/orders") {
    const num = url.searchParams.get("orderNumber");
    const list = [...orders.values()].filter((o) => !num || o.orderNumber === num);
    return send(res, 200, { orders: list, total: list.length, page: 1, pages: 1 });
  }
  if (req.method === "GET" && path === "/shipments") {
    const orderId = url.searchParams.get("orderId");
    const orderNumber = url.searchParams.get("orderNumber");
    let list = [];
    if (orderId) list = shipments.get(String(orderId)) || [];
    else if (orderNumber) {
      const o = [...orders.values()].find((x) => x.orderNumber === orderNumber);
      list = o ? shipments.get(String(o.orderId)) || [] : [];
    } else list = [...shipments.values()].flat();
    return send(res, 200, { shipments: list, total: list.length, page: 1, pages: 1 });
  }
  if (req.method === "POST" && path === "/shipments/getrates") {
    const body = await readBody(req);
    const problems = [];
    for (const f of ["carrierCode", "fromPostalCode", "toCountry", "toPostalCode"]) {
      if (typeof body?.[f] !== "string" || !body[f]) problems.push(`${f} is required`);
    }
    if (typeof body?.weight?.value !== "number" || !body?.weight?.units) problems.push("weight {value, units} is required");
    if (body?.toCountry === "US" && !body?.toState) problems.push("toState is required for US destinations");
    if (problems.length) return badRequest(res, problems.join("; "));
    if (body.carrierCode === "stamps_com" && body.toCountry !== "US") return badRequest(res, "Carrier does not ship to destination");
    const base = body.carrierCode === "ups" ? 9.1 : 5.6;
    return send(res, 200, [
      { serviceName: `${body.carrierCode} Ground`, serviceCode: `${body.carrierCode}_ground`, shipmentCost: base, otherCost: 0 },
      { serviceName: `${body.carrierCode} Express`, serviceCode: `${body.carrierCode}_express`, shipmentCost: base * 2.4, otherCost: 1.2 },
    ]);
  }
  if (req.method === "POST" && path === "/webhooks/subscribe") {
    const body = await readBody(req);
    if (!body?.target_url || !body?.event) return badRequest(res, "target_url and event are required");
    return send(res, 201, { id: 777 });
  }
  send(res, 404, { Message: `mock: no route for ${req.method} ${path}` });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[shipstation-mock] listening on http://127.0.0.1:${PORT} (key=${KEY})`);
});
