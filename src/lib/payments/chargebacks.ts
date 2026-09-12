import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { reconcileStretchGoalsForPledge } from "@/lib/rewards/stretch-goals";

const chargebackLogger = logger.child({ module: "chargebacks" });

/**
 * A backer disputed a charge. Stop the order if nothing has shipped yet.
 *
 * The Pledge status enum has always carried CHARGEBACK, the admin transaction
 * views filter on it, and the chargeback-ban cron's comment says it is "applied
 * by the payment-processor dispute webhook handler" — but no handler ever set
 * it. A disputed pledge stayed COMPLETED, which means it kept counting toward
 * the campaign total, kept holding its reward slot, kept appearing in
 * fulfillment queues and kept receiving surveys. A creator could pack and ship
 * goods for money that was already being clawed back.
 *
 * The status change is the cancellation. Every fulfillment path in this
 * codebase filters on `status: "COMPLETED"` — surveys, the IndieKit lists,
 * digital distribution, the fulfillment pushes — so moving the pledge to
 * CHARGEBACK removes it from all of them at once. That is deliberately
 * preferred over setting a flag each of those paths would have to learn.
 *
 * What is NOT done: a shipped order is not un-shipped. The goods are gone, and
 * pretending otherwise would leave the creator's inventory wrong. Those are
 * marked CHARGEBACK and reported as already fulfilled so an admin can see the
 * loss is real.
 */

/** Pledges a chargeback can act on. Anything else has already been unwound. */
const DISPUTABLE_STATUSES = ["COMPLETED", "PENDING"] as const;

/** Fulfillment states where the goods have not left the creator's hands. */
const UNSHIPPED = ["NOT_STARTED", "IN_PROGRESS"] as const;

export interface ChargebackResult {
  pledgeId: string;
  /** False when the pledge was already disputed, refunded, or gone. */
  applied: boolean;
  /** True when the order was stopped before anything shipped. */
  orderStopped: boolean;
  /** True when goods had already gone out — the loss is real. */
  alreadyShipped: boolean;
  message: string;
}

export async function applyChargeback(params: {
  pledgeId: string;
  /** Which processor reported it, for the audit trail. */
  processor: string;
  /** The processor's dispute id, when it sends one. */
  disputeId?: string;
  /** The processor's stated reason ("fraudulent", "product_not_received"). */
  reason?: string;
}): Promise<ChargebackResult> {
  const { pledgeId, processor, disputeId, reason } = params;

  const pledge = await db.pledge.findFirst({
    where: { id: pledgeId, deletedAt: null },
    select: {
      id: true,
      status: true,
      userId: true,
      projectId: true,
      amount: true,
      rewardId: true,
      confirmationEmailSent: true,
      fulfillmentStatus: true,
      trackingNumber: true,
    },
  });

  if (!pledge) {
    return {
      pledgeId,
      applied: false,
      orderStopped: false,
      alreadyShipped: false,
      message: `Pledge ${pledgeId} not found`,
    };
  }

  if (pledge.status === "CHARGEBACK") {
    return {
      pledgeId,
      applied: false,
      orderStopped: false,
      alreadyShipped: false,
      message: "Pledge already marked as a chargeback",
    };
  }

  if (!(DISPUTABLE_STATUSES as readonly string[]).includes(pledge.status)) {
    // REFUNDED, CANCELLED or FAILED: the money is already back or was never
    // taken, and the unwind has run. Re-running it would double-decrement.
    return {
      pledgeId,
      applied: false,
      orderStopped: false,
      alreadyShipped: false,
      message: `Pledge is ${pledge.status}; nothing to stop`,
    };
  }

  const wasCounted = pledge.confirmationEmailSent && pledge.status === "COMPLETED";
  const alreadyShipped = !(UNSHIPPED as readonly string[]).includes(
    pledge.fulfillmentStatus
  );

  // CAS, matching the refund and cancel paths. A dispute webhook is retried,
  // and two deliveries that both passed the status check above would each
  // decrement the campaign total and the reward slot.
  const cas = await db.pledge.updateMany({
    where: {
      id: pledgeId,
      status: { in: [...DISPUTABLE_STATUSES] as ("COMPLETED")[] },
      deletedAt: null,
    },
    data: {
      status: "CHARGEBACK",
      lastFailureReason: `Chargeback via ${processor}${reason ? `: ${reason}` : ""}`,
    },
  });

  if (cas.count === 0) {
    return {
      pledgeId,
      applied: false,
      orderStopped: false,
      alreadyShipped,
      message: "Pledge was already updated by a concurrent delivery",
    };
  }

  // Only the delivery that actually flipped the status touches the counters.
  if (wasCounted) {
    await db.project.update({
      where: { id: pledge.projectId },
      data: {
        backerCount: { decrement: 1 },
        currentAmount: { decrement: Number(pledge.amount) },
      },
    });

    // Release the reward slot so another backer can take it. Guarded by
    // wasCounted for the same reason the cancel route guards it: an
    // unconfirmed pledge never claimed the slot in the first place.
    //
    // NOT released once the order has shipped. The copy physically left the
    // building — the creator is out the item as well as the money — so handing
    // the slot back would let a second backer buy inventory that no longer
    // exists and turn one loss into two.
    if (pledge.rewardId && !alreadyShipped) {
      await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.rewardId}`;
    }
  }

  // A disputed pledge is no longer a qualifying one, so any granted stretch
  // goals come back off. Non-fatal: the cron sweep is the backstop.
  try {
    await reconcileStretchGoalsForPledge(pledgeId);
  } catch (err) {
    chargebackLogger.error(
      { err: String(err), pledgeId },
      "Failed to revoke stretch goals after chargeback"
    );
  }

  chargebackLogger.warn(
    {
      pledgeId,
      processor,
      disputeId,
      reason,
      amount: Number(pledge.amount),
      projectId: pledge.projectId,
      userId: pledge.userId,
      alreadyShipped,
      trackingNumber: pledge.trackingNumber ?? null,
    },
    alreadyShipped
      ? "Chargeback on an order that already shipped — goods are gone"
      : "Chargeback applied; order stopped before fulfillment"
  );

  return {
    pledgeId,
    applied: true,
    orderStopped: !alreadyShipped,
    alreadyShipped,
    message: alreadyShipped
      ? "Pledge marked as a chargeback. It had already shipped, so fulfillment was not reversed."
      : "Pledge marked as a chargeback and removed from fulfillment before shipping.",
  };
}

/**
 * Resolve a pledge from whatever identifier a processor happens to send.
 *
 * Dispute payloads rarely carry our pledge id — they carry the payment intent
 * or the processor's own charge id, because a dispute is raised against a
 * charge, not against an order. Each of these columns is unique, so the first
 * hit is the answer.
 */
export async function findPledgeForDispute(params: {
  pledgeId?: string;
  paymentIntentId?: string;
  paymentId?: string;
}): Promise<string | null> {
  const { pledgeId, paymentIntentId, paymentId } = params;
  if (pledgeId) return pledgeId;

  const candidates = [paymentIntentId, paymentId].filter(Boolean) as string[];
  if (candidates.length === 0) return null;

  const pledge = await db.pledge.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { stripePaymentIntentId: { in: candidates } },
        { divinityCoinPaymentId: { in: candidates } },
        { whopPaymentId: { in: candidates } },
      ],
    },
    select: { id: true },
  });
  return pledge?.id ?? null;
}
