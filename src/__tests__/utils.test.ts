import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatNumber,
  calculateFundingPercentage,
  getDaysRemaining,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000");
  });
});

describe("formatNumber", () => {
  it("formats numbers with commas", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("calculateFundingPercentage", () => {
  it("calculates correct percentage", () => {
    expect(calculateFundingPercentage(500, 1000)).toBe(50);
  });

  it("handles zero goal", () => {
    expect(calculateFundingPercentage(100, 0)).toBe(0);
  });

  it("handles overfunding", () => {
    expect(calculateFundingPercentage(1500, 1000)).toBe(150);
  });

  it("rounds to nearest integer", () => {
    expect(calculateFundingPercentage(333, 1000)).toBe(33);
  });
});

describe("getDaysRemaining", () => {
  it("returns 0 for past dates", () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(getDaysRemaining(pastDate)).toBe(0);
  });

  it("returns positive days for future dates", () => {
    const futureDate = new Date(Date.now() + 5 * 86400000);
    const days = getDaysRemaining(futureDate);
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });
});
