import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const userPledgesLogger = logger.child({ module: "creator-user-pledges" });

export const dynamic = "force-dynamic";

// GET /api/creator/user-pledges?userId=<backerId>
//
// Returns every pledge the given user has placed on a project owned by
// (or where the caller is a collaborator on) the currently-authenticated
// creator. Used from the messaging "click on name" popup so the creator
// can see this person's full transaction history with them in one shot,
// then jump to the IndieKit BackerDialog for any specific order.
//
// Tenant-scoped at the query level -- the calling creator can never
// observe pledges placed on projects they don't own. We do NOT trust
// the `userId` for any authorization decision (it's just a filter).
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const pledges = await db.pledge.findMany({
      where: {
        userId,
        deletedAt: null,
        project: {
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
      },
      select: {
        id: true,
        backerNumber: true,
        amount: true,
        rewardAmount: true,
        addonsAmount: true,
        shippingAmount: true,
        status: true,
        fulfillmentStatus: true,
        paymentProcessor: true,
        confirmationEmailSent: true,
        createdAt: true,
        projectId: true,
        project: { select: { id: true, title: true, slug: true, status: true } },
        reward: { select: { id: true, title: true } },
        addons: {
          select: {
            quantity: true,
            addon: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const backer = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json({
      user: backer,
      pledges: pledges.map((p) => ({
        id: p.id,
        backerNumber: p.backerNumber,
        amount: Number(p.amount),
        rewardAmount: Number(p.rewardAmount),
        addonsAmount: Number(p.addonsAmount),
        shippingAmount: Number(p.shippingAmount),
        status: p.status,
        fulfillmentStatus: p.fulfillmentStatus,
        paymentProcessor: p.paymentProcessor,
        confirmed: !!p.confirmationEmailSent,
        createdAt: p.createdAt.toISOString(),
        project: p.project,
        reward: p.reward,
        addons: p.addons.map((a: { quantity: number; addon: { id: string; title: string } }) => ({
          id: a.addon.id,
          title: a.addon.title,
          quantity: a.quantity,
        })),
      })),
    });
  } catch (error) {
    userPledgesLogger.error({ err: formatError(error) }, "user-pledges error");
    return NextResponse.json(
      { error: "Failed to fetch pledges" },
      { status: 500 }
    );
  }
}
