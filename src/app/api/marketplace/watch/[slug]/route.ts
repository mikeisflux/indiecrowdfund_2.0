import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const watchLogger = logger.child({ module: "marketplace-watch" });
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/watch/[slug]
 *
 * Public video streaming endpoint — generates a presigned R2 URL.
 * Free to stream; downloading the full file requires purchase.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const item = await prisma.marketplaceBook.findFirst({
      where: {
        slug,
        mediaCategory: "movies",
        status: "LIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        videoFileUrl: true,
        videoStreamUrl: true,
        creatorId: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Paid-content gate. Same pattern as /api/marketplace/stream:
    // the endpoint used to fall back from videoStreamUrl (preview) to
    // videoFileUrl (paid) when no preview was uploaded, giving away
    // the paid master to anyone with the slug. Now: serve preview to
    // the public, full file only to authenticated buyers / the creator.
    const session = await auth();
    let isBuyer = false;
    let isCreator = false;
    if (session?.user?.id) {
      if (item.creatorId === session.user.id) {
        isCreator = true;
      } else {
        const purchase = await prisma.marketplacePurchase.findFirst({
          where: {
            buyerId: session.user.id,
            bookId: item.id,
            status: "COMPLETED",
          },
          select: { id: true },
        });
        if (purchase) isBuyer = true;
      }
    }

    let fileUrl: string | null = null;
    if (item.videoStreamUrl) {
      fileUrl = item.videoStreamUrl;
    } else if (isBuyer || isCreator) {
      fileUrl = item.videoFileUrl;
    }
    if (!fileUrl) {
      return NextResponse.json(
        { error: "No preview available for this video. Purchase to watch." },
        { status: 404 }
      );
    }

    // Increment view count (non-blocking)
    prisma.marketplaceBook
      .update({
        where: { id: item.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    // If the URL is an R2 serve path, generate a presigned URL
    const r2ServeMatch = fileUrl.match(/\/api\/r2\/serve\/(.+)$/);
    if (r2ServeMatch) {
      const storageKey = decodeURIComponent(r2ServeMatch[1]);
      const r2 = await getR2Storage();
      if (r2) {
        const presignedUrl = await r2.getDownloadUrl(storageKey, {
          expiresIn: 7200, // 2 hours for longer video content
        });
        return NextResponse.redirect(presignedUrl, 302);
      }
    }

    return NextResponse.redirect(fileUrl, 302);
  } catch (error) {
    watchLogger.error({ err: formatError(error) }, "Error streaming video");
    return NextResponse.json({ error: "Streaming failed" }, { status: 500 });
  }
}
