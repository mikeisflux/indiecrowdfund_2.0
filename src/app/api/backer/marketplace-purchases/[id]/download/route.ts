import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/backer/marketplace-purchases/[id]/download
 *
 * Get download URL for a purchased marketplace book
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

    // Return the PDF download URL
    return NextResponse.json({
      downloadUrl: purchase.book.pdfFileUrl,
      title: purchase.book.title,
    });
  } catch (error) {
    console.error("Error getting marketplace download:", error);
    return NextResponse.json(
      { error: "Failed to get download URL" },
      { status: 500 }
    );
  }
}
