import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminPayoutsLogger = logger.child({ module: "admin-payouts" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/audit";

// Define types locally since Prisma client may not have them yet
type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
type PayoutType = "CAMPAIGN" | "LATE_PLEDGE" | "PLEDGE_MANAGER";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true }
  });

  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Fetch all payouts with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);

    // Validate and sanitize pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const status = searchParams.get("status") as PayoutStatus | null;
    const type = searchParams.get("type") as PayoutType | null;
    const search = searchParams.get("search");

    // Whitelist allowed sort fields to prevent information disclosure
    const allowedSortFields = ["createdAt", "amount", "status", "type", "sentAt"];
    const requestedSortBy = searchParams.get("sortBy") || "createdAt";
    const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { project: { title: { contains: search, mode: "insensitive" } } },
        { project: { creator: { name: { contains: search, mode: "insensitive" } } } },
        { payoutId: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch payouts with related data
    const [payouts, total] = await Promise.all([
      db.payout.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
              goalAmount: true,
              currentAmount: true,
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      db.payout.count({ where }),
    ]);

    // Calculate summary stats
    const [
      totalPending,
      totalProcessing,
      totalCompleted,
      totalFailed,
      pendingAmount,
      completedAmount,
    ] = await Promise.all([
      db.payout.count({ where: { status: "PENDING" } }),
      db.payout.count({ where: { status: "PROCESSING" } }),
      db.payout.count({ where: { status: "COMPLETED" } }),
      db.payout.count({ where: { status: "FAILED" } }),
      db.payout.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
      }),
      db.payout.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: totalPending,
        processing: totalProcessing,
        completed: totalCompleted,
        failed: totalFailed,
        pendingAmount: Number(pendingAmount._sum.amount || 0),
        completedAmount: Number(completedAmount._sum.amount || 0),
      },
    });
  } catch (error) {
    adminPayoutsLogger.error({ err: formatError(error) }, "Error fetching payouts:");
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

// POST - Create a new payout (typically triggered when a project ends successfully)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { projectId, type = "CAMPAIGN" } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get the project with funding info
    const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        title: true,
        paymentProcessor: true,
        pledges: {
          where: { status: "COMPLETED", deletedAt: null },
          select: { amount: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Calculate amounts
    const grossAmount = project.pledges.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0);
    const pledgeCount = project.pledges.length;
    const payoutPlatformSettings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } });
    const platformFeeRate = payoutPlatformSettings?.platformFee ? Number(payoutPlatformSettings.platformFee) / 100 : 0.03;

    // Use processor-specific rates
    //   PayPal Advanced Checkout: 3.49% + $0.49/tx
    //   DivinityCoin: 3% + $0.30/tx
    //   Whop: ~3% (no per-transaction fee)
    //   Stripe (legacy): 2.9% + $0.30/tx
    const proc = project.paymentProcessor;
    const processorPercentRate =
      proc === "PAYPAL" ? 0.0349
      : proc === "DIVINITYCOIN" ? 0.03
      : proc === "WHOP" ? 0.03
      : 0.029; // Stripe / unknown legacy
    const processorFixedFee =
      proc === "PAYPAL" ? 0.49
      : proc === "DIVINITYCOIN" ? 0.30
      : proc === "WHOP" ? 0
      : 0.30;

    const platformFees = Math.round(grossAmount * platformFeeRate * 100) / 100;
    const processorFees = Math.round(((grossAmount * processorPercentRate) + (pledgeCount * processorFixedFee)) * 100) / 100;
    // Derive net as exact remainder so fees + net always equal gross (no accumulated rounding)
    const netAmount = Math.round((grossAmount - platformFees - processorFees) * 100) / 100;

    // Existence check + create guarded by a Postgres transaction-scoped
    // advisory lock keyed by projectId+type. Without this, two admins
    // hitting "Create Payout" at the same second would both pass the
    // findFirst check and both create duplicate Payout rows for the
    // same campaign — real money implications because each row would
    // independently be marked PROCESSING and the payment processor
    // would be called twice.
    let payout;
    try {
      payout = await db.$transaction(async (tx) => {
        // pg_advisory_xact_lock serializes concurrent transactions that
        // hash to the same bigint. Released automatically at tx commit/
        // rollback. Key space is 32-bit classid + 32-bit objid via
        // hashtext() — plenty of room for projectId×type combinations.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payout-${projectId}-${type}`}))`;

        const existingPayout = await tx.payout.findFirst({
          where: {
            projectId,
            type: type as PayoutType,
            status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
          },
        });

        if (existingPayout) {
          throw new Error("PAYOUT_ALREADY_EXISTS");
        }

        return tx.payout.create({
          data: {
            projectId,
            grossAmount,
            amount: netAmount,
            platformFees,
            processorFees,
            type: type as PayoutType,
            status: "PENDING",
          },
          include: {
            project: {
              select: {
                title: true,
                creator: {
                  select: { name: true, email: true },
                },
              },
            },
          },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "PAYOUT_ALREADY_EXISTS") {
        return NextResponse.json(
          { error: "Payout already exists for this project" },
          { status: 409 }
        );
      }
      throw err;
    }

    auditLog({
      action: "PAYOUT_CREATE",
      actorId: authResult.user.id,
      actorEmail: authResult.user.email || undefined,
      targetId: payout.id,
      targetType: "PAYOUT",
      details: { projectId: payout.projectId, amount: Number(payout.amount) },
    });

    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    adminPayoutsLogger.error({ err: formatError(error) }, "Error creating payout:");
    return NextResponse.json(
      { error: "Failed to create payout" },
      { status: 500 }
    );
  }
}

// PATCH - Update payout status (process, retry, mark as completed)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { payoutId, action, payoutProcessorId, bankAccountLast4 } = body;

    if (!payoutId || !action) {
      return NextResponse.json(
        { error: "Payout ID and action are required" },
        { status: 400 }
      );
    }

    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      include: {
        project: {
          select: {
            title: true,
            creator: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: "Payout not found" },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};
    // statusFilter enforces the expected current status atomically in updateMany
    let statusFilter: Record<string, unknown> | undefined;

    switch (action) {
      case "PROCESS":
        // Start processing the payout
        if (payout.status !== "PENDING" && payout.status !== "FAILED") {
          return NextResponse.json(
            { error: "Only pending or failed payouts can be processed" },
            { status: 400 }
          );
        }
        statusFilter = { status: { in: ["PENDING", "FAILED"] } };
        updateData = {
          status: "PROCESSING",
        };
        break;

      case "COMPLETE":
        // Mark payout as completed (typically after webhook confirmation)
        if (payout.status !== "PROCESSING") {
          return NextResponse.json(
            { error: "Only processing payouts can be marked as completed" },
            { status: 400 }
          );
        }
        statusFilter = { status: "PROCESSING" };
        updateData = {
          status: "COMPLETED",
          sentAt: new Date(),
          payoutId: payoutProcessorId || payout.payoutId,
          bankAccountLast4: bankAccountLast4 || payout.bankAccountLast4,
        };
        break;

      case "FAIL":
        // Mark payout as failed
        if (payout.status !== "PROCESSING") {
          return NextResponse.json(
            { error: "Only processing payouts can be marked as failed" },
            { status: 400 }
          );
        }
        statusFilter = { status: "PROCESSING" };
        updateData = {
          status: "FAILED",
        };
        break;

      case "RETRY":
        // Retry a failed payout
        if (payout.status !== "FAILED") {
          return NextResponse.json(
            { error: "Only failed payouts can be retried" },
            { status: 400 }
          );
        }
        statusFilter = { status: "FAILED" };
        updateData = {
          status: "PENDING",
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Atomic update: only proceed if status hasn't changed since we fetched it
    if (statusFilter) {
      const result = await db.payout.updateMany({
        where: { id: payoutId, ...statusFilter },
        data: updateData,
      });
      if (result.count === 0) {
        return NextResponse.json(
          { error: "Payout status has changed — please refresh and try again" },
          { status: 409 }
        );
      }
    }

    const updatedPayout = await db.payout.findUnique({
      where: { id: payoutId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            creator: { select: { name: true, email: true } },
          },
        },
      },
    });

    const payoutAuditMap: Record<string, Parameters<typeof auditLog>[0]["action"]> = {
      PROCESS: "PAYOUT_PROCESS",
      COMPLETE: "PAYOUT_COMPLETE",
      FAIL: "PAYOUT_FAIL",
      RETRY: "PAYOUT_RETRY",
    };
    if (payoutAuditMap[action]) {
      auditLog({
        action: payoutAuditMap[action],
        actorId: authResult.user.id,
        actorEmail: authResult.user.email || undefined,
        targetId: payoutId,
        targetType: "PAYOUT",
        details: { action, previousStatus: payout.status },
      });
    }

    return NextResponse.json(updatedPayout);
  } catch (error) {
    adminPayoutsLogger.error({ err: formatError(error) }, "Error updating payout:");
    return NextResponse.json(
      { error: "Failed to update payout" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a pending payout
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const payoutId = searchParams.get("id");

    if (!payoutId) {
      return NextResponse.json(
        { error: "Payout ID is required" },
        { status: 400 }
      );
    }

    const payout = await db.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      return NextResponse.json(
        { error: "Payout not found" },
        { status: 404 }
      );
    }

    if (payout.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending payouts can be cancelled" },
        { status: 400 }
      );
    }

    // CAS on status so two concurrent cancels (double-click, two admins)
    // can't both pass the read check above and both issue deletes — the
    // second would throw P2025. deleteMany returns { count: 0 } if the
    // payout transitioned between the read and the delete.
    const deleted = await db.payout.deleteMany({
      where: { id: payoutId, status: "PENDING" },
    });
    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Payout status has changed — please refresh and try again" },
        { status: 409 }
      );
    }

    auditLog({
      action: "PAYOUT_CANCEL",
      actorId: authResult.user.id,
      actorEmail: authResult.user.email || undefined,
      targetId: payoutId,
      targetType: "PAYOUT",
      details: { projectId: payout.projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminPayoutsLogger.error({ err: formatError(error) }, "Error deleting payout:");
    return NextResponse.json(
      { error: "Failed to delete payout" },
      { status: 500 }
    );
  }
}
