import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const watchLogger = logger.child({ module: "marketplace-watch" });
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";

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
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const fileUrl = item.videoStreamUrl || item.videoFileUrl;
    if (!fileUrl) {
      return NextResponse.json({ error: "No video available" }, { status: 404 });
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
