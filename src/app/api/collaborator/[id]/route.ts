import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const collaboratorLogger = logger.child({ module: "collaborator" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the collaborator record
    const collaborator = await db.projectCollaborator.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            title: true,
            slug: true,
            creator: {
              select: { name: true, vanityUrl: true },
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
    // If collaborator has no userId but email matches, link them
    if (!collaborator.userId && collaborator.email?.toLowerCase() === session.user.email?.toLowerCase()) {
      // Link the user to this collaborator record
      await db.projectCollaborator.update({
        where: { id },
        data: { userId: session.user.id },
      });
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

    // Build project URL with vanity URL if available
    const projectUrl = collaborator.project.creator.vanityUrl
      ? `/projects/${collaborator.project.creator.vanityUrl}/${collaborator.project.slug}`
      : `/projects/${collaborator.project.slug}`;

    // Build edit URL for collaborators with edit permission
    const editUrl = collaborator.canEditProject
      ? `${projectUrl}/edit`
      : null;

    return NextResponse.json({
      id: collaborator.id,
      projectTitle: collaborator.project.title,
      projectSlug: collaborator.project.slug,
      projectUrl,
      editUrl,
      inviterName: collaborator.project.creator.name || "Project Creator",
      title: collaborator.title,
      permissions: {
        canEditProject: collaborator.canEditProject,
        canManageCommunity: collaborator.canManageCommunity,
        canCoordinateFulfillment: collaborator.canCoordinateFulfillment,
        canConfigurePledgeManager: collaborator.canConfigurePledgeManager,
      },
      status: collaborator.status,
    });
  } catch (error) {
    collaboratorLogger.error({ err: String(error) }, "Collaborator fetch error:");
    return NextResponse.json(
      { error: "Failed to fetch collaboration details" },
      { status: 500 }
    );
  }
}
