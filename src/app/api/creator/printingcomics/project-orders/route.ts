import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import {
  createOrder,
  upsertProject,
  PrintingComicsApiError,
  type PCOrderItemInput,
  type PCAddress,
} from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-project-orders" });

// List a project's print orders. Used by the IndieKit Fulfillment tab.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    // Authorize: creator OR accepted collaborator.
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }
    const orders = await db.projectPrintOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ orders });
  } catch (err) {
    log.error({ err: String(err) }, "list project print orders failed");
    return NextResponse.json({ error: "Failed to load print orders" }, { status: 500 });
  }
}

// Create a new project-level print order. The CREATOR pays Printing
// Comics on their side via the provider's billing — we don't pass
// markAsPaid:true here since the platform isn't collecting the
// printing cost from the backer pledge stream. The status webhook
// fires `order.paid` once the creator has paid the printer.
//
// Body shape:
//   {
//     projectId: string,
//     productSlug: string,
//     quantity: number,
//     options: Record<string, string|number>,
//     files: [{ uploadId, purpose }],   // already uploaded via /uploads
//     shippingAddress: {
//       firstName, lastName, line1, line2?, city, region, postalCode, country
//     },
//     email: string,
//     shippingRateId?: string,
//     couponCode?: string,
//     notes?: string,
//     // when true, tells PrintingComics we've already collected
//     // payment platform-side (rare; default off — creator pays
//     // PrintingComics directly via their billing).
//     markAsPaid?: boolean
//   }
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    type LineItem = {
      productSlug?: string;
      quantity?: number;
      options?: Record<string, string | number>;
      files?: Array<{ uploadId: string; purpose: string }>;
    };
    let body: {
      projectId?: string;
      // Multi-item shape (preferred): one row in the printer order per
      // entry. Lets the creator order N variants in a single print run
      // (6 different cover variants of the same book, mixed page counts,
      // etc).
      items?: LineItem[];
      // Legacy single-item shape — kept so older clients keep working.
      productSlug?: string;
      quantity?: number;
      options?: Record<string, string | number>;
      files?: Array<{ uploadId: string; purpose: string }>;
      shippingAddress?: PCAddress;
      email?: string;
      shippingRateId?: string;
      couponCode?: string;
      notes?: string;
      markAsPaid?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Normalize: if the client sent a top-level single-item shape, fold
    // it into a one-element items array so the rest of the route only
    // has to think about one shape.
    const items: LineItem[] =
      Array.isArray(body.items) && body.items.length > 0
        ? body.items
        : [{
            productSlug: body.productSlug,
            quantity: body.quantity,
            options: body.options,
            files: body.files,
          }];

    if (items.length > 50) {
      return NextResponse.json(
        { error: "A single print order can have at most 50 line items" },
        { status: 400 }
      );
    }

    const required = (v: unknown, name: string) =>
      v === undefined || v === null || v === ""
        ? NextResponse.json({ error: `${name} is required` }, { status: 400 })
        : null;

    const checks: NextResponse[] = [];
    let r: NextResponse | null;
    if ((r = required(body.projectId, "projectId"))) checks.push(r);
    if ((r = required(body.email, "email"))) checks.push(r);
    if ((r = required(body.shippingAddress, "shippingAddress"))) checks.push(r);
    if (checks.length > 0) return checks[0];

    for (const [idx, it] of items.entries()) {
      if (!it.productSlug || typeof it.productSlug !== "string") {
        return NextResponse.json(
          { error: `items[${idx}].productSlug is required` },
          { status: 400 }
        );
      }
      if (typeof it.quantity !== "number" || it.quantity < 1) {
        return NextResponse.json(
          { error: `items[${idx}].quantity must be a positive number` },
          { status: 400 }
        );
      }
    }
    const ship = body.shippingAddress!;
    for (const f of ["firstName", "lastName", "line1", "city", "region", "postalCode", "country"] as const) {
      if (!ship[f]) {
        return NextResponse.json(
          { error: `shippingAddress.${f} is required` },
          { status: 400 }
        );
      }
    }

    // Authorize: creator OR accepted collaborator.
    const project = await db.project.findFirst({
      where: {
        id: body.projectId!,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        creator: {
          select: { name: true, email: true, vanityUrl: true },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const config = await loadPrintingComicsConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Printing Comics is not configured by the platform admin." },
        { status: 502 }
      );
    }

    // Pre-create the local row in DRAFT so we have an id to send as
    // externalRef. If the gateway call fails we mark it FAILED;
    // re-submitting the form generates a fresh row + fresh
    // externalRef so retries don't collide on the provider side.
    //
    // Legacy fields (productSlug/quantity/options/files) hold the FIRST
    // item's data so existing dashboard cards / webhook handlers /
    // status emails keep rendering. The full multi-item array goes into
    // `items`; new code reads that and falls back to the flat fields
    // for old rows.
    const firstItem = items[0];
    const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const row = await db.projectPrintOrder.create({
      data: {
        projectId: project.id,
        submittedById: session.user.id,
        status: "DRAFT",
        productSlug: firstItem.productSlug!,
        quantity: totalQuantity,
        options: (firstItem.options || {}) as object,
        files: (firstItem.files || []) as object,
        items: items as unknown as object,
        shippingAddress: ship as unknown as object,
        email: body.email!,
        notes: body.notes || null,
      },
    });

    const pcItems: PCOrderItemInput[] = items.map((it) => ({
      productSlug: it.productSlug!,
      quantity: it.quantity!,
      options: it.options || {},
      files: it.files,
    }));

    try {
      // Pre-register / upsert the campaign on PrintingComics' side so
      // their admin shows title + creator contact info. Their POST
      // /projects is idempotent on (partner, externalProjectId) so
      // re-running this for every order keeps the metadata fresh.
      // Failures here aren't fatal — passing projectId on the order
      // also auto-creates the project — so we swallow + log.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const projectUrl = appUrl && project.slug && project.creator?.vanityUrl
        ? `${appUrl}/projects/${project.creator.vanityUrl}/${project.slug}`
        : undefined;
      try {
        await upsertProject(config, {
          externalProjectId: project.id,
          title: project.title,
          url: projectUrl,
          creatorName: project.creator?.name || undefined,
          creatorEmail: project.creator?.email || undefined,
          status: "active",
        });
      } catch (upsertErr) {
        log.warn(
          { err: String(upsertErr), projectId: project.id },
          "Project upsert on PrintingComics failed; relying on order auto-upsert"
        );
      }

      // externalRef format: "<projectId>:<printOrderId>". Their
      // admin can split on ':' to group by IndieCrowdfund campaign;
      // the printOrderId tail keeps idempotency per row.
      const externalRef = `${project.id}:${row.id}`;
      const result = await createOrder(config, {
        externalRef,
        // Their server uses this to associate the order with the
        // (auto- or pre-)created project record. Our internal
        // Project.id doubles as their externalProjectId.
        projectId: project.id,
        email: body.email!,
        customerName: `${ship.firstName} ${ship.lastName}`.trim() || undefined,
        shippingAddress: ship,
        items: pcItems,
        shippingRateId: body.shippingRateId,
        couponCode: body.couponCode,
        notes: [
          `IndieCrowdfund project: ${project.title} (${project.id})`,
          body.notes,
        ].filter(Boolean).join("\n\n"),
        markAsPaid: !!body.markAsPaid,
        // We always want the PayPal approval URL on create unless the
        // caller explicitly opted out (e.g. markAsPaid path).
        generatePaymentLink: body.markAsPaid ? false : true,
      });

      const updated = await db.projectPrintOrder.update({
        where: { id: row.id },
        data: {
          printingComicsOrderId: result.order.id,
          printingComicsOrderNumber: result.order.number,
          status: result.order.status,
          shippingMethod: result.order.shippingMethod || null,
          trackingNumber: result.order.trackingNumber || null,
          subtotalCents: result.order.subtotalCents ?? null,
          shippingCents: result.order.shippingCents ?? null,
          taxCents: result.order.taxCents ?? null,
          discountCents: result.order.discountCents ?? null,
          totalCents: result.order.totalCents ?? null,
          // Cache the PayPal approval URL + expiry returned on create
          // so the dashboard can render a "Pay with PayPal" button
          // without having to re-call /payment-link. The webhook
          // (order.payment_link_created) keeps these fresh on refresh.
          paymentApprovalUrl: result.payment?.approvalUrl || null,
          paymentApprovalUrlExpiresAt: result.payment?.expiresAt
            ? new Date(result.payment.expiresAt)
            : null,
          paymentProvider: result.payment?.provider
            || (body.markAsPaid ? "manual" : null),
          paidAt: body.markAsPaid ? new Date() : null,
          lastSyncedAt: new Date(),
        },
      });

      return NextResponse.json({
        ok: true,
        order: updated,
        idempotent: !!result.idempotent,
      });
    } catch (err) {
      // Mark the local row FAILED so the UI can surface it; keep the
      // row so the creator sees what they tried.
      await db.projectPrintOrder
        .update({ where: { id: row.id }, data: { status: "FAILED" } })
        .catch(() => null);
      if (err instanceof PrintingComicsApiError) {
        log.warn(
          { rowId: row.id, status: err.status, body: err.bodyText.slice(0, 300) },
          "Printing Comics createOrder failed"
        );
        return NextResponse.json(
          { error: err.bodyText, status: err.status },
          { status: err.status >= 400 && err.status < 500 ? err.status : 502 }
        );
      }
      throw err;
    }
  } catch (err) {
    log.error({ err: String(err) }, "submit project print order failed");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit print order" },
      { status: 500 }
    );
  }
}
