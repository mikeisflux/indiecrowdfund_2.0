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
      console.log("[Marketplace Download] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    console.log("[Marketplace Download] Request for purchase:", id, "by user:", session.user.id);

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

    console.log("[Marketplace Download] Purchase found:", purchase ? "yes" : "no");
    if (purchase) {
      console.log("[Marketplace Download] Purchase details:", {
        purchaseId: purchase.id,
        bookId: purchase.book.id,
        bookTitle: purchase.book.title,
        hasPdfUrl: !!purchase.book.pdfFileUrl,
      });
    } else {
      // Try to find the purchase without the buyerId filter to debug
      const anyPurchase = await prisma.marketplacePurchase.findUnique({
        where: { id },
        select: {
          id: true,
          buyerId: true,
          status: true,
        },
      });
      console.log("[Marketplace Download] Debug - purchase exists but not matching:", anyPurchase);
    }

    if (!purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    if (!purchase.book.pdfFileUrl) {
      console.log("[Marketplace Download] No PDF file URL for book");
      return NextResponse.json(
        { error: "PDF file not available" },
        { status: 404 }
      );
    }

    console.log("[Marketplace Download] PDF file URL:", purchase.book.pdfFileUrl);

    // Decode URL-encoded paths (some books have %2F instead of /)
    const decodedPdfUrl = decodeURIComponent(purchase.book.pdfFileUrl);
    console.log("[Marketplace Download] Decoded PDF URL:", decodedPdfUrl);

    // Extract R2 storage key from pdfFileUrl
    // pdfFileUrl is stored as "/api/r2/serve/marketplace/userId/pdfs/file.pdf"
    // We need to extract "marketplace/userId/pdfs/file.pdf"
    const r2KeyMatch = decodedPdfUrl.match(/\/api\/r2\/serve\/(.+)$/);
    if (!r2KeyMatch) {
      // If it's not an R2 path, return the URL directly (legacy support)
      return NextResponse.json({
        downloadUrl: purchase.book.pdfFileUrl,
        title: purchase.book.title,
      });
    }

    const r2Key = r2KeyMatch[1];
    console.log("[Marketplace Download] R2 key:", r2Key);

    // Get R2 storage and generate presigned URL
    const r2 = await getR2Storage();
    if (!r2) {
      console.log("[Marketplace Download] R2 storage not configured");
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Check if file exists - try decoded path first, then original (URL-encoded) path
    console.log("[Marketplace Download] Checking if file exists in R2...");
    let exists = await r2.fileExists(r2Key);
    console.log("[Marketplace Download] File exists (decoded path):", exists);

    // If not found with decoded path, try the original URL-encoded path
    // (in case the file was uploaded with %2F as literal characters in the key)
    let actualKey = r2Key;
    if (!exists) {
      const originalR2KeyMatch = purchase.book.pdfFileUrl.match(/\/api\/r2\/serve\/(.+)$/);
      if (originalR2KeyMatch) {
        const encodedKey = originalR2KeyMatch[1];
        console.log("[Marketplace Download] Trying original encoded key:", encodedKey);
        exists = await r2.fileExists(encodedKey);
        console.log("[Marketplace Download] File exists (encoded path):", exists);
        if (exists) {
          actualKey = encodedKey;
        }
      }
    }

    if (!exists) {
      // Try to list files in the directory to see what's there
      try {
        const dirPath = r2Key.substring(0, r2Key.lastIndexOf('/'));
        console.log("[Marketplace Download] Listing files in directory:", dirPath);
        const files = await r2.listFiles(dirPath);
        console.log("[Marketplace Download] Files in directory:", files?.slice(0, 10));
      } catch (listErr) {
        console.log("[Marketplace Download] Could not list directory:", listErr);
      }
      return NextResponse.json(
        { error: "PDF file not found in storage" },
        { status: 404 }
      );
    }

    // Use the key that worked
    const r2KeyToUse = actualKey;

    // Get signed URL expiration from settings (like crowdfunding does)
    const settings = await prisma.platformSettings.findFirst({
      select: { signedUrlExpirationMinutes: true },
    });
    const expiresIn = (settings?.signedUrlExpirationMinutes || 60) * 60;

    // Generate presigned download URL
    const downloadUrl = await r2.getDownloadUrl(r2KeyToUse, { expiresIn });

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
