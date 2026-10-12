import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getCustomerOrigin } from "@/lib/payments/customer-origin";
import {
  DESCRIPTOR_ACK_STATEMENT,
  STATEMENT_DESCRIPTOR,
  descriptorTypedMatches,
  type DescriptorAck,
} from "@/lib/payments/descriptor-ack";

const log = logger.child({ module: "acknowledge-descriptor" });

export const dynamic = "force-dynamic";

// POST { typed, surface } — record that the backer typed the statement
// descriptor, with their IP and browser, BEFORE any payment surface is
// shown. The payment forms stay hidden until this returns ok, so the
// evidence always predates the charge.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pledgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { pledgeId } = await params;
    const body = await req.json().catch(() => ({}));
    const typed = typeof body.typed === "string" ? body.typed.trim() : "";
    const surface = typeof body.surface === "string" ? body.surface.slice(0, 40) : "checkout";

    if (!descriptorTypedMatches(typed)) {
      return NextResponse.json(
        { error: `Please type the statement descriptor exactly as shown: ${STATEMENT_DESCRIPTOR}` },
        { status: 400 }
      );
    }

    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: { id: true, userId: true, metadata: true },
    });
    if (!pledge || pledge.userId !== session.user.id) {
      return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
    }

    const origin = getCustomerOrigin(req);
    const ack: DescriptorAck = {
      statement: DESCRIPTOR_ACK_STATEMENT,
      descriptor: STATEMENT_DESCRIPTOR,
      typed,
      acknowledgedAt: new Date().toISOString(),
      ip: origin.customerIpAddress ?? null,
      userAgent: origin.customerUserAgent ?? null,
      surface,
    };

    const meta =
      pledge.metadata && typeof pledge.metadata === "object" && !Array.isArray(pledge.metadata)
        ? (pledge.metadata as Record<string, unknown>)
        : {};
    await db.pledge.update({
      where: { id: pledgeId },
      data: { metadata: { ...meta, descriptorAck: ack } },
    });

    // Also in the server log, so the record exists even if the pledge row
    // is later edited: this line is part of the dispute evidence pack.
    log.info(
      { pledgeId, userId: session.user.id, ip: ack.ip, userAgent: ack.userAgent, surface, typed },
      "Statement descriptor acknowledged"
    );

    return NextResponse.json({ ok: true, acknowledgedAt: ack.acknowledgedAt });
  } catch (error) {
    log.error({ err: formatError(error) }, "acknowledge-descriptor failed");
    return NextResponse.json({ error: "Could not record acknowledgement" }, { status: 500 });
  }
}
