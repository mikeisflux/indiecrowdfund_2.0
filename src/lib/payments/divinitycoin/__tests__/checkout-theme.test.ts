import { describe, expect, it } from "vitest";
import {
  checkoutThemeMessage,
  hslTripletToHex,
  normalizeHex,
  sameCheckoutTheme,
  withCheckoutTheme,
} from "../checkout-theme";

describe("hslTripletToHex", () => {
  it("converts the globals.css token format", () => {
    expect(hslTripletToHex("0 0% 100%")).toBe("ffffff");
    expect(hslTripletToHex("0 0% 0%")).toBe("000000");
    expect(hslTripletToHex(" 220 20% 6% ")).toBe("0c0e12");
    // Verified against Python colorsys.hls_to_rgb(152/360, 0.42, 0.76).
    expect(hslTripletToHex("152 76% 42%")).toBe("1abc71");
  });

  it("accepts comma-separated and deg forms", () => {
    expect(hslTripletToHex("152deg, 76%, 42%")).toBe("1abc71");
  });

  it("rejects garbage", () => {
    expect(hslTripletToHex("")).toBeNull();
    expect(hslTripletToHex("blue")).toBeNull();
    expect(hslTripletToHex("152 76")).toBeNull();
  });
});

describe("normalizeHex", () => {
  it("handles hex with and without #, 3 and 6 digits", () => {
    expect(normalizeHex("#E11D48")).toBe("e11d48");
    expect(normalizeHex("e11d48")).toBe("e11d48");
    expect(normalizeHex("#abc")).toBe("aabbcc");
  });
  it("handles rgb() and hsl()", () => {
    expect(normalizeHex("rgb(225, 29, 72)")).toBe("e11d48");
    expect(normalizeHex("hsl(0 0% 100%)")).toBe("ffffff");
  });
  it("returns null for empty/invalid", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
  });
});

describe("withCheckoutTheme", () => {
  const theme = { bg: "14110f", text: "f5ede6", accent: "e11d48" };

  it("appends bg/text/accent with ? on a bare URL", () => {
    const url = new URL(withCheckoutTheme("https://divinitycoin.com/checkout/cs_123", theme));
    expect(url.searchParams.get("bg")).toBe("14110f");
    expect(url.searchParams.get("text")).toBe("f5ede6");
    expect(url.searchParams.get("accent")).toBe("e11d48");
    expect(url.searchParams.has("theme")).toBe(false);
  });

  it("joins with & and keeps existing params", () => {
    const out = withCheckoutTheme("https://divinitycoin.com/checkout/cs_123?partner=icf&x=1", theme);
    expect(out).toContain("?partner=icf&x=1&");
    const url = new URL(out);
    expect(url.searchParams.get("partner")).toBe("icf");
    expect(url.searchParams.get("accent")).toBe("e11d48");
  });

  it("replaces theme params already present", () => {
    const url = new URL(
      withCheckoutTheme("https://divinitycoin.com/checkout/cs_1?theme=light&accent=000000", theme)
    );
    expect(url.searchParams.get("theme")).toBeNull();
    expect(url.searchParams.get("accent")).toBe("e11d48");
    expect(url.searchParams.getAll("accent")).toHaveLength(1);
  });

  it("leaves an unparseable URL alone", () => {
    expect(withCheckoutTheme("not a url", theme)).toBe("not a url");
  });

  it("falls back to no theme params when colours are unavailable in a non-dark document", () => {
    const url = new URL(withCheckoutTheme("https://divinitycoin.com/checkout/cs_1", null));
    expect(url.searchParams.has("bg")).toBe(false);
    expect(url.searchParams.has("theme")).toBe(false);
  });
});

describe("checkoutThemeMessage", () => {
  it("sends colours with a leading # under the DC namespace", () => {
    expect(checkoutThemeMessage({ bg: "14110f", text: "f5ede6", accent: "e11d48" })).toEqual({
      namespace: "divinitycoin-checkout",
      type: "theme",
      bg: "#14110f",
      text: "#f5ede6",
      accent: "#e11d48",
    });
  });
  it("sends a preset when colours are unavailable", () => {
    const msg = checkoutThemeMessage(null);
    expect(msg.namespace).toBe("divinitycoin-checkout");
    expect(msg.type).toBe("theme");
    expect(["light", "dark"]).toContain((msg as { theme: string }).theme);
  });
});

describe("sameCheckoutTheme", () => {
  it("compares by value", () => {
    const a = { bg: "1", text: "2", accent: "3" };
    expect(sameCheckoutTheme(a, { ...a })).toBe(true);
    expect(sameCheckoutTheme(a, { ...a, accent: "4" })).toBe(false);
    expect(sameCheckoutTheme(null, null)).toBe(true);
    expect(sameCheckoutTheme(a, null)).toBe(false);
  });
});
