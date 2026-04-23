import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth-helpers";

const cleanupSurveyResponsesLogger = logger.child({
  module: "admin-cleanup-survey-responses",
});

export const dynamic = "force-dynamic";

// Only pledges in this status can legitimately own a survey response.
// Anything else (PENDING / FAILED / REFUNDED / CANCELLED / CHARGEBACK) means
// the user never actually backed the project and must not receive fulfillment.
const VALID_PLEDGE_STATUS = "COMPLETED" as const;

/**
 * GET - Audit stale survey responses whose pledge is not COMPLETED.
 *
 * Pairs with the audience-gating fix so creators can see which
 * non-backers snuck through the previous PENDING-inclusive query and
 * filled out a survey before the gate was closed.
 *
 * Query params:
 * - projectId (optional): restrict to a single project
 * - onlyComplete (optional, default "true"): only list responses whose
 *   `isComplete` flag is true (i.e. the ones that would actually ship).
 *   Pass "false" to see in-progress drafts too.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const onlyComplete = searchParams.get("onlyComplete") !== "false";

    const responses = await db.surveyResponse.findMany({
      where: {
        ...(onlyComplete ? { isComplete: true } : {}),
        ...(projectId ? { survey: { projectId } } : {}),
      },
      select: {
        id: true,
        surveyId: true,
        pledgeId: true,
        isComplete: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        survey: {
          select: { projectId: true },
        },
      },
    });

    if (responses.length === 0) {
      return NextResponse.json({ total: 0, stale: 0, responses: [] });
    }

    const pledgeIds = responses.map((r) => r.pledgeId);
    const pledges = await db.pledge.findMany({
      where: { id: { in: pledgeIds } },
      select: {
        id: true,
        status: true,
        projectId: true,
        userId: true,
        amount: true,
        createdAt: true,
        deletedAt: true,
        user: { select: { id: true, email: true, name: true } },
        project: { select: { id: true, title: true, slug: true } },
      },
    });
    const pledgeById = new Map(pledges.map((p) => [p.id, p]));

    const stale = responses
      .map((r) => {
        const pledge = pledgeById.get(r.pledgeId) ?? null;
        return { response: r, pledge };
      })
      .filter(({ pledge }) => !pledge || pledge.status !== VALID_PLEDGE_STATUS || pledge.deletedAt !== null);

    return NextResponse.json({
      total: responses.length,
      stale: stale.length,
      responses: stale.map(({ response, pledge }) => ({
        responseId: response.id,
        surveyId: response.surveyId,
        pledgeId: response.pledgeId,
        isComplete: response.isComplete,
        completedAt: response.completedAt,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        pledge: pledge
          ? {
              id: pledge.id,
              status: pledge.status,
              projectId: pledge.projectId,
              amount: Number(pledge.amount),
              deletedAt: pledge.deletedAt,
              user: pledge.user,
              project: pledge.project,
            }
          : null,
      })),
    });
  } catch (error) {
    cleanupSurveyResponsesLogger.error(
      { err: String(error) },
      "Cleanup survey responses audit error",
    );
    return NextResponse.json(
      { error: "Failed to audit survey responses" },
      { status: 500 }
    );
  }
}

/**
 * POST - Remove survey responses belonging to non-COMPLETED pledges so they
 * don't get picked up by fulfillment / production-order exports.
 *
 * Body:
 * - projectId (optional): restrict to a single project
 * - action: "mark-incomplete" (default) | "delete"
 *   - mark-incomplete: sets isComplete=false and completedAt=null, preserving
 *     any data the user entered so a legitimate pledge (if later completed)
 *     can re-submit.
 *   - delete: permanently removes the SurveyResponse row.
 * - dryRun (optional, default false): return the target set without mutating.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const projectId = typeof body.projectId === "string" ? body.projectId : null;
    const action = body.action === "delete" ? "delete" : "mark-incomplete";
    const dryRun = body.dryRun === true;

    const responses = await db.surveyResponse.findMany({
      where: {
        ...(projectId ? { survey: { projectId } } : {}),
      },
      select: {
        id: true,
        pledgeId: true,
        isComplete: true,
        survey: { select: { projectId: true } },
      },
    });

    if (responses.length === 0) {
      return NextResponse.json({
        success: true,
        action,
        dryRun,
        scanned: 0,
        targeted: 0,
        affected: 0,
      });
    }

    const pledges = await db.pledge.findMany({
      where: { id: { in: responses.map((r) => r.pledgeId) } },
      select: { id: true, status: true, deletedAt: true },
    });
    const pledgeById = new Map(pledges.map((p) => [p.id, p]));

    const targets = responses.filter((r) => {
      const pledge = pledgeById.get(r.pledgeId);
      if (!pledge) return true; // orphaned response — no pledge at all
      if (pledge.deletedAt !== null) return true;
      return pledge.status !== VALID_PLEDGE_STATUS;
    });

    if (dryRun || targets.length === 0) {
      return NextResponse.json({
        success: true,
        action,
        dryRun,
        scanned: responses.length,
        targeted: targets.length,
        affected: 0,
        responseIds: targets.map((r) => r.id),
      });
    }

    const targetIds = targets.map((r) => r.id);
    const targetPledgeIds = targets.map((r) => r.pledgeId);

    let affected = 0;
    await db.$transaction(async (tx) => {
      if (action === "delete") {
        const res = await tx.surveyResponse.deleteMany({
          where: { id: { in: targetIds } },
        });
        affected = res.count;
      } else {
        const res = await tx.surveyResponse.updateMany({
          where: { id: { in: targetIds } },
          data: { isComplete: false, completedAt: null },
        });
        affected = res.count;
      }

      // Also clear surveyCompleted on the pledges so they don't appear
      // in "survey complete" filters on the creator dashboard.
      await tx.pledge.updateMany({
        where: {
          id: { in: targetPledgeIds },
          status: { not: VALID_PLEDGE_STATUS },
        },
        data: { surveyCompleted: false },
      });
    });

    cleanupSurveyResponsesLogger.info(
      {
        adminUserId: session.user.id,
        projectId,
        action,
        scanned: responses.length,
        targeted: targets.length,
        affected,
      },
      "Cleaned up stale survey responses from non-COMPLETED pledges",
    );

    return NextResponse.json({
      success: true,
      action,
      dryRun: false,
      scanned: responses.length,
      targeted: targets.length,
      affected,
    });
  } catch (error) {
    cleanupSurveyResponsesLogger.error(
      { err: String(error) },
      "Cleanup survey responses error",
    );
    return NextResponse.json(
      { error: "Failed to clean up survey responses" },
      { status: 500 }
    );
  }
}
