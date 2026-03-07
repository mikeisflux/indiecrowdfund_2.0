import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const bugReportsLogger = logger.child({ module: "bug-reports" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

const bugReportSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Valid email is required"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required"),
  category: z.enum([
    "UI_VISUAL",
    "FUNCTIONALITY",
    "PERFORMANCE",
    "SECURITY",
    "PAYMENT",
    "ACCOUNT",
    "PROJECT",
    "REWARDS",
    "OTHER",
  ]).default("OTHER"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  pageUrl: z.string().optional(),
  browser: z.string().optional(),
  device: z.string().optional(),
  steps: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
});

// POST - Submit a new bug report
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const validatedData = bugReportSchema.parse(body);

    const bugReport = await db.bugReport.create({
      data: {
        userId: session?.user?.id || null,
        name: validatedData.name || null,
        email: validatedData.email,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        severity: validatedData.severity,
        pageUrl: validatedData.pageUrl || null,
        browser: validatedData.browser || null,
        device: validatedData.device || null,
        steps: validatedData.steps || null,
        expectedBehavior: validatedData.expectedBehavior || null,
        actualBehavior: validatedData.actualBehavior || null,
        status: "NEW",
        priority: validatedData.severity === "CRITICAL" ? "URGENT" :
                  validatedData.severity === "HIGH" ? "HIGH" : "MEDIUM",
      },
    });

    return NextResponse.json({ success: true, id: bugReport.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    bugReportsLogger.error({ err: String(error) }, "Error creating bug report:");
    return NextResponse.json(
      { error: "Failed to submit bug report" },
      { status: 500 }
    );
  }
}

// GET - Get bug reports (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");

    // Validate and sanitize pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    // Whitelist allowed sort fields
    const allowedSortFields = ["createdAt", "status", "priority", "category", "severity"];
    const requestedSortBy = searchParams.get("sortBy") || "createdAt";
    const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (status && status !== "all") {
      where.status = status;
    }
    if (category && category !== "all") {
      where.category = category;
    }
    if (priority && priority !== "all") {
      where.priority = priority;
    }

    const [bugReports, total] = await Promise.all([
      db.bugReport.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      db.bugReport.count({ where }),
    ]);

    // Get stats
    const [newCount, inProgressCount, resolvedCount] = await Promise.all([
      db.bugReport.count({ where: { status: "NEW" } }),
      db.bugReport.count({ where: { status: "IN_PROGRESS" } }),
      db.bugReport.count({ where: { status: "RESOLVED" } }),
    ]);

    return NextResponse.json({
      bugReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        new: newCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
      },
    });
  } catch (error) {
    bugReportsLogger.error({ err: String(error) }, "Error fetching bug reports:");
    return NextResponse.json(
      { error: "Failed to fetch bug reports" },
      { status: 500 }
    );
  }
}

// PATCH - Update a bug report (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, priority, assignedTo, resolution } = body;

    if (!id) {
      return NextResponse.json({ error: "Bug report ID required" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (resolution !== undefined) updateData.resolution = resolution;

    // Set resolvedAt if status is RESOLVED or CLOSED
    if (status === "RESOLVED" || status === "CLOSED") {
      updateData.resolvedAt = new Date();
    }

    const bugReport = await db.bugReport.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, bugReport });
  } catch (error) {
    bugReportsLogger.error({ err: String(error) }, "Error updating bug report:");
    return NextResponse.json(
      { error: "Failed to update bug report" },
      { status: 500 }
    );
  }
}
