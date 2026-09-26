import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyDcPayment, handlePaymentSucceeded } from "@/lib/payments/divinitycoin";
import { notifyBackerPledgeConfirmed } from "@/lib/notifications";

const log = logger.child({ module: "admin-recover-dc" });

export const dynamic = "force-dynamic";

/**
 * Guarantee the backer has a confirmation email — force-sending past the
 * creator's "send receipts" toggle if no confirmation was ever delivered.
 * notifyBackerPledgeConfirmed dedups on EmailLog, so this is safe to call
 * even when the commit path already sent one. Returns whether a receipt
 * is now on record.
 */
async function ensureReceipt(pledgeId: string): Promise<boolean> {
  await notifyBackerPledgeConfirmed(pledgeId, true, true).catch((err) =>
    log.error({ pledgeId, err: String(err) }, "[recover-dc] forced receipt send failed")
  );
  const logRow = await db.emailLog.findFirst({
    where: { pledgeId, type: "PLEDGE_CONFIRMATION" },
    select: { id: true },
  });
  return !!logRow;
}

/**
 * POST /api/admin/pledges/recover-dc  (SUPER_ADMIN only)
 *
 * Recovers a DivinityCoin payment that succeeded at the gateway but has
 * no pledge on our side — e.g. a hosted-checkout / Klarna redirect that
 * never loaded the return page, whose PENDING pledge was then swept by
 * the abandoned-cart cleanup before the webhook or reconcile cron could
 * commit it. (The cleanup hole itself is fixed in the pledges route; this
 * endpoint makes already-stranded backers whole and is the tool for any
 * future one that slips through.)
 *
 * It recreates the pledge and runs the SAME commit path the payment
 * webhook uses (handlePaymentSucceeded): flips it COMPLETED, writes the
 * PAYMENT transaction, bumps currentAmount + backerCount, claims reward /
 * addon slots, assigns a backer number, and sends the receipt.
 *
 * Safety:
 *  - SUPER_ADMIN only.
 *  - Idempotent: if a pledge already carries this paymentIntentId, it is
 *    returned untouched (no duplicate, no double count).
 *  - Verifies the payment actually succeeded at DC before creating a
 *    COMPLETED pledge. If DC's API can't resolve the raw intent id, the
 *    call is refused unless `force: true` is passed (use only when the
 *    Divinity Payments dashboard plainly shows the charge succeeded).
 *  - Refuses on an amount mismatch between the reward + shipping + addons
 *    and the amount confirmed at the gateway.
 */
export async function POST(req: NextRequest) {
  try {
    // Two ways in: a logged-in SUPER_ADMIN (for a future admin-UI button)
    // or the CRON_SECRET bearer, so this can be run from the server
    // terminal like the crons are (a plain curl to /api/admin has no
    // session cookie and the proxy 401s it). The proxy opens this one
    // path for the bearer case; the check here is the real gate.
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const hasBearer = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!hasBearer) {
      const session = await auth();
      if (session?.user?.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const {
      paymentIntentId,
      userEmail,
      projectSlug,
      rewardId,
      shippingAmount = 0,
      addons = [],
      expectedAmount,
      force = false,
    }: {
      paymentIntentId?: string;
      userEmail?: string;
      projectSlug?: string;
      rewardId?: string;
      shippingAmount?: number;
      addons?: Array<{ id: string; quantity: number }>;
      expectedAmount?: number;
      force?: boolean;
    } = body;

    if (!paymentIntentId || !userEmail || !projectSlug) {
      return NextResponse.json(
        { error: "paymentIntentId, userEmail and projectSlug are required" },
        { status: 400 }
      );
    }

    // Idempotency: never create a second pledge for a payment we already hold.
    const existing = await db.pledge.findFirst({
      where: { divinityCoinPaymentId: paymentIntentId },
      select: { id: true, status: true },
    });
    if (existing) {
      // Pledge already recovered — but make sure the backer actually got a
      // confirmation email (the first recovery may have run before the
      // forced-receipt fix, or been gated by the creator's receipts toggle).
      const receiptSent = await ensureReceipt(existing.id);
      return NextResponse.json({
        ok: true,
        alreadyRecovered: true,
        pledgeId: existing.id,
        status: existing.status,
        receiptSent,
        message: receiptSent
          ? "Pledge already recovered; confirmation email is on record."
          : "Pledge already recovered, but the confirmation email could not be sent — check email settings/logs.",
      });
    }

    const user = await db.user.findFirst({
      where: { email: { equals: userEmail, mode: "insensitive" }, deletedAt: null },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: `No user with email ${userEmail}` }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: { slug: projectSlug, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!project) {
      return NextResponse.json({ error: `No project with slug ${projectSlug}` }, { status: 404 });
    }

    // Resolve reward + compute the expected total.
    let rewardAmount = 0;
    let resolvedRewardId: string | null = null;
    if (rewardId && rewardId !== "no-reward") {
      const reward = await db.reward.findFirst({
        where: { id: rewardId, projectId: project.id },
        select: { id: true, amount: true },
      });
      if (!reward) {
        return NextResponse.json(
          { error: `Reward ${rewardId} not found on project ${projectSlug}` },
          { status: 404 }
        );
      }
      resolvedRewardId = reward.id;
      rewardAmount = Number(reward.amount);
    }

    let addonsAmount = 0;
    const addonList = Array.isArray(addons) ? addons : [];
    if (addonList.length > 0) {
      const addonRecords = await db.reward.findMany({
        where: { id: { in: addonList.map((a) => a.id) }, projectId: project.id, type: "ADDON" },
        select: { id: true, amount: true },
      });
      const priceMap = new Map(addonRecords.map((a) => [a.id, Number(a.amount)]));
      addonsAmount = addonList.reduce((sum, a) => sum + (priceMap.get(a.id) || 0) * a.quantity, 0);
    }

    const shipping = Number(shippingAmount) || 0;
    const total = rewardAmount + addonsAmount + shipping;

    // Verify the money really moved at DC before creating a COMPLETED pledge.
    const verify = await verifyDcPayment(paymentIntentId);
    let verifiedAmount: number | undefined;
    if (verify.success && verify.status === "succeeded") {
      verifiedAmount = verify.amount;
    } else if (!force) {
      return NextResponse.json(
        {
          error:
            "Could not verify this payment as succeeded at DivinityCoin. If the dashboard clearly shows it succeeded, re-run with force: true.",
          verify,
        },
        { status: 409 }
      );
    }

    // Amount guard. Compare our computed total against whatever authoritative
    // figure we have (the caller's expectedAmount and/or DC's verified amount).
    const target = typeof expectedAmount === "number" ? expectedAmount : verifiedAmount;
    if (typeof target === "number" && Math.abs(target - total) > 0.01) {
      return NextResponse.json(
        {
          error: `Amount mismatch: reward ($${rewardAmount}) + shipping ($${shipping}) + add-ons ($${addonsAmount}) = $${total.toFixed(2)}, but the payment was $${target.toFixed(2)}. Fix the reward/shipping/add-on inputs so they sum to the charged amount.`,
        },
        { status: 400 }
      );
    }

    // Best-effort shipping address from the user's saved default.
    const savedAddr = await db.userAddress.findFirst({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    const shippingAddress = savedAddr
      ? {
          fullName: savedAddr.fullName,
          line1: savedAddr.line1,
          line2: savedAddr.line2 || undefined,
          city: savedAddr.city,
          state: savedAddr.state,
          postalCode: savedAddr.postalCode,
          country: savedAddr.country,
        }
      : undefined;

    // Create the pledge PENDING with the payment reference, then run the
    // exact webhook commit path so all bookkeeping matches a normal pledge.
    const pledge = await db.pledge.create({
      data: {
        userId: user.id,
        projectId: project.id,
        rewardId: resolvedRewardId,
        amount: total,
        rewardAmount,
        addonsAmount,
        shippingAmount: shipping,
        status: "PENDING",
        paymentProcessor: "DIVINITYCOIN",
        chargedImmediately: true,
        divinityCoinPaymentId: paymentIntentId,
        shippingAddress: shippingAddress
          ? (shippingAddress as unknown as Record<string, unknown>)
          : undefined,
      },
    });

    if (addonList.length > 0) {
      const addonRecords = await db.reward.findMany({
        where: { id: { in: addonList.map((a) => a.id) }, projectId: project.id, type: "ADDON" },
        select: { id: true, amount: true },
      });
      const priceMap = new Map(addonRecords.map((a) => [a.id, Number(a.amount)]));
      await db.pledgeAddon.createMany({
        data: addonList.map((a) => ({
          pledgeId: pledge.id,
          addonId: a.id,
          quantity: a.quantity,
          amount: (priceMap.get(a.id) || 0) * a.quantity,
        })),
      });
    }

    log.info(
      { pledgeId: pledge.id, paymentIntentId, userEmail: user.email, total },
      "[recover-dc] created pledge, running commit"
    );

    const commit = await handlePaymentSucceeded({
      pledgeId: pledge.id,
      paymentIntentId,
    } as Parameters<typeof handlePaymentSucceeded>[0]);

    if (!commit.success) {
      log.error({ pledgeId: pledge.id, commit }, "[recover-dc] commit failed");
      return NextResponse.json(
        { error: `Pledge created (${pledge.id}) but commit failed: ${commit.error}. Investigate before retrying.` },
        { status: 500 }
      );
    }

    // Guarantee the confirmation email regardless of the campaign's
    // receipts toggle — this backer got no confirmation at checkout.
    const receiptSent = await ensureReceipt(pledge.id);

    return NextResponse.json({
      ok: true,
      recovered: true,
      pledgeId: pledge.id,
      backer: user.email,
      project: project.title,
      amount: total,
      paymentIntentId,
      receiptSent,
      message: `Recovered $${total.toFixed(2)} pledge for ${user.email} on ${project.title}.${receiptSent ? " Confirmation email sent." : " NOTE: confirmation email could not be sent — check email settings/logs."}`,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "[recover-dc] error");
    return NextResponse.json({ error: "Recovery failed — see logs" }, { status: 500 });
  }
}
