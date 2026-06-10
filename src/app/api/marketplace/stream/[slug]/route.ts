import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const streamLogger = logger.child({ module: "marketplace-stream" });
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketplace/stream/[slug]
 *
 * Public streaming endpoint — proxies audio from R2 through our server.
 * This keeps audio same-origin so the Web Audio API visualizer works.
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
        pdfFileUrl: true,
        creatorId: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Paid-content gate.
    //
    // The endpoint is documented "Free to stream; downloading the full-
    // quality file requires purchase." Schema confirms the intent:
    // `audioStreamUrl` is the public lower-quality preview, `audioFileUrl`
    // is the paid full-quality master. The previous fallback chain went
    //   audioStreamUrl || audioFileUrl || pdfFileUrl
    // so a creator who only uploaded ONE file (the paid one) silently
    // served the full master to unauthenticated requesters -- bypassing
    // payment entirely. Anyone with the track slug got the paid file
    // for free.
    //
    // New policy:
    //   - audioStreamUrl set       -> serve to everyone (public preview)
    //   - else, user purchased     -> serve audioFileUrl (full)
    //   - else, user is creator    -> serve audioFileUrl (own track)
    //   - else                     -> 404 ("no preview available")
    const session = await auth();
    let isBuyer = false;
    let isCreator = false;
    if (session?.user?.id) {
      if (book.creatorId === session.user.id) {
        isCreator = true;
      } else {
        const purchase = await prisma.marketplacePurchase.findFirst({
          where: {
            buyerId: session.user.id,
            bookId: book.id,
            status: "COMPLETED",
          },
          select: { id: true },
        });
        if (purchase) isBuyer = true;
      }
    }

    let fileUrl: string | null = null;
    if (book.audioStreamUrl) {
      fileUrl = book.audioStreamUrl;
    } else if (isBuyer || isCreator) {
      fileUrl = book.audioFileUrl || book.pdfFileUrl;
    }
    if (!fileUrl) {
      return NextResponse.json(
        { error: "No preview available for this track. Purchase to listen." },
        { status: 404 }
      );
    }

    // Increment play count (non-blocking)
    prisma.marketplaceBook
      .update({
        where: { id: book.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    // If the URL is an R2 serve path, proxy the audio through our server
    // so it stays same-origin and the Web Audio API visualizer works
    const r2ServeMatch = fileUrl.match(/\/api\/r2\/serve\/(.+)$/);
    if (r2ServeMatch) {
      const storageKey = decodeURIComponent(r2ServeMatch[1]);
      const r2 = await getR2Storage();
      if (r2) {
        const fileBuffer = await r2.getFile(storageKey);
        if (fileBuffer) {
          // Determine content type from file extension
          const ext = storageKey.split(".").pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            mp3: "audio/mpeg",
            wav: "audio/wav",
            flac: "audio/flac",
            aac: "audio/aac",
            ogg: "audio/ogg",
            m4a: "audio/mp4",
            pdf: "application/pdf",
          };
          const contentType = (ext && mimeMap[ext]) || "audio/mpeg";

          // Support range requests for seeking
          const rangeHeader = request.headers.get("range");
          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (match) {
              const start = parseInt(match[1]);
              const end = match[2] ? parseInt(match[2]) : fileBuffer.length - 1;
              const chunk = fileBuffer.subarray(start, end + 1);

              return new Response(new Uint8Array(chunk), {
                status: 206,
                headers: {
                  "Content-Type": contentType,
                  "Content-Length": String(chunk.length),
                  "Content-Range": `bytes ${start}-${end}/${fileBuffer.length}`,
                  "Accept-Ranges": "bytes",
                  "Cache-Control": "public, max-age=3600",
                },
              });
            }
          }

          return new Response(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Content-Length": String(fileBuffer.length),
              "Accept-Ranges": "bytes",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }
    }

    // Fallback: redirect to the stored URL directly
    return NextResponse.redirect(fileUrl, 302);
  } catch (error) {
    streamLogger.error({ err: formatError(error) }, "Error streaming track");
    return NextResponse.json(
      { error: "Streaming failed" },
      { status: 500 }
    );
  }
}
