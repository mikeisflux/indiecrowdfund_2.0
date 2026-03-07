import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerDigitalLibraryLogger = logger.child({ module: "backer-digital-library" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

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
      // First, get user's pledges with their rewardIds
      const userPledges = await prisma.pledge.findMany({
        where: {
          userId: session.user.id,
          status: { in: ["PENDING", "COMPLETED"] },
          deletedAt: null,
        },
        select: {
          id: true,
          projectId: true,
          rewardId: true,
        },
      });

      // Create maps for quick lookup
      const pledgesByProject = new Map<string, string | null>();
      for (const pledge of userPledges) {
        pledgesByProject.set(pledge.projectId, pledge.rewardId);
      }

      const projectIds = userPledges.map(p => p.projectId);
      const pledgeIds = userPledges.map(p => p.id);

      // Fetch all digital files from projects user has backed
      const digitalFiles = await prisma.digitalFile.findMany({
        where: {
          projectId: { in: projectIds },
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

      // Get all explicit distributions for this backer's pledges
      const explicitDistributions = await prisma.digitalDistribution.findMany({
        where: {
          pledgeId: { in: pledgeIds },
          distributedAt: { not: null },
        },
        select: {
          digitalFileId: true,
        },
      });
      const explicitlyDistributedFileIds = new Set(
        explicitDistributions.map((d: { digitalFileId: string }) => d.digitalFileId)
      );

      // Filter files based on explicit distribution OR rewardIds restriction
      for (const file of digitalFiles) {
        // If the file was explicitly distributed to this backer, show it
        const wasDistributed = explicitlyDistributedFileIds.has(file.id);

        const userRewardId = pledgesByProject.get(file.projectId);
        const fileRewardIds = (file.rewardIds as string[]) || [];

        // Show file if:
        // 1. It was explicitly distributed to this backer, OR
        // 2. rewardIds is empty (available to all backers), OR
        // 3. User's rewardId is in the file's rewardIds array
        const hasAccess = wasDistributed ||
          fileRewardIds.length === 0 ||
          (userRewardId && fileRewardIds.includes(userRewardId));

        if (hasAccess) {
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
                coverImageUrl: true,
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

        backerDigitalLibraryLogger.info({ data: marketplacePurchases.length }, "[Digital Library] Found marketplace purchases:");
        for (const purchase of marketplacePurchases) {
          backerDigitalLibraryLogger.info({ data: {
            purchaseId: purchase.id,
            bookTitle: purchase.book.title,
            hasPdfUrl: !!purchase.book.pdfFileUrl,
          } }, "[Digital Library] Adding marketplace item:");
          libraryItems.push({
            id: `mp_${purchase.id}`,
            title: purchase.book.title,
            subtitle: "Marketplace Purchase",
            fileSize: purchase.book.pdfFileSize || 0,
            coverImageUrl: purchase.book.pdfCoverImageUrl || purchase.book.coverImageUrl,
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
        backerDigitalLibraryLogger.info("MarketplacePurchase table not yet available");
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
    backerDigitalLibraryLogger.error({ err: String(error) }, "Digital library fetch error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
