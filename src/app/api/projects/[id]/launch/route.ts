import { NextRequest, NextResponse } from "next/server";
import { getServerSession, authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Launch an approved project
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = params.id;

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        rewards: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify ownership
    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if project is approved
    if (project.status !== "APPROVED") {
      return NextResponse.json(
        {
          error: "Only approved projects can be launched",
          currentStatus: project.status,
          message:
            project.status === "DRAFT"
              ? "Please submit your project for review first."
              : project.status === "SUBMITTED"
              ? "Your project is still under review."
              : `Project status is ${project.status}.`,
        },
        { status: 400 }
      );
    }

    // Calculate end date based on duration settings
    const now = new Date();
    let endDate: Date;

    if (project.durationType === "END_DATE" && project.endDate) {
      endDate = new Date(project.endDate);
      // Ensure end date is in the future
      if (endDate <= now) {
        return NextResponse.json(
          { error: "End date must be in the future" },
          { status: 400 }
        );
      }
    } else if (project.durationType === "FIXED_DAYS" && project.durationDays) {
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + project.durationDays);
    } else {
      return NextResponse.json(
        { error: "Invalid duration settings" },
        { status: 400 }
      );
    }

    // Update project to LIVE status
    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: {
        status: "LIVE",
        launchDate: now,
        launchedAt: now,
        endDate,
      },
    });

    // Create a review record for the launch
    await db.projectReview.create({
      data: {
        projectId,
        action: "APPROVED", // Technically "LAUNCHED" but we use APPROVED action
        previousStatus: "APPROVED",
        newStatus: "LIVE",
        notes: "Project launched by creator",
      },
    });

    // In production: Send launch notifications to followers
    // await notifyFollowers(projectId, "launch");

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: "Your project is now live!",
      endDate: endDate.toISOString(),
    });
  } catch (error) {
    console.error("Error launching project:", error);
    return NextResponse.json(
      { error: "Failed to launch project" },
      { status: 500 }
    );
  }
}
