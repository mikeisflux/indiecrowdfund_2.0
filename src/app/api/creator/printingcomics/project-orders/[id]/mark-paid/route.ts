import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import {
  markOrderPaid,
  PrintingComicsApiError,
} from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-mark-paid" });

// Assert that a print order has been paid out-of-band — wire / ACH /
// internal billing — so PrintingComics flips it to PAID and starts
// production. Restricted to platform admins (SUPER_ADMIN) since this
// asserts payment without actually moving any money.
//
// Body:
//   { reference?: string, amountCents?: number, note?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const order = await db.projectPrintOrder.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Print order not found" }, { status: 404 });
    }
    if (!order.printingComicsOrderId) {
      return NextResponse.json(
        { error: "Print order hasn't been submitted yet" },
        { status: 400 }
      );
    }
    if (order.paidAt) {
      return NextResponse.json(
        { error: "Print order is already marked paid" },
        { status: 409 }
      );
    }

    let body: { reference?: string; amountCents?: number; note?: string } = {};
    try {
      body = await req.json();
    } catch {
      // optional
    }

    const config = await loadPrintingComicsConfig();
    if (!config) {
      return NextResponse.json({ error: "Printing Comics not configured" }, { status: 502 });
    }

    try {
      const { payment } = await markOrderPaid(config, order.printingComicsOrderId, {
        reference: body.reference,
        amountCents: body.amountCents,
        note: body.note,
      });
      const updated = await db.projectPrintOrder.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paymentProvider: payment.provider || "manual",
          paymentReference: body.reference || payment.providerRef || null,
          paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
          paymentApprovalUrl: null, // any pending PayPal URL is now invalid
          paymentApprovalUrlExpiresAt: null,
          lastSyncedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, order: updated, payment });
    } catch (err) {
      if (err instanceof PrintingComicsApiError) {
        return NextResponse.json(
          { error: err.bodyText, status: err.status },
          { status: err.status >= 400 && err.status < 500 ? err.status : 502 }
        );
      }
      throw err;
    }
  } catch (err) {
    log.error({ err: String(err) }, "mark-paid failed");
    return NextResponse.json({ error: "Failed to mark paid" }, { status: 500 });
  }
}
