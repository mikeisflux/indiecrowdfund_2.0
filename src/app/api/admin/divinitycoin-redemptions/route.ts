import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Check if user is admin
async function isAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

// GET - Fetch DivinityCoin transactions with pagination and filtering
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
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
      transactions: transactions.map((t) => ({
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
