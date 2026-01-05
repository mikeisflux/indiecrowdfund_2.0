import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Type for book returned from the Prisma query
interface PdfBookRecord {
  id: string;
  title: string;
  slug: string;
  status: string;
  pdfFileUrl: string | null;
  pdfFileName: string | null;
  pdfFileSize: number | null;
  pdfCoverImageUrl: string | null;
  pdfTotalPages: number | null;
  coverImageUrl: string | null;
  price: Decimal;
  purchaseCount: number;
  createdAt: Date;
  publishedAt: Date | null;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  _count: {
    purchases: number;
  };
}

/**
 * GET /api/admin/marketplace/pdf-management
 *
 * Get all marketplace books with their PDF status for admin diagnostics
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // all, missing-pdf, has-pdf
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      deletedAt: null,
    };

    if (filter === "missing-pdf") {
      where.OR = [
        { pdfFileUrl: null },
        { pdfFileUrl: "" },
        { pdfFileSize: null },
        { pdfFileSize: 0 },
      ];
    } else if (filter === "has-pdf") {
      where.pdfFileUrl = { not: null };
      where.NOT = { pdfFileUrl: "" };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { id: { contains: search } },
          ],
        },
      ];
    }

    // Get total count
    const total = await prisma.marketplaceBook.count({ where });

    // Get books with PDF info
    const books = await prisma.marketplaceBook.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        pdfFileUrl: true,
        pdfFileName: true,
        pdfFileSize: true,
        pdfCoverImageUrl: true,
        pdfTotalPages: true,
        coverImageUrl: true,
        price: true,
        purchaseCount: true,
        createdAt: true,
        publishedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            purchases: {
              where: { status: "COMPLETED" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Check R2 file existence for books with PDF URLs (optional, can be slow)
    const checkR2 = searchParams.get("checkR2") === "true";
    let r2Status: Record<string, boolean | null> = {};

    if (checkR2) {
      try {
        const r2 = await getR2Storage();
        if (r2) {
          const checks = await Promise.all(
            (books as PdfBookRecord[])
              .filter((b: PdfBookRecord) => b.pdfFileUrl)
              .map(async (book: PdfBookRecord) => {
                const match = book.pdfFileUrl?.match(/\/api\/r2\/serve\/(.+)$/);
                if (match) {
                  const exists = await r2.fileExists(match[1]);
                  return { id: book.id, exists };
                }
                return { id: book.id, exists: null }; // Non-R2 URL
              })
          );
          r2Status = Object.fromEntries(checks.map((c) => [c.id, c.exists]));
        }
      } catch (err) {
        console.error("Error checking R2 files:", err);
      }
    }

    // Transform for response
    const transformedBooks = (books as PdfBookRecord[]).map((book: PdfBookRecord) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      status: book.status,
      pdf: {
        url: book.pdfFileUrl,
        fileName: book.pdfFileName,
        fileSize: book.pdfFileSize,
        fileSizeFormatted: book.pdfFileSize
          ? formatFileSize(book.pdfFileSize)
          : null,
        coverUrl: book.pdfCoverImageUrl,
        totalPages: book.pdfTotalPages,
        hasUrl: !!book.pdfFileUrl,
        hasSize: !!book.pdfFileSize && book.pdfFileSize > 0,
        r2Exists: checkR2 ? r2Status[book.id] : undefined,
      },
      coverImageUrl: book.coverImageUrl,
      price: Number(book.price),
      purchaseCount: book._count.purchases,
      createdAt: book.createdAt.toISOString(),
      publishedAt: book.publishedAt?.toISOString() || null,
      creator: {
        id: book.creator.id,
        name: book.creator.name,
        email: book.creator.email,
      },
      issues: detectIssues(book),
    }));

    // Get summary stats
    const stats = {
      total,
      withPdf: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          pdfFileUrl: { not: null },
          NOT: { pdfFileUrl: "" },
        },
      }),
      missingPdf: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          OR: [{ pdfFileUrl: null }, { pdfFileUrl: "" }],
        },
      }),
      missingSize: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          pdfFileUrl: { not: null },
          NOT: { pdfFileUrl: "" },
          OR: [{ pdfFileSize: null }, { pdfFileSize: 0 }],
        },
      }),
      liveWithIssues: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          status: "LIVE",
          OR: [
            { pdfFileUrl: null },
            { pdfFileUrl: "" },
            { pdfFileSize: null },
            { pdfFileSize: 0 },
          ],
        },
      }),
    };

    return NextResponse.json({
      books: transformedBooks,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching PDF management data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Detect issues with a book's PDF configuration
 */
function detectIssues(book: {
  status: string;
  pdfFileUrl: string | null;
  pdfFileSize: number | null;
  pdfFileName: string | null;
}): string[] {
  const issues: string[] = [];

  if (!book.pdfFileUrl) {
    issues.push("Missing PDF URL");
  }

  if (!book.pdfFileSize || book.pdfFileSize === 0) {
    issues.push("Missing file size");
  }

  if (!book.pdfFileName) {
    issues.push("Missing file name");
  }

  if (book.status === "LIVE" && !book.pdfFileUrl) {
    issues.push("LIVE book without PDF!");
  }

  return issues;
}

/**
 * Format file size to human readable
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
