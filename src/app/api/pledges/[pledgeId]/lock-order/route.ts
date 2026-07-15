import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { z } from "zod";
import { chargeDcSavedPaymentMethod, handlePaymentSucceeded } from "@/lib/payments/divinitycoin";

const log = logger.child({ module: "backer-lock-order" });

export const dynamic = "force-dynamic";

const addressSchema = z
  .object({
    fullName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    region: z.string().optional(),
    postalCode: z.string().min(1),
    country: z.string().min(1),
    phone: z.string().optional(),
  })
  .passthrough();

const postSchema = z.object({
  action: z.enum(["approve", "decline"]),
  shippingAddress: addressSchema.optional(),
});

async function loadOwnedPledge(pledgeId: string, userId: string) {
  const pledge = await db.pledge.findUnique({
    where: { id: pledgeId },
    include: {
      project: { select: { id: true, title: true, paymentProcessor: true, slug: true } },
      reward: { select: { title: true, amount: true } },
      addons: { include: { addon: { select: { title: true } } } },
    },
  });
  if (!pledge || pledge.deletedAt) return { error: "Pledge not found", status: 404 as const };
  if (pledge.userId !== userId) return { error: "Access denied", status: 403 as const };
  return { pledge };
}

// GET — order summary for the approval page.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ pledgeId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { pledgeId } = await params;

    const res = await loadOwnedPledge(pledgeId, session.user.id);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const { pledge } = res;

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: Number(pledge.amount),
        currency: "USD",
        lockStatus: pledge.orderLockStatus,
        lockedAt: pledge.orderLockedAt,
        alreadyPaid: pledge.status === "COMPLETED",
        shippingAddress: pledge.shippingAddress ?? null,
        reward: pledge.reward ? { title: pledge.reward.title, amount: Number(pledge.reward.amount) } : null,
        addons: pledge.addons.map((a: (typeof pledge.addons)[number]) => ({ title: a.addon?.title || "Add-on", quantity: a.quantity, amount: Number(a.amount) })),
      },
      project: { id: pledge.project.id, title: pledge.project.title, slug: pledge.project.slug },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "lock-order GET failed");
    return NextResponse.json({ error: "Failed to load order" }, { status: 500 });
  }
}

// POST — approve (confirm address + charge + lock) or decline.
export async function POST(req: NextRequest, { params }: { params: Promise<{ pledgeId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { pledgeId } = await params;
    const { action, shippingAddress } = postSchema.parse(await req.json());

    const res = await loadOwnedPledge(pledgeId, session.user.id);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const { pledge } = res;

    if (pledge.orderLockStatus === "LOCKED") {
      return NextResponse.json({ error: "This order is already locked.", alreadyLocked: true }, { status: 409 });
    }

    // ---- Decline ----
    if (action === "decline") {
      await db.pledge.update({
        where: { id: pledge.id },
        data: { orderLockStatus: "DECLINED", orderLockDeclinedAt: new Date() },
      });
      await db.fulfillmentActivity
        .create({
          data: { projectId: pledge.projectId, pledgeId: pledge.id, userId: session.user.id, type: "ORDER_LOCK_DECLINED", title: "Backer declined the order lock request" },
        })
        .catch(() => {});
      return NextResponse.json({ success: true, declined: true });
    }

    // ---- Approve ----
    if (!shippingAddress && !pledge.shippingAddress) {
      return NextResponse.json({ error: "A shipping address is required to lock your order." }, { status: 400 });
    }

    // Charge, per processor capability:
    //   - already COMPLETED  -> nothing to charge
    //   - DivinityCoin saved card -> off-session charge now
    //   - anything else -> freeze only; charged on the normal funding schedule
    let charged = pledge.status === "COMPLETED";
    let chargeNote = "";
    const processor = pledge.project.paymentProcessor || "STRIPE";

    if (!charged && processor === "DIVINITYCOIN" && pledge.divinityCoinPaymentMethodId) {
      // Atomic claim so we don't race the funded-campaign cron / double-charge.
      const claim = await db.pledge.updateMany({
        where: { id: pledge.id, status: "PENDING", chargedImmediately: false, divinityCoinPaymentId: null, deletedAt: null },
        data: { chargedImmediately: true },
      });
      if (claim.count === 1) {
        try {
          const charge = await chargeDcSavedPaymentMethod({
            platformUserId: pledge.userId,
            paymentMethodId: pledge.divinityCoinPaymentMethodId,
            amount: Math.round(Number(pledge.amount) * 100),
            currency: "usd",
            pledgeId: pledge.id,
            projectId: pledge.projectId,
            description: `Order lock — ${pledge.project.title}`,
          });
          if (charge.success && charge.status === "succeeded" && charge.paymentIntentId) {
            // Full completion: transaction row, stats, backer number, email.
            await handlePaymentSucceeded({
              pledgeId: pledge.id,
              paymentId: charge.paymentIntentId,
            } as Parameters<typeof handlePaymentSucceeded>[0]);
            charged = true;
          } else {
            // Roll the claim back so the cron can retry later.
            await db.pledge.updateMany({ where: { id: pledge.id }, data: { chargedImmediately: false } });
            return NextResponse.json(
              { error: charge.error || "Your card was declined. Please update your payment method and try again." },
              { status: 402 }
            );
          }
        } catch (chargeErr) {
          // On a thrown error the charge may or may not have landed — do NOT
          // mark failed; release the claim and let the cron reconcile.
          await db.pledge.updateMany({ where: { id: pledge.id }, data: { chargedImmediately: false } });
          log.error({ err: String(chargeErr), pledgeId: pledge.id }, "DC lock charge threw");
          return NextResponse.json({ error: "Payment could not be processed right now. Please try again shortly." }, { status: 502 });
        }
      } else {
        // Someone already claimed/charged it (or it just completed) — treat as paid.
        charged = true;
      }
    } else if (!charged) {
      chargeNote = "Your order is locked. Payment will be collected on the normal schedule for this campaign.";
    }

    // Freeze + confirm: save address, mark locked, and treat as survey-complete
    // so these backers flow into fulfillment and aren't re-surveyed.
    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        orderLockStatus: "LOCKED",
        orderLockedAt: new Date(),
        surveyCompleted: true,
        ...(shippingAddress ? { shippingAddress } : {}),
      },
    });

    await db.fulfillmentActivity
      .create({
        data: { projectId: pledge.projectId, pledgeId: pledge.id, userId: session.user.id, type: "ORDER_LOCK_APPROVED", title: charged ? "Backer locked & paid for their order" : "Backer locked their order" },
      })
      .catch(() => {});

    return NextResponse.json({ success: true, locked: true, charged, note: chargeNote || undefined });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.issues }, { status: 400 });
    }
    log.error({ err: formatError(error) }, "lock-order POST failed");
    return NextResponse.json({ error: "Failed to lock order" }, { status: 500 });
  }
}
