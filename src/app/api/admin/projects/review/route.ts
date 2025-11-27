import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// POST - Submit a project review (approve, reject, request changes)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In production, check if user is admin
    // const user = await db.user.findUnique({ where: { id: session.user.id } });
    // if (user?.role !== "ADMIN") {
    //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // }

    const body = await req.json();
    const {
      projectId,
      action, // "APPROVED" | "REJECTED" | "REQUESTED_CHANGES"
      notes,
      internalNotes,
      rejectionReason,
      sendEmail = true,
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
      include: {
        creator: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "Project is not in submitted status" },
        { status: 400 }
      );
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
    const [updatedProject, review] = await db.$transaction([
      // Update project status
      db.project.update({
        where: { id: projectId },
        data: { status: newStatus },
      }),

      // Create review record
      db.projectReview.create({
        data: {
          projectId,
          reviewerId: session.user.id,
          reviewerEmail: session.user.email,
          action: reviewAction,
          previousStatus: project.status,
          newStatus,
          notes,
          internalNotes,
          rejectionReason: rejectionReason || null,
          flagsRaised: [],
        },
      }),
    ]);

    // Send email notification if enabled
    if (sendEmail && project.creator.email) {
      // In production, integrate with SendGrid
      // await sendReviewEmail({
      //   to: project.creator.email,
      //   action: reviewAction,
      //   projectTitle: project.title,
      //   notes,
      //   rejectionReason,
      // });
      console.log(`Email notification would be sent to ${project.creator.email}`);
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
      review,
    });
  } catch (error) {
    console.error("Error reviewing project:", error);
    return NextResponse.json(
      { error: "Failed to review project" },
      { status: 500 }
    );
  }
}

// GET - Get pending projects for review
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "SUBMITTED";
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {
      status,
    };

    if (category && category !== "all") {
      where.category = category;
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
              createdAt: true,
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
              pledges: true,
            },
          },
        },
        orderBy: { createdAt: "asc" }, // Oldest first (FIFO)
        skip,
        take: limit,
      }),
      db.project.count({ where }),
    ]);

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
      projects,
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
    console.error("Error fetching projects for review:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
