import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/creator/marketplace/books/[id]/submit
 *
 * Submit a book for review
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id,
        creatorId: session.user.id,
        deletedAt: null,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Validate book can be submitted
    if (book.status !== "DRAFT" && book.status !== "REJECTED") {
      return NextResponse.json(
        { error: "Only draft or rejected books can be submitted for review" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!book.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!book.description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    if (!book.pdfFileUrl) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 }
      );
    }

    if (!book.price || Number(book.price) <= 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      );
    }

    // Submit for review
    await prisma.marketplaceBook.update({
      where: { id },
      data: {
        status: "PENDING_REVIEW",
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Book submitted for review",
    });
  } catch (error) {
    console.error("Error submitting book for review:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
