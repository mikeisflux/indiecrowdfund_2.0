import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        imageUrl: true,
        description: true,
        shortDescription: true,
        category: true,
        fundingGoal: true,
        endDate: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action, field, value } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    if (action === "update_field" && field) {
      // Only allow updating certain fields
      const allowedFields = ["title", "description", "shortDescription", "category"];
      if (!allowedFields.includes(field)) {
        return NextResponse.json({ error: "Field not allowed" }, { status: 400 });
      }

      await db.project.update({
        where: { id: projectId },
        data: { [field]: value },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "update_survey_settings") {
      // Update survey settings
      const survey = await db.survey.findUnique({
        where: { projectId },
      });

      if (survey) {
        await db.survey.update({
          where: { id: survey.id },
          data: body.surveySettings || {},
        });
      }

      return NextResponse.json({ success: true });
    }

    if (action === "update_fulfillment_settings") {
      // Stub - would update fulfillment-specific settings
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Settings POST error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
