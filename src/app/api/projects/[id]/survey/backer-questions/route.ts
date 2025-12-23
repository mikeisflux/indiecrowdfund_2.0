import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const backerQuestionSchema = z.object({
  question: z.string().min(1),
  description: z.string().optional().nullable(),
  questionType: z.enum(["OPEN_TEXT", "SINGLE_SELECT", "MULTIPLE_SELECT"]).default("OPEN_TEXT"),
  options: z.array(z.string()).default([]),
  targetType: z.enum(["ALL_BACKERS", "SPECIFIC_REWARDS"]).default("ALL_BACKERS"),
  targetRewardIds: z.array(z.string()).default([]),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      collaborators: {
        where: {
          userId,
          status: "ACCEPTED",
          canCoordinateFulfillment: true,
        },
      },
    },
  });

  if (!project) return null;

  const isOwner = project.creatorId === userId;
  const hasPermission = project.collaborators.length > 0;

  return isOwner || hasPermission ? project : null;
}

// GET - Get all backer questions for a survey
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await verifyProjectAccess(params.id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId: params.id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const backerQuestions = await db.surveyBackerQuestion.findMany({
      where: { surveyId: survey.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ backerQuestions });
  } catch (error) {
    console.error("Error fetching backer questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch backer questions" },
      { status: 500 }
    );
  }
}

// POST - Create a new backer question
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await verifyProjectAccess(params.id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId: params.id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "Cannot edit a locked survey" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = backerQuestionSchema.parse(body);

    // Validate target rewards if targeting specific rewards
    if (data.targetType === "SPECIFIC_REWARDS" && data.targetRewardIds.length > 0) {
      const validRewards = await db.reward.count({
        where: {
          id: { in: data.targetRewardIds },
          projectId: params.id,
        },
      });

      if (validRewards !== data.targetRewardIds.length) {
        return NextResponse.json(
          { error: "Invalid target rewards" },
          { status: 400 }
        );
      }
    }

    const backerQuestion = await db.surveyBackerQuestion.create({
      data: {
        surveyId: survey.id,
        question: data.question,
        description: data.description,
        questionType: data.questionType,
        options: data.options,
        targetType: data.targetType,
        targetRewardIds: data.targetRewardIds,
        isRequired: data.isRequired,
        sortOrder: data.sortOrder,
      },
    });

    return NextResponse.json({ backerQuestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("Error creating backer question:", error);
    return NextResponse.json(
      { error: "Failed to create backer question" },
      { status: 500 }
    );
  }
}

// PUT - Update a backer question
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await verifyProjectAccess(params.id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId: params.id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "Cannot edit a locked survey" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { questionId, ...updateData } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    const data = backerQuestionSchema.partial().parse(updateData);

    // Verify the question belongs to this survey
    const existingQuestion = await db.surveyBackerQuestion.findFirst({
      where: { id: questionId, surveyId: survey.id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: "Backer question not found" },
        { status: 404 }
      );
    }

    // Validate target rewards if targeting specific rewards
    if (data.targetType === "SPECIFIC_REWARDS" && data.targetRewardIds && data.targetRewardIds.length > 0) {
      const validRewards = await db.reward.count({
        where: {
          id: { in: data.targetRewardIds },
          projectId: params.id,
        },
      });

      if (validRewards !== data.targetRewardIds.length) {
        return NextResponse.json(
          { error: "Invalid target rewards" },
          { status: 400 }
        );
      }
    }

    const updatedQuestion = await db.surveyBackerQuestion.update({
      where: { id: questionId },
      data: {
        question: data.question,
        description: data.description,
        questionType: data.questionType,
        options: data.options,
        targetType: data.targetType,
        targetRewardIds: data.targetRewardIds,
        isRequired: data.isRequired,
        sortOrder: data.sortOrder,
      },
    });

    return NextResponse.json({ backerQuestion: updatedQuestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("Error updating backer question:", error);
    return NextResponse.json(
      { error: "Failed to update backer question" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a backer question
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await verifyProjectAccess(params.id, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId: params.id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "Cannot edit a locked survey" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    // Verify the question belongs to this survey
    const existingQuestion = await db.surveyBackerQuestion.findFirst({
      where: { id: questionId, surveyId: survey.id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: "Backer question not found" },
        { status: 404 }
      );
    }

    await db.surveyBackerQuestion.delete({
      where: { id: questionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting backer question:", error);
    return NextResponse.json(
      { error: "Failed to delete backer question" },
      { status: 500 }
    );
  }
}
