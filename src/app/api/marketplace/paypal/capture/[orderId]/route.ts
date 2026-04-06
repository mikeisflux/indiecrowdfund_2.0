import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { logger } from "@/lib/logger";

const captureLogger = logger.child({ module: "marketplace-paypal-capture" });

export const dynamic = "force-dynamic";

const PAYPAL_FEE_RATE = 0.0349;   // 3.49%
const PAYPAL_FEE_FIXED = 0.49;    // $0.49 per transaction

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the pending purchase for this PayPal order
    const purchase = await db.marketplacePurchase.findUnique({
      where: { paypalOrderId: orderId },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            creatorId: true,
            creator: {
              select: {
                id: true,
                paypalPayoutConfig: { select: { id: true, paypalEmail: true } },
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    if (purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (purchase.status === "COMPLETED") {
      return NextResponse.json({ success: true, message: "Already completed" });
    }

    // Capture the PayPal order
    const config = await getPayPalConfig();
    const accessToken = await getPayPalAccessToken();

    const captureRes = await fetch(
      `${config.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!captureRes.ok) {
      const errBody = await captureRes.text();
      captureLogger.error({ orderId, err: errBody }, "PayPal capture failed");
      await db.marketplacePurchase.update({
        where: { id: purchase.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ error: "Payment capture failed" }, { status: 502 });
    }

    const captureData = await captureRes.json();
    const captureStatus = captureData.status;

    if (captureStatus !== "COMPLETED") {
      captureLogger.warn({ orderId, captureStatus }, "Unexpected capture status");
      return NextResponse.json(
        { error: `Unexpected payment status: ${captureStatus}` },
        { status: 400 }
      );
    }

    const transactionId =
      captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;

    // Atomically mark purchase as completed
    const grossAmount = Number(purchase.amount);
    const paypalFee = Math.round((grossAmount * PAYPAL_FEE_RATE + PAYPAL_FEE_FIXED) * 100) / 100;
    const mpPaypalPlatformSettings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } });
    const mpPaypalFeeRate = mpPaypalPlatformSettings?.platformFee ? Number(mpPaypalPlatformSettings.platformFee) / 100 : 0.03;
    const platformFee = Math.round(grossAmount * mpPaypalFeeRate * 100) / 100;
    const netAmount = Math.round((grossAmount - paypalFee - platformFee) * 100) / 100;

    const updated = await db.marketplacePurchase.updateMany({
      where: { id: purchase.id, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        deliveredAt: new Date(),
        transactionId,
        platformFee: platformFee, // Platform fee only (PayPal processing fee is separate cost)
        creatorPayout: netAmount,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ success: true, message: "Already completed" });
    }

    // Increment book purchase count
    await db.marketplaceBook.update({
      where: { id: purchase.bookId },
      data: { purchaseCount: { increment: 1 } },
    });

    captureLogger.info(
      { purchaseId: purchase.id, orderId, transactionId },
      "Marketplace PayPal purchase completed"
    );

    // Auto-payout creator if they have a PayPal email configured
    const payoutConfig = purchase.book.creator.paypalPayoutConfig;
    if (payoutConfig && netAmount > 0) {
      try {
        const payoutRecord = await db.payPalPayout.create({
          data: {
            payoutConfigId: payoutConfig.id,
            projectName: purchase.book.title,
            grossAmount,
            platformFee,
            netAmount,
            status: "PROCESSING",
            initiatedAt: new Date(),
          },
        });

        const senderBatchId = `mp_${payoutRecord.id}_${Date.now()}`;
        const payoutPayload = {
          sender_batch_header: {
            sender_batch_id: senderBatchId,
            email_subject: `Your IndieCrowdfund marketplace sale payout`,
            email_message: `You received $${netAmount.toFixed(2)} USD from the sale of "${purchase.book.title}".`,
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: { value: netAmount.toFixed(2), currency: "USD" },
              receiver: payoutConfig.paypalEmail,
              sender_item_id: payoutRecord.id,
              note: `Marketplace sale: "${purchase.book.title}"`,
            },
          ],
        };

        const payoutsRes = await fetch(`${config.baseUrl}/v1/payments/payouts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payoutPayload),
        });

        if (payoutsRes.ok) {
          const payoutsData = await payoutsRes.json();
          const batchId = payoutsData.batch_header?.payout_batch_id as string | undefined;
          const itemId = payoutsData.items?.[0]?.payout_item_id as string | undefined;
          await db.payPalPayout.update({
            where: { id: payoutRecord.id },
            data: { paypalBatchId: batchId, paypalItemId: itemId },
          });
          captureLogger.info(
            { payoutId: payoutRecord.id, batchId, email: payoutConfig.paypalEmail, netAmount },
            "Auto-payout to creator initiated"
          );
        } else {
          const errBody = await payoutsRes.text();
          captureLogger.error({ err: errBody, payoutId: payoutRecord.id }, "Auto-payout failed");
          await db.payPalPayout.update({
            where: { id: payoutRecord.id },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              failureReason: `PayPal API error: ${errBody.slice(0, 500)}`,
            },
          });
        }
      } catch (payoutErr) {
        captureLogger.error({ err: String(payoutErr) }, "Auto-payout error (non-fatal)");
      }
    }

    return NextResponse.json({ success: true, purchaseId: purchase.id });
  } catch (error) {
    captureLogger.error({ err: String(error) }, "Marketplace PayPal capture error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
