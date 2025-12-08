import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// GET - Get survey for a project (creator view)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Verify project ownership or collaborator access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          where: { userId: session.user.id, status: "ACCEPTED" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.creatorId === session.user.id;
    const isCollaborator = project.collaborators.length > 0;

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get or create survey
    const survey = await db.survey.findUnique({
      where: { projectId },
      include: {
        itemQuestions: {
          include: {
            variants: {
              orderBy: { sortOrder: "asc" },
            },
            customQuestions: {
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        backerQuestions: {
          orderBy: { sortOrder: "asc" },
        },
        responses: {
          include: {
            // We'll get pledge info separately
          },
        },
      },
    });

    // If no survey exists, return null
    if (!survey) {
      return NextResponse.json({ survey: null });
    }

    // Get response stats
    const totalBackers = await db.pledge.count({
      where: { projectId, status: "COMPLETED" },
    });

    const completedResponses = await db.surveyResponse.count({
      where: { surveyId: survey.id, isComplete: true },
    });

    // Get rewards for item question mapping
    const rewards = await db.reward.findMany({
      where: { projectId },
      select: { id: true, title: true },
    });

    return NextResponse.json({
      survey,
      stats: {
        totalBackers,
        completedResponses,
        responseRate: totalBackers > 0 ? Math.round((completedResponses / totalBackers) * 100) : 0,
      },
      rewards,
    });
  } catch (error) {
    console.error("Error fetching survey:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey" },
      { status: 500 }
    );
  }
}

const surveySchema = z.object({
  introTitle: z.string().optional().nullable(),
  introMessage: z.string().optional().nullable(),
  collectAddresses: z.boolean().optional(),
});

// POST - Create survey for a project
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    const body = await req.json();

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
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

    // Check if survey already exists
    const existingSurvey = await db.survey.findUnique({
      where: { projectId },
    });

    if (existingSurvey) {
      return NextResponse.json(
        { error: "Survey already exists for this project" },
        { status: 400 }
      );
    }

    const data = surveySchema.parse(body);

    const survey = await db.survey.create({
      data: {
        projectId,
        introTitle: data.introTitle,
        introMessage: data.introMessage,
        collectAddresses: data.collectAddresses ?? true,
      },
    });

    return NextResponse.json({ survey });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating survey:", error);
    return NextResponse.json(
      { error: "Failed to create survey" },
      { status: 500 }
    );
  }
}

// PUT - Update survey intro and settings
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;
    const body = await req.json();

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
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

    // Don't allow editing locked surveys
    if (survey.status === "LOCKED") {
      return NextResponse.json(
        { error: "Cannot edit a locked survey" },
        { status: 400 }
      );
    }

    const data = surveySchema.parse(body);

    const updatedSurvey = await db.survey.update({
      where: { id: survey.id },
      data: {
        introTitle: data.introTitle,
        introMessage: data.introMessage,
        collectAddresses: data.collectAddresses,
      },
    });

    return NextResponse.json({ survey: updatedSurvey });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating survey:", error);
    return NextResponse.json(
      { error: "Failed to update survey" },
      { status: 500 }
    );
  }
}
