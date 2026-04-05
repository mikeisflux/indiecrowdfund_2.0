import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminProjectsHistoryLogger = logger.child({ module: "admin-projects-history" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Get review history
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

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

    const { searchParams } = new URL(req.url);
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skip = (page - 1) * limit;

    // Fetch reviews
    const [reviews, total] = await Promise.all([
      db.projectReview.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.projectReview.count(),
    ]);

    // Get unique project IDs and reviewer IDs
    const projectIds = Array.from(new Set(reviews.map((r: { projectId: string }) => r.projectId)));
    const reviewerIds = Array.from(
      new Set(
        reviews
          .filter((r: { reviewerId: string | null }): r is { reviewerId: string } => r.reviewerId !== null)
          .map((r: { reviewerId: string }) => r.reviewerId)
      )
    );

    // Fetch projects and reviewers in parallel
    const [projects, reviewers] = await Promise.all([
      db.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          creator: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      reviewerIds.length > 0
        ? db.user.findMany({
            where: { id: { in: reviewerIds } },
            select: {
              id: true,
              name: true,
              email: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // Create lookup maps
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const reviewerMap = new Map(reviewers.map((r) => [r.id, r]));

    // Define review type
    interface ProjectReviewRow {
      id: string;
      projectId: string;
      reviewerId: string | null;
      reviewerEmail: string | null;
      action: string;
      notes: string | null;
      internalNotes: string | null;
      rejectionReason: string | null;
      previousStatus: string;
      newStatus: string;
      createdAt: Date;
    }

    // Combine the data
    const reviewsWithDetails = reviews.map((review: ProjectReviewRow) => ({
      id: review.id,
      projectId: review.projectId,
      action: review.action,
      notes: review.notes,
      internalNotes: review.internalNotes,
      rejectionReason: review.rejectionReason,
      previousStatus: review.previousStatus,
      newStatus: review.newStatus,
      createdAt: review.createdAt,
      project: projectMap.get(review.projectId) || {
        id: review.projectId,
        title: "Unknown Project",
        slug: "",
        status: "UNKNOWN",
        creator: { name: null, email: "unknown" },
      },
      reviewer: review.reviewerId
        ? reviewerMap.get(review.reviewerId) || { name: null, email: review.reviewerEmail || "unknown" }
        : review.reviewerEmail
          ? { name: null, email: review.reviewerEmail }
          : null,
    }));

    return NextResponse.json({
      reviews: reviewsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    adminProjectsHistoryLogger.error({ err: String(error) }, "Error fetching review history:");
    return NextResponse.json(
      { error: "Failed to fetch review history" },
      { status: 500 }
    );
  }
}
