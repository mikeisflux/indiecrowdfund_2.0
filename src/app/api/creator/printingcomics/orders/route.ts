import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import {
  createOrder,
  PrintingComicsApiError,
  type PCOrderItemInput,
  type PCAddress,
} from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-orders" });

// Submit a print order to Printing Comics for a single backer pledge.
// The pledge's id doubles as the externalRef on their side so re-POSTs
// are idempotent (they return the original order with idempotent:true).
//
// Body shape:
//   {
//     pledgeId: string,
//     items: [{
//       productSlug: string,
//       quantity: number,
//       options: Record<string, string|number>,
//       files?: [{ uploadId: string, purpose: string }]
//     }],
//     shippingRateId?: string,
//     couponCode?: string,
//     notes?: string
//   }
//
// We construct shippingAddress from pledge.shippingAddress (the same
// address the backer entered for the pledge — already validated by
// the pledge flow's address gate).
//
// markAsPaid is forced to true: the pledge has already been charged
// on our side via NMI / Stripe / DC, so Printing Comics should queue
// for production immediately, not invoice us.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    pledgeId?: string;
    items?: PCOrderItemInput[];
    shippingRateId?: string;
    couponCode?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.pledgeId || typeof body.pledgeId !== "string") {
    return NextResponse.json({ error: "pledgeId is required" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items[] is required and must be non-empty" }, { status: 400 });
  }

  // Authorize: pledge must belong to a project the caller owns or
  // collaborates on.
  const pledge = await db.pledge.findFirst({
    where: { id: body.pledgeId, deletedAt: null },
    include: {
      user: { select: { email: true, name: true } },
      project: {
        select: {
          title: true,
          creatorId: true,
          collaborators: {
            where: { userId: session.user.id, status: "ACCEPTED" },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!pledge) {
    return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
  }
  const isCreator = pledge.project.creatorId === session.user.id;
  const isCollaborator = pledge.project.collaborators.length > 0;
  if (!isCreator && !isCollaborator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull the shipping address the backer attached to this pledge.
  // confirm-nmi (and the other processors) already enforce that
  // shippable carts have a saved address, so this should always be
  // populated for a real fulfillable pledge.
  const ship = pledge.shippingAddress as Record<string, string> | null;
  if (!ship || !ship.line1 || !ship.city || !ship.country) {
    return NextResponse.json(
      { error: "Pledge is missing a complete shipping address — backer must update their profile address." },
      { status: 400 }
    );
  }
  const shipName = (ship.name || pledge.user.name || "").trim();
  const [firstName, ...rest] = shipName.split(/\s+/);
  const shippingAddress: PCAddress = {
    firstName: firstName || "Backer",
    lastName: rest.join(" ") || "",
    line1: ship.line1,
    line2: ship.line2 || undefined,
    city: ship.city,
    region: ship.state || ship.region || "",
    postalCode: ship.postalCode || ship.zip || "",
    country: ship.country,
  };

  const email = pledge.user.email || undefined;
  if (!email) {
    return NextResponse.json(
      { error: "Pledge user has no email on file." },
      { status: 400 }
    );
  }

  const config = await loadPrintingComicsConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Printing Comics is not configured" },
      { status: 502 }
    );
  }

  try {
    const result = await createOrder(config, {
      externalRef: pledge.id,
      email,
      customerName: shipName || undefined,
      shippingAddress,
      items: body.items,
      shippingRateId: body.shippingRateId,
      couponCode: body.couponCode,
      notes: body.notes,
      markAsPaid: true,
    });

    // Stash the order id + status on the pledge so the backers table
    // surfaces print-fulfillment state. The webhook will keep this
    // fresh as the order moves through production / shipping.
    await db.pledge.update({
      where: { id: pledge.id },
      data: {
        printingComicsOrderId: result.order.id,
        printingComicsOrderNumber: result.order.number,
        printingComicsStatus: result.order.status,
        printingComicsTrackingNumber: result.order.trackingNumber || null,
        printingComicsLastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      order: result.order,
      idempotent: !!result.idempotent,
    });
  } catch (err) {
    if (err instanceof PrintingComicsApiError) {
      log.warn(
        { pledgeId: pledge.id, status: err.status, body: err.bodyText.slice(0, 300) },
        "Printing Comics createOrder failed"
      );
      return NextResponse.json(
        { error: err.bodyText, status: err.status },
        { status: err.status >= 400 && err.status < 500 ? err.status : 502 }
      );
    }
    log.error({ err: String(err), pledgeId: pledge.id }, "submit order failed");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit order" },
      { status: 500 }
    );
  }
}
