import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerSurveysLogger = logger.child({ module: "backer-surveys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET: List all surveys for the backer with IndieKit integration
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "pending" | "completed" | "all"

    // Get all valid pledges for the user (with COMPLETED or valid PENDING status)
    const pledges = await db.pledge.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        OR: [
          { status: "COMPLETED" },
          {
            status: "PENDING",
            confirmationEmailSent: true,
          },
          {
            status: "PENDING",
            stripePaymentMethodId: { not: null },
          },
          {
            status: "PENDING",
            stripeSetupIntentId: { not: null },
          },
          {
            status: "PENDING",
            stripePaymentIntentId: { not: null },
          },
          {
            status: "PENDING",
            divinityCoinPaymentId: { not: null },
          },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            status: true,
            creator: {
              select: {
                id: true,
                name: true,
                vanityUrl: true,
              },
            },
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
            amount: true,
            estimatedDelivery: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get project IDs
    const projectIds = Array.from(new Set(pledges.map((p) => p.projectId)));

    if (projectIds.length === 0) {
      return NextResponse.json({
        surveys: [],
        stats: { total: 0, completed: 0, pending: 0 }
      }, { headers: corsHeaders });
    }

    // Get all surveys for these projects (IndieKit surveys)
    const surveys = await db.survey.findMany({
      where: {
        projectId: { in: projectIds },
        status: { in: ["SENT", "LOCKED"] }, // Only active surveys
      },
      include: {
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
        itemQuestions: {
          include: {
            variants: true,
            customQuestions: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Map surveys to user pledges with completion status
    const surveyResponses = pledges.map((pledge) => {
      const survey = surveys.find((s) => s.projectId === pledge.projectId);

      if (!survey) {
        return null; // No survey for this project yet
      }

      const projectUrl = pledge.project.creator.vanityUrl
        ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
        : `/projects/${pledge.project.slug}`;

      // Count questions (backer questions + item questions)
      const questionCount = survey.backerQuestions.length +
        survey.itemQuestions.reduce((acc: number, item: typeof survey.itemQuestions[number]) =>
          acc + item.variants.length + item.customQuestions.length + 1, 0);

      return {
        id: survey.id,
        pledgeId: pledge.id,
        projectId: pledge.projectId,
        projectTitle: pledge.project.title,
        projectSlug: pledge.project.slug,
        projectImage: pledge.project.imageUrl,
        projectUrl,
        creatorName: pledge.project.creator.name || "Unknown Creator",
        pledgeAmount: Number(pledge.amount),
        rewardTitle: pledge.reward?.title || "No reward",
        estimatedDelivery: pledge.reward?.estimatedDelivery,
        surveyCompleted: pledge.surveyCompleted,
        surveyRequired: true,
        fulfillmentStatus: pledge.fulfillmentStatus,
        shippingAddress: pledge.shippingAddress,
        surveyStatus: survey.status.toLowerCase(),
        addressesLocked: survey.addressesLocked,
        questionCount,
        introTitle: survey.introTitle,
        introMessage: survey.introMessage,
        sentAt: survey.sentAt,
        lockedAt: survey.lockedAt,
      };
    }).filter(Boolean);

    // Filter by status if requested
    let filteredSurveys = surveyResponses;
    if (status === "pending") {
      filteredSurveys = surveyResponses.filter((s) => !s?.surveyCompleted);
    } else if (status === "completed") {
      filteredSurveys = surveyResponses.filter((s) => s?.surveyCompleted);
    }

    // Calculate stats
    const stats = {
      total: surveyResponses.length,
      completed: surveyResponses.filter((s) => s?.surveyCompleted).length,
      pending: surveyResponses.filter((s) => !s?.surveyCompleted).length,
    };

    return NextResponse.json({
      surveys: filteredSurveys,
      stats,
    }, { headers: corsHeaders });
  } catch (error) {
    backerSurveysLogger.error({ err: String(error) }, "Error fetching backer surveys:");
    return NextResponse.json(
      { error: "Failed to fetch surveys" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST: Get survey details for a specific pledge
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const { pledgeId } = body;

    if (!pledgeId) {
      return NextResponse.json({ error: "Pledge ID required" }, { status: 400, headers: corsHeaders });
    }

    // Get the pledge
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
          },
        },
        addons: {
          select: {
            addon: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404, headers: corsHeaders });
    }

    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403, headers: corsHeaders });
    }

    // Get the survey with questions
    const survey = await db.survey.findUnique({
      where: { projectId: pledge.projectId },
      include: {
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
        itemQuestions: {
          include: {
            variants: true,
            customQuestions: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({
        error: "No survey available for this project yet"
      }, { status: 404, headers: corsHeaders });
    }

    // Map questions to frontend format
    type QuestionFormat = {
      id: string;
      type: string;
      label: string;
      required: boolean;
      helpText?: string;
      options?: string[];
      sortOrder: number;
      section?: string;
    };

    const questions: QuestionFormat[] = [];

    // Add backer questions
    survey.backerQuestions.forEach((q: typeof survey.backerQuestions[number]) => {
      questions.push({
        id: q.id,
        type: mapQuestionType(q.questionType),
        label: q.question,
        required: q.isRequired,
        helpText: q.description || undefined,
        options: q.options.length > 0 ? q.options : undefined,
        sortOrder: q.sortOrder,
        section: "backer_info",
      });
    });

    // Add item questions (for selected rewards/addons)
    survey.itemQuestions.forEach((item: typeof survey.itemQuestions[number]) => {
      // Add section break for item
      questions.push({
        id: `section_${item.id}`,
        type: "section_break",
        label: item.itemName,
        required: false,
        helpText: item.itemDescription || undefined,
        sortOrder: item.sortOrder,
        section: "items",
      });

      // Add variant questions
      item.variants.forEach((variant: typeof item.variants[number]) => {
        questions.push({
          id: variant.id,
          type: "dropdown",
          label: variant.variantType,
          required: true,
          options: variant.options,
          sortOrder: variant.sortOrder,
          section: "items",
        });
      });

      // Add custom questions
      item.customQuestions.forEach((custom: typeof item.customQuestions[number]) => {
        questions.push({
          id: custom.id,
          type: mapQuestionType(custom.questionType),
          label: custom.question,
          required: custom.isRequired,
          helpText: custom.description || undefined,
          options: custom.options.length > 0 ? custom.options : undefined,
          sortOrder: custom.sortOrder,
          section: "items",
        });
      });
    });

    return NextResponse.json({
      survey: {
        id: survey.id,
        status: survey.status.toLowerCase(),
        collectAddresses: survey.collectAddresses,
        addressesLocked: survey.addressesLocked,
        introTitle: survey.introTitle,
        introMessage: survey.introMessage,
      },
      pledge: {
        id: pledge.id,
        surveyCompleted: pledge.surveyCompleted,
        surveyResponses: pledge.surveyResponses,
        shippingAddress: pledge.shippingAddress,
        reward: pledge.reward,
        addons: pledge.addons.map((a: typeof pledge.addons[number]) => a.addon),
      },
      questions: questions.sort((a, b) => a.sortOrder - b.sortOrder),
    }, { headers: corsHeaders });
  } catch (error) {
    backerSurveysLogger.error({ err: String(error) }, "Error fetching survey details:");
    return NextResponse.json(
      { error: "Failed to fetch survey details" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Helper function to map question types
function mapQuestionType(dbType: string): string {
  const typeMap: Record<string, string> = {
    OPEN_TEXT: "short_text",
    SINGLE_SELECT: "multiple_choice",
    MULTIPLE_SELECT: "checkboxes",
  };
  return typeMap[dbType] || "short_text";
}
