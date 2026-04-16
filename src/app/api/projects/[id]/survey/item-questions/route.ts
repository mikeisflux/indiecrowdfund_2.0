import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsSurveyItemQuestionsLogger = logger.child({ module: "projects-survey-item-questions" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const variantSchema = z.object({
  id: z.string().optional(),
  variantType: z.string().min(1),
  options: z.array(z.string()).min(1),
  skuPrefix: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
});

const customQuestionSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(1),
  description: z.string().optional().nullable(),
  questionType: z.enum(["OPEN_TEXT", "SINGLE_SELECT", "MULTIPLE_SELECT"]).default("OPEN_TEXT"),
  options: z.array(z.string()).default([]),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

const itemQuestionSchema = z.object({
  rewardId: z.string(),
  itemName: z.string().min(1),
  itemDescription: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
  variants: z.array(variantSchema).default([]),
  customQuestions: z.array(customQuestionSchema).default([]),
});

async function verifyProjectAccess(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null },
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

// GET - Get all item questions for a survey
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
    });

    if (!survey) {
      return NextResponse.json({ itemQuestions: [] });
    }

    const itemQuestions = await db.surveyItemQuestion.findMany({
      where: { surveyId: survey.id },
      include: {
        variants: { orderBy: { sortOrder: "asc" } },
        customQuestions: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ itemQuestions });
  } catch (error) {
    projectsSurveyItemQuestionsLogger.error({ err: String(error) }, "Error fetching item questions:");
    return NextResponse.json(
      { error: "Failed to fetch item questions" },
      { status: 500 }
    );
  }
}

// POST - Create a new item question
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
    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Auto-create survey via upsert — prevents P2002 race on concurrent
    // POSTs when the survey doesn't yet exist (projectId is @unique).
    const survey = await db.survey.upsert({
      where: { projectId },
      create: {
        projectId,
        introTitle: "Backer Survey",
        introMessage: "Please complete this survey to help us fulfill your order.",
        collectAddresses: true,
      },
      update: {},
    });

    if (survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "Cannot edit a locked survey" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const data = itemQuestionSchema.parse(body);

    // Verify the reward belongs to this project
    const reward = await db.reward.findFirst({
      where: { id: data.rewardId, projectId },
    });

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Create item question with variants and custom questions
    const itemQuestion = await db.surveyItemQuestion.create({
      data: {
        surveyId: survey.id,
        rewardId: data.rewardId,
        itemName: data.itemName,
        itemDescription: data.itemDescription,
        imageUrl: data.imageUrl,
        sortOrder: data.sortOrder,
        variants: {
          create: data.variants.map((v, index) => ({
            variantType: v.variantType,
            options: v.options,
            skuPrefix: v.skuPrefix || generateSkuPrefix(data.itemName, v.variantType),
            sortOrder: v.sortOrder ?? index,
          })),
        },
        customQuestions: {
          create: data.customQuestions.map((q, index) => ({
            question: q.question,
            description: q.description,
            questionType: q.questionType,
            options: q.options,
            isRequired: q.isRequired,
            sortOrder: q.sortOrder ?? index,
          })),
        },
      },
      include: {
        variants: { orderBy: { sortOrder: "asc" } },
        customQuestions: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ itemQuestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    projectsSurveyItemQuestionsLogger.error({ err: String(error) }, "Error creating item question:");
    return NextResponse.json(
      { error: "Failed to create item question" },
      { status: 500 }
    );
  }
}

// PUT - Update an item question
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
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

    const data = itemQuestionSchema.partial().parse(updateData);

    // Verify the question belongs to this survey
    const existingQuestion = await db.surveyItemQuestion.findFirst({
      where: { id: questionId, surveyId: survey.id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: "Item question not found" },
        { status: 404 }
      );
    }

    // Update with transaction to handle variants and custom questions
    const updatedQuestion = await db.$transaction(async (tx) => {
      // Update main question
      await tx.surveyItemQuestion.update({
        where: { id: questionId },
        data: {
          itemName: data.itemName,
          itemDescription: data.itemDescription,
          imageUrl: data.imageUrl,
          sortOrder: data.sortOrder,
        },
      });

      // Handle variants - delete existing and recreate
      if (data.variants) {
        await tx.surveyItemVariant.deleteMany({
          where: { itemQuestionId: questionId },
        });

        await tx.surveyItemVariant.createMany({
          data: data.variants.map((v, index) => ({
            itemQuestionId: questionId,
            variantType: v.variantType,
            options: v.options,
            skuPrefix: v.skuPrefix || generateSkuPrefix(data.itemName || existingQuestion.itemName, v.variantType),
            sortOrder: v.sortOrder ?? index,
          })),
        });
      }

      // Handle custom questions - delete existing and recreate
      if (data.customQuestions) {
        await tx.surveyItemCustomQuestion.deleteMany({
          where: { itemQuestionId: questionId },
        });

        await tx.surveyItemCustomQuestion.createMany({
          data: data.customQuestions.map((q, index) => ({
            itemQuestionId: questionId,
            question: q.question,
            description: q.description,
            questionType: q.questionType,
            options: q.options,
            isRequired: q.isRequired,
            sortOrder: q.sortOrder ?? index,
          })),
        });
      }

      return tx.surveyItemQuestion.findUnique({
        where: { id: questionId },
        include: {
          variants: { orderBy: { sortOrder: "asc" } },
          customQuestions: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    return NextResponse.json({ itemQuestion: updatedQuestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    projectsSurveyItemQuestionsLogger.error({ err: String(error) }, "Error updating item question:");
    return NextResponse.json(
      { error: "Failed to update item question" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an item question
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await verifyProjectAccess(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
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

    // Scoped delete via deleteMany — enforces the question belongs to
    // this survey AND resolves concurrent double-clicks as { count: 0 }
    // instead of P2025.
    const deleted = await db.surveyItemQuestion.deleteMany({
      where: { id: questionId, surveyId: survey.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Item question not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    projectsSurveyItemQuestionsLogger.error({ err: String(error) }, "Error deleting item question:");
    return NextResponse.json(
      { error: "Failed to delete item question" },
      { status: 500 }
    );
  }
}

// Helper function to generate SKU prefix
function generateSkuPrefix(itemName: string, variantType: string): string {
  const itemPart = itemName
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();
  const variantPart = variantType
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase();
  return `${itemPart}-${variantPart}`;
}
