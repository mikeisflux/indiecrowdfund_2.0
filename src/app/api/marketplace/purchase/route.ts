import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const marketplacePurchaseLogger = logger.child({ module: "marketplace-purchase" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getDivinityCoinConfig } from "@/lib/payments/divinitycoin";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketplace/purchase
 *
 * Initiate a purchase for a marketplace book
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, paymentMethod } = body;

    if (!bookId) {
      return NextResponse.json({ error: "bookId is required" }, { status: 400 });
    }

    // Get the book with creator info
    const book = await prisma.marketplaceBook.findFirst({
      where: {
        id: bookId,
        status: "LIVE",
        deletedAt: null,
      },
      include: {
        creator: {
          select: { id: true },
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

    // Verify payment method matches book's requirements
    if (book.paymentProcessor === "STRIPE" && paymentMethod !== "stripe") {
      return NextResponse.json(
        { error: "This book requires Stripe payment" },
        { status: 400 }
      );
    }
    if (book.paymentProcessor === "DIVINITYCOIN" && paymentMethod !== "divinitycoin") {
      return NextResponse.json(
        { error: "This book requires DivinityCoin payment" },
        { status: 400 }
      );
    }
    if (book.paymentProcessor === "PAYPAL" && paymentMethod !== "paypal") {
      return NextResponse.json(
        { error: "This book requires PayPal payment" },
        { status: 400 }
      );
    }

    // Create purchase record in PENDING state
    const purchase = await prisma.marketplacePurchase.create({
      data: {
        bookId,
        buyerId: session.user.id,
        amount: book.price,
        currency: book.currency,
        paymentProcessor: book.paymentProcessor,
        status: "PENDING",
      },
    });

    // PayPal payment flow — create an order and return the orderId for the frontend
    if (book.paymentProcessor === "PAYPAL" && paymentMethod === "paypal") {
      try {
        const config = await getPayPalConfig();
        const accessToken = await getPayPalAccessToken();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

        const orderRes = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                custom_id: purchase.id,
                description: `Marketplace: ${book.title}`,
                amount: {
                  currency_code: (book.currency || "USD").toUpperCase(),
                  value: Number(book.price).toFixed(2),
                },
              },
            ],
            application_context: {
              return_url: `${appUrl}/marketplace/books/${book.slug}?purchase=success`,
              cancel_url: `${appUrl}/marketplace/books/${book.slug}`,
              brand_name: "IndieCrowdfund",
              landing_page: "NO_PREFERENCE",
              user_action: "PAY_NOW",
            },
          }),
        });

        if (!orderRes.ok) {
          const errBody = await orderRes.text();
          marketplacePurchaseLogger.error({ err: errBody }, "[Marketplace PayPal] Failed to create order");
          await prisma.marketplacePurchase.delete({ where: { id: purchase.id } });
          return NextResponse.json({ error: "Failed to create PayPal order" }, { status: 502 });
        }

        const orderData = await orderRes.json();
        const paypalOrderId = orderData.id as string;

        await prisma.marketplacePurchase.update({
          where: { id: purchase.id },
          data: { paypalOrderId },
        });

        marketplacePurchaseLogger.info(
          { purchaseId: purchase.id, paypalOrderId },
          "Marketplace PayPal order created"
        );

        return NextResponse.json({
          success: true,
          purchaseId: purchase.id,
          paymentRequired: true,
          paymentProcessor: "PAYPAL",
          paypalOrderId,
          amount: Number(book.price),
          currency: book.currency,
        });
      } catch (paypalError) {
        marketplacePurchaseLogger.error({ err: String(paypalError) }, "[Marketplace PayPal] Error:");
        await prisma.marketplacePurchase.delete({ where: { id: purchase.id } });
        return NextResponse.json({ error: "Failed to initialize PayPal payment" }, { status: 502 });
      }
    }

    // DivinityCoin seamless payment flow
    if (book.paymentProcessor === "DIVINITYCOIN" && paymentMethod === "divinitycoin") {
      try {
        const dcConfig = await getDivinityCoinConfig();
        const userRecord = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { email: true, name: true },
        });

        const dcResponse = await fetch(`${dcConfig.baseUrl}?action=create-payment-intent`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${dcConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(Number(book.price) * 100), // cents
            currency: book.currency || "usd",
            platformUserId: session.user.id,
            email: userRecord?.email || "",
            name: userRecord?.name || "",
            // DC API requires pledgeId/projectId — map from marketplace context
            pledgeId: purchase.id,
            projectId: book.id,
            purchaseId: purchase.id,
            bookId: book.id,
            type: "marketplace",
            statement_descriptor: "INDIECROWDFUND",
          }),
        });

        const dcResult = await dcResponse.json();
        if (!dcResponse.ok || !dcResult.success) {
          marketplacePurchaseLogger.error({ err: String(dcResult) }, "[Marketplace DC] Failed to create payment intent:");
          await prisma.marketplacePurchase.delete({ where: { id: purchase.id } });
          return NextResponse.json(
            { error: dcResult.error || "Failed to initialize payment" },
            { status: 502 }
          );
        }

        // Store DC's payment intent ID on purchase
        await prisma.marketplacePurchase.update({
          where: { id: purchase.id },
          data: { divinityCoinPaymentId: dcResult.paymentIntentId },
        });

        return NextResponse.json({
          success: true,
          purchaseId: purchase.id,
          paymentRequired: true,
          paymentProcessor: "DIVINITYCOIN",
          clientSecret: dcResult.clientSecret,
          publishableKey: dcResult.publishableKey,
          amount: Number(book.price),
          currency: book.currency,
        });
      } catch (dcError) {
        marketplacePurchaseLogger.error({ err: String(dcError) }, "[Marketplace DC] API error:");
        await prisma.marketplacePurchase.delete({ where: { id: purchase.id } });
        return NextResponse.json(
          { error: "Failed to connect to payment processor" },
          { status: 502 }
        );
      }
    }

    // For Stripe payments, return the purchase info for client-side Stripe handling
    return NextResponse.json({
      success: true,
      purchase,
      paymentRequired: true,
      paymentProcessor: book.paymentProcessor,
      amount: Number(book.price),
      currency: book.currency,
    });
  } catch (error) {
    marketplacePurchaseLogger.error({ err: String(error) }, "Error processing purchase:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/purchase
 *
 * Get user's purchases
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const purchases = await prisma.marketplacePurchase.findMany({
      where: {
        buyerId: session.user.id,
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImageUrl: true,
            pdfCoverImageUrl: true,
            price: true,
            currency: true,
            creator: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    type PurchaseType = (typeof purchases)[number];
    return NextResponse.json({
      purchases: purchases.map((p: PurchaseType) => ({
        id: p.id,
        status: p.status,
        amount: Number(p.amount),
        currency: p.currency,
        purchasedAt: p.completedAt,
        book: {
          id: p.book.id,
          title: p.book.title,
          slug: p.book.slug,
          coverImage: p.book.coverImageUrl || p.book.pdfCoverImageUrl,
          creator: p.book.creator.name,
        },
      })),
    });
  } catch (error) {
    marketplacePurchaseLogger.error({ err: String(error) }, "Error fetching purchases:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
