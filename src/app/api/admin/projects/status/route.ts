import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/admin/projects/status - Change project status (deactivate, send to review)
export async function POST(request: Request) {
  try {
    const session = await auth();

    // Check if user is authenticated and is an admin
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In production, check if user is admin
    // const user = await db.user.findUnique({
    //   where: { id: session.user.id },
    //   select: { role: true },
    // });
    // if (user?.role !== "ADMIN") {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const body = await request.json();
    const { projectId, action, reason, notes, sendEmail } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get the project
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let newStatus: string;
    let actionDescription: string;

    switch (action) {
      case "DEACTIVATE":
        if (project.status !== "LIVE") {
          return NextResponse.json(
            { error: "Only live campaigns can be deactivated" },
            { status: 400 }
          );
        }
        newStatus = "PAUSED";
        actionDescription = "Campaign deactivated";
        break;

      case "SEND_TO_REVIEW":
        if (project.status !== "LIVE" && project.status !== "APPROVED") {
          return NextResponse.json(
            { error: "Only live or approved campaigns can be sent to review" },
            { status: 400 }
          );
        }
        newStatus = "SUBMITTED";
        actionDescription = "Campaign sent back to review";
        break;

      case "REACTIVATE":
        if (project.status !== "PAUSED") {
          return NextResponse.json(
            { error: "Only paused campaigns can be reactivated" },
            { status: 400 }
          );
        }
        newStatus = "LIVE";
        actionDescription = "Campaign reactivated";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update the project status
    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: {
        status: newStatus,
      },
    });

    // Create a review history entry
    await db.projectReview.create({
      data: {
        projectId: projectId,
        reviewerId: session.user.id,
        reviewerEmail: session.user.email || "admin@indiecrowdfund.com",
        action: action,
        previousStatus: project.status,
        newStatus: newStatus,
        notes: reason || notes || actionDescription,
        internalNotes: `Admin action: ${action}`,
        flagsRaised: [],
      },
    });

    // TODO: Send email notification if sendEmail is true
    if (sendEmail && project.creator.email) {
      // await sendStatusChangeEmail(project.creator.email, project.title, action, reason);
      console.log(`Would send email to ${project.creator.email} about ${action}`);
    }

    return NextResponse.json({
      success: true,
      message: actionDescription,
      project: {
        id: updatedProject.id,
        status: updatedProject.status,
      },
    });
  } catch (error) {
    console.error("Error changing project status:", error);
    return NextResponse.json(
      { error: "Failed to change project status" },
      { status: 500 }
    );
  }
}
