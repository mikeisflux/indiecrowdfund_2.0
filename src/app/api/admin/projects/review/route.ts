import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withCorrelation, CORRELATION_HEADER } from "@/lib/correlation";

const adminProjectsReviewLogger = logger.child({ module: "admin-projects-review" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  sendProjectApprovedEmail,
  sendProjectRejectedEmail,
  sendProjectChangesRequestedEmail,
} from "@/lib/email";
import { auditLog } from "@/lib/audit";
import { notifyProjectPublished, notifyPrelaunchPublished } from "@/lib/seo/indexing";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// POST - Submit a project review (approve, reject, request changes)
export async function POST(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      projectId,
      action, // "APPROVED" | "REJECTED" | "REQUESTED_CHANGES"
      notes,
      internalNotes,
      rejectionReason,
      sendEmail = true,
      isPrelaunch = false, // Whether this is a prelaunch review
    } = body;

    if (!projectId || !action) {
      return NextResponse.json(
        { error: "Project ID and action are required" },
        { status: 400 }
      );
    }

    // Get the current project
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        prelaunchStatus: true,
        contactEmail: true, // Email from payment settings
        creator: {
          select: { id: true, email: true, name: true, role: true, vanityUrl: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check status based on review type
    if (isPrelaunch) {
      if (project.prelaunchStatus !== "SUBMITTED") {
        // Backward compatibility: check if there's a pending prelaunch review record
        // (orphaned submission from before the bug fix)
        const pendingPrelaunchReview = await db.projectReview.findFirst({
          where: {
            projectId,
            action: "SUBMITTED",
            flagsRaised: { has: "prelaunch_review" },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!pendingPrelaunchReview) {
          return NextResponse.json(
            { error: "Prelaunch page is not in submitted status" },
            { status: 400 }
          );
        }
        // If we found a pending review, allow the approval to proceed
      }
    } else {
      if (project.status !== "SUBMITTED") {
        return NextResponse.json(
          { error: "Project is not in submitted status" },
          { status: 400 }
        );
      }
    }

    // Determine new status based on action
    let newStatus: "APPROVED" | "DRAFT" | "SUBMITTED";
    let reviewAction: "APPROVED" | "REJECTED" | "REQUESTED_CHANGES";

    switch (action) {
      case "APPROVED":
        newStatus = "APPROVED";
        reviewAction = "APPROVED";
        break;
      case "REJECTED":
        newStatus = "DRAFT"; // Reset to draft so they can't resubmit same content
        reviewAction = "REJECTED";
        if (!rejectionReason) {
          return NextResponse.json(
            { error: "Rejection reason is required" },
            { status: 400 }
          );
        }
        break;
      case "REQUESTED_CHANGES":
        newStatus = "DRAFT"; // Allow them to edit and resubmit
        reviewAction = "REQUESTED_CHANGES";
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update project and create review record in a transaction
    const updateData = isPrelaunch
      ? { prelaunchStatus: newStatus, ...(newStatus === "APPROVED" && { prelaunchActive: true }) }
      : { status: newStatus };

    const previousStatus = isPrelaunch ? project.prelaunchStatus : project.status;

    const [updatedProject, review] = await db.$transaction([
      // Update project status
      db.project.update({
        where: { id: projectId },
        data: updateData,
      }),

      // Create review record
      db.projectReview.create({
        data: {
          projectId,
          reviewerId: session.user.id,
          reviewerEmail: session.user.email,
          action: reviewAction,
          previousStatus: previousStatus,
          newStatus,
          notes,
          internalNotes,
          rejectionReason: rejectionReason || null,
          flagsRaised: isPrelaunch ? ["prelaunch_review"] : [],
        },
      }),
    ]);

    // Auto-promote user to CREATOR role when prelaunch is approved
    if (
      isPrelaunch &&
      action === "APPROVED" &&
      project.creator?.role === "USER"
    ) {
      await db.user.update({
        where: { id: project.creator.id },
        data: { role: "CREATOR" },
      });
    }

    // Send email notification if enabled
    if (sendEmail) {
      try {
        const creatorName = project.creator.name || "Creator";

        // Collect unique email addresses to send to
        const emailAddresses = new Set<string>();
        if (project.contactEmail) {
          emailAddresses.add(project.contactEmail.toLowerCase());
        }
        if (project.creator.email) {
          emailAddresses.add(project.creator.email.toLowerCase());
        }

        if (emailAddresses.size === 0) {
          adminProjectsReviewLogger.info("No email addresses found for project creator");
        } else {
          // Send to each unique email address
          for (const email of Array.from(emailAddresses)) {
            let emailResult: { success: boolean; error?: string } = { success: false };

            switch (reviewAction) {
              case "APPROVED":
                emailResult = await sendProjectApprovedEmail(
                  email,
                  creatorName,
                  project.title,
                  project.slug,
                  notes
                );
                break;
              case "REJECTED":
                emailResult = await sendProjectRejectedEmail(
                  email,
                  creatorName,
                  project.title,
                  rejectionReason,
                  notes
                );
                break;
              case "REQUESTED_CHANGES":
                emailResult = await sendProjectChangesRequestedEmail(
                  email,
                  creatorName,
                  project.title,
                  notes || "Please review your project and make necessary updates."
                );
                break;
            }

            if (emailResult.success) {
              adminProjectsReviewLogger.info(`Review email sent successfully to ${email} for action: ${reviewAction}`);
            } else {
              adminProjectsReviewLogger.error(`Failed to send review email to ${email}: ${emailResult.error}`);
            }
          }
        }
      } catch (emailError) {
        adminProjectsReviewLogger.error({ err: String(emailError) }, "Failed to send review email:");
        // Continue with the response even if email fails
      }
    } else {
      adminProjectsReviewLogger.info(`Email notification skipped - sendEmail: ${sendEmail}`);
    }

    const reviewAuditMap: Record<string, Parameters<typeof auditLog>[0]["action"]> = {
      APPROVED: "PROJECT_APPROVE",
      REJECTED: "PROJECT_REJECT",
    };
    if (reviewAuditMap[action]) {
      auditLog({
        action: reviewAuditMap[action],
        actorId: session.user.id,
        actorEmail: session.user.email || undefined,
        targetId: projectId,
        targetType: "PROJECT",
        details: { action, previousStatus, newStatus, rejectionReason },
      });
    }

    // Notify search engines about newly approved/published content (fire-and-forget)
    if (action === "APPROVED") {
      const vanityUrl = project.creator.vanityUrl ?? null;
      if (isPrelaunch) {
        notifyPrelaunchPublished(project.slug, vanityUrl);
      } else {
        notifyProjectPublished(project.slug, vanityUrl);
      }
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
      review,
    }, {
      headers: { [CORRELATION_HEADER]: correlationId },
    });
  } catch (error) {
    adminProjectsReviewLogger.error({ correlationId, err: String(error) }, "Error reviewing project:");
    return NextResponse.json(
      { error: "Failed to review project", correlationId },
      { status: 500, headers: { [CORRELATION_HEADER]: correlationId } }
    );
  }
  });
}

// GET - Get pending projects for review
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "SUBMITTED";
    const category = searchParams.get("category");
    const prelaunchActive = searchParams.get("prelaunchActive") === "true"; // Active prelaunch pages
    const prelaunchReview = searchParams.get("prelaunchReview") === "true"; // Prelaunch pending review
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    // Always exclude deleted projects
    let where: Record<string, unknown> = { deletedAt: null };
    if (prelaunchActive) {
      // Active prelaunch pages - show all with prelaunchActive: true
      // (includes legacy pages that were published before prelaunchStatus was added)
      where = { deletedAt: null, prelaunchActive: true };
    } else if (prelaunchReview) {
      // Prelaunch pages pending review
      where = { deletedAt: null, prelaunchStatus: "SUBMITTED" };
    } else {
      // Regular project status query
      where = { deletedAt: null, status };
    }

    if (category && category !== "all") {
      where.category = category;
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          description: true,
          category: true,
          goalAmount: true,
          currentAmount: true,
          backerCount: true,
          currency: true,
          durationType: true,
          durationDays: true,
          endDate: true,
          launchDate: true,
          videoUrl: true,
          imageUrl: true,
          risks: true,
          status: true,
          prelaunchActive: true,
          paymentProcessor: true,
          hasAdultContent: true,
          hasRiskyContent: true,
          promoContentSfw: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
              createdAt: true,
              vanityUrl: true,
              _count: {
                select: {
                  createdProjects: true,
                },
              },
            },
          },
          rewards: {
            select: { id: true },
          },
          _count: {
            select: {
              pledges: {
                where: { status: "COMPLETED" },
              },
              followers: true,
            },
          },
        },
        orderBy: { createdAt: "asc" }, // Oldest first (FIFO)
        skip,
        take: limit,
      }),
      db.project.count({ where }),
    ]);

    // Get fulfillment stats for each project
    const projectIds = projects.map((p: { id: string }) => p.id);
    const fulfillmentStats = projectIds.length > 0
      ? await db.pledge.groupBy({
          by: ["projectId", "fulfillmentStatus"],
          where: {
            projectId: { in: projectIds },
            status: "COMPLETED",
            deletedAt: null,
          },
          _count: true,
        })
      : [];

    // Build fulfillment map: projectId -> { total, shipped, delivered, inProgress, notStarted }
    const fulfillmentMap = new Map<string, { total: number; notStarted: number; inProgress: number; shipped: number; delivered: number }>();
    for (const row of fulfillmentStats) {
      if (!fulfillmentMap.has(row.projectId)) {
        fulfillmentMap.set(row.projectId, { total: 0, notStarted: 0, inProgress: 0, shipped: 0, delivered: 0 });
      }
      const entry = fulfillmentMap.get(row.projectId)!;
      entry.total += row._count;
      switch (row.fulfillmentStatus) {
        case "NOT_STARTED": entry.notStarted += row._count; break;
        case "IN_PROGRESS": entry.inProgress += row._count; break;
        case "SHIPPED": entry.shipped += row._count; break;
        case "DELIVERED": entry.delivered += row._count; break;
      }
    }

    // Merge fulfillment data into projects
    const projectsWithFulfillment = projects.map((p: { id: string }) => ({
      ...p,
      fulfillment: fulfillmentMap.get(p.id) || { total: 0, notStarted: 0, inProgress: 0, shipped: 0, delivered: 0 },
    }));

    // Get review stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [approvedToday, rejectedToday] = await Promise.all([
      db.projectReview.count({
        where: {
          action: "APPROVED",
          createdAt: { gte: today },
        },
      }),
      db.projectReview.count({
        where: {
          action: "REJECTED",
          createdAt: { gte: today },
        },
      }),
    ]);

    return NextResponse.json({
      projects: projectsWithFulfillment,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: total,
        approvedToday,
        rejectedToday,
      },
    });
  } catch (error) {
    adminProjectsReviewLogger.error({ err: String(error) }, "Error fetching projects for review:");
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
