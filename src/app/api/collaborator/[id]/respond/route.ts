import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const collaboratorRespondLogger = logger.child({ module: "collaborator-respond" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await req.json();

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    // Find the collaborator record
    const collaborator = await db.projectCollaborator.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            title: true,
            slug: true,
            creatorId: true,
            creator: {
              select: { vanityUrl: true },
            },
          },
        },
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        { error: "Collaboration invite not found" },
        { status: 404 }
      );
    }

    // Verify the logged-in user matches the collaborator
    // If collaborator has no userId but email matches, link them first
    if (!collaborator.userId && collaborator.email?.toLowerCase() === session.user.email?.toLowerCase()) {
      // Link the user to this collaborator record
      await db.projectCollaborator.update({
        where: { id },
        data: { userId: session.user.id },
      });
      // Update local reference
      collaborator.userId = session.user.id;
    } else if (collaborator.userId && collaborator.userId !== session.user.id) {
      return NextResponse.json(
        { error: "This invitation is for a different user" },
        { status: 403 }
      );
    } else if (!collaborator.userId && collaborator.email?.toLowerCase() !== session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation is for a different email address" },
        { status: 403 }
      );
    }

    // Check if already responded
    if (collaborator.status !== "PENDING") {
      return NextResponse.json(
        { error: `This invitation has already been ${collaborator.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Build project URL with vanity URL if available
    const projectUrl = collaborator.project.creator.vanityUrl
      ? `/projects/${collaborator.project.creator.vanityUrl}/${collaborator.project.slug}`
      : `/projects/${collaborator.project.slug}`;

    // Build edit URL for collaborators with edit permission
    const editUrl = collaborator.canEditProject
      ? `${projectUrl}/edit`
      : null;

    if (action === "accept") {
      // Accept the collaboration
      await db.projectCollaborator.update({
        where: { id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });

      // Notify the project creator
      await db.notification.create({
        data: {
          userId: collaborator.project.creatorId,
          type: "COLLABORATOR_ACCEPTED",
          title: "Collaboration accepted",
          message: `${session.user.name || session.user.email} has accepted your invitation to collaborate on "${collaborator.project.title}"`,
          actionUrl: projectUrl,
          projectId: collaborator.projectId,
          senderId: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "You have accepted the collaboration invitation",
        projectSlug: collaborator.project.slug,
        projectUrl,
        editUrl,
        canEditProject: collaborator.canEditProject,
      });
    } else {
      // Decline the collaboration
      await db.projectCollaborator.update({
        where: { id },
        data: {
          status: "DECLINED",
        },
      });

      // Notify the project creator
      await db.notification.create({
        data: {
          userId: collaborator.project.creatorId,
          type: "COLLABORATOR_DECLINED",
          title: "Collaboration declined",
          message: `${session.user.name || session.user.email} has declined your invitation to collaborate on "${collaborator.project.title}"`,
          actionUrl: projectUrl,
          projectId: collaborator.projectId,
          senderId: session.user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "You have declined the collaboration invitation",
      });
    }
  } catch (error) {
    collaboratorRespondLogger.error({ err: String(error) }, "Collaborator respond error:");
    return NextResponse.json(
      { error: "Failed to process response" },
      { status: 500 }
    );
  }
}
