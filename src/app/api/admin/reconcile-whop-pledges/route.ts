import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getWhopConfig } from "@/lib/payments/whop";
import Whop from "@whop/sdk";

const whopReconLogger = logger.child({ module: "admin-reconcile-whop-pledges" });

export const dynamic = "force-dynamic";

// POST /api/admin/reconcile-whop-pledges
//
// Cross-references Whop's payment list against our Pledge table to
// find paid charges that never made it into our DB as a pledge --
// i.e. backers whose card was charged but who never got the
// confirmation, never appear under "Projects Backed," and whose
// reward slot was never claimed.
//
// Surfaces the gap so we can either reconcile by hand or, later,
// auto-create the Pledge rows.
//
// Auth: SUPER_ADMIN
//
// Body (optional, all default to "everything for this project"):
//   {
//     "projectId": "cmq8b...",      // required: which project's
//                                     payments to audit
//     "lookbackDays": 30,           // optional: only look at Whop
//                                     payments from the last N days
//                                     (defaults to 90)
//     "limit": 200                   // optional: cap pages fetched
//   }
//
// Returns:
//   {
//     ok: true,
//     projectId,
//     whopPaidCount,
//     ourPledgeCount,
//     orphans: [{
//       whopPaymentId, checkoutConfigurationId, amount, paidAt,
//       email, name, metadataPledgeId, ourUserId | null
//     }, ...]
//   }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: string; lookbackDays?: number; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const lookbackDays = Math.max(1, Math.min(365, body.lookbackDays ?? 90));
  const pageCap = Math.max(1, Math.min(50, body.limit ?? 20));

  try {
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, paymentProcessor: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.paymentProcessor !== "WHOP") {
      return NextResponse.json(
        { error: `Project's paymentProcessor is ${project.paymentProcessor}, not WHOP` },
        { status: 400 }
      );
    }

    const config = await getWhopConfig();
    const client = new Whop({ apiKey: config.apiKey });

    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Walk Whop's payments list, filtering on app side because
    // the API's filter set doesn't include metadata.projectId.
    type WhopPayment = {
      id?: string;
      status?: string;
      checkout_configuration_id?: string;
      amount?: number;
      currency?: string;
      paid_at?: string;
      created_at?: string;
      metadata?: Record<string, string>;
      email?: string;
      customer?: { email?: string; name?: string };
    };

    const whopPaidForProject: WhopPayment[] = [];
    let pagesWalked = 0;
    const iterable = await client.payments.list({
      company_id: config.companyId,
      first: 100,
      created_after: since.toISOString(),
    });

    for await (const raw of iterable) {
      const p = raw as unknown as WhopPayment;
      if (p.metadata?.projectId === projectId &&
          (p.status === "paid" || p.status === "succeeded")) {
        whopPaidForProject.push(p);
      }
      // Hard cap so a misconfigured huge company can't run away.
      pagesWalked += 1;
      if (pagesWalked >= pageCap * 100) break;
    }

    // Pull every Pledge.whopPaymentId we know about for this project.
    const ourPledges = await db.pledge.findMany({
      where: {
        projectId,
        paymentProcessor: "WHOP",
        whopPaymentId: { not: null },
      },
      select: { whopPaymentId: true },
    });
    const knownPaymentIds = new Set(
      ourPledges
        .map((p: { whopPaymentId: string | null }) => p.whopPaymentId)
        .filter((x: string | null): x is string => !!x)
    );

    // Anything Whop reported as paid for this project that we don't
    // have in our DB is an orphan.
    const orphans = await Promise.all(
      whopPaidForProject
        .filter((p) => p.id && !knownPaymentIds.has(p.id))
        .map(async (p) => {
          const metadataPledgeId = p.metadata?.pledgeId ?? null;
          const metadataUserId = p.metadata?.userId ?? null;
          const email = p.metadata?.email ?? p.email ?? p.customer?.email ?? null;
          const name = p.customer?.name ?? null;

          // Try to surface the matching IndieCrowdfund user (by email)
          // so the operator can drop straight into a reconciliation
          // SQL without an extra lookup.
          let ourUserId: string | null = null;
          if (email) {
            const u = await db.user.findFirst({
              where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
              select: { id: true },
            });
            ourUserId = u?.id ?? null;
          } else if (metadataUserId) {
            ourUserId = metadataUserId;
          }

          return {
            whopPaymentId: p.id,
            checkoutConfigurationId: p.checkout_configuration_id ?? null,
            amount: p.amount ?? null,
            currency: p.currency ?? null,
            paidAt: p.paid_at ?? p.created_at ?? null,
            email,
            name,
            metadataPledgeId,
            metadataUserId,
            ourUserId,
          };
        })
    );

    const totalAmount = orphans.reduce((sum, o) => sum + (o.amount ?? 0), 0);

    whopReconLogger.info(
      {
        projectId,
        projectTitle: project.title,
        whopPaidCount: whopPaidForProject.length,
        ourPledgeCount: ourPledges.length,
        orphanCount: orphans.length,
        orphanTotalAmount: totalAmount,
      },
      "Reconciliation complete"
    );

    return NextResponse.json({
      ok: true,
      projectId,
      projectTitle: project.title,
      lookbackDays,
      whopPaidCount: whopPaidForProject.length,
      ourPledgeCount: ourPledges.length,
      orphanCount: orphans.length,
      orphanTotalAmount: totalAmount,
      orphans,
    });
  } catch (error) {
    whopReconLogger.error({ err: formatError(error) }, "Reconciliation failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 }
    );
  }
}
