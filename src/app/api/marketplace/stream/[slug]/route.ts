import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const streamLogger = logger.child({ module: "marketplace-stream" });
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/stream/[slug]
 *
 * Public streaming endpoint — redirects to the audio file URL.
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

    const streamUrl = book.audioStreamUrl || book.audioFileUrl;
    if (!streamUrl) {
      return NextResponse.json({ error: "No audio available" }, { status: 404 });
    }

    // Increment view count (used as play count for music)
    await prisma.marketplaceBook.update({
      where: { id: book.id },
      data: { viewCount: { increment: 1 } },
    });

    // Redirect to the actual audio file
    return NextResponse.redirect(streamUrl, 302);
  } catch (error) {
    streamLogger.error({ err: String(error) }, "Error streaming track");
    return NextResponse.json(
      { error: "Streaming failed" },
      { status: 500 }
    );
  }
}
