import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import {
  buildModifierQuestions,
  suggestFromText,
  validateSelections,
  type ModifierQuestion,
} from "@/lib/fulfillment/modifiers";
import { autoAssignPledge, loadProjectRewardMap, writeAssignments } from "@/lib/fulfillment/modifiers-db";
import {
  computeProductionCounts,
  computeVariantCounts,
  guessSkuFromTitle,
  productionCsv,
  comboSku,
  type SkuContext,
} from "@/lib/fulfillment/production-counts";

const log = logger.child({ module: "creator-indiekit-production" });

export const dynamic = "force-dynamic";

/**
 * Production view of a campaign: what to make, by SKU, and what is still
 * unknown because a backer hasn't said which item an upgrade applies to.
 *
 * GET ?projectId=…            counts + unresolved upgrades + setup data
 * GET ?projectId=…&format=csv the counts table as a download
 * GET ?projectId=…&pledgeId=… one pledge's upgrade questions (backer dialog)
 * POST { action }             assign_units | auto_assign_all | set_reward_sku |
 *                             set_modifier | suggest_skus
 */

async function projectForUser(projectId: string, userId: string) {
  return db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [{ creatorId: userId }, { collaborators: { some: { userId, status: "ACCEPTED" } } }],
    },
    select: { id: true, title: true },
  });
}

const PLEDGE_SELECT = {
  id: true,
  backerNumber: true,
  rewardId: true,
  surveyCompleted: true,
  orderLockStatus: true,
  user: { select: { name: true, email: true } },
  addons: { select: { addonId: true, quantity: true } },
  modifierAssignments: { select: { id: true, rewardId: true, modifierAddonId: true, unitIndex: true, source: true } },
  surveyResponse: { select: { isComplete: true, itemResponses: true } },
} as const;

type PledgeRow = {
  id: string;
  backerNumber: number | null;
  rewardId: string | null;
  surveyCompleted: boolean;
  orderLockStatus: string;
  user: { name: string | null; email: string | null };
  addons: { addonId: string; quantity: number }[];
  modifierAssignments: { id: string; rewardId: string; modifierAddonId: string; unitIndex: number; source: string | null }[];
  surveyResponse: { isComplete: boolean; itemResponses: unknown } | null;
};

async function loadSkuContext(projectId: string): Promise<SkuContext> {
  const [rewardsById, skuMappings, modifierSkuMappings] = await Promise.all([
    loadProjectRewardMap(projectId),
    db.shopifySkuMapping.findMany({
      where: { projectId },
      select: { sourceType: true, sourceId: true, shopifySku: true, shopifyVariantId: true, quantity: true },
    }),
    db.modifierSkuMapping.findMany({
      where: { projectId },
      select: { baseRewardId: true, modifierAddonId: true, shopifySku: true, shopifyVariantId: true },
    }),
  ]);
  return { rewardsById, skuMappings, modifierSkuMappings };
}

/**
 * The old free-text answer for a modifier add-on's item question ("which
 * cover do you want upgraded?"), joined across units, so the creator can
 * see what the backer meant while resolving it.
 */
function legacyAnswer(
  itemResponses: unknown,
  itemQuestions: { id: string; rewardId: string; customQuestions: { id: string }[] }[],
  modifierAddonId: string,
): string | null {
  const iq = itemQuestions.find((q) => q.rewardId === modifierAddonId);
  if (!iq || !itemResponses || typeof itemResponses !== "object") return null;
  const parts: string[] = [];
  for (const [key, resp] of Object.entries(itemResponses as Record<string, { customAnswers?: Record<string, string | string[]> }>)) {
    if (key !== iq.id && !key.startsWith(`${iq.id}#`)) continue;
    for (const cq of iq.customQuestions) {
      const a = resp?.customAnswers?.[cq.id];
      const val = Array.isArray(a) ? a.join(", ") : a;
      if (val && String(val).trim()) parts.push(String(val).trim());
    }
  }
  return parts.length ? parts.join(" | ") : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const pledgeId = searchParams.get("pledgeId");
    const format = searchParams.get("format");
    if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

    const project = await projectForUser(projectId, session.user.id);
    if (!project) return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });

    const ctx = await loadSkuContext(projectId);
    const survey = await db.survey.findUnique({
      where: { projectId },
      select: {
        itemQuestions: {
          select: {
            id: true,
            rewardId: true,
            itemName: true,
            variants: { select: { id: true, variantType: true, options: true, skuPrefix: true } },
            customQuestions: { select: { id: true, question: true, questionType: true, options: true } },
          },
        },
      },
    });
    const itemQuestions = survey?.itemQuestions ?? [];

    // One pledge: its upgrade questions with the legacy text and a guess.
    if (pledgeId) {
      const pledge = (await db.pledge.findFirst({ where: { id: pledgeId, projectId, deletedAt: null }, select: PLEDGE_SELECT })) as PledgeRow | null;
      if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      await autoAssignPledge(pledge, ctx.rewardsById);
      const rows = await db.pledgeModifierAssignment.findMany({
        where: { pledgeId },
        select: { id: true, rewardId: true, modifierAddonId: true, unitIndex: true, source: true },
      });
      const questions = buildModifierQuestions({ ...pledge, modifierAssignments: rows }, ctx.rewardsById).map((q) => decorate(q, pledge, itemQuestions, ctx));
      return NextResponse.json({ questions });
    }

    const pledges = (await db.pledge.findMany({
      where: { projectId, deletedAt: null, status: "COMPLETED" },
      select: PLEDGE_SELECT,
      orderBy: { backerNumber: "asc" },
    })) as PledgeRow[];

    const forCounts = pledges.map((p) => ({
      ...p,
      surveyComplete: !!p.surveyResponse?.isComplete || p.surveyCompleted || p.orderLockStatus === "LOCKED",
      itemResponses: p.surveyResponse?.itemResponses,
    }));

    const lines = computeProductionCounts(forCounts, ctx);
    if (format === "csv") {
      const safeTitle = project.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "campaign";
      return new NextResponse(productionCsv(lines), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="production-${safeTitle}.csv"`,
        },
      });
    }
    const variants = computeVariantCounts(itemQuestions, forCounts, ctx);

    // Every pledge with an upgrade copy that still has no target.
    const unresolved: unknown[] = [];
    let upgradeBackers = 0;
    for (const p of pledges) {
      const questions = buildModifierQuestions(p, ctx.rewardsById);
      if (questions.length === 0) continue;
      upgradeBackers++;
      const open = questions.filter((q) => !q.auto && q.selections.some((s) => s === null));
      if (open.length === 0) continue;
      unresolved.push({
        pledgeId: p.id,
        backerNumber: p.backerNumber,
        name: p.user?.name || "Anonymous",
        email: p.user?.email || "",
        surveyComplete: !!p.surveyResponse?.isComplete || p.surveyCompleted,
        questions: open.map((q) => decorate(q, p, itemQuestions, ctx)),
      });
    }

    const rewards = Array.from(ctx.rewardsById.values())
      .filter((r) => r.type === "TIER" || r.type === "ADDON")
      .map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        sku: r.sku ?? null,
        mappedSku: ctx.skuMappings.find((m) => m.sourceId === r.id)?.shopifySku ?? null,
        isModifier: !!r.isModifier,
        modifiesRewardIds: r.modifiesRewardIds ?? [],
        modifierSkuSuffix: r.modifierSkuSuffix ?? null,
        shippingType: r.shippingType ?? null,
      }));

    const surveysComplete = forCounts.filter((p) => p.surveyComplete).length;
    return NextResponse.json({
      lines,
      variantLines: variants.lines,
      variantUnanswered: variants.unanswered,
      unresolved,
      rewards,
      summary: {
        backers: pledges.length,
        surveysComplete,
        surveysPending: pledges.length - surveysComplete,
        upgradeBackers,
        unresolvedBackers: unresolved.length,
        unitsConfirmed: lines.filter((l) => l.kind !== "unassigned_upgrade").reduce((s, l) => s + l.confirmed, 0),
        unitsPending: lines.filter((l) => l.kind !== "unassigned_upgrade").reduce((s, l) => s + l.pending, 0),
        missingSku: lines.filter((l) => l.kind !== "unassigned_upgrade" && !l.sku).length,
      },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Production GET error");
    return NextResponse.json({ error: "Failed to load production data" }, { status: 500 });
  }
}

function decorate(
  q: ModifierQuestion,
  pledge: PledgeRow,
  itemQuestions: { id: string; rewardId: string; customQuestions: { id: string }[] }[],
  ctx: SkuContext,
) {
  const legacy = legacyAnswer(pledge.surveyResponse?.itemResponses, itemQuestions, q.modifierAddonId);
  const suggested = q.selections.every((s) => s !== null) ? [] : suggestFromText(legacy, q.targets, q.quantity, ctx.rewardsById);
  return {
    ...q,
    legacyAnswer: legacy,
    suggested,
    targets: q.targets.map((t) => ({ ...t, sku: comboSku(t.rewardId, q.modifierAddonId, ctx).sku })),
  };
}

const assignSchema = z.object({
  action: z.literal("assign_units"),
  projectId: z.string(),
  pledgeId: z.string(),
  modifierAddonId: z.string(),
  picks: z.array(z.string().max(100).nullable()).max(100),
});
const autoSchema = z.object({ action: z.literal("auto_assign_all"), projectId: z.string() });
const skuSchema = z.object({
  action: z.literal("set_reward_sku"),
  projectId: z.string(),
  rewardId: z.string(),
  sku: z.string().max(100).nullable(),
});
const modifierSchema = z.object({
  action: z.literal("set_modifier"),
  projectId: z.string(),
  addonId: z.string(),
  isModifier: z.boolean(),
  modifiesRewardIds: z.array(z.string().max(100)).max(500).optional(),
  modifierSkuSuffix: z.string().max(40).nullable().optional(),
});
const suggestSchema = z.object({ action: z.literal("suggest_skus"), projectId: z.string() });
const bodySchema = z.discriminatedUnion("action", [assignSchema, autoSchema, skuSchema, modifierSchema, suggestSchema]);

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const body = parsed.data;

    const project = await projectForUser(body.projectId, session.user.id);
    if (!project) return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    const projectId = project.id;

    if (body.action === "assign_units") {
      const pledge = (await db.pledge.findFirst({ where: { id: body.pledgeId, projectId, deletedAt: null }, select: PLEDGE_SELECT })) as PledgeRow | null;
      if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      const rewardsById = await loadProjectRewardMap(projectId);
      const q = buildModifierQuestions(pledge, rewardsById).find((x) => x.modifierAddonId === body.modifierAddonId);
      if (!q) return NextResponse.json({ error: "This backer does not have that upgrade" }, { status: 400 });
      const problem = validateSelections(q, body.picks);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      await writeAssignments({
        pledgeId: pledge.id,
        modifierAddonId: q.modifierAddonId,
        picks: body.picks.slice(0, q.quantity) as string[],
        source: "CREATOR",
        assignedBy: session.user.id,
      });
      const fresh = (await db.pledge.findFirst({ where: { id: pledge.id }, select: PLEDGE_SELECT })) as PledgeRow;
      const stillOpen = buildModifierQuestions(fresh, rewardsById).some((x) => !x.auto && x.selections.some((s) => s === null));
      await db.pledge.update({ where: { id: pledge.id }, data: { needsModifierAssignment: stillOpen } });
      return NextResponse.json({ success: true, needsModifierAssignment: stillOpen });
    }

    if (body.action === "auto_assign_all") {
      const rewardsById = await loadProjectRewardMap(projectId);
      const pledges = (await db.pledge.findMany({
        where: { projectId, deletedAt: null, status: "COMPLETED" },
        select: PLEDGE_SELECT,
      })) as PledgeRow[];
      let assigned = 0;
      let unresolved = 0;
      for (const p of pledges) {
        const r = await autoAssignPledge(p, rewardsById);
        assigned += r.assigned;
        unresolved += r.unresolved;
      }
      return NextResponse.json({ success: true, assigned, unresolved });
    }

    if (body.action === "set_reward_sku") {
      const reward = await db.reward.findFirst({ where: { id: body.rewardId, projectId }, select: { id: true } });
      if (!reward) return NextResponse.json({ error: "Reward not found" }, { status: 404 });
      const sku = body.sku?.trim() || null;
      await db.reward.update({ where: { id: reward.id }, data: { sku } });
      return NextResponse.json({ success: true, sku });
    }

    if (body.action === "set_modifier") {
      const addon = await db.reward.findFirst({ where: { id: body.addonId, projectId, type: "ADDON" }, select: { id: true, title: true } });
      if (!addon) return NextResponse.json({ error: "Add-on not found" }, { status: 404 });
      const modifiesRewardIds = body.modifiesRewardIds ?? [];
      if (modifiesRewardIds.length) {
        const count = await db.reward.count({ where: { id: { in: modifiesRewardIds }, projectId } });
        if (count !== new Set(modifiesRewardIds).size) return NextResponse.json({ error: "Eligible items must belong to this campaign" }, { status: 400 });
      }
      await db.reward.update({
        where: { id: addon.id },
        data: {
          isModifier: body.isModifier,
          modifiesRewardIds: body.isModifier ? modifiesRewardIds : [],
          modifierSkuSuffix: body.isModifier ? body.modifierSkuSuffix?.trim() || null : null,
        },
      });
      auditLog({
        action: "MODIFIER_CHANGE",
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetId: addon.id,
        targetType: "REWARD",
        details: { subaction: "set_modifier", projectId, isModifier: body.isModifier, modifiesRewardIds: modifiesRewardIds.slice(0, 50), suffix: body.modifierSkuSuffix ?? null },
      });
      // Newly-marked upgrades may now be forced for some backers.
      let assigned = 0;
      if (body.isModifier) {
        const rewardsById = await loadProjectRewardMap(projectId);
        const pledges = (await db.pledge.findMany({
          where: { projectId, deletedAt: null, status: "COMPLETED", addons: { some: { addonId: addon.id } } },
          select: PLEDGE_SELECT,
        })) as PledgeRow[];
        for (const p of pledges) assigned += (await autoAssignPledge(p, rewardsById)).assigned;
      }
      return NextResponse.json({ success: true, assigned });
    }

    if (body.action === "suggest_skus") {
      // Items whose title already IS a product code ("SW3-18", "LD1-01",
      // "Art Print of Your Choice Clean SW3-APYCC") get it as their SKU.
      // Only fills blanks; never overwrites a code the creator typed.
      const rewards = await db.reward.findMany({
        where: { projectId, type: { in: ["TIER", "ADDON"] }, OR: [{ sku: null }, { sku: "" }] },
        select: { id: true, title: true },
      });
      let filled = 0;
      for (const r of rewards) {
        const guess = guessSkuFromTitle(r.title);
        if (!guess) continue;
        await db.reward.update({ where: { id: r.id }, data: { sku: guess } });
        filled++;
      }
      return NextResponse.json({ success: true, filled });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    log.error({ err: formatError(error) }, "Production POST error");
    return NextResponse.json({ error: "Failed to update production data" }, { status: 500 });
  }
}
