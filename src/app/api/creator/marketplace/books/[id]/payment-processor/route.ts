import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "marketplace-payment-processor" });

const VALID_PROCESSORS = ["PAYPAL", "DIVINITYCOIN", "WHOP"] as const;
type ValidProcessor = (typeof VALID_PROCESSORS)[number];

/**
 * POST /api/creator/marketplace/books/[id]/payment-processor
 *
 * Update only the paymentProcessor on a marketplace listing. Lets
 * the creator switch processors at any time — DRAFT, PENDING_REVIEW,
 * APPROVED, LIVE, REJECTED, DEACTIVATED. Future purchases use the
 * new processor; existing MarketplacePurchase rows keep their
 * snapshotted processor and stay refundable / serviceable through
 * the original.
 *
 * Why a dedicated endpoint instead of the existing PUT?
 *   - The existing PUT route blocks all edits while
 *     status=PENDING_REVIEW. A processor swap doesn't change the
 *     content under review, so there's no reason to gate it on
 *     review state.
 *   - Keeps the surface narrow: only paymentProcessor is mutated,
 *     so no risk of accidental field bleed from the wider edit
 *     form.
 *   - Doesn't trigger the LIVE → re-review flow that file / cover
 *     changes do in PUT — the processor change doesn't affect
 *     content moderation.
 *
 * Constraints:
 *   - NSFW books (hasAdultContent=true) are locked to DIVINITYCOIN
 *     because mainstream processors won't service adult content.
 *     Requests for anything else on an NSFW book are rejected.
 *   - NMI is not a valid choice — that processor is decommissioned
 *     (PaymentCloud cancelled the merchant account). Books still
 *     on NMI must move to one of the three live processors.
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
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const requested = body?.paymentProcessor;

    if (
      typeof requested !== "string" ||
      !VALID_PROCESSORS.includes(requested as ValidProcessor)
    ) {
      return NextResponse.json(
        { error: "Invalid payment processor" },
        { status: 400 }
      );
    }

    const book = await db.marketplaceBook.findFirst({
      where: { id, creatorId: session.user.id, deletedAt: null },
      select: {
        id: true,
        hasAdultContent: true,
        paymentProcessor: true,
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book.hasAdultContent && requested !== "DIVINITYCOIN") {
      return NextResponse.json(
        { error: "NSFW content requires Divinity Payments" },
        { status: 400 }
      );
    }

    if (book.paymentProcessor === requested) {
      return NextResponse.json({
        success: true,
        paymentProcessor: requested,
        unchanged: true,
      });
    }

    await db.marketplaceBook.update({
      where: { id },
      data: {
        paymentProcessor: requested as ValidProcessor,
        updatedAt: new Date(),
      },
    });

    log.info(
      {
        bookId: id,
        creatorId: session.user.id,
        from: book.paymentProcessor,
        to: requested,
      },
      "Marketplace payment processor changed"
    );

    return NextResponse.json({
      success: true,
      paymentProcessor: requested,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Failed to update marketplace payment processor"
    );
    return NextResponse.json(
      { error: "Failed to update payment processor" },
      { status: 500 }
    );
  }
}
