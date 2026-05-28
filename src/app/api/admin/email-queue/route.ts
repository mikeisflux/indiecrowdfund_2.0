import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminEmailQueueLogger = logger.child({ module: "admin-email-queue" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEmailQueueStats, setEmailQueueEnabled, EMAIL_PRIORITY } from "@/lib/email";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get email queue status and stats with filtering/pagination
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // PENDING, PROCESSING, SENT, FAILED, or "all"
    const queue = searchParams.get("queue"); // "microsoft" to filter to MS domains only
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const search = searchParams.get("search") || "";

    const stats = await getEmailQueueStats();

    // Also count demoted (retry) emails separately
    const demotedCount = await db.emailQueue.count({
      where: { status: "PENDING", priority: { lt: 0 } },
    });

    // Microsoft domain email counts (outlook, hotmail, live, msn)
    const microsoftDomainFilter = {
      OR: [
        { toEmail: { contains: "@outlook.", mode: "insensitive" as const } },
        { toEmail: { contains: "@hotmail.", mode: "insensitive" as const } },
        { toEmail: { contains: "@live.", mode: "insensitive" as const } },
        { toEmail: { contains: "@msn.", mode: "insensitive" as const } },
      ],
    };

    const [msPending, msProcessing, msSent, msFailed] = await Promise.all([
      db.emailQueue.count({ where: { status: "PENDING", ...microsoftDomainFilter } }),
      db.emailQueue.count({ where: { status: "PROCESSING", ...microsoftDomainFilter } }),
      db.emailQueue.count({ where: { status: "SENT", ...microsoftDomainFilter } }),
      db.emailQueue.count({ where: { status: "FAILED", ...microsoftDomainFilter } }),
    ]);

    // Build where clause for filtered list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status && status !== "all") {
      where.status = status;
    }

    // Filter to Microsoft domains only
    if (queue === "microsoft") {
      where.AND = [
        ...(where.AND || []),
        microsoftDomainFilter,
      ];
    }

    if (search) {
      where.OR = [
        { toEmail: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { error: { contains: search, mode: "insensitive" } },
      ];
    }

    const [emails, totalCount] = await Promise.all([
      db.emailQueue.findMany({
        where,
        orderBy: [
          { status: "asc" }, // FAILED/PENDING first
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          toEmail: true,
          subject: true,
          status: true,
          priority: true,
          attempts: true,
          maxAttempts: true,
          error: true,
          createdAt: true,
          processedAt: true,
          sentAt: true,
          fromEmail: true,
          isCreatorEmail: true,
        },
      }),
      db.emailQueue.count({ where }),
    ]);

    return NextResponse.json({
      stats: {
        ...stats,
        demoted: demotedCount,
      },
      microsoftStats: {
        pending: msPending,
        processing: msProcessing,
        sent: msSent,
        failed: msFailed,
        total: msPending + msProcessing + msSent + msFailed,
      },
      emails,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    adminEmailQueueLogger.error({ err: formatError(error) }, "Error fetching email queue:");
    return NextResponse.json(
      { error: "Failed to fetch email queue status" },
      { status: 500 }
    );
  }
}

// POST - Control the email queue (start/stop/retry/clear/delete-one/promote)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { action, emailId } = body;

    if (action === "start") {
      await setEmailQueueEnabled(true);
      return NextResponse.json({
        success: true,
        message: "Email queue started",
        enabled: true,
      });
    } else if (action === "stop") {
      await setEmailQueueEnabled(false);
      return NextResponse.json({
        success: true,
        message: "Email queue stopped",
        enabled: false,
      });
    } else if (action === "retry-failed") {
      // Reset failed emails to pending for retry, but skip permanently blocked ones
      const result = await db.emailQueue.updateMany({
        where: {
          status: "FAILED",
          error: {
            not: { contains: "blocked" },
          },
        },
        data: { status: "PENDING", attempts: 0, error: null, priority: EMAIL_PRIORITY.RETRY },
      });
      return NextResponse.json({
        success: true,
        message: `Reset ${result.count} failed emails for retry at low priority`,
        count: result.count,
      });
    } else if (action === "retry-one") {
      // Retry a single email — updateMany so a concurrent delete/process
      // doesn't cause P2025.
      if (!emailId) {
        return NextResponse.json({ error: "emailId required" }, { status: 400 });
      }
      const updated = await db.emailQueue.updateMany({
        where: { id: emailId },
        data: { status: "PENDING", attempts: 0, error: null },
      });
      if (updated.count === 0) {
        return NextResponse.json({ success: true, message: "Email no longer in queue" });
      }
      return NextResponse.json({ success: true, message: "Email queued for retry" });
    } else if (action === "delete-one") {
      // Delete a single email from queue
      if (!emailId) {
        return NextResponse.json({ error: "emailId required" }, { status: 400 });
      }
      const deleted = await db.emailQueue.deleteMany({ where: { id: emailId } });
      if (deleted.count === 0) {
        return NextResponse.json({ success: true, message: "Email already removed from queue" });
      }
      return NextResponse.json({ success: true, message: "Email removed from queue" });
    } else if (action === "promote-demoted") {
      // Promote all demoted (retry priority) emails back to AI_MARKETING priority
      const result = await db.emailQueue.updateMany({
        where: { status: "PENDING", priority: { lt: 0 } },
        data: { priority: EMAIL_PRIORITY.AI_MARKETING },
      });
      return NextResponse.json({
        success: true,
        message: `Promoted ${result.count} demoted emails back to normal priority`,
        count: result.count,
      });
    } else if (action === "clear-sent") {
      // Clear old sent emails (older than 7 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const result = await db.emailQueue.deleteMany({
        where: {
          status: "SENT",
          sentAt: { lt: cutoff },
        },
      });
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.count} old sent emails`,
        count: result.count,
      });
    } else if (action === "unstick-processing") {
      // Reset all PROCESSING emails back to PENDING (for manually fixing stuck emails)
      const result = await db.emailQueue.updateMany({
        where: { status: "PROCESSING" },
        data: { status: "PENDING", error: "Manually reset from PROCESSING by admin" },
      });
      return NextResponse.json({
        success: true,
        message: `Reset ${result.count} stuck processing email(s) back to pending`,
        count: result.count,
      });
    } else if (action === "clear-all-sent") {
      // Clear ALL sent emails
      const result = await db.emailQueue.deleteMany({
        where: { status: "SENT" },
      });
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.count} sent emails`,
        count: result.count,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    adminEmailQueueLogger.error({ err: formatError(error) }, "Error controlling email queue:");
    return NextResponse.json(
      { error: "Failed to control email queue" },
      { status: 500 }
    );
  }
}

// DELETE - Clear all queued emails (emergency)
export async function DELETE() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Clear all pending emails
    const result = await db.emailQueue.deleteMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.count} pending emails from queue`,
      count: result.count,
    });
  } catch (error) {
    adminEmailQueueLogger.error({ err: formatError(error) }, "Error clearing email queue:");
    return NextResponse.json(
      { error: "Failed to clear email queue" },
      { status: 500 }
    );
  }
}
