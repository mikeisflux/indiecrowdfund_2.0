import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminProjectsStatusLogger = logger.child({ module: "admin-projects-status" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { notifyProjectPublished } from "@/lib/seo/indexing";

export const dynamic = "force-dynamic";

// POST /api/admin/projects/status - Change project status (deactivate, send to review)
export async function POST(request: Request) {
  try {
    const session = await auth();

    // Check if user is authenticated and is an admin
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { projectId, action, reason, notes, sendEmail } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get the project
    const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            vanityUrl: true,
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

      case "MAKE_LIVE":
        // Allow admin to directly make an approved project live
        if (project.status !== "APPROVED" && project.status !== "PAUSED") {
          return NextResponse.json(
            { error: "Only approved or paused campaigns can be made live" },
            { status: 400 }
          );
        }
        newStatus = "LIVE";
        actionDescription = "Campaign set to live by admin";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update the project status (and clear prelaunch data when going live)
    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "LIVE") {
      updateData.prelaunchActive = false;
      updateData.prelaunchDescription = null;
      updateData.prelaunchStatus = "DRAFT";

      // Set launch dates if not already set (admin MAKE_LIVE or REACTIVATE)
      if (!project.launchedAt) {
        const now = new Date();
        updateData.launchDate = now;
        updateData.launchedAt = now;

        // Calculate endDate if not already set
        if (!project.endDate) {
          if (project.durationType === "FIXED_DAYS" && project.durationDays) {
            const endDate = new Date(now);
            endDate.setDate(endDate.getDate() + project.durationDays);
            updateData.endDate = endDate;
          }
          // If durationType is END_DATE, the creator already set endDate in the builder
        }
      }
    }

    // CAS on the project's current status so two admins hitting the
    // same button simultaneously can't both create ProjectReview rows
    // and both send the status-change email to the creator.
    const statusCas = await db.project.updateMany({
      where: { id: projectId, status: project.status, deletedAt: null },
      data: updateData,
    });
    if (statusCas.count === 0) {
      return NextResponse.json(
        { error: "Project status changed — another admin may have already acted. Please refresh." },
        { status: 409 }
      );
    }
    const updatedProject = await db.project.findUnique({ where: { id: projectId } });
    if (!updatedProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Map admin actions to valid ReviewAction enum values (MAKE_LIVE is not in the enum)
    const actionToReviewAction: Record<string, "DEACTIVATE" | "REACTIVATE" | "SEND_TO_REVIEW"> = {
      DEACTIVATE: "DEACTIVATE",
      REACTIVATE: "REACTIVATE",
      MAKE_LIVE: "REACTIVATE",
      SEND_TO_REVIEW: "SEND_TO_REVIEW",
    };
    const reviewAction = actionToReviewAction[action];

    // Create a review history entry
    if (reviewAction) {
      await db.projectReview.create({
        data: {
          projectId: projectId,
          reviewerId: session.user.id,
          reviewerEmail: session.user.email || "admin@indiecrowdfund.com",
          action: reviewAction,
          previousStatus: project.status,
          newStatus: newStatus,
          notes: reason || notes || actionDescription,
          internalNotes: `Admin action: ${action}`,
          flagsRaised: [],
        },
      });
    }

    // Notify search engines when a project goes live (fire-and-forget)
    if (newStatus === "LIVE") {
      notifyProjectPublished(project.slug, project.creator.vanityUrl ?? null);
    }

    // Send email notification if sendEmail is true
    if (sendEmail && project.creator.email) {
      try {
        const { sendEmail: sendEmailFn } = await import("@/lib/email");
        const actionLabels: Record<string, string> = {
          DEACTIVATE: "deactivated",
          REACTIVATE: "reactivated",
          MAKE_LIVE: "set to live",
          SEND_TO_REVIEW: "sent back for review",
        };
        const actionLabel = actionLabels[action] || action.toLowerCase();
        const APP_NAME = "IndieCrowdfund";
        const html = `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333;">${APP_NAME}</h1>
            <div style="background: #f9f9f9; border-radius: 8px; padding: 24px;">
              <h2>Project Status Update</h2>
              <p>Hi ${project.creator.name || "Creator"},</p>
              <p>Your project <strong>${project.title}</strong> has been <strong>${actionLabel}</strong> by an administrator.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
              <p>If you have questions, please contact our support team.</p>
            </div>
          </div>
        `;
        await sendEmailFn({
          to: project.creator.email,
          subject: `Your project "${project.title}" has been ${actionLabel}`,
          html,
        });
        adminProjectsStatusLogger.info({ email: project.creator.email, action }, "Status change email sent");
      } catch (emailError) {
        adminProjectsStatusLogger.error({ err: String(emailError) }, "Failed to send status change email");
      }
    }

    const statusAuditMap: Record<string, Parameters<typeof auditLog>[0]["action"]> = {
      DEACTIVATE: "PROJECT_DEACTIVATE",
      SEND_TO_REVIEW: "PROJECT_SEND_TO_REVIEW",
      REACTIVATE: "PROJECT_REACTIVATE",
      MAKE_LIVE: "PROJECT_MAKE_LIVE",
    };
    if (statusAuditMap[action]) {
      auditLog({
        action: statusAuditMap[action],
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetId: projectId,
        targetType: "PROJECT",
        details: { action, previousStatus: project.status, newStatus, reason },
      });
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
    adminProjectsStatusLogger.error({ err: formatError(error) }, "Error changing project status:");
    return NextResponse.json(
      { error: "Failed to change project status" },
      { status: 500 }
    );
  }
}
