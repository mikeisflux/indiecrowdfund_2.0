import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWiseWebhook } from "@/lib/payments/wise";

// Wise webhook public key for signature verification
const WISE_PUBLIC_KEY = process.env.WISE_WEBHOOK_PUBLIC_KEY || "";

// ============================================
// WEBHOOK EVENT TYPES
// ============================================

interface WiseWebhookEvent {
  subscription_id: string;
  event_type: WiseEventType;
  schema_version: string;
  sent_at: string;
  data: WiseEventData;
}

type WiseEventType =
  | "transfers#state-change"
  | "transfers#active-cases"
  | "balances#credit"
  | "balances#update"
  | "cards#transaction"
  | "profiles#verification-state-change";

interface WiseEventData {
  resource: {
    id: number;
    profile_id: number;
    account_id?: number;
    type: string;
  };
  current_state?: string;
  previous_state?: string;
  occurred_at: string;
  // For balance credits
  amount?: number;
  currency?: string;
  reference?: string;
  // For card transactions
  transaction_id?: string;
  merchant_name?: string;
  // For transfers
  target_value?: number;
  source_value?: number;
}

// ============================================
// WEBHOOK HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-signature-sha256") || "";

    // Verify webhook signature
    if (WISE_PUBLIC_KEY && !verifyWiseWebhook(body, signature, WISE_PUBLIC_KEY)) {
      console.error("Wise webhook signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event: WiseWebhookEvent = JSON.parse(body);

    console.log(`Wise webhook received: ${event.event_type}`, {
      resourceId: event.data.resource.id,
      state: event.data.current_state,
    });

    // Handle different event types
    switch (event.event_type) {
      case "transfers#state-change":
        await handleTransferStateChange(event);
        break;

      case "balances#credit":
        await handleBalanceCredit(event);
        break;

      case "cards#transaction":
        await handleCardTransaction(event);
        break;

      case "profiles#verification-state-change":
        await handleProfileVerification(event);
        break;

      default:
        console.log(`Unhandled Wise webhook event: ${event.event_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Wise webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

async function handleTransferStateChange(event: WiseWebhookEvent) {
  const transferId = event.data.resource.id.toString();
  const newState = event.data.current_state;

  // Find payout by Wise transfer ID
  const payout = await db.payout.findFirst({
    where: { wiseTransferId: transferId },
  });

  if (!payout) {
    console.log(`Payout not found for transfer ${transferId}`);
    return;
  }

  // Map Wise states to our payout status
  let status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" = payout.status as "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

  switch (newState) {
    case "incoming_payment_waiting":
    case "incoming_payment_initiated":
      status = "PENDING";
      break;

    case "processing":
    case "funds_converted":
    case "outgoing_payment_sent":
      status = "PROCESSING";
      break;

    case "completed":
      status = "COMPLETED";
      break;

    case "cancelled":
    case "funds_refunded":
    case "bounced_back":
      status = "FAILED";
      break;
  }

  // Update payout status
  await db.payout.update({
    where: { id: payout.id },
    data: {
      status,
      ...(status === "PROCESSING" && { sentAt: new Date() }),
      ...(status === "COMPLETED" && { completedAt: new Date() }),
    },
  });

  console.log(`Payout ${payout.id} updated to ${status}`);
}

async function handleBalanceCredit(event: WiseWebhookEvent) {
  const { amount, reference } = event.data;

  if (!reference) {
    console.log("Balance credit without reference, skipping");
    return;
  }

  // Check if this is a pledge payment (reference format: PLG-XXXXXXXX)
  if (reference.startsWith("PLG-")) {
    const pledge = await db.pledge.findFirst({
      where: { wisePayInReference: reference },
    });

    if (!pledge) {
      console.log(`Pledge not found for reference ${reference}`);
      return;
    }

    // Verify amount matches
    if (amount !== pledge.amount) {
      console.warn(
        `Amount mismatch for pledge ${pledge.id}: expected ${pledge.amount}, got ${amount}`
      );
    }

    // Update pledge to completed
    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        status: "COMPLETED",
      },
    });

    // Update project funding
    await db.project.update({
      where: { id: pledge.projectId },
      data: {
        currentAmount: { increment: pledge.amount },
        backerCount: { increment: 1 },
      },
    });

    // Update reward quantity
    await db.reward.update({
      where: { id: pledge.rewardId },
      data: {
        quantityClaimed: { increment: 1 },
      },
    });

    console.log(`Pledge ${pledge.id} completed via ACH payment`);
  }
}

async function handleCardTransaction(event: WiseWebhookEvent) {
  // Log card transactions for creator spending tracking
  const { transaction_id, merchant_name } = event.data;
  const amount = event.data.amount;

  console.log(`Card transaction: ${transaction_id}`, {
    merchant: merchant_name,
    amount,
  });

  // Could track spending patterns here if needed
}

async function handleProfileVerification(event: WiseWebhookEvent) {
  const profileId = event.data.resource.profile_id.toString();
  const verificationState = event.data.current_state;

  // Find WiseConfig by profile ID
  const wiseConfig = await db.wiseConfig.findFirst({
    where: { wiseProfileId: profileId },
  });

  if (!wiseConfig) {
    console.log(`WiseConfig not found for profile ${profileId}`);
    return;
  }

  // Map verification states
  let kycStatus = wiseConfig.kycStatus;
  let isOnboarded = wiseConfig.isOnboarded;

  switch (verificationState) {
    case "verified":
      kycStatus = "verified";
      isOnboarded = true;
      break;

    case "pending":
    case "processing":
      kycStatus = "in_progress";
      break;

    case "rejected":
    case "failed":
      kycStatus = "rejected";
      break;
  }

  await db.wiseConfig.update({
    where: { id: wiseConfig.id },
    data: {
      kycStatus,
      isOnboarded,
      ...(kycStatus === "verified" && { kycVerifiedAt: new Date() }),
    },
  });

  console.log(`Creator ${wiseConfig.userId} KYC status: ${kycStatus}`);
}

// ============================================
// WEBHOOK VERIFICATION ENDPOINT
// ============================================

// Wise may send GET requests to verify the webhook endpoint
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "IndieCrowdfund Wise webhook endpoint",
    timestamp: new Date().toISOString(),
  });
}
