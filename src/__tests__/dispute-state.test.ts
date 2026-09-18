import { describe, it, expect } from "vitest";
import {
  readDisputeState,
  withDisputeState,
  daysUntilEvidenceDue,
  disputeUrgency,
} from "@/lib/payments/dispute-state";

const NOW = new Date("2026-09-18T12:00:00Z");
const at = (iso: string) => daysUntilEvidenceDue(iso, NOW);

describe("daysUntilEvidenceDue", () => {
  it("counts a deadline weeks out", () => {
    // Oct 27 from Sep 18 — the real Roswell window.
    expect(at("2026-10-27T23:59:00Z")).toBe(40);
  });

  it("rounds a partial day up, so a live deadline never reads as zero", () => {
    expect(at("2026-09-18T18:00:00Z")).toBe(1);
    expect(at("2026-09-19T11:00:00Z")).toBe(1);
  });

  it("goes negative once the window has closed", () => {
    expect(at("2026-09-17T12:00:00Z")).toBe(-1);
  });

  it("returns null rather than a wrong number when there is no usable date", () => {
    expect(daysUntilEvidenceDue(undefined, NOW)).toBeNull();
    expect(daysUntilEvidenceDue("not a date", NOW)).toBeNull();
  });
});

describe("disputeUrgency", () => {
  it("escalates as the deadline approaches", () => {
    expect(disputeUrgency(40)).toBe("open");
    expect(disputeUrgency(7)).toBe("soon");
    expect(disputeUrgency(3)).toBe("critical");
    expect(disputeUrgency(0)).toBe("critical");
    expect(disputeUrgency(-1)).toBe("overdue");
  });

  it("treats a missing deadline as open, not as overdue", () => {
    expect(disputeUrgency(null)).toBe("open");
  });
});

describe("withDisputeState", () => {
  it("preserves unrelated metadata", () => {
    const meta = { dcCharge: { attemptKey: "attempt-2" }, other: 1 };
    const next = withDisputeState(meta, { disputeId: "du_1" });
    expect(next.dcCharge).toEqual({ attemptKey: "attempt-2" });
    expect(next.other).toBe(1);
    expect(readDisputeState(next)?.disputeId).toBe("du_1");
  });

  it("merges rather than replacing, so a later update keeps the deadline", () => {
    const first = withDisputeState(null, {
      disputeId: "du_1",
      evidenceDueBy: "2026-10-27T23:59:00Z",
    });
    const second = withDisputeState(first, { status: "lost" });
    const state = readDisputeState(second);
    expect(state?.evidenceDueBy).toBe("2026-10-27T23:59:00Z");
    expect(state?.status).toBe("lost");
  });

  it("omits undefined fields instead of writing them, which Prisma Json rejects", () => {
    const next = withDisputeState(null, { disputeId: "du_1", reason: undefined });
    expect(Object.keys(next.dispute as object)).toEqual(["disputeId"]);
  });

  it("reads back nothing from metadata that has no dispute", () => {
    expect(readDisputeState(null)).toBeNull();
    expect(readDisputeState({ other: 1 })).toBeNull();
    expect(readDisputeState("not an object")).toBeNull();
  });
});
