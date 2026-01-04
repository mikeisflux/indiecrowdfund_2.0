import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketplace/transactions
 *
 * Get all marketplace transactions for admin view
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { book: { title: { contains: search, mode: "insensitive" } } },
        { buyer: { name: { contains: search, mode: "insensitive" } } },
        { buyer: { email: { contains: search, mode: "insensitive" } } },
        { transactionId: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count
    const totalCount = await db.marketplacePurchase.count({ where });

    // Get transactions with pagination
    const transactions = await db.marketplacePurchase.findMany({
      where,
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImageUrl: true,
            pdfCoverImageUrl: true,
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate stats
    const stats = await db.marketplacePurchase.aggregate({
      _sum: {
        amount: true,
        platformFee: true,
        creatorPayout: true,
      },
      _count: true,
      where: { status: "COMPLETED" },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayStats = await db.marketplacePurchase.aggregate({
      _sum: {
        amount: true,
        platformFee: true,
      },
      _count: true,
      where: {
        status: "COMPLETED",
        completedAt: { gte: todayStart },
      },
    });

    // Format transactions
    const formattedTransactions = transactions.map((tx: typeof transactions[number]) => ({
      id: tx.id,
      book: {
        id: tx.book.id,
        title: tx.book.title,
        slug: tx.book.slug,
        coverImage: tx.book.pdfCoverImageUrl || tx.book.coverImageUrl,
        creator: tx.book.creator,
      },
      buyer: {
        id: tx.buyer.id,
        name: tx.buyer.name,
        email: tx.buyer.email,
        avatar: tx.buyer.image,
      },
      amount: Number(tx.amount),
      platformFee: Number(tx.platformFee),
      creatorPayout: Number(tx.creatorPayout),
      currency: tx.currency,
      paymentProcessor: tx.paymentProcessor,
      transactionId: tx.transactionId,
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
      completedAt: tx.completedAt?.toISOString() || null,
      refundedAt: tx.refundedAt?.toISOString() || null,
      refundReason: tx.refundReason,
    }));

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalRevenue: Number(stats._sum.amount || 0),
        totalPlatformFees: Number(stats._sum.platformFee || 0),
        totalCreatorPayouts: Number(stats._sum.creatorPayout || 0),
        totalTransactions: stats._count,
        todayRevenue: Number(todayStats._sum.amount || 0),
        todayPlatformFees: Number(todayStats._sum.platformFee || 0),
        todayTransactions: todayStats._count,
      },
    });
  } catch (error) {
    console.error("Error fetching marketplace transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
