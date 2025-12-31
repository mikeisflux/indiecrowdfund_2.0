import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getR2Storage } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/r2/serve/[...key]
 *
 * Serve files from R2 storage with presigned URLs
 * The key is the full R2 storage key (e.g., marketplace/userId/pdfs/fileId_name.pdf)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key: keyParts } = await params;
    const key = keyParts.join("/");

    if (!key) {
      return NextResponse.json({ error: "File key required" }, { status: 400 });
    }

    // Security check: Only allow access to files the user owns or has purchased
    const isMarketplaceFile = key.startsWith("marketplace/");
    const isDigitalRewardsFile = key.startsWith("digital-rewards/");

    if (isMarketplaceFile) {
      // For marketplace files, check if user is the owner
      const userIdFromKey = key.split("/")[1];
      if (userIdFromKey !== session.user.id) {
        // User is not the owner - check if they have purchased a book using this file
        const { prisma } = await import("@/lib/prisma");

        const purchase = await prisma.marketplacePurchase.findFirst({
          where: {
            buyerId: session.user.id,
            status: "COMPLETED",
            book: {
              pdfFileUrl: { contains: key },
            },
          },
        });

        if (!purchase) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
      }
    } else if (isDigitalRewardsFile) {
      // For digital rewards, check if user has a valid pledge
      const { db } = await import("@/lib/db");

      const projectIdFromKey = key.split("/")[1];
      const hasAccess = await db.pledge.findFirst({
        where: {
          userId: session.user.id,
          projectId: projectIdFromKey,
          status: "COMPLETED",
        },
      });

      if (!hasAccess) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Invalid file key" }, { status: 400 });
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Check if file exists
    const exists = await r2.fileExists(key);
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Generate presigned download URL (valid for 1 hour)
    const downloadUrl = await r2.getDownloadUrl(key, { expiresIn: 3600 });

    // Check if client wants redirect or JSON response
    const wantsRedirect = request.headers.get("Accept")?.includes("text/html") ||
      request.nextUrl.searchParams.get("redirect") === "true";

    if (wantsRedirect) {
      return NextResponse.redirect(downloadUrl);
    }

    return NextResponse.json({ url: downloadUrl });
  } catch (error) {
    console.error("Error serving R2 file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
