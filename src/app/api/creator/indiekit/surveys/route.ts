import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendSurveyAvailableEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET - Get survey and questions for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get survey with backer questions only (General Questions)
    // Item questions are fetched separately via /api/projects/:id/survey/item-questions
    const survey = await db.survey.findUnique({
      where: { projectId },
      include: {
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({
        survey: null,
        questions: [],
      });
    }

    // Map backer questions to frontend format (General Questions only)
    // Item questions (per-reward) are fetched separately via /api/projects/:id/survey/item-questions
    type BackerQuestionType = { id: string; questionType: string; displayType: string | null; question: string; isRequired: boolean; description: string | null; options: string[]; sortOrder: number };
    type QuestionFormat = { id: string; type: string; label: string; required: boolean; helpText: string | undefined; options: string[] | undefined; sortOrder: number };

    const questions: QuestionFormat[] = survey.backerQuestions.map((q: BackerQuestionType) => ({
      id: q.id,
      type: q.displayType || mapQuestionType(q.questionType),
      label: q.question,
      required: q.isRequired,
      helpText: q.description || undefined,
      options: q.options.length > 0 ? q.options : undefined,
      sortOrder: q.sortOrder,
    }));

    return NextResponse.json({
      survey: {
        id: survey.id,
        status: survey.status.toLowerCase(),
        collectAddresses: survey.collectAddresses,
        addressesLocked: survey.addressesLocked,
        introTitle: survey.introTitle,
        introMessage: survey.introMessage,
      },
      questions: questions.sort((a: QuestionFormat, b: QuestionFormat) => a.sortOrder - b.sortOrder),
    });
  } catch (error) {
    console.error("IndieKit surveys fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}

// POST - Create or update survey questions
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, questions } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Get or create survey
    let survey = await db.survey.findUnique({
      where: { projectId },
    });

    if (!survey) {
      survey = await db.survey.create({
        data: {
          projectId,
          status: "DRAFT",
        },
      });
    }

    // Clear existing backer questions and recreate
    await db.surveyBackerQuestion.deleteMany({
      where: { surveyId: survey.id },
    });

    // Filter out section breaks and item-related questions
    const backerQuestions = questions.filter(
      (q: { type: string; isItemQuestion?: boolean }) => q.type !== "section_break" && !q.isItemQuestion
    );

    // Create new backer questions
    for (let i = 0; i < backerQuestions.length; i++) {
      const q = backerQuestions[i];
      await db.surveyBackerQuestion.create({
        data: {
          surveyId: survey.id,
          question: q.label,
          description: q.helpText || null,
          questionType: mapToDbQuestionType(q.type),
          displayType: q.type || null,
          options: q.options || [],
          isRequired: q.required || false,
          sortOrder: i,
        },
      });
    }

    return NextResponse.json({
      success: true,
      surveyId: survey.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("IndieKit surveys update error:", error);
    return NextResponse.json(
      { error: "Failed to update survey" },
      { status: 500 }
    );
  }
}

// PATCH - Update survey status
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    let emailsSent = 0;

    switch (action) {
      case "send":
        await db.survey.update({
          where: { id: survey.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        // Get all valid backers for this project to send email notifications
        const backers = await db.pledge.findMany({
          where: {
            projectId,
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
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        });

        // Send email to each backer
        for (const pledge of backers) {
          if (pledge.user?.email) {
            try {
              await sendSurveyAvailableEmail(
                pledge.user.email,
                pledge.user.name || "Backer",
                project.title,
                session.user.name || "The Creator",
                pledge.id
              );
              emailsSent++;
            } catch (emailError) {
              console.error(`Failed to send survey email to ${pledge.user.email}:`, emailError);
            }
          }
        }

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "SURVEY_SENT",
            title: `Survey sent to ${emailsSent} backers`,
          },
        });
        break;

      case "lock":
        await db.survey.update({
          where: { id: survey.id },
          data: { status: "LOCKED", lockedAt: new Date() },
        });

        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDERS_LOCKED",
            title: "Survey locked - orders finalized",
          },
        });
        break;

      case "lockAddresses":
        await db.survey.update({
          where: { id: survey.id },
          data: { addressesLocked: true },
        });

        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ADDRESSES_LOCKED",
            title: "All shipping addresses locked",
          },
        });
        break;
    }

    return NextResponse.json({ success: true, emailsSent });
  } catch (error) {
    console.error("IndieKit survey status update error:", error);
    return NextResponse.json(
      { error: "Failed to update survey status" },
      { status: 500 }
    );
  }
}

// Helper functions
function mapQuestionType(dbType: string): string {
  const typeMap: Record<string, string> = {
    OPEN_TEXT: "short_text",
    SINGLE_SELECT: "multiple_choice",
    MULTIPLE_SELECT: "checkboxes",
  };
  return typeMap[dbType] || "short_text";
}

function mapToDbQuestionType(frontendType: string): "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT" {
  const typeMap: Record<string, "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT"> = {
    short_text: "OPEN_TEXT",
    long_text: "OPEN_TEXT",
    multiple_choice: "SINGLE_SELECT",
    checkboxes: "MULTIPLE_SELECT",
    dropdown: "SINGLE_SELECT",
    email: "OPEN_TEXT",
    phone: "OPEN_TEXT",
    date: "OPEN_TEXT",
    number: "OPEN_TEXT",
    address: "OPEN_TEXT",
  };
  return typeMap[frontendType] || "OPEN_TEXT";
}
