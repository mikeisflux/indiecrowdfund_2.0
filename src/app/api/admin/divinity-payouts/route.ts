import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminDivinityPayoutsLogger = logger.child({ module: "admin-divinity-payouts" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth-helpers";

// GET - Fetch DivinityCoin settlements with pagination and filtering
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { divinitySettlementId: { contains: search, mode: "insensitive" } },
        { bankAccount: { user: { name: { contains: search, mode: "insensitive" } } } },
        { bankAccount: { user: { email: { contains: search, mode: "insensitive" } } } },
      ];
    }

    // Fetch settlements with pagination
    const [settlements, total] = await Promise.all([
      db.divinityCoinSettlement.findMany({
        where,
        include: {
          bankAccount: {
            select: {
              id: true,
              bankNameDisplay: true,
              accountLastFour: true,
              accountType: true,
              isVerified: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              slug: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.divinityCoinSettlement.count({ where }),
    ]);

    // Get stats
    const stats = await db.divinityCoinSettlement.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true },
    });

    const statsMap: Record<string, { count: number; amount: number }> = {};
    stats.forEach((s: { status: string; _count: number; _sum: { amount: number | null } }) => {
      statsMap[s.status] = {
        count: s._count,
        amount: Number(s._sum.amount || 0),
      };
    });

    return NextResponse.json({
      settlements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: statsMap.PENDING?.count || 0,
        initiated: statsMap.INITIATED?.count || 0,
        processing: statsMap.PROCESSING?.count || 0,
        completed: statsMap.COMPLETED?.count || 0,
        failed: statsMap.FAILED?.count || 0,
        pendingAmount: statsMap.PENDING?.amount || 0,
        completedAmount: statsMap.COMPLETED?.amount || 0,
      },
    });
  } catch (error) {
    adminDivinityPayoutsLogger.error({ err: String(error) }, "Error fetching settlements:");
    return NextResponse.json(
      { error: "Failed to fetch settlements" },
      { status: 500 }
    );
  }
}

// POST - Create a new settlement
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await auth();
    const body = await req.json();
    const { bankAccountId, amount, projectId, adminNotes } = body;

    if (!bankAccountId || !amount) {
      return NextResponse.json(
        { error: "Bank account ID and amount are required" },
        { status: 400 }
      );
    }

    // Verify bank account exists
    const bankAccount = await db.divinityCoinBankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: "Bank account not found" },
        { status: 404 }
      );
    }

    // Get project name if projectId provided
    let projectName = null;
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId, deletedAt: null },
        select: { title: true },
      });
      projectName = project?.title || null;
    }

    const settlement = await db.divinityCoinSettlement.create({
      data: {
        bankAccountId,
        amount: parseFloat(amount),
        projectId: projectId || null,
        projectName,
        adminNotes: adminNotes || null,
        processedBy: session?.user?.id,
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    adminDivinityPayoutsLogger.error({ err: String(error) }, "Error creating settlement:");
    return NextResponse.json(
      { error: "Failed to create settlement" },
      { status: 500 }
    );
  }
}

// PATCH - Update settlement status or details
export async function PATCH(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await auth();
    const body = await req.json();
    const { settlementId, action, notes } = body;

    if (!settlementId || !action) {
      return NextResponse.json(
        { error: "Settlement ID and action are required" },
        { status: 400 }
      );
    }

    const settlement = await db.divinityCoinSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "INITIATE":
        if (settlement.status !== "PENDING") {
          return NextResponse.json(
            { error: "Can only initiate pending settlements" },
            { status: 400 }
          );
        }
        updateData = {
          status: "INITIATED",
          initiatedAt: new Date(),
          processedBy: session?.user?.id,
        };
        break;

      case "MARK_PROCESSING":
        if (settlement.status !== "INITIATED") {
          return NextResponse.json(
            { error: "Can only mark initiated settlements as processing" },
            { status: 400 }
          );
        }
        updateData = {
          status: "PROCESSING",
          processedAt: new Date(),
        };
        break;

      case "MARK_COMPLETED":
        if (!["INITIATED", "PROCESSING"].includes(settlement.status)) {
          return NextResponse.json(
            { error: "Can only complete initiated or processing settlements" },
            { status: 400 }
          );
        }
        updateData = {
          status: "COMPLETED",
          completedAt: new Date(),
        };
        break;

      case "MARK_FAILED":
        updateData = {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: notes || "Manual failure",
        };
        break;

      case "RETRY":
        if (settlement.status !== "FAILED") {
          return NextResponse.json(
            { error: "Can only retry failed settlements" },
            { status: 400 }
          );
        }
        updateData = {
          status: "PENDING",
          failedAt: null,
          failureReason: null,
          initiatedAt: null,
          processedAt: null,
          completedAt: null,
        };
        break;

      case "CANCEL":
        if (!["PENDING", "INITIATED"].includes(settlement.status)) {
          return NextResponse.json(
            { error: "Can only cancel pending or initiated settlements" },
            { status: 400 }
          );
        }
        updateData = {
          status: "CANCELLED",
          adminNotes: notes
            ? `${settlement.adminNotes || ""}\n[Cancelled]: ${notes}`
            : settlement.adminNotes,
        };
        break;

      case "UPDATE":
        if (settlement.status !== "PENDING") {
          return NextResponse.json(
            { error: "Can only edit pending settlements" },
            { status: 400 }
          );
        }
        if (notes) {
          const parsed = JSON.parse(notes);
          updateData = {
            amount: parsed.amount || settlement.amount,
            adminNotes: parsed.adminNotes ?? settlement.adminNotes,
          };
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    const updated = await db.divinityCoinSettlement.update({
      where: { id: settlementId },
      data: updateData,
    });

    return NextResponse.json({ success: true, settlement: updated });
  } catch (error) {
    adminDivinityPayoutsLogger.error({ err: String(error) }, "Error updating settlement:");
    return NextResponse.json(
      { error: "Failed to update settlement" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a pending settlement
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Settlement ID is required" },
        { status: 400 }
      );
    }

    const settlement = await db.divinityCoinSettlement.findUnique({
      where: { id },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    if (settlement.status !== "PENDING") {
      return NextResponse.json(
        { error: "Can only delete pending settlements" },
        { status: 400 }
      );
    }

    await db.divinityCoinSettlement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    adminDivinityPayoutsLogger.error({ err: String(error) }, "Error deleting settlement:");
    return NextResponse.json(
      { error: "Failed to delete settlement" },
      { status: 500 }
    );
  }
}
