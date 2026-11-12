import { describe, it, expect } from "vitest";
import { unitKey, parseUnitKey, itemQuantity, unitLabel, listItemUnits, joinUnitAnswers } from "@/lib/surveys/item-units";

describe("survey item units", () => {
  it("keeps unit 1 under the plain item id", () => {
    expect(unitKey("abc", 0)).toBe("abc");
    expect(unitKey("abc", 1)).toBe("abc#2");
    expect(parseUnitKey("abc")).toEqual({ itemQuestionId: "abc", unit: 0 });
    expect(parseUnitKey("abc#2")).toEqual({ itemQuestionId: "abc", unit: 1 });
    expect(parseUnitKey("abc#10")).toEqual({ itemQuestionId: "abc", unit: 9 });
    expect(parseUnitKey("abc#1")).toEqual({ itemQuestionId: "abc#1", unit: 0 });
    expect(parseUnitKey("abc#x")).toEqual({ itemQuestionId: "abc#x", unit: 0 });
  });

  it("uses the add-on quantity and 1 for the tier", () => {
    const pledge = { rewardId: "tier", addons: [{ addonId: "prints", quantity: 10 }] };
    expect(itemQuantity("tier", pledge)).toBe(1);
    expect(itemQuantity("prints", pledge)).toBe(10);
    expect(itemQuantity("other", pledge)).toBe(1);
    expect(itemQuantity("prints", { rewardId: null, addons: [{ addonId: "prints", quantity: 0 }] })).toBe(1);
  });

  it("labels and lists units", () => {
    expect(unitLabel("Art Print", 2, 10)).toBe("Art Print (#3 of 10)");
    expect(unitLabel("Art Print", 0, 1)).toBe("Art Print");
    const responses = { "it#3": { customAnswers: { q: "09" } }, it: { customAnswers: { q: "01" } }, "it#2": { customAnswers: { q: "06" } }, other: {} };
    const units = listItemUnits(responses, "it");
    expect(units.map((u) => u.unit)).toEqual([0, 1, 2]);
    expect(joinUnitAnswers(units.map((u) => u.response.customAnswers?.q))).toBe("#1: 01 | #2: 06 | #3: 09");
    expect(joinUnitAnswers(["01"])).toBe("01");
    expect(joinUnitAnswers([["a", "b"], undefined])).toBe("#1: a; b | #2: —");
  });
});
