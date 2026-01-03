import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getStripeInstance, getSecureAppUrl, checkAndUpdateStripeOnboarding } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/checkout
 *
 * Create a Stripe Checkout session for marketplace book purchase
 * Uses Stripe Connect to pay the creator directly
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json({ error: "bookId is required" }, { status: 400 });
    }

    // Get the book with creator's Stripe config
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id: bookId,
        status: "LIVE",
        deletedAt: null,
      },
      include: {
        creator: {
          include: {
            stripeConfig: true,
          },
        },
      },
    });

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // Check if already purchased
    const existingPurchase = await prisma.marketplacePurchase.findFirst({
      where: {
        bookId,
        buyerId: session.user.id,
        status: "COMPLETED",
      },
    });

    if (existingPurchase) {
      return NextResponse.json(
        { error: "You have already purchased this book" },
        { status: 400 }
      );
    }

    // Check if creator has connected Stripe
    if (!book.creator.stripeConfig?.stripeAccountId) {
      return NextResponse.json(
        { error: "Creator has not connected Stripe. Please try again later or contact the creator." },
        { status: 400 }
      );
    }

    // Check onboarding status - query Stripe directly if DB shows not onboarded (webhook might be delayed)
    const isOnboarded = await checkAndUpdateStripeOnboarding(
      book.creator.stripeConfig.id,
      book.creator.stripeConfig.stripeAccountId,
      book.creator.stripeConfig.isOnboarded
    );

    if (!isOnboarded) {
      return NextResponse.json(
        { error: "Creator's Stripe account is not fully set up. Please try again later." },
        { status: 400 }
      );
    }

    // Create or get pending purchase record
    let purchase = await prisma.marketplacePurchase.findFirst({
      where: {
        bookId,
        buyerId: session.user.id,
        status: "PENDING",
      },
    });

    // Calculate platform fee (3%) and creator payout (97%)
    const bookPrice = Number(book.price);
    const platformFeeAmount = Math.round(bookPrice * 0.03 * 100) / 100;
    const creatorPayoutAmount = Math.round((bookPrice - platformFeeAmount) * 100) / 100;

    if (!purchase) {
      purchase = await prisma.marketplacePurchase.create({
        data: {
          bookId,
          buyerId: session.user.id,
          amount: book.price,
          platformFee: platformFeeAmount,
          creatorPayout: creatorPayoutAmount,
          currency: book.currency,
          paymentProcessor: "STRIPE",
          status: "PENDING",
        },
      });
    }

    // Get Stripe client
    const stripe = await getStripeInstance();
    const baseUrl = getSecureAppUrl();

    // Calculate platform fee in cents for Stripe
    const amountInCents = Math.round(bookPrice * 100);
    const platformFee = Math.round(amountInCents * 0.03); // 3% platform fee

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: book.currency.toLowerCase(),
            product_data: {
              name: book.title,
              description: book.shortDescription || `Digital book by ${book.creator.name || "Creator"}`,
              images: book.coverImageUrl ? [book.coverImageUrl] : book.pdfCoverImageUrl ? [book.pdfCoverImageUrl] : [],
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: book.creator.stripeConfig.stripeAccountId,
        },
        metadata: {
          purchaseId: purchase.id,
          bookId: book.id,
          buyerId: session.user.id,
          type: "marketplace_purchase",
        },
      },
      success_url: `${baseUrl}/marketplace/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/marketplace/books/${book.slug}?canceled=true`,
      customer_email: session.user.email || undefined,
      metadata: {
        purchaseId: purchase.id,
        bookId: book.id,
        buyerId: session.user.id,
        type: "marketplace_purchase",
      },
    });

    // Update purchase with checkout session ID
    await prisma.marketplacePurchase.update({
      where: { id: purchase.id },
      data: {
        stripeCheckoutSessionId: checkoutSession.id,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
