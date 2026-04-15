import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminRecalculatePledgeAmountsLogger = logger.child({ module: "admin-recalculate-pledge-amounts" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PledgeFix {
  pledgeId: string;
  backerNumber: number | null;
  projectTitle: string;
  backerEmail: string;
  totalAmount: number;
  current: {
    rewardAmount: number;
    addonsAmount: number;
    shippingAmount: number;
  };
  corrected: {
    rewardAmount: number;
    addonsAmount: number;
    shippingAmount: number;
  };
  warning?: string;
}

/**
 * GET /api/admin/recalculate-pledge-amounts
 *
 * Dry run - shows which pledges have incorrect rewardAmount/addonsAmount/shippingAmount
 * and what the corrected values should be.
 *
 * Query params:
 *   projectId - optional, limit to a specific project
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("projectId");

    const fixes = await findMismatchedPledges(projectId);

    return NextResponse.json({
      dryRun: true,
      totalFound: fixes.length,
      fixes,
    });
  } catch (error) {
    adminRecalculatePledgeAmountsLogger.error({ err: String(error) }, "Recalculate pledge amounts (dry run) error:");
    return NextResponse.json(
      { error: "Failed to analyze pledge amounts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/recalculate-pledge-amounts
 *
 * Actually updates the pledge records with corrected amounts.
 *
 * Query params:
 *   projectId - optional, limit to a specific project
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("projectId");

    const fixes = await findMismatchedPledges(projectId);

    if (fixes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pledges need fixing",
        updated: 0,
      });
    }

    // Only apply fixes that don't have warnings (skip negative remainders)
    const safeFixes = fixes.filter((f) => !f.warning);
    const skipped = fixes.filter((f) => f.warning);

    let updated = 0;
    for (const fix of safeFixes) {
      await db.pledge.update({
        where: { id: fix.pledgeId },
        data: {
          rewardAmount: fix.corrected.rewardAmount,
          addonsAmount: fix.corrected.addonsAmount,
          shippingAmount: fix.corrected.shippingAmount,
        },
      });
      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} pledges, skipped ${skipped.length} with warnings`,
      updated,
      skipped: skipped.length,
      skippedDetails: skipped.map((s) => ({
        pledgeId: s.pledgeId,
        backerNumber: s.backerNumber,
        warning: s.warning,
      })),
    });
  } catch (error) {
    adminRecalculatePledgeAmountsLogger.error({ err: String(error) }, "Recalculate pledge amounts error:");
    return NextResponse.json(
      { error: "Failed to recalculate pledge amounts" },
      { status: 500 }
    );
  }
}

async function findMismatchedPledges(
  projectId: string | null
): Promise<PledgeFix[]> {
  // Get all COMPLETED pledges that have a reward tier, with their addon data.
  // Skip no-reward pledges - they don't have a meaningful amount breakdown.
  // Skip PENDING pledges - those are likely abandoned carts.
  //
  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — use the `NOT: { field: null }` wrapper syntax instead.
  const pledges = await db.pledge.findMany({
    where: {
      status: "COMPLETED",
      NOT: { rewardId: null },
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
    },
    include: {
      user: { select: { email: true } },
      project: { select: { title: true } },
      reward: { select: { amount: true } },
      addons: { select: { amount: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const fixes: PledgeFix[] = [];

  for (const pledge of pledges) {
    const totalAmount = Number(pledge.amount);
    const currentReward = Number(pledge.rewardAmount);
    const currentAddons = Number(pledge.addonsAmount);
    const currentShipping = Number(pledge.shippingAmount);

    // Compute correct values from related records
    const correctReward = pledge.reward ? Number(pledge.reward.amount) : 0;
    const correctAddons = pledge.addons.reduce(
      (sum: number, a: { amount: unknown }) => sum + Number(a.amount || 0),
      0
    );
    const remainder = Math.round((totalAmount - correctReward - correctAddons) * 100) / 100;

    // Determine correct shipping:
    // If current shipping looks valid (non-zero and remainder matches), keep it.
    // Otherwise shipping = remainder (total - reward - addons).
    let correctShipping: number;
    let warning: string | undefined;

    if (remainder < 0) {
      // Reward + addons exceed total - something is wrong with this pledge
      warning = `Reward ($${correctReward}) + Addons ($${correctAddons}) = $${correctReward + correctAddons} exceeds total $${totalAmount}`;
      correctShipping = currentShipping; // Keep current value, flag for manual review
    } else {
      correctShipping = remainder;
    }

    // Check if anything actually needs changing
    const rewardDiff = Math.abs(currentReward - correctReward) > 0.001;
    const addonsDiff = Math.abs(currentAddons - correctAddons) > 0.001;
    const shippingDiff = Math.abs(currentShipping - correctShipping) > 0.001;

    if (rewardDiff || addonsDiff || shippingDiff) {
      fixes.push({
        pledgeId: pledge.id,
        backerNumber: pledge.backerNumber,
        projectTitle: pledge.project.title,
        backerEmail: pledge.user.email || "unknown",
        totalAmount,
        current: {
          rewardAmount: currentReward,
          addonsAmount: currentAddons,
          shippingAmount: currentShipping,
        },
        corrected: {
          rewardAmount: correctReward,
          addonsAmount: correctAddons,
          shippingAmount: correctShipping,
        },
        warning,
      });
    }
  }

  return fixes;
}
