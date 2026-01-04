import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/backer/marketplace-purchases/[id]/download
 *
 * Get presigned download URL for a purchased marketplace book
 * Uses R2 presigned URLs just like crowdfunding files
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the purchase and verify ownership
    const purchase = await prisma.marketplacePurchase.findFirst({
      where: {
        id,
        buyerId: session.user.id,
        status: "COMPLETED",
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            pdfFileUrl: true,
            pdfFileName: true,
            pdfFileSize: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    if (!purchase.book.pdfFileUrl) {
      return NextResponse.json(
        { error: "PDF file not available" },
        { status: 404 }
      );
    }

    // Extract R2 storage key from pdfFileUrl
    // pdfFileUrl is stored as "/api/r2/serve/marketplace/userId/pdfs/file.pdf"
    // We need to extract "marketplace/userId/pdfs/file.pdf"
    const r2KeyMatch = purchase.book.pdfFileUrl.match(/\/api\/r2\/serve\/(.+)$/);
    if (!r2KeyMatch) {
      // If it's not an R2 path, return the URL directly (legacy support)
      return NextResponse.json({
        downloadUrl: purchase.book.pdfFileUrl,
        title: purchase.book.title,
      });
    }

    const r2Key = r2KeyMatch[1];

    // Get R2 storage and generate presigned URL
    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Check if file exists
    const exists = await r2.fileExists(r2Key);
    if (!exists) {
      return NextResponse.json(
        { error: "PDF file not found in storage" },
        { status: 404 }
      );
    }

    // Get signed URL expiration from settings (like crowdfunding does)
    const settings = await prisma.platformSettings.findFirst({
      select: { signedUrlExpirationMinutes: true },
    });
    const expiresIn = (settings?.signedUrlExpirationMinutes || 60) * 60;

    // Generate presigned download URL
    const downloadUrl = await r2.getDownloadUrl(r2Key, { expiresIn });

    return NextResponse.json({
      downloadUrl,
      title: purchase.book.title,
      fileName: purchase.book.pdfFileName,
      fileSize: purchase.book.pdfFileSize,
      expiresIn,
    });
  } catch (error) {
    console.error("Error getting marketplace download:", error);
    return NextResponse.json(
      { error: "Failed to get download URL" },
      { status: 500 }
    );
  }
}
