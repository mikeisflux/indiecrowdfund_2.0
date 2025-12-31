import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/marketplace/books
 *
 * Get all marketplace books for admin review
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all books
    const allBooks = await prisma.marketplaceBook.findMany({
      where: { deletedAt: null },
      orderBy: { submittedAt: "desc" },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Separate by status
    const pendingBooks = allBooks.filter((b) => b.status === "PENDING_REVIEW");
    const liveBooks = allBooks.filter((b) => b.status === "LIVE");

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayReviews = await prisma.marketplaceBookReview.findMany({
      where: {
        createdAt: { gte: today },
      },
      select: { action: true },
    });

    const approvedToday = todayReviews.filter((r) => r.action === "APPROVED").length;
    const rejectedToday = todayReviews.filter((r) => r.action === "REJECTED").length;

    // Total revenue and sales
    const purchases = await prisma.marketplacePurchase.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
      _count: true,
    });

    const formatBook = (book: typeof allBooks[0]) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      description: book.description,
      category: book.category,
      coverImage: book.coverImageUrl || book.pdfCoverImageUrl,
      promoVideoUrl: book.promoVideoUrl,
      pdfFileUrl: book.pdfFileUrl,
      price: Number(book.price),
      currency: book.currency,
      paymentProcessor: book.paymentProcessor,
      isNsfw: book.isNsfw,
      status: book.status,
      isFeatured: book.isFeatured,
      isStaffPick: book.isStaffPick,
      submittedAt: book.submittedAt?.toISOString() || null,
      createdAt: book.createdAt.toISOString(),
      creator: {
        id: book.creator.id,
        name: book.creator.name || "Unknown",
        email: book.creator.email || "",
        avatar: book.creator.image,
      },
      company: book.company
        ? {
            id: book.company.id,
            name: book.company.name,
            slug: book.company.slug,
          }
        : null,
    });

    return NextResponse.json({
      pendingBooks: pendingBooks.map(formatBook),
      liveBooks: liveBooks.map(formatBook),
      allBooks: allBooks.map(formatBook),
      stats: {
        pending: pendingBooks.length,
        live: liveBooks.length,
        approvedToday,
        rejectedToday,
        totalRevenue: Number(purchases._sum.amount || 0),
        totalSales: purchases._count,
      },
    });
  } catch (error) {
    console.error("Error fetching admin marketplace books:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
