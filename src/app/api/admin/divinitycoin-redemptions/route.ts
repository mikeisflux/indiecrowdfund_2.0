import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/divinitycoin-redemptions - Get all redemption history
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
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    // Build filter for transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (type !== "all") {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get transactions with pagination
    const [transactions, totalCount] = await Promise.all([
      db.divinityCoinTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              divinityCoinBalance: true,
            },
          },
          pledge: {
            select: {
              id: true,
              amount: true,
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),
      db.divinityCoinTransaction.count({ where }),
    ]);

    // Get aggregate stats
    const [
      totalRedemptions,
      totalPayments,
      totalRefunds,
      redemptionSum,
      paymentSum,
      refundSum,
      uniqueUsers,
    ] = await Promise.all([
      db.divinityCoinTransaction.count({ where: { type: "REDEMPTION" } }),
      db.divinityCoinTransaction.count({ where: { type: "PAYMENT" } }),
      db.divinityCoinTransaction.count({ where: { type: "REFUND" } }),
      db.divinityCoinTransaction.aggregate({
        where: { type: "REDEMPTION" },
        _sum: { amount: true },
      }),
      db.divinityCoinTransaction.aggregate({
        where: { type: "PAYMENT" },
        _sum: { amount: true },
      }),
      db.divinityCoinTransaction.aggregate({
        where: { type: "REFUND" },
        _sum: { amount: true },
      }),
      db.divinityCoinTransaction.findMany({
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    return NextResponse.json({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transactions: transactions.map((t: any) => ({
        id: t.id,
        userId: t.userId,
        userName: t.user.name,
        userEmail: t.user.email,
        userImage: t.user.image,
        userBalance: Number(t.user.divinityCoinBalance),
        amount: Number(t.amount),
        type: t.type,
        description: t.description,
        metadata: t.metadata ? JSON.parse(t.metadata) : null,
        pledgeId: t.pledgeId,
        pledgeAmount: t.pledge ? Number(t.pledge.amount) : null,
        projectTitle: t.pledge?.project?.title || null,
        createdAt: t.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalRedemptions,
        totalPayments,
        totalRefunds,
        redemptionTotal: Number(redemptionSum._sum.amount || 0),
        paymentTotal: Math.abs(Number(paymentSum._sum.amount || 0)),
        refundTotal: Number(refundSum._sum.amount || 0),
        uniqueUsers: uniqueUsers.length,
      },
    });
  } catch (error) {
    console.error("Error fetching DivinityCoin redemption history:", error);
    return NextResponse.json(
      { error: "Failed to fetch redemption history" },
      { status: 500 }
    );
  }
}
