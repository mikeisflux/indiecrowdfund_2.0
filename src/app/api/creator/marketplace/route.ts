import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        ownerId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        logo: true,
        banner: true,
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
    const totalRevenue = books
      .filter((b) => b.status === "LIVE")
      .reduce((sum, b) => sum + Number(b.price) * b.purchaseCount, 0);

    const totalSales = books.reduce((sum, b) => sum + b.purchaseCount, 0);

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

    const monthlyRevenue = monthlyPurchases.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const monthlySales = monthlyPurchases.length;

    // Format books for response
    const formattedBooks = books.map((book) => ({
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
      const companyBooks = books.filter((b) => b.status === "LIVE");
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
            logo: company.logo,
            banner: company.banner,
            isVerified: company.isVerified,
            stats: companyStats,
          }
        : null,
      stats: {
        totalBooks: books.length,
        liveBooks: books.filter((b) => b.status === "LIVE").length,
        pendingBooks: books.filter((b) => b.status === "PENDING_REVIEW").length,
        totalRevenue,
        totalSales,
        monthlyRevenue,
        monthlySales,
      },
    });
  } catch (error) {
    console.error("Error fetching creator marketplace data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
