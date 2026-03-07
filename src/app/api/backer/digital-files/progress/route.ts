import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerDigitalFilesProgressLogger = logger.child({ module: "backer-digital-files-progress" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/backer/digital-files/progress
 *
 * Get reading progress for all user's digital files
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all user's pledges
    const pledges = await prisma.pledge.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["PENDING", "COMPLETED"] },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const pledgeIds = pledges.map((p) => p.id);

    // Get all distributions for user's pledges
    const distributions = await prisma.digitalDistribution.findMany({
      where: {
        pledgeId: { in: pledgeIds },
      },
      select: {
        digitalFileId: true,
        readingProgress: true,
        lastReadAt: true,
        readingStatus: true,
      },
    });

    // Build progress map
    const progressMap: Record<
      string,
      {
        currentPage: number;
        totalPages: number;
        lastRead: string | null;
        status: string;
      }
    > = {};

    for (const dist of distributions) {
      if (dist.readingProgress) {
        const progress = dist.readingProgress as {
          currentPage?: number;
          totalPages?: number;
        };
        progressMap[dist.digitalFileId] = {
          currentPage: progress.currentPage || 0,
          totalPages: progress.totalPages || 0,
          lastRead: dist.lastReadAt?.toISOString() || null,
          status: dist.readingStatus,
        };
      }
    }

    return NextResponse.json({ progress: progressMap });
  } catch (error) {
    backerDigitalFilesProgressLogger.error({ err: String(error) }, "Error fetching reading progress:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backer/digital-files/progress
 *
 * Save reading progress for a digital file
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileId, currentPage, totalPages, source } = body;

    if (!fileId || currentPage === undefined || totalPages === undefined) {
      return NextResponse.json(
        { error: "fileId, currentPage, and totalPages are required" },
        { status: 400 }
      );
    }

    // Determine reading status
    const percentRead = (currentPage / totalPages) * 100;
    let readingStatus: "UNREAD" | "IN_PROGRESS" | "COMPLETED" = "UNREAD";
    if (percentRead >= 95) {
      readingStatus = "COMPLETED";
    } else if (percentRead > 0) {
      readingStatus = "IN_PROGRESS";
    }

    if (source === "marketplace") {
      // Update marketplace purchase progress
      try {
        await prisma.marketplacePurchase.update({
          where: {
            id: fileId,
            buyerId: session.user.id,
          },
          data: {
            readingProgress: { currentPage, totalPages },
            lastReadAt: new Date(),
          },
        });
      } catch {
        // MarketplacePurchase table might not exist yet
        backerDigitalFilesProgressLogger.info("MarketplacePurchase update skipped - table may not exist");
      }
    } else {
      // Find the user's pledge for this file
      const distribution = await prisma.digitalDistribution.findFirst({
        where: {
          digitalFileId: fileId,
          pledge: {
            userId: session.user.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (!distribution) {
        return NextResponse.json(
          { error: "Distribution not found" },
          { status: 404 }
        );
      }

      // Update distribution with progress
      await prisma.digitalDistribution.update({
        where: { id: distribution.id },
        data: {
          readingProgress: { currentPage, totalPages },
          lastReadAt: new Date(),
          readingStatus,
        },
      });
    }

    return NextResponse.json({
      success: true,
      progress: {
        currentPage,
        totalPages,
        percentRead: Math.round(percentRead),
        status: readingStatus,
      },
    });
  } catch (error) {
    backerDigitalFilesProgressLogger.error({ err: String(error) }, "Error saving reading progress:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
