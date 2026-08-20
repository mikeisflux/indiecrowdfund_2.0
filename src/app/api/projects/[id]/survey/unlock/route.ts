import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsSurveyUnlockLogger = logger.child({ module: "projects-survey-unlock" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Reopen a locked survey.
//
// Locking is not just "responses become read-only": the backer submit handler
// rejects on `survey.status === "LOCKED"` before it ever looks for an existing
// response, so a backer who never answered is shut out entirely, and the
// backfill action refuses to run on anything that isn't SENT. Creators lock
// ahead of print, then discover stragglers still need to give an address, and
// there was no way back — the lock dialog itself says "cannot be easily
// undone", which was accurate because nothing anywhere wrote the status back.
//
// Mirrors ../lock exactly in auth and CAS shape so the pair stays symmetrical.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        collaborators: {
          where: {
            userId: session.user.id,
            status: "ACCEPTED",
            canCoordinateFulfillment: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.creatorId === session.user.id;
    const hasPermission = project.collaborators.length > 0;

    if (!isOwner && !hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status !== "LOCKED") {
      return NextResponse.json(
        { error: "This survey isn't locked." },
        { status: 400 }
      );
    }

    // CAS on status: LOCKED → SENT, so two concurrent unlocks don't both fire
    // the activity entry or race the response update below.
    const unlockCas = await db.survey.updateMany({
      where: { id: survey.id, status: "LOCKED" },
      data: {
        status: "SENT",
        lockedAt: null,
        addressesLocked: false,
      },
    });

    if (unlockCas.count === 0) {
      return NextResponse.json(
        { error: "Survey has already been unlocked" },
        { status: 400 }
      );
    }

    // Release address locks, but only on responses that were never completed.
    //
    // Those are the ones the unlock is for: a backer who hasn't answered needs
    // to be able to enter an address. A completed response is already barred
    // from resubmission by its own isComplete guard, so leaving its address
    // locked costs nothing — and preserves any per-backer locks applied from
    // the Backers tab, which a blanket clear would silently undo.
    const released = await db.surveyResponse.updateMany({
      where: { surveyId: survey.id, isComplete: false },
      data: { addressLocked: false },
    });

    await db.fulfillmentActivity
      .create({
        data: {
          projectId,
          type: "ORDERS_UNLOCKED",
          title: "Survey unlocked - backers can respond again",
          userId: session.user.id,
          affectedCount: released.count,
        },
      })
      .catch((err: unknown) =>
        // The unlock itself has already succeeded; losing the audit row must
        // not turn that into a failure the creator has to retry.
        projectsSurveyUnlockLogger.error(
          { err: formatError(err), projectId },
          "Failed to log survey unlock activity"
        )
      );

    return NextResponse.json({
      success: true,
      addressesReleased: released.count,
      message: "Survey unlocked. Backers can submit and edit responses again.",
    });
  } catch (error) {
    projectsSurveyUnlockLogger.error({ err: formatError(error) }, "Error unlocking survey:");
    return NextResponse.json(
      { error: "Failed to unlock survey" },
      { status: 500 }
    );
  }
}
