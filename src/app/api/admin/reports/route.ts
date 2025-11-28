import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get reports list
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "PENDING";
    const priority = searchParams.get("priority") || "all";
    const targetType = searchParams.get("targetType") || "all";
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status !== "all") {
      where.status = status;
    }
    if (priority !== "all") {
      where.priority = priority;
    }
    if (targetType !== "all") {
      where.targetType = targetType;
    }

    const [reports, total, statusCounts] = await Promise.all([
      db.report.findMany({
        where,
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" }
        ],
        skip,
        take: limit
      }),
      db.report.count({ where }),
      Promise.all([
        db.report.count({ where: { status: "PENDING" } }),
        db.report.count({ where: { status: "UNDER_REVIEW" } }),
        db.report.count({ where: { status: "RESOLVED" } }),
        db.report.count({ where: { status: "DISMISSED" } }),
        db.report.count({ where: { status: "ESCALATED" } })
      ])
    ]);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        pending: statusCounts[0],
        underReview: statusCounts[1],
        resolved: statusCounts[2],
        dismissed: statusCounts[3],
        escalated: statusCounts[4]
      }
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

// POST - Create a new report
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetType, targetId, reason, description, reporterEmail, projectId, userId, evidence } = body;

    if (!targetType || !targetId || !reason || !description) {
      return NextResponse.json(
        { error: "Target type, target ID, reason, and description are required" },
        { status: 400 }
      );
    }

    // Get reporter ID if authenticated
    const session = await auth();
    const reporterId = session?.user?.id || null;

    const report = await db.report.create({
      data: {
        targetType,
        targetId,
        reason,
        description,
        reporterId,
        reporterEmail: reporterId ? null : reporterEmail,
        projectId,
        userId,
        evidence: evidence || []
      }
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}

// PATCH - Update report status
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { reportId, action, resolution, actionTaken } = body;

    if (!reportId || !action) {
      return NextResponse.json(
        { error: "Report ID and action are required" },
        { status: 400 }
      );
    }

    const report = await db.report.findUnique({
      where: { id: reportId }
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    switch (action) {
      case "REVIEW":
        updateData.status = "UNDER_REVIEW";
        break;

      case "RESOLVE":
        updateData.status = "RESOLVED";
        updateData.resolvedBy = authResult.user.id;
        updateData.resolvedAt = new Date();
        updateData.resolution = resolution;
        updateData.actionTaken = actionTaken;
        break;

      case "DISMISS":
        updateData.status = "DISMISSED";
        updateData.resolvedBy = authResult.user.id;
        updateData.resolvedAt = new Date();
        updateData.resolution = resolution;
        updateData.actionTaken = "NO_ACTION";
        break;

      case "ESCALATE":
        updateData.status = "ESCALATED";
        updateData.priority = "URGENT";
        break;

      case "UPDATE_PRIORITY":
        if (body.priority) {
          updateData.priority = body.priority;
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    const updatedReport = await db.report.update({
      where: { id: reportId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      report: updatedReport
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 }
    );
  }
}
