import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import {
  refreshPaymentLink,
  PrintingComicsApiError,
} from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-payment-link" });

// Mint a fresh PayPal approval URL for an existing print order.
// PrintingComics' approval URLs expire ~3h after issuance; the
// dashboard surfaces a "Refresh payment link" button when a creator
// missed the original window. Generating a new link invalidates the
// previous one on PrintingComics' side.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const order = await db.projectPrintOrder.findFirst({
      where: { id },
      include: {
        project: {
          select: {
            creatorId: true,
            collaborators: {
              where: { userId: session.user.id, status: "ACCEPTED" },
              select: { id: true },
            },
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Print order not found" }, { status: 404 });
    }
    const isCreator = order.project.creatorId === session.user.id;
    const isCollaborator = order.project.collaborators.length > 0;
    if (!isCreator && !isCollaborator) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!order.printingComicsOrderId) {
      return NextResponse.json(
        { error: "Print order hasn't been submitted to Printing Comics yet" },
        { status: 400 }
      );
    }
    if (order.paidAt || order.status === "PAID" || order.status === "IN_PRODUCTION" || order.status === "SHIPPED" || order.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Print order is already paid; nothing to refresh" },
        { status: 409 }
      );
    }

    const config = await loadPrintingComicsConfig();
    if (!config) {
      return NextResponse.json({ error: "Printing Comics not configured" }, { status: 502 });
    }

    let body: { returnUrl?: string; cancelUrl?: string } = {};
    try {
      body = await req.json();
    } catch {
      // optional
    }

    try {
      const { payment } = await refreshPaymentLink(config, order.printingComicsOrderId, {
        returnUrl: typeof body?.returnUrl === "string" ? body.returnUrl : undefined,
        cancelUrl: typeof body?.cancelUrl === "string" ? body.cancelUrl : undefined,
      });

      const updated = await db.projectPrintOrder.update({
        where: { id: order.id },
        data: {
          paymentApprovalUrl: payment.approvalUrl,
          paymentApprovalUrlExpiresAt: payment.expiresAt ? new Date(payment.expiresAt) : null,
          paymentProvider: payment.provider,
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
    log.error({ err: String(err) }, "refresh payment link failed");
    return NextResponse.json({ error: "Failed to refresh payment link" }, { status: 500 });
  }
}
