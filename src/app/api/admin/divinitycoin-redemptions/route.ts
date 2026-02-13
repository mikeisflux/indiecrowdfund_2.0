import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Check if user is admin, returns session user id if authorized
async function getAdminUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
    return session.user.id;
  }
  return null;
}

const VALID_TYPES = ["PAYMENT", "REDEMPTION", "REFUND", "REFUND_DEDUCTION"];

// GET - Fetch DivinityCoin transactions with pagination and filtering
export async function GET(req: NextRequest) {
  try {
    if (!(await getAdminUserId())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skip = (page - 1) * limit;

    // Filters
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type");

    // Build where clause for transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (type && type !== "all") {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { description: { contains: search, mode: "insensitive" } },
        { id: { contains: search } },
      ];
    }

    // Fetch transactions with user info
    const [transactions, totalCount, stats] = await Promise.all([
      db.divinityCoinTransaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          pledge: {
            select: {
              id: true,
              amount: true,
              status: true,
              project: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.divinityCoinTransaction.count({ where }),
      // Get aggregate stats
      db.divinityCoinTransaction.groupBy({
        by: ["type"],
        _count: { id: true },
        _sum: { amount: true },
      }),
    ]);

    // Calculate stats
    const statsSummary = {
      totalTransactions: totalCount,
      payments: { count: 0, total: 0 },
      redemptions: { count: 0, total: 0 },
      refunds: { count: 0, total: 0 },
      refundDeductions: { count: 0, total: 0 },
    };

    for (const stat of stats) {
      const count = stat._count.id;
      const total = Math.abs(Number(stat._sum.amount || 0));
      switch (stat.type) {
        case "PAYMENT":
          statsSummary.payments = { count, total };
          break;
        case "REDEMPTION":
          statsSummary.redemptions = { count, total };
          break;
        case "REFUND":
          statsSummary.refunds = { count, total };
          break;
        case "REFUND_DEDUCTION":
          statsSummary.refundDeductions = { count, total };
          break;
      }
    }

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions: transactions.map((t: any) => ({
        id: t.id,
        userId: t.userId,
        pledgeId: t.pledgeId,
        amount: Number(t.amount),
        type: t.type,
        description: t.description,
        metadata: t.metadata ? JSON.parse(t.metadata) : null,
        createdAt: t.createdAt.toISOString(),
        user: t.user,
        pledge: t.pledge
          ? {
              id: t.pledge.id,
              amount: Number(t.pledge.amount),
              status: t.pledge.status,
              project: t.pledge.project,
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: statsSummary,
    });
  } catch (error) {
    console.error("Error fetching DivinityCoin transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// POST - Create a new DivinityCoin transaction
export async function POST(req: NextRequest) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, amount, type, description } = body;

    if (!userId || amount === undefined || amount === null || !type) {
      return NextResponse.json(
        { error: "userId, amount, and type are required" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const transaction = await db.divinityCoinTransaction.create({
      data: {
        userId,
        amount: parsedAmount,
        type,
        description: description || null,
        metadata: JSON.stringify({
          createdBy: adminId,
          source: "admin_manual",
          createdAt: new Date().toISOString(),
        }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({
      id: transaction.id,
      userId: transaction.userId,
      pledgeId: transaction.pledgeId,
      amount: Number(transaction.amount),
      type: transaction.type,
      description: transaction.description,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : null,
      createdAt: transaction.createdAt.toISOString(),
      user: transaction.user,
      pledge: null,
    });
  } catch (error) {
    console.error("Error creating DivinityCoin transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

// PATCH - Update an existing DivinityCoin transaction
export async function PATCH(req: NextRequest) {
  try {
    const adminId = await getAdminUserId();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, amount, type, description } = body;

    if (!id) {
      return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
    }

    // Verify transaction exists
    const existing = await db.divinityCoinTransaction.findUnique({
      where: { id },
      select: { id: true, metadata: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (amount !== undefined && amount !== null) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      updateData.amount = parsedAmount;
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.type = type;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    // Append edit info to metadata
    let existingMeta = {};
    try {
      existingMeta = existing.metadata ? JSON.parse(existing.metadata) : {};
    } catch {
      // ignore parse error
    }

    updateData.metadata = JSON.stringify({
      ...existingMeta,
      lastEditedBy: adminId,
      lastEditedAt: new Date().toISOString(),
    });

    const transaction = await db.divinityCoinTransaction.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        pledge: {
          select: {
            id: true,
            amount: true,
            status: true,
            project: {
              select: { id: true, title: true, slug: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      id: transaction.id,
      userId: transaction.userId,
      pledgeId: transaction.pledgeId,
      amount: Number(transaction.amount),
      type: transaction.type,
      description: transaction.description,
      metadata: transaction.metadata ? JSON.parse(transaction.metadata) : null,
      createdAt: transaction.createdAt.toISOString(),
      user: transaction.user,
      pledge: transaction.pledge
        ? {
            id: transaction.pledge.id,
            amount: Number(transaction.pledge.amount),
            status: transaction.pledge.status,
            project: transaction.pledge.project,
          }
        : null,
    });
  } catch (error) {
    console.error("Error updating DivinityCoin transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a DivinityCoin transaction
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminUserId())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Transaction id is required" }, { status: 400 });
    }

    // Verify it exists
    const existing = await db.divinityCoinTransaction.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await db.divinityCoinTransaction.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting DivinityCoin transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
