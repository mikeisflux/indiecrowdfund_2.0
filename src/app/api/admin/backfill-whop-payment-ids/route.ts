import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getWhopConfig } from "@/lib/payments/whop";
import Whop from "@whop/sdk";

const backfillLogger = logger.child({ module: "admin-backfill-whop-payment-ids" });

export const dynamic = "force-dynamic";

// POST /api/admin/backfill-whop-payment-ids
//
// Backfills whopPaymentId on existing Pledge rows where the
// payment_succeeded webhook short-circuited before stamping it.
// The old webhook logic was:
//
//   if (!pledge || pledge.status === "COMPLETED") break;
//
// Any pledge whose /api/whop/confirm/[pledgeId] browser-confirm
// flipped status to COMPLETED before the webhook arrived ended
// up with whopPaymentId = NULL forever -- so refund / dispute /
// reconciliation lookups against the payment id couldn't find
// our pledge row. Webhook is now fixed going forward; this route
// repairs the historical rows.
//
// What it does:
//   1. Loads every Whop pledge with whopPaymentId IS NULL and
//      whopCheckoutId IS NOT NULL.
//   2. For each, queries Whop's payments.list filtered by the
//      checkout config id, finds the paid/succeeded payment, and
//      stamps its id onto the pledge.
//   3. Logs and counts updated / unchanged / not-found / errored.
//
// Auth: SUPER_ADMIN only.
//
// Body (optional):
//   { projectId?: string }   -- scope to one project
//   { dryRun?: boolean }     -- preview without writing
//   { limit?: number }       -- cap how many pledges to process
//                                (default 500, max 5000)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: string; dryRun?: boolean; limit?: number } = {};
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {}

  const dryRun = body.dryRun === true;
  const limit = Math.max(1, Math.min(5000, body.limit ?? 500));

  try {
    const where: Record<string, unknown> = {
      paymentProcessor: "WHOP",
      whopPaymentId: null,
      whopCheckoutId: { not: null },
      deletedAt: null,
    };
    if (body.projectId) where.projectId = body.projectId;

    const pledges = await db.pledge.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        whopCheckoutId: true,
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (pledges.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No pledges to backfill",
        pledgesScanned: 0,
        updated: 0,
        notFound: 0,
        errored: 0,
        dryRun,
      });
    }

    const config = await getWhopConfig();
    const client = new Whop({ apiKey: config.apiKey });

    // Walk the full payments list once and index by checkout config
    // id -- cheaper than calling payments.list per pledge when the
    // backfill is for many rows. Look back 180 days (covers all live
    // Whop campaigns plus a buffer).
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    type WhopPayment = {
      id?: string;
      status?: string;
      checkout_configuration_id?: string;
    };
    const indexByCheckout = new Map<string, string>();
    const iter = await client.payments.list({
      company_id: config.companyId,
      first: 100,
      created_after: since.toISOString(),
    });
    let walked = 0;
    for await (const raw of iter) {
      const p = raw as unknown as WhopPayment;
      if (
        p.id &&
        p.checkout_configuration_id &&
        (p.status === "paid" || p.status === "succeeded") &&
        !indexByCheckout.has(p.checkout_configuration_id)
      ) {
        indexByCheckout.set(p.checkout_configuration_id, p.id);
      }
      walked += 1;
      if (walked >= 5000) break;
    }

    let updated = 0;
    let notFound = 0;
    let errored = 0;
    const sample: Array<{
      pledgeId: string;
      whopCheckoutId: string;
      whopPaymentId?: string;
      result: "updated" | "would-update" | "not-found" | "errored";
    }> = [];

    for (const p of pledges) {
      const checkoutId = p.whopCheckoutId as string;
      const paymentId = indexByCheckout.get(checkoutId);
      if (!paymentId) {
        notFound += 1;
        sample.push({ pledgeId: p.id, whopCheckoutId: checkoutId, result: "not-found" });
        continue;
      }
      if (dryRun) {
        sample.push({
          pledgeId: p.id,
          whopCheckoutId: checkoutId,
          whopPaymentId: paymentId,
          result: "would-update",
        });
        continue;
      }
      try {
        const res = await db.pledge.updateMany({
          where: { id: p.id, whopPaymentId: null },
          data: { whopPaymentId: paymentId },
        });
        if (res.count > 0) {
          updated += 1;
          sample.push({
            pledgeId: p.id,
            whopCheckoutId: checkoutId,
            whopPaymentId: paymentId,
            result: "updated",
          });
        }
      } catch (err) {
        errored += 1;
        backfillLogger.error(
          { err: formatError(err), pledgeId: p.id, checkoutId },
          "Failed to stamp whopPaymentId"
        );
        sample.push({ pledgeId: p.id, whopCheckoutId: checkoutId, result: "errored" });
      }
    }

    backfillLogger.info(
      { pledgesScanned: pledges.length, updated, notFound, errored, dryRun },
      "Whop payment id backfill complete"
    );

    return NextResponse.json({
      ok: true,
      pledgesScanned: pledges.length,
      whopPaymentsIndexed: indexByCheckout.size,
      updated,
      notFound,
      errored,
      dryRun,
      sample: sample.slice(0, 50),
    });
  } catch (error) {
    backfillLogger.error({ err: formatError(error) }, "Backfill failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}
