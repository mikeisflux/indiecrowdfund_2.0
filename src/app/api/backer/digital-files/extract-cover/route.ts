import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const backerDigitalFilesExtractCoverLogger = logger.child({ module: "backer-digital-files-extract-cover" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { extractAndSaveCover } from "@/lib/pdf-cover-extractor";

export const dynamic = "force-dynamic";

/**
 * POST /api/backer/digital-files/extract-cover
 *
 * Extract cover image from a PDF file
 * Requires: fileId in request body
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    // Verify the user has access to this file
    const digitalFile = await prisma.digitalFile.findFirst({
      where: {
        id: fileId,
        project: {
          pledges: {
            some: {
              userId: session.user.id,
              status: "COMPLETED",
            },
          },
        },
      },
      select: {
        id: true,
        fileUrl: true,
        r2StorageKey: true,
        coverImageUrl: true,
        coverExtractionFailed: true,
      },
    });

    if (!digitalFile) {
      return NextResponse.json({ error: "File not found or access denied" }, { status: 404 });
    }

    // Check if already extracted
    if (digitalFile.coverImageUrl) {
      return NextResponse.json({
        success: true,
        coverUrl: digitalFile.coverImageUrl,
        message: "Cover already extracted",
      });
    }

    // Check if previously failed
    if (digitalFile.coverExtractionFailed) {
      return NextResponse.json({
        success: false,
        message: "Previous extraction attempt failed",
      });
    }

    // Get the PDF URL
    const pdfUrl = digitalFile.r2StorageKey || digitalFile.fileUrl;
    if (!pdfUrl) {
      return NextResponse.json({ error: "PDF URL not found" }, { status: 400 });
    }

    // Extract cover
    const result = await extractAndSaveCover(
      { digitalFile: prisma.digitalFile },
      fileId,
      pdfUrl,
      "digital-file"
    );

    return NextResponse.json({
      success: result.success,
      coverUrl: result.coverUrl,
      totalPages: result.totalPages,
      ...(result.error && { error: result.error }),
    });
  } catch (error) {
    backerDigitalFilesExtractCoverLogger.error({ err: String(error) }, "Cover extraction error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/backer/digital-files/extract-cover
 *
 * Get list of files pending cover extraction
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's digital files that need cover extraction
    const filesNeedingCovers = await prisma.digitalFile.findMany({
      where: {
        coverImageUrl: null,
        coverExtractionFailed: false,
        mimeType: "application/pdf",
        project: {
          pledges: {
            some: {
              userId: session.user.id,
              status: "COMPLETED",
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        fileName: true,
      },
    });

    return NextResponse.json({
      count: filesNeedingCovers.length,
      files: filesNeedingCovers,
    });
  } catch (error) {
    backerDigitalFilesExtractCoverLogger.error({ err: String(error) }, "Error fetching files needing covers:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
