import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitSurveysLogger = logger.child({ module: "creator-indiekit-surveys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendSurveyAvailableEmail, sendSurveyUpdateRequestEmail } from "@/lib/email";
import { notifySurveyUpdateRequested } from "@/lib/notifications";

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
        deletedAt: null,
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
    creatorIndiekitSurveysLogger.error({ err: String(error) }, "IndieKit surveys fetch error:");
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
        deletedAt: null,
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
    creatorIndiekitSurveysLogger.error({ err: String(error) }, "IndieKit surveys update error:");
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
        deletedAt: null,
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
      include: {
        creator: {
          select: { name: true },
        },
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
      case "send": {
        // CAS on survey status: not-SENT/LOCKED → SENT. Without this,
        // two concurrent "Send Survey" clicks would both flip status
        // and both fire survey-available emails to every backer.
        const sendCas = await db.survey.updateMany({
          where: { id: survey.id, status: { notIn: ["SENT", "LOCKED"] } },
          data: { status: "SENT", sentAt: new Date() },
        });
        if (sendCas.count === 0) {
          return NextResponse.json(
            { error: "Survey has already been sent" },
            { status: 400 }
          );
        }

        // Surveys go ONLY to backers whose pledge is fully COMPLETED.
        // PENDING/FAILED/REFUNDED/CANCELLED/CHARGEBACK pledges must not receive surveys.
        const backers = await db.pledge.findMany({
          where: {
            projectId,
            deletedAt: null,
            status: "COMPLETED",
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
                project.creator?.name || "The Creator",
                pledge.id
              );
              emailsSent++;
            } catch (emailError) {
              creatorIndiekitSurveysLogger.error({ err: String(emailError) }, `Failed to send survey email to ${pledge.user.email}:`);
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
      }

      case "lock": {
        // CAS on status → LOCKED so two concurrent lock calls don't
        // both fire the "orders locked" activity entry.
        const lockCas = await db.survey.updateMany({
          where: { id: survey.id, status: { not: "LOCKED" } },
          data: { status: "LOCKED", lockedAt: new Date() },
        });
        if (lockCas.count === 0) {
          return NextResponse.json(
            { error: "Survey has already been locked" },
            { status: 400 }
          );
        }

        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "ORDERS_LOCKED",
            title: "Survey locked - orders finalized",
          },
        });
        break;
      }

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

      case "backfill": {
        // Find backers who don't have a survey response yet
        if (survey.status !== "SENT") {
          return NextResponse.json(
            { error: "Survey must be in SENT status to backfill" },
            { status: 400 }
          );
        }

        // Get all valid pledges that don't have a response
        const existingResponsePledgeIds = await db.surveyResponse.findMany({
          where: { surveyId: survey.id },
          select: { pledgeId: true },
        });
        const respondedIds = new Set(existingResponsePledgeIds.map(r => r.pledgeId));

        const newBackers = await db.pledge.findMany({
          where: {
            projectId,
            deletedAt: null,
            status: "COMPLETED",
          },
          include: {
            user: { select: { email: true, name: true } },
          },
        });

        const unnotifiedBackers = newBackers.filter(b => !respondedIds.has(b.id));

        for (const pledge of unnotifiedBackers) {
          if (pledge.user?.email) {
            try {
              await sendSurveyAvailableEmail(
                pledge.user.email,
                pledge.user.name || "Backer",
                project.title,
                project.creator?.name || "The Creator",
                pledge.id
              );
              emailsSent++;
            } catch (emailError) {
              creatorIndiekitSurveysLogger.error({ err: String(emailError) }, `Failed to send backfill survey email to ${pledge.user.email}:`);
            }
          }
        }

        if (emailsSent > 0) {
          await db.fulfillmentActivity.create({
            data: {
              projectId,
              type: "SURVEY_REMINDER",
              title: `Survey backfill: sent to ${emailsSent} new backers`,
            },
          });
        }
        break;
      }

      case "request-update": {
        // Survey must be in SENT status to request updates
        if (survey.status !== "SENT") {
          return NextResponse.json(
            { error: "Survey must be in SENT status to request updates" },
            { status: 400 }
          );
        }

        // Reset all survey responses to incomplete so backers need to re-review
        await db.surveyResponse.updateMany({
          where: { surveyId: survey.id },
          data: { isComplete: false, completedAt: null },
        });

        // Also reset surveyCompleted on pledges
        await db.pledge.updateMany({
          where: {
            projectId,
            status: "COMPLETED",
          },
          data: { surveyCompleted: false },
        });

        // Get all backers with completed pledges to send notifications
        const updateBackers = await db.pledge.findMany({
          where: {
            projectId,
            deletedAt: null,
            status: "COMPLETED",
          },
          include: {
            user: { select: { email: true, name: true } },
          },
        });

        // Send update request email to each backer
        for (const pledge of updateBackers) {
          if (pledge.user?.email) {
            try {
              await sendSurveyUpdateRequestEmail(
                pledge.user.email,
                pledge.user.name || "Backer",
                project.title,
                project.creator?.name || "The Creator",
                pledge.id
              );
              emailsSent++;
            } catch (emailError) {
              creatorIndiekitSurveysLogger.error({ err: String(emailError) }, `Failed to send survey update request email to ${pledge.user.email}:`);
            }
          }
        }

        // Create in-app notifications
        await notifySurveyUpdateRequested(projectId, project.title);

        // Log activity
        await db.fulfillmentActivity.create({
          data: {
            projectId,
            type: "SURVEY_SENT",
            title: `Survey update requested - ${emailsSent} backers notified`,
          },
        });

        break;
      }
    }

    return NextResponse.json({ success: true, emailsSent });
  } catch (error) {
    creatorIndiekitSurveysLogger.error({ err: String(error) }, "IndieKit survey status update error:");
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
