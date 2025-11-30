import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSurveySchema = z.object({
  projectId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(["text", "multiple_choice", "dropdown", "address"]),
    question: z.string(),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })),
});

const submitResponseSchema = z.object({
  surveyId: z.string(),
  pledgeId: z.string(),
  responses: z.record(z.string(), z.unknown()),
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
      const pledge = await db.pledge.findUnique({
        where: { id: data.pledgeId },
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

      // Verify project ownership
      const project = await db.project.findUnique({
        where: { id: data.projectId },
        select: { creatorId: true, status: true },
      });

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (project.creatorId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Create or update survey
      const survey = await db.survey.upsert({
        where: { projectId: data.projectId },
        create: {
          projectId: data.projectId,
          title: data.title,
          description: data.description,
          questions: data.questions as object[],
        },
        update: {
          title: data.title,
          description: data.description,
          questions: data.questions as object[],
        },
      });

      return NextResponse.json({ survey }, { status: 201 });
    }
  } catch (error) {
    console.error("Survey error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
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
      // Get survey for project (creator view)
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { creatorId: true },
      });

      if (project?.creatorId !== session.user.id) {
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
      const pledge = await db.pledge.findUnique({
        where: { id: pledgeId },
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
          title: true,
          description: true,
          questions: true,
          isActive: true,
        },
      });

      return NextResponse.json({
        survey,
        completed: pledge.surveyCompleted,
      });
    }

    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  } catch (error) {
    console.error("Get survey error:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}
