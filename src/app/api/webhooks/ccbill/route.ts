import { NextRequest, NextResponse } from "next/server";
import {
  handleCCBillWebhook,
  verifyCCBillDigest,
} from "@/lib/payments/ccbill";

const CCBILL_WEBHOOK_SALT = process.env.CCBILL_WEBHOOK_SALT!;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const payload: Record<string, string> = {};

    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    // Verify webhook authenticity
    const digest = payload.responseDigest;
    if (digest && !verifyCCBillDigest(payload, digest, CCBILL_WEBHOOK_SALT)) {
      console.error("CCBill webhook verification failed");
      return NextResponse.json(
        { error: "Invalid digest" },
        { status: 400 }
      );
    }

    // Map to webhook payload type
    const webhookPayload = {
      eventType: payload.eventType,
      subscriptionId: payload.subscriptionId,
      clientAccnum: payload.clientAccnum,
      clientSubacc: payload.clientSubacc,
      timestamp: payload.timestamp,
      transactionId: payload.transactionId,
      initialPrice: payload.initialPrice,
      currencyCode: payload.currencyCode,
      X_pledgeId: payload["X_pledgeId"],
      X_projectId: payload["X_projectId"],
      X_userId: payload["X_userId"],
    };

    await handleCCBillWebhook(webhookPayload);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("CCBill webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
