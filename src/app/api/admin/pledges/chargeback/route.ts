import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-helpers";
import { applyChargeback, findPledgeForDispute } from "@/lib/payments/chargebacks";

const adminChargebackLogger = logger.child({ module: "admin-chargeback" });

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/pledges/chargeback
 *
 * Record a chargeback by hand and stop the order if nothing has shipped.
 *
 * The webhook path is the intended one, but DivinityCoin does not send a
 * dispute event yet — their published event list has no such event — so today
 * a dispute is discovered by a human looking at Stripe. Without this, the only
 * way to stop the order is a hand-written UPDATE against production, which
 * would skip the reward-slot release, the campaign-total decrement and the
 * stretch-goal revoke that a chargeback has to carry with it.
 *
 * Accepts the pledge id, or the payment intent from the dispute row, since
 * that is what a dispute in Stripe actually shows you.
 */
const bodySchema = z
  .object({
    pledgeId: z.string().min(1).optional(),
    paymentIntentId: z.string().min(1).optional(),
    processor: z.string().min(1).max(40).default("Manual"),
    disputeId: z.string().max(200).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((b) => b.pledgeId || b.paymentIntentId, {
    message: "Provide pledgeId or paymentIntentId",
  });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await req.json());

    const pledgeId = await findPledgeForDispute({
      pledgeId: body.pledgeId,
      paymentIntentId: body.paymentIntentId,
      paymentId: body.paymentIntentId,
    });

    if (!pledgeId) {
      return NextResponse.json(
        { error: "No pledge found for that id or payment intent" },
        { status: 404 }
      );
    }

    const result = await applyChargeback({
      pledgeId,
      processor: body.processor,
      disputeId: body.disputeId,
      reason: body.reason,
    });

    adminChargebackLogger.warn(
      { adminId: session.user.id, ...result },
      "Chargeback applied by admin"
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    adminChargebackLogger.error({ err: formatError(error) }, "Chargeback failed");
    return NextResponse.json({ error: "Failed to apply chargeback" }, { status: 500 });
  }
}
