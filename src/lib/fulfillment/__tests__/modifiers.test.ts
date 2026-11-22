import { describe, expect, it } from "vitest";
import {
  buildModifierQuestions,
  eligibleTargets,
  forcedSelections,
  suggestFromText,
  targetKey,
  validateSelections,
  type EligibleTarget,
  type ModifierRewardShape,
} from "../modifiers";
import {
  comboSku,
  computeProductionCounts,
  defaultModifierSuffix,
  guessSkuFromTitle,
  resolvePledgeLines,
  type ProjectItemShape,
  type SkuContext,
} from "../production-counts";

// Items are the real product codes (ProjectItem titles), as creators set
// them up in the campaign builder; rewards point at them through RewardItem.
const ITEMS: ProjectItemShape[] = [
  { id: "i18", title: "SW3-18", sku: null, inStock: false },
  { id: "i22", title: "SW3-22", sku: null, inStock: false },
  { id: "i24", title: "SW3-24", sku: null, inStock: true },
  { id: "i12", title: "SW3-12", sku: null, inStock: false },
  { id: "ibox", title: "SW3-BOX", sku: null, inStock: false },
  { id: "icoin", title: "SW3-CC", sku: null, inStock: false },
];
const item = (id: string) => ({ projectItemId: id, title: ITEMS.find((i) => i.id === id)!.title });

const R = (id: string, title: string, type: "TIER" | "ADDON", extra: Partial<ModifierRewardShape> = {}): ModifierRewardShape => ({
  id,
  title,
  type,
  shippingType: "WORLDWIDE",
  isModifier: false,
  modifiesRewardIds: [],
  sku: null,
  modifierSkuSuffix: null,
  items: [],
  ...extra,
});

const rewards = new Map<string, ModifierRewardShape>(
  [
    R("t18", "SW3-18", "TIER", { items: [item("i18")] }),
    R("t24", "SW3-24", "TIER", { items: [item("i24")] }),
    R("tbox", "The Rebel Box", "TIER", { items: [item("ibox"), item("i22"), item("i24")] }),
    R("tdig", "Digital Deluxe", "TIER", { shippingType: "NO_SHIPPING" }),
    R("a24", "SW3-24 (Add-on)", "ADDON", { items: [item("i24")] }),
    R("a12", "SW3-12 (Add-on)", "ADDON", { items: [item("i12")] }),
    R("coin", "Challenge Coin", "ADDON", { items: [item("icoin")] }),
    R("plain", "Sticker Pack", "ADDON", { sku: "SW3-STK" }), // no item breakdown
    R("foil", "Upgrade to foil", "ADDON", { isModifier: true, modifierSkuSuffix: "-F" }),
    R("metal", "Upgrade to metal", "ADDON", { isModifier: true, modifierSkuSuffix: "-M", modifiesRewardIds: ["i18"] }),
  ].map((r) => [r.id, r]),
);

const ctx: SkuContext = {
  rewardsById: rewards,
  projectItemsById: new Map(ITEMS.map((i) => [i.id, i])),
  skuMappings: [],
  modifierSkuMappings: [],
};

const T = (rewardId: string, projectItemId: string | null, title: string, quantity: number, kind: "tier" | "addon" = "addon"): EligibleTarget => ({
  key: targetKey(rewardId, projectItemId),
  rewardId,
  projectItemId,
  title,
  imageUrl: null,
  quantity,
  kind,
});

describe("eligibleTargets", () => {
  it("lists physical items of the tier and add-ons, never digital rewards or other modifiers", () => {
    const pledge = { id: "p", rewardId: "tdig", addons: [{ addonId: "a24", quantity: 4 }, { addonId: "foil", quantity: 4 }, { addonId: "coin", quantity: 1 }] };
    const targets = eligibleTargets(rewards.get("foil")!, pledge, rewards);
    expect(targets.map((t) => [t.projectItemId, t.quantity])).toEqual([["i24", 4], ["icoin", 1]]);
  });

  it("breaks a bundle reward into its items", () => {
    const pledge = { id: "p", rewardId: "tbox", addons: [{ addonId: "foil", quantity: 1 }] };
    const targets = eligibleTargets(rewards.get("foil")!, pledge, rewards);
    expect(targets.map((t) => t.title)).toEqual(["SW3-BOX (from The Rebel Box)", "SW3-22 (from The Rebel Box)", "SW3-24 (from The Rebel Box)"]);
  });

  it("merges the same item held through two rewards", () => {
    const pledge = { id: "p", rewardId: "t24", addons: [{ addonId: "a24", quantity: 2 }, { addonId: "foil", quantity: 1 }] };
    const targets = eligibleTargets(rewards.get("foil")!, pledge, rewards);
    expect(targets).toHaveLength(2); // tier's i24 and add-on's i24 are different reward sources
    expect(targets.reduce((s, t) => s + t.quantity, 0)).toBe(3);
  });

  it("respects a narrowed eligibility list of item ids or reward ids", () => {
    const pledge = { id: "p", rewardId: "t24", addons: [{ addonId: "a12", quantity: 1 }, { addonId: "metal", quantity: 1 }] };
    expect(eligibleTargets(rewards.get("metal")!, pledge, rewards)).toEqual([]);
    const pledge2 = { id: "p", rewardId: "t18", addons: [{ addonId: "metal", quantity: 1 }] };
    expect(eligibleTargets(rewards.get("metal")!, pledge2, rewards).map((t) => t.projectItemId)).toEqual(["i18"]);
  });
});

describe("forcedSelections / buildModifierQuestions", () => {
  it("auto-assigns when copies held equal upgrades bought", () => {
    expect(forcedSelections([T("t18", "i18", "SW3-18", 1, "tier")], 1)).toEqual([targetKey("t18", "i18")]);
    expect(forcedSelections([T("a24", "i24", "x", 4)], 4)).toEqual(Array(4).fill(targetKey("a24", "i24")));
    expect(forcedSelections([T("a24", "i24", "x", 4)], 2)).toBeNull();
  });

  it("asks one pick per copy and reads legacy reward-only rows as the reward's item", () => {
    const pledge = {
      id: "p",
      rewardId: "t18",
      addons: [{ addonId: "a24", quantity: 2 }, { addonId: "foil", quantity: 2 }],
      modifierAssignments: [{ rewardId: "a24", projectItemId: null, modifierAddonId: "foil", unitIndex: 1, source: "SURVEY" }],
    };
    const [q] = buildModifierQuestions(pledge, rewards);
    expect(q.auto).toBe(false);
    expect(q.quantity).toBe(2);
    expect(q.selections).toEqual([null, targetKey("a24", "i24")]);
    expect(q.source).toBe("SURVEY");
  });
});

describe("validateSelections", () => {
  const q = { title: "Upgrade to foil", quantity: 2, targets: [T("t18", "i18", "SW3-18", 1, "tier"), T("a24", "i24", "SW3-24 (Add-on)", 1)] };
  const k18 = targetKey("t18", "i18");
  const k24 = targetKey("a24", "i24");
  it("requires every copy", () => expect(validateSelections(q, [k18, null])).toMatch(/2 needed/));
  it("rejects upgrading the same single copy twice", () => expect(validateSelections(q, [k18, k18])).toMatch(/only have 1/));
  it("accepts a valid spread", () => expect(validateSelections(q, [k18, k24])).toBeNull());
});

describe("suggestFromText", () => {
  const targets = [T("t18", "i18", "SW3-18", 1, "tier"), T("a24", "i24", "SW3-24 (Add-on)", 1), T("a12", "i12", "SW3-12 (Add-on)", 1)];
  it("reads codes and bare numbers out of free text", () => {
    expect(suggestFromText("Sw3 12, 18 & 24", targets, 3, rewards).sort()).toEqual([targetKey("a12", "i12"), targetKey("a24", "i24"), targetKey("t18", "i18")].sort());
    expect(suggestFromText("18", targets, 1, rewards)).toEqual([targetKey("t18", "i18")]);
    expect(suggestFromText("SW3-24 please", targets, 1, rewards)).toEqual([targetKey("a24", "i24")]);
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
        { rewardId: "a24", projectItemId: "i24", modifierAddonId: "foil", unitIndex: 0 },
        { rewardId: "t18", projectItemId: "i18", modifierAddonId: "foil", unitIndex: 1 },
      ],
    };
    const lines = resolvePledgeLines(pledge, ctx);
    const bySku = Object.fromEntries(lines.map((l) => [l.sku ?? l.key, l]));
    expect(bySku["SW3-18"]).toBeUndefined(); // the only SW3-18 became foil
    expect(bySku["SW3-18-F"]).toMatchObject({ kind: "upgrade", quantity: 1, skuDerived: true, baseProjectItemId: "i18" });
    expect(bySku["SW3-24"]).toMatchObject({ quantity: 3 });
    expect(bySku["SW3-24-F"]).toMatchObject({ quantity: 1 });
    expect(bySku["unassigned:foil"]).toMatchObject({ kind: "unassigned_upgrade", quantity: 1 });
  });

  it("upgrades one item inside a bundle, leaving the rest of the bundle alone", () => {
    const pledge = {
      id: "p",
      rewardId: "tbox",
      addons: [{ addonId: "foil", quantity: 1 }],
      modifierAssignments: [{ rewardId: "tbox", projectItemId: "i22", modifierAddonId: "foil", unitIndex: 0 }],
    };
    const skus = resolvePledgeLines(pledge, ctx).map((l) => `${l.sku}×${l.quantity}`);
    expect(skus.sort()).toEqual(["SW3-22-F×1", "SW3-24×1", "SW3-BOX×1"]);
  });

  it("uses the upgraded edition's own item once it exists", () => {
    const withVariant: SkuContext = {
      ...ctx,
      projectItemsById: new Map([...ctx.projectItemsById, ["v", { id: "v", title: "SW3-18-F", sku: "SW3-18-FOIL", inStock: true, upgradeOfItemId: "i18", upgradeModifierId: "foil" }]]),
    };
    const pledge = { id: "p", rewardId: "t18", addons: [{ addonId: "foil", quantity: 1 }], modifierAssignments: [{ rewardId: "t18", projectItemId: "i18", modifierAddonId: "foil", unitIndex: 0 }] };
    expect(resolvePledgeLines(pledge, withVariant).find((l) => l.kind === "upgrade")).toMatchObject({ sku: "SW3-18-FOIL", projectItemId: "v", skuDerived: false });
  });

  it("derives the suffix from the upgrade's name when none is set", () => {
    const noSuffix = new Map(rewards);
    noSuffix.set("foil", { ...rewards.get("foil")!, modifierSkuSuffix: null });
    noSuffix.set("rm", R("rm", "Upgrade to Raised Metal", "ADDON", { isModifier: true }));
    noSuffix.set("gitd", R("gitd", "Upgrade to glow in the dark", "ADDON", { isModifier: true }));
    const c = { ...ctx, rewardsById: noSuffix };
    expect(comboSku("t18", "i18", "foil", c).sku).toBe("SW3-18-F");
    expect(comboSku("t18", "i18", "rm", c).sku).toBe("SW3-18-RM");
    expect(comboSku("t18", "i18", "gitd", c).sku).toBe("SW3-18-GD");
    expect(comboSku("plain", null, "foil", c).sku).toBe("SW3-STK-F");
    expect(defaultModifierSuffix("Upgrade")).toBeNull();
  });

  it("merges tier and add-on copies of one SKU and subtracts shipped and pushed units", () => {
    const a = { id: "a", rewardId: "t24", addons: [{ addonId: "a24", quantity: 2 }], modifierAssignments: [], surveyComplete: true, fulfillmentStatus: "SHIPPED", orderLockStatus: "LOCKED" };
    const b = { id: "b", rewardId: "t24", addons: [{ addonId: "foil", quantity: 1 }], modifierAssignments: [{ rewardId: "t24", projectItemId: "i24", modifierAddonId: "foil", unitIndex: 0 }], surveyComplete: true, fulfillmentStatus: "IN_PROGRESS" };
    const c = { id: "c", rewardId: "t18", addons: [{ addonId: "a24", quantity: 1 }, { addonId: "foil", quantity: 1 }], modifierAssignments: [{ rewardId: "a24", projectItemId: "i24", modifierAddonId: "foil", unitIndex: 0 }], surveyComplete: false, fulfillmentStatus: "NOT_STARTED" };
    const lines = computeProductionCounts([a, b, c], ctx);
    const base = lines.find((l) => l.sku === "SW3-24")!;
    expect(base).toMatchObject({ total: 3, shipped: 3, pushed: 0, locked: 3, toProduce: 0, backers: 1, kind: "tier", projectItemId: "i24" });
    expect(base.titles.sort()).toEqual(["SW3-24"]);
    const foil = lines.find((l) => l.sku === "SW3-24-F")!;
    expect(foil).toMatchObject({ total: 2, shipped: 0, pushed: 1, toProduce: 1, backers: 2, kind: "upgrade", label: "SW3-24 + Upgrade to foil", confirmed: 1, pending: 1 });
    expect(lines.filter((l) => l.sku === "SW3-24-F")).toHaveLength(1);
    expect(lines.find((l) => l.sku === "SW3-18")).toMatchObject({ total: 1, toProduce: 1 });
  });
});

describe("guessSkuFromTitle", () => {
  it("pulls a product code out of an item name", () => {
    expect(guessSkuFromTitle("SW3-18")).toBe("SW3-18");
    expect(guessSkuFromTitle("SW3-18 (Add-on)")).toBe("SW3-18");
    expect(guessSkuFromTitle("Lady Darth #1 CLEAN LD1-01")).toBe("LD1-01");
    expect(guessSkuFromTitle("Art Print of Your Choice Clean SW3-APYCC")).toBe("SW3-APYCC");
    expect(guessSkuFromTitle("SW1-9-SW2-26")).toBe("SW1-9-SW2-26");
    expect(guessSkuFromTitle("T-Shirt Green")).toBeNull();
    expect(guessSkuFromTitle("Challenge Coin")).toBeNull();
  });
});
