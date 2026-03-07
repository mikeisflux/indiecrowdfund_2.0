import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorMarketplaceLogger = logger.child({ module: "creator-marketplace" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/marketplace
 *
 * Get creator's marketplace dashboard data
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get creator's company profile
    const company = await prisma.companyProfile.findFirst({
      where: {
        userId: userId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        logoUrl: true,
        bannerImageUrl: true,
        isVerified: true,
        totalSales: true,
      },
    });

    // Get creator's books
    const books = await prisma.marketplaceBook.findMany({
      where: {
        creatorId: userId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImageUrl: true,
        pdfCoverImageUrl: true,
        price: true,
        currency: true,
        status: true,
        isFeatured: true,
        isStaffPick: true,
        purchaseCount: true,
        viewCount: true,
        createdAt: true,
        publishedAt: true,
        rejectionReason: true,
      },
    });

    // Calculate stats
    type BookType = (typeof books)[number];
    const totalRevenue = books
      .filter((b: BookType) => b.status === "LIVE")
      .reduce((sum: number, b: BookType) => sum + Number(b.price) * b.purchaseCount, 0);

    const totalSales = books.reduce((sum: number, b: BookType) => sum + b.purchaseCount, 0);

    // Get monthly stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyPurchases = await prisma.marketplacePurchase.findMany({
      where: {
        book: {
          creatorId: userId,
        },
        status: "COMPLETED",
        completedAt: { gte: thirtyDaysAgo },
      },
      select: {
        amount: true,
      },
    });

    type PurchaseType = (typeof monthlyPurchases)[number];
    const monthlyRevenue = monthlyPurchases.reduce(
      (sum: number, p: PurchaseType) => sum + Number(p.amount),
      0
    );
    const monthlySales = monthlyPurchases.length;

    // Format books for response
    const formattedBooks = books.map((book: BookType) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
      price: Number(book.price),
      currency: book.currency,
      status: book.status,
      isFeatured: book.isFeatured,
      isStaffPick: book.isStaffPick,
      stats: {
        purchases: book.purchaseCount,
        views: book.viewCount,
        revenue: Number(book.price) * book.purchaseCount,
      },
      createdAt: book.createdAt.toISOString(),
      publishedAt: book.publishedAt?.toISOString() || null,
      rejectionReason: book.rejectionReason,
    }));

    // Company stats
    let companyStats = null;
    if (company) {
      const companyBooks = books.filter((b: BookType) => b.status === "LIVE");
      companyStats = {
        books: companyBooks.length,
        totalSales: company.totalSales,
        totalRevenue,
      };
    }

    return NextResponse.json({
      books: formattedBooks,
      company: company
        ? {
            id: company.id,
            name: company.name,
            slug: company.slug,
            tagline: company.tagline,
            logo: company.logoUrl,
            banner: company.bannerImageUrl,
            isVerified: company.isVerified,
            stats: companyStats,
          }
        : null,
      stats: {
        totalBooks: books.length,
        liveBooks: books.filter((b: BookType) => b.status === "LIVE").length,
        pendingBooks: books.filter((b: BookType) => b.status === "PENDING_REVIEW").length,
        totalRevenue,
        totalSales,
        monthlyRevenue,
        monthlySales,
      },
    });
  } catch (error) {
    creatorMarketplaceLogger.error({ err: String(error) }, "Error fetching creator marketplace data:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
