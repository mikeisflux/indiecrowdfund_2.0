import { describe, expect, it } from "vitest";
import {
  buildModifierQuestions,
  eligibleTargets,
  forcedSelections,
  suggestFromText,
  validateSelections,
  type ModifierRewardShape,
} from "../modifiers";
import { comboSku, computeProductionCounts, defaultModifierSuffix, resolvePledgeLines, type SkuContext } from "../production-counts";

const R = (
  id: string,
  title: string,
  type: "TIER" | "ADDON",
  extra: Partial<ModifierRewardShape> = {},
): ModifierRewardShape => ({ id, title, type, shippingType: "WORLDWIDE", isModifier: false, modifiesRewardIds: [], sku: null, modifierSkuSuffix: null, ...extra });

const rewards = new Map<string, ModifierRewardShape>(
  [
    R("t18", "SW3-18", "TIER", { sku: "SW3-18" }),
    R("t24", "SW3-24", "TIER", { sku: "SW3-24" }),
    R("tdig", "Digital Deluxe", "TIER", { shippingType: "NO_SHIPPING" }),
    R("a24", "SW3-24 (Add-on)", "ADDON", { sku: "SW3-24" }),
    R("a12", "SW3-12 (Add-on)", "ADDON", { sku: "SW3-12" }),
    R("coin", "Challenge Coin", "ADDON", { sku: "SW3-COIN" }),
    R("foil", "Upgrade to foil", "ADDON", { isModifier: true, modifierSkuSuffix: "-F" }),
    R("metal", "Upgrade to metal", "ADDON", { isModifier: true, modifierSkuSuffix: "-M", modifiesRewardIds: ["t18"] }),
  ].map((r) => [r.id, r]),
);

const ctx: SkuContext = { rewardsById: rewards, skuMappings: [], modifierSkuMappings: [] };

describe("eligibleTargets", () => {
  it("includes the tier and physical add-ons, never digital items or other modifiers", () => {
    const pledge = { id: "p", rewardId: "tdig", addons: [{ addonId: "a24", quantity: 4 }, { addonId: "foil", quantity: 4 }, { addonId: "coin", quantity: 1 }] };
    const targets = eligibleTargets(rewards.get("foil")!, pledge, rewards);
    expect(targets.map((t) => t.rewardId)).toEqual(["a24", "coin"]);
    expect(targets[0].quantity).toBe(4);
  });

  it("respects a narrowed modifiesRewardIds list", () => {
    const pledge = { id: "p", rewardId: "t24", addons: [{ addonId: "a12", quantity: 1 }, { addonId: "metal", quantity: 1 }] };
    expect(eligibleTargets(rewards.get("metal")!, pledge, rewards)).toEqual([]);
    const pledge2 = { id: "p", rewardId: "t18", addons: [{ addonId: "metal", quantity: 1 }] };
    expect(eligibleTargets(rewards.get("metal")!, pledge2, rewards).map((t) => t.rewardId)).toEqual(["t18"]);
  });
});

describe("forcedSelections / buildModifierQuestions", () => {
  it("auto-assigns when copies held equal upgrades bought", () => {
    expect(forcedSelections([{ rewardId: "t18", title: "SW3-18", imageUrl: null, quantity: 1, kind: "tier" }], 1)).toEqual(["t18"]);
    expect(forcedSelections([{ rewardId: "a24", title: "x", imageUrl: null, quantity: 4, kind: "addon" }], 4)).toEqual(["a24", "a24", "a24", "a24"]);
    expect(forcedSelections([{ rewardId: "a24", title: "x", imageUrl: null, quantity: 4, kind: "addon" }], 2)).toBeNull();
  });

  it("asks one pick per copy when there is a real choice", () => {
    const pledge = {
      id: "p",
      rewardId: "t18",
      addons: [{ addonId: "a24", quantity: 2 }, { addonId: "foil", quantity: 2 }],
      modifierAssignments: [{ rewardId: "a24", modifierAddonId: "foil", unitIndex: 1, source: "SURVEY" }],
    };
    const [q] = buildModifierQuestions(pledge, rewards);
    expect(q.auto).toBe(false);
    expect(q.quantity).toBe(2);
    expect(q.selections).toEqual([null, "a24"]);
    expect(q.source).toBe("SURVEY");
  });
});

describe("validateSelections", () => {
  const q = { title: "Upgrade to foil", quantity: 2, targets: [{ rewardId: "t18", title: "SW3-18", imageUrl: null, quantity: 1, kind: "tier" as const }, { rewardId: "a24", title: "SW3-24 (Add-on)", imageUrl: null, quantity: 1, kind: "addon" as const }] };
  it("requires every copy", () => expect(validateSelections(q, ["t18", null])).toMatch(/2 needed/));
  it("rejects upgrading the same single copy twice", () => expect(validateSelections(q, ["t18", "t18"])).toMatch(/only have 1/));
  it("accepts a valid spread", () => expect(validateSelections(q, ["t18", "a24"])).toBeNull());
});

describe("suggestFromText", () => {
  const targets = [
    { rewardId: "t18", title: "SW3-18", imageUrl: null, quantity: 1, kind: "tier" as const },
    { rewardId: "a24", title: "SW3-24 (Add-on)", imageUrl: null, quantity: 1, kind: "addon" as const },
    { rewardId: "a12", title: "SW3-12 (Add-on)", imageUrl: null, quantity: 1, kind: "addon" as const },
  ];
  it("reads codes and bare numbers out of free text", () => {
    expect(suggestFromText("Sw3 12, 18 & 24", targets, 3, rewards).sort()).toEqual(["a12", "a24", "t18"]);
    expect(suggestFromText("18", targets, 1, rewards)).toEqual(["t18"]);
    expect(suggestFromText("SW3-24 please", targets, 1, rewards)).toEqual(["a24"]);
    expect(suggestFromText("LTD Jeweled Metal Cover", targets, 1, rewards)).toEqual([]);
  });
});

describe("resolvePledgeLines / computeProductionCounts", () => {
  it("moves assigned copies to the upgraded SKU and reports unassigned ones", () => {
    const pledge = {
      id: "p1",
      rewardId: "t18",
      addons: [{ addonId: "a24", quantity: 4 }, { addonId: "foil", quantity: 3 }],
      modifierAssignments: [
        { rewardId: "a24", modifierAddonId: "foil", unitIndex: 0 },
        { rewardId: "t18", modifierAddonId: "foil", unitIndex: 1 },
      ],
    };
    const lines = resolvePledgeLines(pledge, ctx);
    const byKey = Object.fromEntries(lines.map((l) => [l.key, l]));
    expect(byKey["t18"]).toBeUndefined(); // the only SW3-18 became foil
    expect(byKey["t18+foil"]).toMatchObject({ sku: "SW3-18-F", quantity: 1, skuDerived: true });
    expect(byKey["a24"]).toMatchObject({ sku: "SW3-24", quantity: 3 });
    expect(byKey["a24+foil"]).toMatchObject({ sku: "SW3-24-F", quantity: 1 });
    expect(byKey["unassigned:foil"]).toMatchObject({ kind: "unassigned_upgrade", quantity: 1 });
  });

  it("derives the suffix from the upgrade's name when none is set", () => {
    const noSuffix = new Map(rewards);
    noSuffix.set("foil", { ...rewards.get("foil")!, modifierSkuSuffix: null });
    noSuffix.set("rm", R("rm", "Upgrade to Raised Metal", "ADDON", { isModifier: true }));
    noSuffix.set("gitd", R("gitd", "Upgrade to glow in the dark", "ADDON", { isModifier: true }));
    const c = { ...ctx, rewardsById: noSuffix };
    expect(comboSku("t18", "foil", c).sku).toBe("SW3-18-F");
    expect(comboSku("t18", "rm", c).sku).toBe("SW3-18-RM");
    expect(comboSku("t18", "gitd", c).sku).toBe("SW3-18-GD");
    expect(defaultModifierSuffix("Upgrade")).toBeNull();
  });

  it("merges tier and add-on copies of one SKU into a single production line", () => {
    const a = { id: "a", rewardId: "t24", addons: [{ addonId: "a24", quantity: 2 }], modifierAssignments: [], surveyComplete: true };
    const b = { id: "b", rewardId: "t24", addons: [{ addonId: "foil", quantity: 1 }], modifierAssignments: [{ rewardId: "t24", modifierAddonId: "foil", unitIndex: 0 }], surveyComplete: true };
    const c = { id: "c", rewardId: "t18", addons: [{ addonId: "a24", quantity: 1 }, { addonId: "foil", quantity: 1 }], modifierAssignments: [{ rewardId: "a24", modifierAddonId: "foil", unitIndex: 0 }], surveyComplete: true };
    const lines = computeProductionCounts([a, b, c], ctx);
    const base = lines.find((l) => l.sku === "SW3-24")!;
    expect(base).toMatchObject({ total: 3, backers: 1, kind: "tier" });
    expect(base.titles.sort()).toEqual(["SW3-24", "SW3-24 (Add-on)"]);
    const foil = lines.find((l) => l.sku === "SW3-24-F")!;
    expect(foil).toMatchObject({ total: 2, backers: 2, kind: "upgrade", label: "SW3-24 + Upgrade to foil" });
    expect(lines.filter((l) => l.sku === "SW3-24-F")).toHaveLength(1);
  });

  it("prefers an explicit modifier SKU mapping over the derived code", () => {
    const mapped: SkuContext = { ...ctx, modifierSkuMappings: [{ baseRewardId: "t18", modifierAddonId: "foil", shopifySku: "SW3-18-FOIL-LTD" }] };
    const pledge = { id: "p", rewardId: "t18", addons: [{ addonId: "foil", quantity: 1 }], modifierAssignments: [{ rewardId: "t18", modifierAddonId: "foil", unitIndex: 0 }] };
    expect(resolvePledgeLines(pledge, mapped).find((l) => l.kind === "upgrade")).toMatchObject({ sku: "SW3-18-FOIL-LTD", skuDerived: false });
  });

  it("splits confirmed and pending by survey completion", () => {
    const done = { id: "a", rewardId: "t18", addons: [], modifierAssignments: [], surveyComplete: true };
    const open = { id: "b", rewardId: "t18", addons: [{ addonId: "coin", quantity: 2 }], modifierAssignments: [], surveyComplete: false };
    const lines = computeProductionCounts([done, open], ctx);
    expect(lines.find((l) => l.sku === "SW3-18")).toMatchObject({ confirmed: 1, pending: 1, total: 2, backers: 2 });
    expect(lines.find((l) => l.sku === "SW3-COIN")).toMatchObject({ confirmed: 0, pending: 2, total: 2 });
  });
});

describe("guessSkuFromTitle", () => {
  it("pulls a product code out of an item name", async () => {
    const { guessSkuFromTitle } = await import("../production-counts");
    expect(guessSkuFromTitle("SW3-18")).toBe("SW3-18");
    expect(guessSkuFromTitle("SW3-18 (Add-on)")).toBe("SW3-18");
    expect(guessSkuFromTitle("Lady Darth #1 CLEAN LD1-01")).toBe("LD1-01");
    expect(guessSkuFromTitle("Art Print of Your Choice Clean SW3-APYCC")).toBe("SW3-APYCC");
    expect(guessSkuFromTitle("SW1-9-SW2-26")).toBe("SW1-9-SW2-26");
    expect(guessSkuFromTitle("T-Shirt Green")).toBeNull();
    expect(guessSkuFromTitle("Challenge Coin")).toBeNull();
  });
});
