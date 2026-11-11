import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  dc: vi.fn(),
  whop: vi.fn(),
  paypal: vi.fn(),
  paypalConfig: vi.fn(),
  projects: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    divinityCoinBankAccount: { findUnique: mocks.dc },
    whopBankAccount: { findUnique: mocks.whop },
    payPalBankAccount: { findUnique: mocks.paypal },
    payPalPayoutConfig: { findUnique: mocks.paypalConfig },
    project: { findMany: mocks.projects },
  },
}));

import { missingBankFields, pendingPayoutDetails } from "@/lib/payouts/payout-details";

const completeRow = {
  bankNameEncrypted: "x",
  accountHolderEncrypted: "x",
  accountNumberEncrypted: "x",
  routingNumberEncrypted: "x",
  billingLine1Encrypted: "x",
  billingCityEncrypted: "x",
  billingZipEncrypted: "x",
  billingCountryEncrypted: "x",
  bankNameDisplay: "Fifth Third",
  accountType: "checking",
  bankCountry: "US",
  accountLastFour: "0028",
};

describe("missingBankFields", () => {
  it("accepts a complete row", () => {
    expect(missingBankFields(completeRow)).toEqual([]);
  });
  it("flags a legacy row with no billing address", () => {
    expect(
      missingBankFields({ ...completeRow, billingLine1Encrypted: null, billingCityEncrypted: null, billingZipEncrypted: null, billingCountryEncrypted: null })
    ).toEqual(["billing address"]);
  });
  it("names the partial address fields", () => {
    expect(missingBankFields({ ...completeRow, billingZipEncrypted: null })).toEqual(["billing address (ZIP/postal code)"]);
  });
  it("accepts split first/last account holder on DC rows", () => {
    expect(
      missingBankFields({ ...completeRow, accountHolderEncrypted: null, accountHolderFirstNameEncrypted: "a", accountHolderLastNameEncrypted: "b" })
    ).toEqual([]);
  });
});

describe("pendingPayoutDetails", () => {
  beforeEach(() => {
    mocks.dc.mockReset();
    mocks.whop.mockReset();
    mocks.paypal.mockReset();
    mocks.paypalConfig.mockReset();
    mocks.projects.mockReset();
    mocks.whop.mockResolvedValue(null);
    mocks.paypal.mockResolvedValue(null);
    mocks.paypalConfig.mockResolvedValue(null);
    mocks.projects.mockResolvedValue([]);
  });

  it("is empty for a complete account and no launched campaigns", async () => {
    mocks.dc.mockResolvedValue(completeRow);
    expect(await pendingPayoutDetails("u1")).toEqual([]);
  });

  it("gates a legacy DC row missing the billing address, even with no campaigns", async () => {
    mocks.dc.mockResolvedValue({ ...completeRow, billingLine1Encrypted: null, billingCityEncrypted: null, billingZipEncrypted: null, billingCountryEncrypted: null });
    const out = await pendingPayoutDetails("u1");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ processor: "DIVINITYCOIN", exists: true, missing: ["billing address"], prefill: { lastFour: "0028", bankName: "Fifth Third" } });
  });

  it("gates a live campaign whose processor has no account at all", async () => {
    mocks.dc.mockResolvedValue(null);
    mocks.projects.mockResolvedValue([{ id: "p1", title: "Ghost Dance", status: "LIVE", paymentProcessor: "DIVINITYCOIN" }]);
    const out = await pendingPayoutDetails("u1");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ processor: "DIVINITYCOIN", exists: false, missing: ["bank account"], projects: [{ id: "p1" }] });
  });

  it("does not gate a draft campaign with no account", async () => {
    mocks.dc.mockResolvedValue(null);
    // The status filter lives in the query; a DRAFT never comes back.
    mocks.projects.mockResolvedValue([]);
    expect(await pendingPayoutDetails("u1")).toEqual([]);
  });

  it("accepts the legacy PayPal payout config in place of a bank row", async () => {
    mocks.dc.mockResolvedValue(null);
    mocks.paypalConfig.mockResolvedValue({ id: "cfg" });
    mocks.projects.mockResolvedValue([{ id: "p2", title: "Old", status: "FUNDED", paymentProcessor: "PAYPAL" }]);
    expect(await pendingPayoutDetails("u1")).toEqual([]);
  });

  it("ignores Stripe-era campaigns", async () => {
    mocks.dc.mockResolvedValue(null);
    mocks.projects.mockResolvedValue([{ id: "p3", title: "Stripe", status: "FUNDED", paymentProcessor: "STRIPE" }]);
    expect(await pendingPayoutDetails("u1")).toEqual([]);
  });
});
