import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const projectsPrelaunchLogger = logger.child({ module: "projects-prelaunch" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkProjectEditPermission, canActivatePrelaunchImmediately } from "@/lib/project-permissions";
import { sendProjectSubmittedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const prelaunchSchema = z.object({
  prelaunchActive: z.boolean().optional(),
  prelaunchDescription: z.string().optional().nullable(),
});

// POST - Update prelaunch settings
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const { permission } = permissionCheck;

    // For launched projects, prelaunch settings are no longer relevant - return success silently
    if (permission.isLaunched) {
      return NextResponse.json({
        success: true,
        message: "Prelaunch settings not applicable for launched campaigns",
        project: { id: projectId },
      });
    }

    const body = await req.json();
    const data = prelaunchSchema.parse(body);

    // Get current project state
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        prelaunchStatus: true,
        status: true,
        title: true,
        creator: { select: { name: true, email: true } }
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Handle prelaunch activation
    if (data.prelaunchActive === true) {
      // Check if user can activate prelaunch immediately
      const canActivate = await canActivatePrelaunchImmediately(session.user.id);

      if (!canActivate) {
        // User needs approval - check if prelaunch is already approved or pending
        if (project.prelaunchStatus === "SUBMITTED") {
          return NextResponse.json({
            success: true,
            requiresApproval: true,
            message: "Your pre-launch page is already submitted and pending review.",
            project: { id: projectId, prelaunchStatus: "SUBMITTED" },
          });
        }

        if (project.prelaunchStatus !== "APPROVED") {
          // Submit the prelaunch for review — use updateMany with status guard to prevent
          // duplicate review records from concurrent requests
          updateData.prelaunchStatus = "SUBMITTED";

          const updated = await db.project.updateMany({
            where: { id: projectId, prelaunchStatus: { notIn: ["SUBMITTED", "APPROVED"] } },
            data: updateData,
          });

          if (updated.count === 0) {
            // Another concurrent request already submitted this — return as-if successful
            return NextResponse.json({
              success: true,
              requiresApproval: true,
              message: "Your pre-launch page is already submitted and pending review.",
              project: { id: projectId, prelaunchStatus: "SUBMITTED" },
            });
          }

          // Create a project review record
          await db.projectReview.create({
            data: {
              projectId,
              action: "SUBMITTED",
              previousStatus: project.status,
              newStatus: project.status,
              notes: "Pre-launch page submitted for review. Standard user without previous successful campaign.",
              flagsRaised: ["prelaunch_review"],
            },
          });

          // Send email notification
          if (project.creator?.email) {
            try {
              await sendProjectSubmittedEmail(
                project.creator.email,
                project.creator.name || "Creator",
                project.title
              );
            } catch (emailError) {
              projectsPrelaunchLogger.error({ err: String(emailError) }, "Failed to send project submitted email:");
            }
          }

          return NextResponse.json({
            success: true,
            requiresApproval: true,
            message: "Your pre-launch page has been submitted for review. Once approved, you can activate it.",
            project: { id: projectId, prelaunchStatus: "SUBMITTED" },
          });
        }
        // Prelaunch is approved, allow activation
        updateData.prelaunchActive = true;
      } else {
        // User can activate prelaunch immediately
        updateData.prelaunchActive = true;
      }
    } else if (data.prelaunchActive === false) {
      updateData.prelaunchActive = false;
    }

    if (data.prelaunchDescription !== undefined) {
      updateData.prelaunchDescription = data.prelaunchDescription;
    }

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        prelaunchActive: true,
        prelaunchDescription: true,
        prelaunchStatus: true,
      },
    });

    projectsPrelaunchLogger.info(`Project prelaunch settings updated for ${projectId}`);

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    projectsPrelaunchLogger.error({ err: formatError(error) }, "Update prelaunch error:");

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update prelaunch settings" },
      { status: 500 }
    );
  }
}

// GET - Get prelaunch settings
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const permissionCheck = await checkProjectEditPermission(projectId, session.user.id);

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      );
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        prelaunchActive: true,
        prelaunchDescription: true,
        prelaunchStatus: true,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    projectsPrelaunchLogger.error({ err: formatError(error) }, "Get prelaunch error:");
    return NextResponse.json(
      { error: "Failed to get prelaunch settings" },
      { status: 500 }
    );
  }
}
