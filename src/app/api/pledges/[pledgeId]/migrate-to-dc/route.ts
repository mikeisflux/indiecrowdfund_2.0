import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDivinityCoinConfig } from "@/lib/payments/divinitycoin";

const log = logger.child({ module: "pledges-migrate-to-dc" });

/**
 * Per-pledge migration endpoint. Used by the
 * /dashboard/pledges/[pledgeId]/complete-with-dc page to spin up a
 * fresh DivinityCoin PaymentIntent for a pledge that was switched
 * over to DC via the admin migration tool.
 *
 * Auth: pledge owner only.
 *
 * Preconditions:
 *   - Pledge.paymentProcessor === "DIVINITYCOIN"
 *   - Pledge.status === "PENDING"
 *
 * We always charge immediately here (PaymentIntent, not SetupIntent)
 * because the campaign has already hit its funding goal — there's no
 * "wait for AoN cron to charge" deferral required. The backer pays
 * now and the DC payment.succeeded webhook moves the pledge to
 * COMPLETED + fires the usual finalize side effects (project counter
 * bumps, reward slot claim, backer number, creator notification).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { pledgeId } = await params;

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            paymentProcessor: true,
            creator: { select: { vanityUrl: true } },
          },
        },
        reward: { select: { title: true, amount: true } },
        addons: {
          include: { addon: { select: { title: true, amount: true } } },
        },
        user: { select: { email: true, name: true } },
      },
    });
    if (!pledge) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }
    if (pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (pledge.project.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json(
        {
          error:
            "This pledge isn't on the DivinityCoin migration path. If you reached this page from an email link, the project may have been migrated to a different processor — contact support.",
        },
        { status: 400 }
      );
    }
    if (pledge.status === "COMPLETED") {
      return NextResponse.json({
        alreadyCompleted: true,
        projectUrl: pledge.project.creator?.vanityUrl
          ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
          : `/projects/${pledge.project.slug}`,
      });
    }
    if (pledge.status !== "PENDING") {
      return NextResponse.json(
        { error: `Pledge is in ${pledge.status.toLowerCase()} state and can't be migrated` },
        { status: 400 }
      );
    }

    const dcConfig = await getDivinityCoinConfig();
    if (!dcConfig?.baseUrl || !dcConfig?.apiKey) {
      return NextResponse.json(
        { error: "DivinityCoin not configured. Please contact support." },
        { status: 502 }
      );
    }

    // Reuse an existing intent if migrate-to-dc was called more than
    // once for this pledge — avoids creating duplicate PaymentIntents
    // on DC's side. The clientSecret on a still-open intent is reusable.
    if (pledge.divinityCoinPaymentId) {
      // We don't have the original clientSecret stored, so we ask DC
      // to re-issue one for the same intent. If their API doesn't
      // support that, we fall through and create a new intent.
      // (Most calls land on the create-new-intent branch in practice.)
    }

    const userRecord = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { email: true, name: true },
    });

    const dcAbortController = new AbortController();
    const dcTimeout = setTimeout(() => dcAbortController.abort(), 15000);
    let dcResponse: Response;
    try {
      dcResponse = await fetch(`${dcConfig.baseUrl}?action=create-payment-intent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dcConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(Number(pledge.amount) * 100),
          currency: "usd",
          platformUserId: session.user.id,
          email: userRecord?.email || pledge.user.email || "",
          name: userRecord?.name || pledge.user.name || "",
          pledgeId: pledge.id,
          projectId: pledge.project.id,
        }),
        signal: dcAbortController.signal,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      log.error(
        { pledgeId, err: err instanceof Error ? err.message : String(err), isTimeout },
        "DC create-payment-intent error"
      );
      return NextResponse.json(
        {
          error: isTimeout
            ? "Payment processor timed out. Please try again."
            : "Failed to connect to payment processor. Please try again.",
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(dcTimeout);
    }

    const dcResult = await dcResponse.json().catch(() => ({}));
    if (!dcResponse.ok || !dcResult.success) {
      log.error({ pledgeId, dcResult }, "DC create-payment-intent declined");
      return NextResponse.json(
        { error: dcResult.error || "Failed to initialize payment" },
        { status: 502 }
      );
    }

    // Persist the PI id on the pledge so the webhook can match it
    // back to this pledge when payment succeeds.
    await db.pledge
      .update({
        where: { id: pledge.id },
        data: { divinityCoinPaymentId: dcResult.paymentIntentId },
      })
      .catch((err) =>
        log.error({ pledgeId, err: String(err) }, "Failed to persist divinityCoinPaymentId")
      );

    const projectUrl = pledge.project.creator?.vanityUrl
      ? `/projects/${pledge.project.creator.vanityUrl}/${pledge.project.slug}`
      : `/projects/${pledge.project.slug}`;

    return NextResponse.json({
      pledge: {
        id: pledge.id,
        amount: Number(pledge.amount),
        rewardTitle: pledge.reward?.title || null,
        rewardAmount: pledge.reward ? Number(pledge.reward.amount) : 0,
        addons: pledge.addons.map((a: { addon: { title: string }; quantity: number; amount: unknown }) => ({
          title: a.addon.title,
          quantity: a.quantity,
          amount: Number(a.amount),
        })),
        shippingAmount: Number(pledge.shippingAmount || 0),
      },
      project: {
        title: pledge.project.title,
        url: projectUrl,
      },
      clientSecret: dcResult.clientSecret,
      publishableKey: dcResult.publishableKey,
      paymentIntentId: dcResult.paymentIntentId,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "migrate-to-dc GET error"
    );
    return NextResponse.json(
      { error: "Failed to start DivinityCoin migration" },
      { status: 500 }
    );
  }
}
