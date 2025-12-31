import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Unified Digital Library Item
 */
interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  fileSize: number;
  coverImageUrl: string | null;
  totalPages: number | null;
  source: "crowdfunding" | "marketplace";
  sourceId: string;
  sourceName: string;
  createdAt: string;
  mimeType: string | null;
}

/**
 * GET /api/backer/digital-library
 *
 * Returns a unified list of all digital items the user has access to:
 * - Digital files from backed crowdfunding projects
 * - Purchased marketplace books
 *
 * Supports filtering and sorting via query params
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source"); // 'crowdfunding' | 'marketplace' | null (all)
    const fileType = searchParams.get("fileType"); // 'pdf' | null (all)

    const libraryItems: LibraryItem[] = [];

    // Fetch crowdfunding digital files
    if (!source || source === "crowdfunding") {
      const digitalFiles = await prisma.digitalFile.findMany({
        where: {
          project: {
            pledges: {
              some: {
                userId: session.user.id,
                status: { in: ["ACTIVE", "PROCESSING", "COLLECTED"] },
              },
            },
          },
          ...(fileType === "pdf"
            ? {
                OR: [
                  { mimeType: "application/pdf" },
                  { fileName: { endsWith: ".pdf" } },
                ],
              }
            : {}),
        },
        include: {
          project: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      for (const file of digitalFiles) {
        libraryItems.push({
          id: `cf_${file.id}`,
          title: file.name,
          subtitle: file.project.title,
          fileSize: file.fileSize,
          coverImageUrl: file.coverImageUrl,
          totalPages: file.totalPages,
          source: "crowdfunding",
          sourceId: file.id,
          sourceName: file.project.title,
          createdAt: file.createdAt.toISOString(),
          mimeType: file.mimeType,
        });
      }
    }

    // Fetch marketplace purchases
    if (!source || source === "marketplace") {
      // Check if MarketplacePurchase table exists (will fail gracefully if not migrated yet)
      try {
        const marketplacePurchases = await prisma.marketplacePurchase.findMany({
          where: {
            buyerId: session.user.id,
            status: "COMPLETED",
          },
          include: {
            book: {
              select: {
                id: true,
                title: true,
                pdfFileUrl: true,
                pdfCoverImageUrl: true,
                pdfFileName: true,
                pdfFileSize: true,
                pdfTotalPages: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        for (const purchase of marketplacePurchases) {
          libraryItems.push({
            id: `mp_${purchase.id}`,
            title: purchase.book.title,
            subtitle: "Marketplace Purchase",
            fileSize: purchase.book.pdfFileSize || 0,
            coverImageUrl: purchase.book.pdfCoverImageUrl,
            totalPages: purchase.book.pdfTotalPages,
            source: "marketplace",
            sourceId: purchase.id,
            sourceName: purchase.book.title,
            createdAt: purchase.createdAt.toISOString(),
            mimeType: "application/pdf",
          });
        }
      } catch {
        // MarketplacePurchase table doesn't exist yet, skip
        console.log("MarketplacePurchase table not yet available");
      }
    }

    // Sort by createdAt descending (newest first)
    libraryItems.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Stats
    const stats = {
      totalItems: libraryItems.length,
      crowdfundingItems: libraryItems.filter((i) => i.source === "crowdfunding").length,
      marketplaceItems: libraryItems.filter((i) => i.source === "marketplace").length,
      pdfItems: libraryItems.filter(
        (i) => i.mimeType === "application/pdf" || i.title.toLowerCase().endsWith(".pdf")
      ).length,
    };

    return NextResponse.json({
      items: libraryItems,
      stats,
    });
  } catch (error) {
    console.error("Digital library fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
