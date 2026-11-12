import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  attemptFindUnique: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptFindMany: vi.fn(),
  attemptCreate: vi.fn(),
  attemptUpdate: vi.fn(),
  attemptUpdateMany: vi.fn(),
  ledgerFindMany: vi.fn(),
  callDc: vi.fn(),
  alertAdmins: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    dcRefundAttempt: {
      findUnique: mocks.attemptFindUnique,
      findFirst: mocks.attemptFindFirst,
      findMany: mocks.attemptFindMany,
      create: mocks.attemptCreate,
      update: mocks.attemptUpdate,
      updateMany: mocks.attemptUpdateMany,
    },
    divinityCoinTransaction: { findMany: mocks.ledgerFindMany },
  },
}));
vi.mock("@/lib/payments/divinitycoin/client", () => ({ callDivinityCoinAPI: mocks.callDc }));
vi.mock("@/lib/payments/divinitycoin/config", () => ({
  paymentsDivinitycoinLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/admin-alerts", () => ({ alertAdmins: mocks.alertAdmins }));

import { requestDcRefund } from "@/lib/payments/divinitycoin/refunds";

const base = {
  paymentId: "pi_1",
  pledgeId: "pl_1",
  amountCents: 4400,
  reason: "test",
  requestedBy: "admin" as const,
  purpose: "recoup-refund",
  idempotencyKey: "recoup-refund:r1",
  chargedCents: 4400,
};

describe("requestDcRefund", () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 });
    mocks.attemptFindUnique.mockResolvedValue(null);
    mocks.attemptFindFirst.mockResolvedValue(null);
    mocks.attemptFindMany.mockResolvedValue([]);
    mocks.ledgerFindMany.mockResolvedValue([]);
    mocks.attemptCreate.mockResolvedValue({ id: "att_1" });
    mocks.attemptUpdate.mockResolvedValue({});
    mocks.alertAdmins.mockResolvedValue({});
  });

  it("sends the refund and records it as succeeded", async () => {
    mocks.callDc.mockResolvedValue({ success: true, data: { refundId: "re_1" } });
    const out = await requestDcRefund(base);
    expect(out).toMatchObject({ success: true, refundId: "re_1", reused: false });
    expect(mocks.callDc).toHaveBeenCalledTimes(1);
    expect(mocks.attemptUpdate).toHaveBeenCalledWith({ where: { id: "att_1" }, data: { status: "SUCCEEDED", refundId: "re_1" } });
  });

  it("returns the recorded refund for a repeated key instead of sending again", async () => {
    mocks.attemptFindUnique.mockResolvedValue({ id: "att_0", status: "SUCCEEDED", refundId: "re_0" });
    const out = await requestDcRefund(base);
    expect(out).toMatchObject({ success: true, refundId: "re_0", reused: true });
    expect(mocks.callDc).not.toHaveBeenCalled();
  });

  it("blocks while an earlier attempt on the payment is unanswered", async () => {
    mocks.attemptFindFirst.mockResolvedValue({ id: "att_u", status: "UNCERTAIN", purpose: "pledge-cancel", amountCents: 4400, createdAt: new Date() });
    const out = await requestDcRefund({ ...base, idempotencyKey: "other" });
    expect(out).toMatchObject({ success: false, blocked: "uncertain" });
    expect(mocks.callDc).not.toHaveBeenCalled();
  });

  it("lets an admin force past an unanswered attempt", async () => {
    mocks.attemptFindFirst.mockResolvedValue({ id: "att_u", status: "UNCERTAIN", purpose: "x", amountCents: 1, createdAt: new Date() });
    mocks.callDc.mockResolvedValue({ success: true, data: { id: "re_2" } });
    const out = await requestDcRefund({ ...base, idempotencyKey: "other", force: true });
    expect(out).toMatchObject({ success: true, refundId: "re_2" });
  });

  it("refuses to refund more than was charged", async () => {
    mocks.attemptFindMany.mockResolvedValue([{ amountCents: 4400 }]);
    const out = await requestDcRefund({ ...base, idempotencyKey: "second" });
    expect(out).toMatchObject({ success: false, blocked: "over_refund" });
    expect(mocks.callDc).not.toHaveBeenCalled();
  });

  it("marks a no-decision failure uncertain and alerts admins", async () => {
    mocks.callDc.mockResolvedValue({ success: false, error: "Failed to process refund" });
    const out = await requestDcRefund(base);
    expect(out).toMatchObject({ success: false, uncertain: true });
    expect(mocks.attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "UNCERTAIN" }) }));
    expect(mocks.alertAdmins).toHaveBeenCalledTimes(1);
  });

  it("marks a coded refusal failed, retryable, no alert", async () => {
    mocks.callDc.mockResolvedValue({ success: false, error: "Insufficient balance", code: "INSUFFICIENT_BALANCE" });
    const out = await requestDcRefund(base);
    expect(out).toMatchObject({ success: false, uncertain: false, code: "INSUFFICIENT_BALANCE" });
    expect(mocks.attemptUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
    expect(mocks.alertAdmins).not.toHaveBeenCalled();
  });
});
