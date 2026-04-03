import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsCollaboratorsLogger = logger.child({ module: "projects-collaborators" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { sendCollaboratorInviteEmail } from "@/lib/email";

const collaboratorSchema = z.object({
  email: z.string().email(),
  title: z.string().optional(),
  canEditProject: z.boolean().optional(),
  canManageCommunity: z.boolean().optional(),
  canCoordinateFulfillment: z.boolean().optional(),
  canConfigurePledgeManager: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        creatorId: true,
        title: true,
        slug: true,
        creator: {
          select: { name: true }
        }
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const collab = collaboratorSchema.parse(body);
    const emailLower = collab.email.toLowerCase();

    // Check if already a collaborator
    const existingCollaborator = await db.projectCollaborator.findFirst({
      where: {
        projectId,
        email: { equals: emailLower, mode: "insensitive" },
      },
    });

    if (existingCollaborator) {
      return NextResponse.json(
        { error: "This person is already a collaborator on this project" },
        { status: 400 }
      );
    }

    const creatorName = session.user.name || project.creator.name || "Project Creator";

    // Get creator's email handle for reply-to address
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { creatorEmailHandle: true },
    });
    const creatorEmailHandle = creator?.creatorEmailHandle;
    const creatorEmail = creatorEmailHandle ? `${creatorEmailHandle}@indiecrowdfund.com` : undefined;

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    });

    // Create collaborator record
    const collaboratorRecord = await db.projectCollaborator.create({
      data: {
        projectId,
        userId: user?.id || null,
        email: collab.email,
        title: collab.title || null,
        canEditProject: collab.canEditProject || false,
        canManageCommunity: collab.canManageCommunity || false,
        canCoordinateFulfillment: collab.canCoordinateFulfillment || false,
        canConfigurePledgeManager: collab.canConfigurePledgeManager || false,
        status: "PENDING",
      },
    });

    // Create notification if user exists
    if (user) {
      await db.notification.create({
        data: {
          userId: user.id,
          type: "COLLABORATOR_INVITE",
          title: "You've been invited to collaborate",
          message: `${creatorName} has invited you to collaborate on "${project.title}"`,
          actionUrl: `/collaborate/${collaboratorRecord.id}`,
          projectId,
          senderId: session.user.id,
        },
      });
    }

    // Send email notification with reply-to set to creator's email
    const emailResult = await sendCollaboratorInviteEmail(
      collab.email,
      creatorName,
      project.title,
      collaboratorRecord.id,
      creatorEmail ? { replyTo: creatorEmail } : undefined
    );

    projectsCollaboratorsLogger.info(
      { emailSent: emailResult.success, error: emailResult.error || null, to: collab.email },
      "Collaborator invite email result"
    );

    // Create a Message record so it appears in the creator's inbox
    if (user) {
      await db.message.create({
        data: {
          senderId: session.user.id,
          recipientId: user.id,
          projectId,
          subject: emailResult.subject,
          content: emailResult.plainTextContent,
          read: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      collaborator: {
        id: collaboratorRecord.id,
        email: collaboratorRecord.email,
        title: collaboratorRecord.title,
        status: collaboratorRecord.status,
      },
      emailSent: emailResult.success,
    });
  } catch (error) {
    projectsCollaboratorsLogger.error({ err: String(error) }, "Add collaborator error:");
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to add collaborator" },
      { status: 500 }
    );
  }
}

// Get all collaborators for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership or collaboration
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isCollaborator = await db.projectCollaborator.findFirst({
      where: {
        projectId,
        userId: session.user.id,
        status: "ACCEPTED",
      },
    });

    if (project.creatorId !== session.user.id && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const PLATFORM_OWNER_EMAIL = "mikeisflux@indiecrowdfund.com";

    const collaborators = await db.projectCollaborator.findMany({
      where: { projectId, NOT: { email: { equals: PLATFORM_OWNER_EMAIL, mode: "insensitive" } } },
      select: {
        id: true,
        email: true,
        title: true,
        status: true,
        canEditProject: true,
        canManageCommunity: true,
        canCoordinateFulfillment: true,
        canConfigurePledgeManager: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ collaborators });
  } catch (error) {
    projectsCollaboratorsLogger.error({ err: String(error) }, "Get collaborators error:");
    return NextResponse.json(
      { error: "Failed to fetch collaborators" },
      { status: 500 }
    );
  }
}

// Delete a collaborator
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const collaboratorId = searchParams.get("collaboratorId");

    if (!collaboratorId) {
      return NextResponse.json({ error: "Collaborator ID required" }, { status: 400 });
    }

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.projectCollaborator.delete({
      where: { id: collaboratorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    projectsCollaboratorsLogger.error({ err: String(error) }, "Delete collaborator error:");
    return NextResponse.json(
      { error: "Failed to delete collaborator" },
      { status: 500 }
    );
  }
}
