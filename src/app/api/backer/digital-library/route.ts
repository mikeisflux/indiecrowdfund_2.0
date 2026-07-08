import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
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
      // Get user's pledges with their rewardIds AND addon IDs
      const userPledges = await prisma.pledge.findMany({
        where: {
          userId: session.user.id,
          status: "COMPLETED",
          deletedAt: null,
        },
        select: {
          id: true,
          projectId: true,
          rewardId: true,
          addons: {
            select: { addonId: true },
          },
        },
      });

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

      // Filter files using accessType — same logic as the stream/download routes
      for (const file of digitalFiles) {
        // Explicitly distributed to this backer always grants access
        if (explicitlyDistributedFileIds.has(file.id)) {
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
          continue;
        }

        // Find this user's pledge for the project
        const pledge = userPledges.find(p => p.projectId === file.projectId);
        if (!pledge) continue;

        const fileRewardIds = (file.rewardIds as string[]) || [];
        const fileAddonIds = (file.addonIds as string[]) || [];
        const userAddonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);

        let hasAccess = false;
        if (file.accessType === "ALL_BACKERS") {
          hasAccess = true;
        } else if (fileRewardIds.length === 0 && fileAddonIds.length === 0) {
          // No specific IDs configured — grant access to any backer of this project
          hasAccess = true;
        } else {
          // Union check: backer qualifies if they match ANY configured reward OR addon.
          // This correctly handles files with multiple distribution rules (e.g. both a
          // main-reward rule and an addon rule) where the last rule may have overwritten
          // the accessType but both rewardIds and addonIds arrays remain accurate.
          const rewardMatch = fileRewardIds.length > 0 && !!pledge.rewardId && fileRewardIds.includes(pledge.rewardId);
          const addonMatch = fileAddonIds.length > 0 && userAddonIds.some((id: string) => fileAddonIds.includes(id));
          hasAccess = rewardMatch || addonMatch;
        }

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
    backerDigitalLibraryLogger.error({ err: formatError(error) }, "Digital library fetch error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
