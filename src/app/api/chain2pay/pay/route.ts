import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateCSRFToken } from "@/lib/csrf";

/**
 * POST /api/chain2pay/pay
 *
 * Generate a Chain2Pay payment link for a pledge.
 * Flow:
 * 1. Create/validate pledge
 * 2. Call Chain2Pay /generate endpoint to get hosted checkout URL
 * 3. Return payment_url for frontend redirect
 * 4. Chain2Pay sends webhook to /api/webhooks/chain2pay on success
 *
 * PCI DSS Compliance:
 * - We NEVER handle, process, or store credit card information
 * - All payment data is entered on Chain2Pay's PCI-compliant hosted checkout page
 * - Our role is SAQ A (redirect-only) - the lowest PCI compliance level
 * - We only store transaction IDs and webhook confirmations, never card details
 * - CSRF protection prevents unauthorized payment initiation
 * - All communication with Chain2Pay uses HTTPS
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in" },
        { status: 401 }
      );
    }

    // CSRF validation
    const csrfToken = req.headers.get("x-csrf-token");
    if (!csrfToken || !validateCSRFToken(csrfToken)) {
      return NextResponse.json(
        { error: "Invalid request. Please refresh and try again." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { pledgeId, amount } = body;

    if (!pledgeId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount > 1000000 || !Number.isFinite(amount)) {
      return NextResponse.json(
        { error: "Invalid payment amount" },
        { status: 400 }
      );
    }

    // Get pledge and verify ownership
    const pledge = await db.pledge.findUnique({
      where: { id: pledgeId },
      include: {
        project: {
          select: {
            id: true,
            paymentProcessor: true,
            chain2payWallet: true,
            title: true,
          },
        },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check if this is an add-items payment (pledge already completed with pending items)
    const metadata = (typeof pledge.metadata === "object" && pledge.metadata !== null)
      ? pledge.metadata as Record<string, unknown>
      : {};
    const pendingItems = metadata.pendingAdditionalItems as {
      paymentMethod: string;
      addons: { id: string; quantity: number }[];
      amount: number;
    } | undefined;
    const isAddItems = pledge.status === "COMPLETED" && pendingItems?.paymentMethod === "CHAIN2PAY";

    if (pledge.status === "COMPLETED" && !isAddItems) {
      return NextResponse.json({
        success: true,
        message: "Payment was already processed",
      });
    }

    if (pledge.project.paymentProcessor !== "CHAIN2PAY") {
      return NextResponse.json(
        { error: "This project does not accept Chain2Pay payments" },
        { status: 400 }
      );
    }

    // For add-items, use the pending items amount instead of the pledge amount
    const paymentAmount = isAddItems ? pendingItems!.amount : amount;

    // Get platform Chain2Pay settings
    const settings = await db.platformSettings.findFirst({
      select: {
        chain2payEnabled: true,
        chain2payMerchantWallet: true,
        chain2payDefaultProvider: true,
        chain2payCallbackBaseUrl: true,
      },
    });

    if (!settings?.chain2payEnabled || !settings?.chain2payMerchantWallet) {
      return NextResponse.json(
        { error: "Chain2Pay is not configured. Please contact support." },
        { status: 500 }
      );
    }

    // Use project-specific wallet or fall back to platform wallet
    const merchantWallet = pledge.project.chain2payWallet || settings.chain2payMerchantWallet;

    // Build callback URL with pledge ID for webhook identification
    const callbackBase = settings.chain2payCallbackBaseUrl || `${req.nextUrl.origin}`;
    const callbackUrl = isAddItems
      ? `${callbackBase}/api/webhooks/chain2pay?pledgeId=${pledgeId}&addItems=true`
      : `${callbackBase}/api/webhooks/chain2pay?pledgeId=${pledgeId}`;

    // Call Chain2Pay API to generate payment link
    const chain2payRes = await fetch("https://chain2pay.cloud/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(paymentAmount.toFixed(2)),
        currency: "USD",
        merchant_wallet: merchantWallet,
        callback_url: callbackUrl,
        customer_email: session.user.email || undefined,
        provider: settings.chain2payDefaultProvider || "multihosted",
      }),
    });

    const chain2payData = await chain2payRes.json();

    if (!chain2payData.success || !chain2payData.payment_url) {
      console.error("[Chain2Pay] Failed to generate payment link:", chain2payData);
      return NextResponse.json(
        { error: chain2payData.error || "Failed to create payment link" },
        { status: 500 }
      );
    }

    // Store the order ID and IPN token on the pledge for tracking
    await db.pledge.update({
      where: { id: pledgeId },
      data: {
        chain2payOrderId: chain2payData.order_id,
        chain2payIpnToken: chain2payData.ipn_token,
      },
    });

    console.log(`[Chain2Pay] Payment link generated for pledge ${pledgeId}${isAddItems ? " (add-items)" : ""}: order=${chain2payData.order_id}`);

    return NextResponse.json({
      success: true,
      paymentUrl: chain2payData.payment_url,
      orderId: chain2payData.order_id,
    });
  } catch (error) {
    console.error("[Chain2Pay Pay] Error:", error);
    return NextResponse.json(
      { error: "Failed to process payment. Please try again." },
      { status: 500 }
    );
  }
}
