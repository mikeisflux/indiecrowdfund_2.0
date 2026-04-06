import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorIndiekitTransactionsLogger = logger.child({ module: "creator-indiekit-transactions" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/creator/indiekit/transactions?projectId=...
 *
 * Returns transaction history for a project including:
 * - Original pledge payments
 * - Post-campaign add-on purchases (aftersales from surveys)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Verify the user owns or collaborates on this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all completed pledges for this project
    const pledges = await db.pledge.findMany({
      where: {
        projectId,
        status: "COMPLETED",
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        reward: { select: { id: true, title: true } },
        addons: {
          include: { addon: { select: { title: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    interface Transaction {
      id: string;
      type: "pledge" | "aftersale";
      backerName: string | null;
      backerEmail: string;
      amount: number;
      description: string;
      paymentProcessor: string;
      stripePaymentIntentId: string | null;
      status: string;
      date: string;
    }

    const transactions: Transaction[] = [];

    // Summary stats
    let totalPledgeRevenue = 0;
    let totalAftersaleRevenue = 0;
    let aftersaleCount = 0;

    for (const pledge of pledges) {
      // Original pledge payment
      const addonNames = pledge.addons
        .map((a: typeof pledge.addons[number]) => a.addon.title)
        .join(", ");
      const rewardDesc = pledge.reward?.title || "No reward";
      const description = addonNames
        ? `${rewardDesc} + ${addonNames}`
        : rewardDesc;

      totalPledgeRevenue += Number(pledge.amount);

      transactions.push({
        id: pledge.id,
        type: "pledge",
        backerName: pledge.user.name,
        backerEmail: pledge.user.email,
        amount: Number(pledge.amount),
        description,
        paymentProcessor: pledge.paymentProcessor,
        stripePaymentIntentId: pledge.stripePaymentIntentId,
        status: "COMPLETED",
        date: pledge.createdAt.toISOString(),
      });

      // Post-campaign add-on purchases (aftersales)
      const meta = pledge.metadata as Record<string, unknown> | null;
      const completedItems = (meta?.completedAdditionalItems as Array<{
        paymentIntentId?: string;
        addons?: Array<{ title?: string; quantity?: number }>;
        amount?: number;
        completedAt?: string;
      }>) || [];

      for (let i = 0; i < completedItems.length; i++) {
        const item = completedItems[i];
        const amount = Number(item.amount || 0);
        if (amount <= 0) continue;

        aftersaleCount++;
        totalAftersaleRevenue += amount;

        const itemAddons = item.addons
          ?.map((a) => {
            const qty = a.quantity && a.quantity > 1 ? ` x${a.quantity}` : "";
            return `${a.title || "Add-on"}${qty}`;
          })
          .join(", ") || "Add-ons";

        transactions.push({
          id: `${pledge.id}-aftersale-${i}`,
          type: "aftersale",
          backerName: pledge.user.name,
          backerEmail: pledge.user.email,
          amount,
          description: itemAddons,
          paymentProcessor: pledge.paymentProcessor,
          stripePaymentIntentId: item.paymentIntentId || null,
          status: "COMPLETED",
          date: item.completedAt || pledge.updatedAt.toISOString(),
        });
      }
    }

    // Sort all transactions by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      transactions,
      stats: {
        totalPledges: pledges.length,
        totalPledgeRevenue,
        aftersaleCount,
        totalAftersaleRevenue,
        totalRevenue: totalPledgeRevenue + totalAftersaleRevenue,
      },
    });
  } catch (error) {
    creatorIndiekitTransactionsLogger.error({ err: String(error) }, "Error fetching IndieKit transactions:");
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
