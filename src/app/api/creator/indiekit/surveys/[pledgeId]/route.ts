import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const creatorIndiekitSurveysLogger = logger.child({ module: "creator-indiekit-surveys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolvePledgeShippingAddress } from "@/lib/fulfillment/shipping-address";

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

    if (!survey) {
      // Still return the pledge block — the page header always renders
      // backer name/email/reward even when no survey is configured.
      // Returning the no-survey state without `pledge` made the dashboard
      // crash with "Cannot read properties of undefined (reading
      // 'backerName')" inside the dashboard error boundary.
      return NextResponse.json({
        survey: null,
        response: null,
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
        addons: pledge.addons.map((a: { addon: { id: string; title: string } }) => ({
          id: a.addon.id,
          title: a.addon.title,
        })),
      },
      questions: {
        // Return all item questions from the survey
        itemQuestions: survey.itemQuestions,
        // Return all backer questions from the survey
        backerQuestions: survey.backerQuestions,
      },
      response: response
        ? {
            itemResponses: response.itemResponses,
            backerResponses: response.backerResponses,
            shippingAddress: resolvedAddress ?? response.shippingAddress,
            isComplete: response.isComplete,
            completedAt: response.completedAt,
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
