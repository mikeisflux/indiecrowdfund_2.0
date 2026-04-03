import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStripeInstance } from "@/lib/payments/stripe";
import { callDivinityCoinAPI } from "@/lib/payments/divinitycoin";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";
import { getWhopClient } from "@/lib/payments/whop";
import { notifyRefundRequestDecision } from "@/lib/notifications/pledge-notifications";

const refundRequestLogger = logger.child({ module: "creator-refund-request" });

export const dynamic = "force-dynamic";

// PATCH /api/creator/refund-requests/[requestId]
// Body: { action: "approve" | "deny", creatorNote?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await req.json();
    const { action, creatorNote } = body as { action: "approve" | "deny"; creatorNote?: string };

    if (!["approve", "deny"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch the refund request with pledge and project
    const refundRequest = await db.refundRequest.findUnique({
      where: { id: requestId },
      include: {
        project: {
          select: {
            id: true,
            creatorId: true,
            title: true,
            paymentProcessor: true,
          },
        },
        pledge: {
          select: {
            id: true,
            amount: true,
            status: true,
            paymentProcessor: true,
            stripePaymentIntentId: true,
            divinityCoinPaymentId: true,
            paypalOrderId: true,
            paypalAuthorizationId: true,
            chargedImmediately: true,
            whopPaymentId: true,
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!refundRequest) {
      return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
    }

    // Verify the requester is the project creator or an accepted collaborator
    const isOwner = refundRequest.project.creatorId === session.user.id;
    if (!isOwner) {
      const collab = await db.projectCollaborator.findFirst({
        where: { projectId: refundRequest.projectId, userId: session.user.id, status: "ACCEPTED" },
      });
      if (!collab) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    if (refundRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request has already been ${refundRequest.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    if (action === "deny") {
      await db.refundRequest.update({
        where: { id: requestId },
        data: {
          status: "DENIED",
          creatorNote: creatorNote || null,
          processedAt: new Date(),
        },
      });

      // Fire-and-forget notification to backer
      notifyRefundRequestDecision(refundRequest.pledge.id, "denied", creatorNote || null).catch(() => {});

      return NextResponse.json({ success: true, message: "Refund request denied." });
    }

    // action === "approve" — process the actual refund
    const pledge = refundRequest.pledge;
    const processor = pledge.paymentProcessor;

    if (pledge.status === "REFUNDED") {
      // Already refunded — just mark the request approved
      await db.refundRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", creatorNote: creatorNote || null, processedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: "Refund request approved (pledge was already refunded)." });
    }

    if (pledge.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "This pledge is not in a refundable state." },
        { status: 400 }
      );
    }

    // Process the refund per processor
    try {
      if (processor === "STRIPE") {
        if (!pledge.stripePaymentIntentId) {
          return NextResponse.json({ error: "No Stripe payment found to refund." }, { status: 400 });
        }
        const stripe = await getStripeInstance();
        await stripe.refunds.create({
          payment_intent: pledge.stripePaymentIntentId,
          reason: "requested_by_customer",
          metadata: {
            pledgeId: pledge.id,
            approvedBy: session.user.id,
            refundRequestId: requestId,
            reason: refundRequest.reason,
          },
        });
      } else if (processor === "DIVINITYCOIN") {
        const dcResult = await callDivinityCoinAPI("refund", {
          pledgeId: pledge.id,
          paymentId: pledge.divinityCoinPaymentId,
          amount: Math.round(Number(pledge.amount) * 100),
          reason: refundRequest.reason,
          requestedBy: "creator",
        });
        if (!dcResult.success) {
          return NextResponse.json({ error: dcResult.error || "DivinityCoin refund failed." }, { status: 400 });
        }
      } else if (processor === "PAYPAL") {
        const ppConfig = await getPayPalConfig();
        const ppToken = await getPayPalAccessToken();

        if (pledge.paypalAuthorizationId && !pledge.chargedImmediately) {
          // Void authorization (not yet captured)
          const voidRes = await fetch(
            `${ppConfig.baseUrl}/v2/payments/authorizations/${pledge.paypalAuthorizationId}/void`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ppToken}`,
                "Content-Type": "application/json",
                "PayPal-Request-Id": `void_creator_${pledge.id}`,
              },
            }
          );
          if (!voidRes.ok && voidRes.status !== 422) {
            const errBody = await voidRes.text();
            refundRequestLogger.error({ pledgeId: pledge.id, err: errBody }, "PayPal void failed");
            return NextResponse.json({ error: "Failed to void PayPal authorization." }, { status: 502 });
          }
        } else if (pledge.paypalOrderId) {
          const orderRes = await fetch(`${ppConfig.baseUrl}/v2/checkout/orders/${pledge.paypalOrderId}`, {
            headers: { Authorization: `Bearer ${ppToken}` },
          });
          if (!orderRes.ok) {
            return NextResponse.json({ error: "Failed to fetch PayPal order." }, { status: 502 });
          }
          const orderData = await orderRes.json();
          const captureId = orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id as string | undefined;
          if (!captureId) {
            return NextResponse.json({ error: "PayPal capture not found." }, { status: 400 });
          }
          const refundRes = await fetch(`${ppConfig.baseUrl}/v2/payments/captures/${captureId}/refund`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ppToken}`,
              "Content-Type": "application/json",
              "PayPal-Request-Id": `refund_creator_${pledge.id}`,
            },
            body: JSON.stringify({ note_to_payer: refundRequest.reason }),
          });
          if (!refundRes.ok) {
            const errBody = await refundRes.text();
            refundRequestLogger.error({ pledgeId: pledge.id, err: errBody }, "PayPal refund failed");
            return NextResponse.json({ error: "Failed to process PayPal refund." }, { status: 502 });
          }
        } else {
          return NextResponse.json({ error: "No PayPal payment found to refund." }, { status: 400 });
        }
      } else if (processor === "WHOP") {
        if (!pledge.whopPaymentId) {
          return NextResponse.json(
            { error: "Whop payment ID not available. Please process the refund manually in your Whop dashboard." },
            { status: 400 }
          );
        }
        const whopClient = await getWhopClient();
        await whopClient.payments.refund(pledge.whopPaymentId);
      }
    } catch (refundError) {
      refundRequestLogger.error({ err: String(refundError), pledgeId: pledge.id }, "Refund processing error");
      return NextResponse.json({ error: "Failed to process refund. Please try again." }, { status: 500 });
    }

    // Update DB atomically
    await db.$transaction([
      db.pledge.update({
        where: { id: pledge.id },
        data: { status: "REFUNDED", lastFailureReason: `Refund approved by creator: ${refundRequest.reason}` },
      }),
      db.project.update({
        where: { id: refundRequest.projectId },
        data: {
          backerCount: { decrement: 1 },
          currentAmount: { decrement: pledge.amount },
        },
      }),
      db.refundRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", creatorNote: creatorNote || null, processedAt: new Date() },
      }),
    ]);

    // Fire-and-forget notification to backer
    notifyRefundRequestDecision(pledge.id, "approved", creatorNote || null).catch(() => {});

    refundRequestLogger.info({ requestId, pledgeId: pledge.id }, "Refund request approved and processed");
    return NextResponse.json({ success: true, message: "Refund approved and processed successfully." });
  } catch (error) {
    refundRequestLogger.error({ err: String(error) }, "Error processing refund request");
    return NextResponse.json({ error: "Failed to process refund request" }, { status: 500 });
  }
}
