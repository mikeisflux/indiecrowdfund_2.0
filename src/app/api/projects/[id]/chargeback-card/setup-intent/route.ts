import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { createDcSetupIntent } from "@/lib/payments/divinitycoin/saved-cards";

const log = logger.child({ module: "chargeback-card-setup-intent" });

export const dynamic = "force-dynamic";

// POST - Start saving a chargeback protection card through the DivinityCoin
// vault. Returns a SetupIntent client secret the browser confirms with
// Stripe Elements pointed at DC's publishable key. The card number and CVC
// go from the creator's browser to DC and never touch this server.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: projectId } = await params;

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { creatorId: true, creator: { select: { email: true, name: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project creator can set the chargeback card" },
        { status: 403 }
      );
    }

    const si = await createDcSetupIntent({
      platformUserId: project.creatorId,
      email: project.creator.email || undefined,
      name: project.creator.name || undefined,
    });
    if (!si.success) {
      log.error({ projectId, err: si.error }, "create-setup-intent failed");
      return NextResponse.json(
        { error: "Couldn't start the secure card form. Please try again in a moment." },
        { status: 502 }
      );
    }

    // Remember which SetupIntent belongs to this project so the confirm
    // step can verify it server-side even if the browser loses the pm id
    // (3DS redirect). Never creates a card row without a token: the
    // display columns stay as they were until DC confirms the card.
    await db.creatorChargebackCard.updateMany({
      where: { projectId },
      data: { divinityCoinSetupIntentId: si.setupIntentId },
    });

    return NextResponse.json({
      clientSecret: si.clientSecret,
      setupIntentId: si.setupIntentId,
      publishableKey: si.publishableKey,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "setup-intent route failed");
    return NextResponse.json({ error: "Failed to start card setup" }, { status: 500 });
  }
}
