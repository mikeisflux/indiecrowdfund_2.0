import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
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
      return NextResponse.json({
        survey: null,
        response: null,
        questions: { itemQuestions: [], backerQuestions: [] },
      });
    }

    // Get survey response for this pledge
    const response = await db.surveyResponse.findUnique({
      where: { pledgeId },
    });

    // Filter item questions to only show those relevant to this backer's reward
    const relevantItemQuestions = survey.itemQuestions.filter(
      (iq: { rewardId: string }) => iq.rewardId === pledge.rewardId
    );

    // Also include item questions for any addons
    const addonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);
    const addonItemQuestions = survey.itemQuestions.filter(
      (iq: { rewardId: string }) => addonIds.includes(iq.rewardId)
    );

    // Filter backer questions based on targeting
    const relevantBackerQuestions = survey.backerQuestions.filter(
      (bq: { targetType: string; targetRewardIds: string[] }) => {
        if (bq.targetType === "ALL_BACKERS") return true;
        if (bq.targetType === "SPECIFIC_REWARDS") {
          return (
            bq.targetRewardIds.includes(pledge.rewardId as string) ||
            bq.targetRewardIds.some((id: string) => addonIds.includes(id))
          );
        }
        return false;
      }
    );

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
        itemQuestions: [...relevantItemQuestions, ...addonItemQuestions],
        backerQuestions: relevantBackerQuestions,
      },
      response: response
        ? {
            itemResponses: response.itemResponses,
            backerResponses: response.backerResponses,
            shippingAddress: response.shippingAddress,
            isComplete: response.isComplete,
            completedAt: response.completedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching pledge survey response:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey response" },
      { status: 500 }
    );
  }
}
