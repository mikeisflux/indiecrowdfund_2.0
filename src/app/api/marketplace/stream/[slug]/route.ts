import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const streamLogger = logger.child({ module: "marketplace-stream" });
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/stream/[slug]
 *
 * Public streaming endpoint — generates a presigned R2 URL for audio playback.
 * Free to stream; downloading the full-quality file requires purchase.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const book = await prisma.marketplaceBook.findFirst({
      where: {
        slug,
        mediaCategory: "music",
        status: "LIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        audioFileUrl: true,
        audioStreamUrl: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const fileUrl = book.audioStreamUrl || book.audioFileUrl;
    if (!fileUrl) {
      return NextResponse.json({ error: "No audio available" }, { status: 404 });
    }

    // Increment play count (non-blocking)
    prisma.marketplaceBook
      .update({
        where: { id: book.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    // If the URL is an R2 serve path, extract the key and generate a presigned URL
    const r2ServeMatch = fileUrl.match(/\/api\/r2\/serve\/(.+)$/);
    if (r2ServeMatch) {
      const storageKey = decodeURIComponent(r2ServeMatch[1]);
      const r2 = await getR2Storage();
      if (r2) {
        const presignedUrl = await r2.getDownloadUrl(storageKey, {
          expiresIn: 3600, // 1 hour
        });
        return NextResponse.redirect(presignedUrl, 302);
      }
    }

    // Fallback: redirect to the stored URL directly
    return NextResponse.redirect(fileUrl, 302);
  } catch (error) {
    streamLogger.error({ err: String(error) }, "Error streaming track");
    return NextResponse.json(
      { error: "Streaming failed" },
      { status: 500 }
    );
  }
}
