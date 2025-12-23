import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
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
        pendingAmount: pendingAmount._sum.amount || 0,
        completedAmount: completedAmount._sum.amount || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
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
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        pledges: {
          where: { status: "COMPLETED" },
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

    // Check if payout already exists for this project
    const existingPayout = await db.payout.findFirst({
      where: {
        projectId,
        type: type as PayoutType,
        status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
      },
    });

    if (existingPayout) {
      return NextResponse.json(
        { error: "Payout already exists for this project" },
        { status: 400 }
      );
    }

    // Calculate amounts
    const grossAmount = project.pledges.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
    const platformFeeRate = 0.03; // 3% platform fee
    const processorFeeRate = 0.029 + 0.30; // 2.9% + $0.30 per transaction (Stripe standard)

    const platformFees = grossAmount * platformFeeRate;
    const processorFees = grossAmount * processorFeeRate;
    const netAmount = grossAmount - platformFees - processorFees;

    // Create the payout record
    const payout = await db.payout.create({
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

    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    console.error("Error creating payout:", error);
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

    switch (action) {
      case "PROCESS":
        // Start processing the payout
        if (payout.status !== "PENDING" && payout.status !== "FAILED") {
          return NextResponse.json(
            { error: "Only pending or failed payouts can be processed" },
            { status: 400 }
          );
        }
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

    const updatedPayout = await db.payout.update({
      where: { id: payoutId },
      data: updateData,
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

    return NextResponse.json(updatedPayout);
  } catch (error) {
    console.error("Error updating payout:", error);
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

    await db.payout.delete({
      where: { id: payoutId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payout:", error);
    return NextResponse.json(
      { error: "Failed to delete payout" },
      { status: 500 }
    );
  }
}
