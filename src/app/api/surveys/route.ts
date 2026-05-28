import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const surveysLogger = logger.child({ module: "surveys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { canUserEditProject } from "@/lib/project-auth";

const createSurveySchema = z.object({
  projectId: z.string(),
  // Legacy fields — mapped to current schema equivalents (introTitle/introMessage)
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  // questions field is accepted for backward compat but ignored (stored as SurveyItemQuestion/SurveyBackerQuestion)
  questions: z.array(z.object({
    id: z.string().max(100),
    type: z.enum(["text", "multiple_choice", "dropdown", "address"]),
    question: z.string().max(500),
    required: z.boolean().default(false),
    options: z.array(z.string().max(200)).max(50).optional(),
  })).max(100).optional(),
});

const submitResponseSchema = z.object({
  surveyId: z.string(),
  pledgeId: z.string(),
  responses: z.record(z.string().max(100), z.union([
    z.string().max(10000),
    z.array(z.string().max(200)).max(50),
    z.object({
      name: z.string().max(100).optional(),
      address1: z.string().max(200).optional(),
      address2: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      zip: z.string().max(20).optional(),
      country: z.string().max(10).optional(),
    }),
    z.null(),
  ])).refine(r => Object.keys(r).length <= 100, "Too many response fields"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Check if this is a survey creation or response submission
    if (body.surveyId) {
      // Response submission
      const data = submitResponseSchema.parse(body);

      // Verify pledge belongs to user
      const pledge = await db.pledge.findFirst({
        where: { id: data.pledgeId, deletedAt: null },
        select: { userId: true, surveyCompleted: true },
      });

      if (!pledge) {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }

      if (pledge.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (pledge.surveyCompleted) {
        return NextResponse.json(
          { error: "Survey already completed" },
          { status: 400 }
        );
      }

      // Save response
      const response = await db.surveyResponse.create({
        data: {
          surveyId: data.surveyId,
          pledgeId: data.pledgeId,
          responses: data.responses as object,
        },
      });

      // Mark pledge survey as completed
      await db.pledge.update({
        where: { id: data.pledgeId },
        data: {
          surveyCompleted: true,
          surveyResponses: data.responses as object,
        },
      });

      return NextResponse.json({ response }, { status: 201 });
    } else {
      // Survey creation
      const data = createSurveySchema.parse(body);

      // Verify project ownership or collaborator edit access
      const project = await db.project.findFirst({
        where: { id: data.projectId, deletedAt: null },
        select: { creatorId: true, status: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const canEdit = await canUserEditProject(data.projectId, session.user.id, project.creatorId);
      if (!canEdit) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Create or update survey — use actual schema fields (introTitle/introMessage)
      const survey = await db.survey.upsert({
        where: { projectId: data.projectId },
        create: {
          projectId: data.projectId,
          introTitle: data.title || null,
          introMessage: data.description || null,
        },
        update: {
          introTitle: data.title || null,
          introMessage: data.description || null,
        },
      });

      return NextResponse.json({ survey }, { status: 201 });
    }
  } catch (error) {
    surveysLogger.error({ err: formatError(error) }, "Survey error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Survey operation failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const pledgeId = searchParams.get("pledgeId");

    if (projectId) {
      // Get survey for project (creator/collaborator view)
      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { creatorId: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const canEdit = await canUserEditProject(projectId, session.user.id, project.creatorId);
      if (!canEdit) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const survey = await db.survey.findUnique({
        where: { projectId },
        include: {
          responses: {
            include: {
              // Include basic pledge info
            },
          },
        },
      });

      return NextResponse.json({ survey });
    } else if (pledgeId) {
      // Get survey for a specific pledge (backer view)
      const pledge = await db.pledge.findFirst({
        where: { id: pledgeId, deletedAt: null },
        select: { userId: true, projectId: true, surveyCompleted: true },
      });

      if (!pledge) {
        return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
      }

      if (pledge.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const survey = await db.survey.findUnique({
        where: { projectId: pledge.projectId },
        select: {
          id: true,
          introTitle: true,
          introMessage: true,
          status: true,
        },
      });

      return NextResponse.json({
        survey,
        completed: pledge.surveyCompleted,
      });
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (error) {
    surveysLogger.error({ err: formatError(error) }, "Get survey error:");
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}
