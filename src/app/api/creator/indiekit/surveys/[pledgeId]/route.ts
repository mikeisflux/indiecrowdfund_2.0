import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitSurveysLogger = logger.child({ module: "creator-indiekit-surveys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";
import { itemQuantity } from "@/lib/surveys/item-units";
import { auditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email/email-config";
import { z } from "zod";
import { buildModifierQuestions, forcedSelections, validateSelections } from "@/lib/fulfillment/modifiers";
import { autoAssignPledge, loadProjectRewardMap, writeAssignments } from "@/lib/fulfillment/modifiers-db";

export const dynamic = "force-dynamic";

// GET - Get survey response for a specific pledge (creator view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pledgeId } = await params;

    // Get pledge with project info
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId , deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            creatorId: true,
            collaborators: {
              where: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        },
        reward: {
          select: { id: true, title: true },
        },
        addons: {
          include: {
            addon: {
              select: { id: true, title: true },
            },
          },
        },
        modifierAssignments: {
          select: { id: true, rewardId: true, projectItemId: true, modifierAddonId: true, unitIndex: true, source: true },
        },
        user: {
          select: { name: true, email: true },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    // Verify creator/collaborator access
    const isOwner = pledge.project.creatorId === session.user.id;
    const isCollaborator = pledge.project.collaborators.length > 0;

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get survey for this project
    const survey = await db.survey.findUnique({
      where: { projectId: pledge.projectId },
      include: {
        itemQuestions: {
          include: {
            variants: { orderBy: { sortOrder: "asc" } },
            customQuestions: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { sortOrder: "asc" },
        },
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Order Lock confirmation. A campaign can run entirely on lock requests
    // and never send a survey: the backer confirms reward, add-ons and
    // address through the lock page, which marks the pledge survey-complete
    // with no SurveyResponse row. The creator views must show that
    // confirmation, not "no survey configured".
    const orderLock =
      pledge.orderLockStatus === "LOCKED"
        ? {
            status: "LOCKED" as const,
            lockedAt: pledge.orderLockedAt,
            charged: pledge.chargedImmediately || pledge.status === "COMPLETED",
          }
        : null;

    if (!survey) {
      // Still return the pledge block — the page header always renders
      // backer name/email/reward even when no survey is configured.
      // Returning the no-survey state without `pledge` made the dashboard
      // crash with "Cannot read properties of undefined (reading
      // 'backerName')" inside the dashboard error boundary.
      const lockAddress = resolvePledgeShippingAddress(null, pledge.shippingAddress);
      return NextResponse.json({
        survey: null,
        orderLock,
        response:
          lockAddress || orderLock
            ? {
                itemResponses: null,
                backerResponses: null,
                shippingAddress: lockAddress,
                isComplete: pledge.surveyCompleted === true,
                completedAt: pledge.orderLockedAt,
              }
            : null,
        pledge: {
          id: pledge.id,
          rewardTitle: pledge.reward?.title || "No Reward",
          backerName: pledge.user?.name,
          backerEmail: pledge.user?.email,
          addons: pledge.addons.map((a: { addon: { id: string; title: string } }) => ({
            id: a.addon.id,
            title: a.addon.title,
          })),
        },
        questions: { itemQuestions: [], backerQuestions: [] },
      });
    }

    // Get survey response for this pledge
    const response = await db.surveyResponse.findUnique({
      where: { pledgeId },
    });

    // Order-locked backers store their address on the pledge with no
    // SurveyResponse row — resolve + normalize so the detail view shows it.
    const resolvedAddress = resolvePledgeShippingAddress(
      response?.shippingAddress,
      pledge.shippingAddress
    );

    // Which item questions apply to THIS pledge, how many of each the backer
    // holds, and a picture, for the creator fill-in form. Same rules as the
    // backer's own survey (quantity per add-on unit, reward image fallback).
    // Upgrade add-ons are a structured pick (which item each copy applies
    // to), not an item question; forced ones are written now.
    const rewardsById = await loadProjectRewardMap(pledge.projectId);
    await autoAssignPledge(pledge, rewardsById);
    const freshRows = await db.pledgeModifierAssignment.findMany({
      where: { pledgeId },
      select: { id: true, rewardId: true, projectItemId: true, modifierAddonId: true, unitIndex: true, source: true },
    });
    const modifierQuestions = buildModifierQuestions({ ...pledge, modifierAssignments: freshRows }, rewardsById);
    const isModifierReward = (rewardId: string) => !!rewardsById.get(rewardId)?.isModifier;

    const addonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);
    const relevant = survey.itemQuestions.filter(
      (iq: { rewardId: string }) => (iq.rewardId === pledge.rewardId || addonIds.includes(iq.rewardId)) && !isModifierReward(iq.rewardId)
    );
    const rewardImages = relevant.length
      ? await db.reward.findMany({ where: { id: { in: relevant.map((iq: { rewardId: string }) => iq.rewardId) } }, select: { id: true, imageUrl: true } })
      : [];
    const imageByReward = new Map<string, string | null>(rewardImages.map((r: { id: string; imageUrl: string | null }) => [r.id, r.imageUrl]));
    const relevantItemQuestions = relevant.map((iq: { id: string; rewardId: string; imageUrl: string | null }) => ({
      id: iq.id,
      quantity: itemQuantity(iq.rewardId, pledge),
      imageUrl: iq.imageUrl || imageByReward.get(iq.rewardId) || null,
    }));

    // For creator view, return ALL survey questions (not filtered by reward)
    // This allows creators to see the complete survey configuration
    return NextResponse.json({
      survey: {
        id: survey.id,
        introTitle: survey.introTitle,
        introMessage: survey.introMessage,
        collectAddresses: survey.collectAddresses,
        status: survey.status,
        addressesLocked: survey.addressesLocked,
      },
      pledge: {
        id: pledge.id,
        rewardTitle: pledge.reward?.title || "No Reward",
        backerName: pledge.user?.name,
        backerEmail: pledge.user?.email,
        addons: pledge.addons.map((a: { addon: { id: string; title: string }; quantity: number }) => ({
          id: a.addon.id,
          title: a.addon.title,
          quantity: a.quantity,
        })),
        pledgeShippingAddress: resolvePledgeShippingAddress(null, pledge.shippingAddress),
      },
      orderLock,
      questions: {
        // Return all item questions from the survey
        itemQuestions: survey.itemQuestions,
        // Return all backer questions from the survey
        backerQuestions: survey.backerQuestions,
      },
      relevantItemQuestions,
      modifierQuestions,
      response: response
        ? {
            itemResponses: response.itemResponses,
            backerResponses: response.backerResponses,
            shippingAddress: resolvedAddress ?? response.shippingAddress,
            isComplete: response.isComplete,
            completedAt: response.completedAt,
            completedBy: response.completedBy,
          }
        : resolvedAddress
          ? {
              itemResponses: null,
              backerResponses: null,
              shippingAddress: resolvedAddress,
              isComplete: pledge.surveyCompleted === true,
              completedAt: null,
            }
          : null,
    });
  } catch (error) {
    creatorIndiekitSurveysLogger.error({ err: formatError(error) }, "Error fetching pledge survey response:");
    return NextResponse.json(
      { error: "Failed to fetch survey response" },
      { status: 500 }
    );
  }
}

const responseValue = z.union([z.string().max(10000), z.array(z.string().max(500)).max(50)]);
const fillSchema = z.object({
  itemResponses: z
    .record(z.string().max(100), z.object({ variants: z.record(z.string().max(100), z.string().max(500)).optional(), customAnswers: z.record(z.string().max(100), responseValue).optional() }))
    .optional(),
  backerResponses: z.record(z.string().max(100), responseValue).optional(),
  shippingAddress: z
    .object({
      name: z.string().max(100).optional(),
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      postalCode: z.string().max(20).optional(),
      country: z.string().max(60).optional(),
      phone: z.string().max(30).optional(),
    })
    .optional()
    .nullable(),
  // Upgrade add-ons: modifierAddonId -> rewardId per copy.
  modifierSelections: z.record(z.string().max(100), z.array(z.string().max(100).nullable()).max(100)).optional(),
  notifyBacker: z.boolean().default(true),
});

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

// PUT - Fill in (or correct) a backer's survey on their behalf.
//
// A backer who answered by email, DM, or at a convention table, or who never
// opened the survey, still has to be shipped the right thing. The creator
// enters the answers here; the response is marked complete and tagged
// completedBy CREATOR so it is never mistaken for the backer's own
// submission, and the backer gets an email listing what was recorded so a
// wrong guess surfaces before anything ships.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ pledgeId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { pledgeId } = await params;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            creatorId: true,
            creator: { select: { vanityUrl: true, name: true } },
            collaborators: { where: { userId: session.user.id, status: "ACCEPTED" }, select: { canCoordinateFulfillment: true, canConfigurePledgeManager: true } },
          },
        },
        reward: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
    });
    if (!pledge) return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    const isOwner = pledge.project.creatorId === session.user.id;
    const collab = pledge.project.collaborators[0];
    if (!isOwner && !(collab && (collab.canCoordinateFulfillment || collab.canConfigurePledgeManager))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId: pledge.projectId },
      include: { itemQuestions: { include: { variants: true, customQuestions: true } }, backerQuestions: true },
    });
    if (!survey) return NextResponse.json({ error: "This campaign has no survey yet. Build one in Pledge Manager first." }, { status: 400 });

    const raw = await req.json().catch(() => null);
    if (!raw) {
      creatorIndiekitSurveysLogger.warn({ pledgeId, actor: session.user.id }, "Creator survey fill: empty or unparseable body");
      return NextResponse.json({ error: "Nothing was sent to save. Reload the page and try again." }, { status: 400 });
    }
    const parsed = fillSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      creatorIndiekitSurveysLogger.warn({ pledgeId, actor: session.user.id, fieldErrors }, "Creator survey fill rejected");
      const where = Object.entries(fieldErrors)
        .map(([k, v]) => `${k}: ${(v as string[] | undefined)?.[0] ?? "invalid"}`)
        .join("; ");
      return NextResponse.json({ error: `Couldn't save: ${where || "invalid survey data"}`, details: fieldErrors }, { status: 400 });
    }
    const data = parsed.data;
    creatorIndiekitSurveysLogger.info(
      { pledgeId, actor: session.user.id, items: Object.keys(data.itemResponses ?? {}).length, upgrades: Object.keys(data.modifierSelections ?? {}).length, address: !!data.shippingAddress },
      "Creator survey fill received"
    );

    // Upgrade picks, same rules as the backer's own survey. Items with
    // nothing eligible are skipped rather than blocking the save.
    const pledgeForModifiers = await db.pledge.findFirst({
      where: { id: pledgeId },
      select: {
        id: true,
        rewardId: true,
        addons: { select: { addonId: true, quantity: true } },
        modifierAssignments: { select: { id: true, rewardId: true, projectItemId: true, modifierAddonId: true, unitIndex: true, source: true } },
      },
    });
    const rewardsById = await loadProjectRewardMap(pledge.projectId);
    const upgradeLines: string[] = [];
    if (pledgeForModifiers) {
      for (const q of buildModifierQuestions(pledgeForModifiers, rewardsById)) {
        let picks: string[];
        let source: "AUTO" | "CREATOR";
        if (q.auto) {
          picks = forcedSelections(q.targets, q.quantity)!;
          source = "AUTO";
        } else {
          const given = data.modifierSelections?.[q.modifierAddonId] ?? q.selections;
          if (q.targets.length === 0 || given.every((g) => g === null)) continue;
          const problem = validateSelections(q, given);
          if (problem) return NextResponse.json({ error: problem }, { status: 400 });
          picks = given.slice(0, q.quantity) as string[];
          source = "CREATOR";
        }
        await writeAssignments({ pledgeId, modifierAddonId: q.modifierAddonId, picks, source, assignedBy: session.user.id });
        upgradeLines.push(`${q.title}: ${picks.map((id) => rewardsById.get(id)?.title || id).join(", ")}`);
      }
    }

    const existing = await db.surveyResponse.findUnique({ where: { pledgeId } });
    const now = new Date();
    const response = await db.surveyResponse.upsert({
      where: { pledgeId },
      create: {
        surveyId: survey.id,
        pledgeId,
        itemResponses: data.itemResponses ?? {},
        backerResponses: data.backerResponses ?? {},
        shippingAddress: data.shippingAddress ?? undefined,
        isComplete: true,
        completedAt: now,
        completedBy: "CREATOR",
        completedById: session.user.id,
      },
      update: {
        itemResponses: data.itemResponses ?? existing?.itemResponses ?? {},
        backerResponses: data.backerResponses ?? existing?.backerResponses ?? {},
        ...(data.shippingAddress ? { shippingAddress: data.shippingAddress } : {}),
        isComplete: true,
        completedAt: existing?.completedAt ?? now,
        completedBy: "CREATOR",
        completedById: session.user.id,
      },
    });

    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        surveyCompleted: true,
        needsModifierAssignment: false,
        ...(data.shippingAddress ? { shippingAddress: data.shippingAddress } : {}),
        surveyResponses: { itemResponses: response.itemResponses, backerResponses: response.backerResponses },
      },
    });

    auditLog({
      action: "SURVEY_FILLED_BY_CREATOR",
      actorId: session.user.id,
      actorEmail: session.user.email || undefined,
      targetId: pledgeId,
      targetType: "PROJECT",
      details: { projectId: pledge.projectId, backerEmail: pledge.user?.email, wasComplete: !!existing?.isComplete, addressChanged: !!data.shippingAddress },
    });

    // Tell the backer what was recorded. Their copy to check, not a receipt
    // for something they did.
    if (data.notifyBacker && pledge.user?.email) {
      const lines: string[] = [];
      const items = (response.itemResponses ?? {}) as Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;
      for (const [key, resp] of Object.entries(items)) {
        const iq = survey.itemQuestions.find((q: { id: string }) => key === q.id || key.startsWith(`${q.id}#`));
        if (!iq) continue;
        const unit = key.includes("#") ? ` (#${key.split("#")[1]})` : "";
        for (const v of iq.variants) {
          const val = resp.variants?.[v.id] ?? resp.variants?.[v.variantType];
          if (val) lines.push(`${iq.itemName}${unit} — ${v.variantType}: ${val}`);
        }
        for (const cq of iq.customQuestions) {
          const a = resp.customAnswers?.[cq.id];
          const val = Array.isArray(a) ? a.join(", ") : a;
          if (val) lines.push(`${iq.itemName}${unit} — ${cq.question}: ${val}`);
        }
      }
      lines.push(...upgradeLines);
      const backerAnswers = (response.backerResponses ?? {}) as Record<string, string | string[]>;
      for (const bq of survey.backerQuestions) {
        const a = backerAnswers[bq.id];
        const val = Array.isArray(a) ? a.join(", ") : a;
        if (val) lines.push(`${bq.question}: ${val}`);
      }
      const addr = (response.shippingAddress ?? null) as { name?: string; line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
      if (addr?.line1) lines.push(`Shipping to: ${[addr.name, addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(", ")}`);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
      const creatorName = pledge.project.creator?.name || "The creator";
      await sendEmail({
        to: pledge.user.email,
        subject: `${creatorName} filled in your survey for "${pledge.project.title}"`,
        html: `<p>Hi ${escapeHtml(pledge.user.name || "there")},</p>
<p>${escapeHtml(creatorName)} entered your survey answers for <strong>${escapeHtml(pledge.project.title)}</strong> on your behalf${pledge.reward?.title ? ` (${escapeHtml(pledge.reward.title)})` : ""}. Here is what was recorded:</p>
<ul>${lines.length ? lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("") : "<li>No item choices were needed; the order and address were confirmed.</li>"}</ul>
<p>If any of this is wrong, reply to this email or message the creator through your IndieCrowdfund inbox before the campaign ships. You can review it any time at <a href="${appUrl}/dashboard/pledges/${pledgeId}/survey">${appUrl}/dashboard/pledges/${pledgeId}/survey</a>.</p>`,
        skipUnsubscribeCheck: true,
      }).catch((err: unknown) => creatorIndiekitSurveysLogger.warn({ err: String(err), pledgeId }, "backer notice for creator-filled survey failed"));
    }

    creatorIndiekitSurveysLogger.info({ pledgeId, actor: session.user.id, responseId: response.id }, "Creator survey fill saved");
    return NextResponse.json({ ok: true, isComplete: true, completedBy: "CREATOR" });
  } catch (error) {
    creatorIndiekitSurveysLogger.error({ err: formatError(error) }, "Error filling survey for backer:");
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: `Failed to save survey${message ? `: ${message.slice(0, 200)}` : ""}` }, { status: 500 });
  }
}
