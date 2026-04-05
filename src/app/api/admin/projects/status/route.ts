import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminProjectsStatusLogger = logger.child({ module: "admin-projects-status" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateStripeConnectAccount } from "@/lib/payments/stripe";
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
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
    const project = await db.project.findUnique({
      where: { id: projectId, deletedAt: null },
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
        // Validate Stripe Connect before reactivating (skip for DivinityCoin projects)
        if (project.paymentProcessor !== "DIVINITYCOIN" && project.paymentProcessor !== "PAYPAL" && project.paymentProcessor !== "WHOP") {
          const stripeValidation = await validateStripeConnectAccount(project.creator.id);
          if (!stripeValidation.isValid) {
            return NextResponse.json(
              {
                error: "Cannot reactivate: Creator's Stripe account is not ready",
                message: stripeValidation.error,
                code: "STRIPE_NOT_READY",
              },
              { status: 400 }
            );
          }
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
        // Validate Stripe Connect before making live (skip for DivinityCoin projects)
        if (project.paymentProcessor !== "DIVINITYCOIN" && project.paymentProcessor !== "PAYPAL" && project.paymentProcessor !== "WHOP") {
          const stripeValidation = await validateStripeConnectAccount(project.creator.id);
          if (!stripeValidation.isValid) {
            return NextResponse.json(
              {
                error: "Cannot make live: Creator's Stripe account is not ready",
                message: stripeValidation.error,
                code: "STRIPE_NOT_READY",
              },
              { status: 400 }
            );
          }
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
    }

    const updatedProject = await db.project.update({
      where: { id: projectId },
      data: updateData,
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
      SEND_TO_REVIEW: "PROJECT_DEACTIVATE",
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
    adminProjectsStatusLogger.error({ err: String(error) }, "Error changing project status:");
    return NextResponse.json(
      { error: "Failed to change project status" },
      { status: 500 }
    );
  }
}
