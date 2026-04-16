import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPayoutsWhopLogger = logger.child({ module: "admin-payouts-whop" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") return { error: "Forbidden - Super Admin access required", status: 403 };
  return { user: session.user };
}

// GET - Fetch Whop projects that need payouts
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const now = new Date();
    const where: Record<string, unknown> = {
      paymentProcessor: "WHOP",
      deletedAt: null,
      OR: [
        { status: { in: ["FUNDED", "FAILED"] } },
        { status: "LIVE", fundedAt: { not: null }, endDate: { lt: now } },
      ],
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { creator: { name: { contains: search, mode: "insensitive" } } },
            { creator: { email: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    const projects = await db.project.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            whopBankAccount: {
              select: {
                id: true,
                bankNameDisplay: true,
                accountLastFour: true,
                accountType: true,
                isVerified: true,
                verifiedAt: true,
              },
            },
          },
        },
        pledges: {
          where: { status: "COMPLETED", deletedAt: null },
          select: { id: true, amount: true },
        },
        whopSettlements: {
          select: {
            id: true,
            amount: true,
            status: true,
            processedAt: true,
            completedAt: true,
          },
        },
      },
      orderBy: { fundedAt: "desc" },
    });

    const projectIds = projects.map((p) => p.id);

    // Fetch refund data for all projects in batch
    const refundedPledges = await db.pledge.findMany({
      where: { projectId: { in: projectIds }, status: "REFUNDED", deletedAt: null },
      select: {
        id: true, projectId: true, amount: true, lastFailureReason: true, updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    const refundActivities = await db.fulfillmentActivity.findMany({
      where: { projectId: { in: projectIds }, type: "REFUND_ISSUED" },
      select: {
        id: true, projectId: true, description: true, metadata: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group refund data by project
    const refundsByProject = new Map<string, {
      fullRefundTotal: number; fullRefundCount: number;
      partialRefundTotal: number; partialRefundCount: number;
      totalRefunded: number;
      refunds: Array<{ id: string; type: "full" | "partial"; amount: number; backerName: string | null; backerEmail: string; reason: string | null; date: string }>;
    }>();

    for (const projectId of projectIds) {
      const projectRefundedPledges = refundedPledges.filter((p) => p.projectId === projectId);
      const projectRefundActivities = refundActivities.filter((a: { projectId: string }) => a.projectId === projectId);
      let fullRefundTotal = 0;
      let partialRefundTotal = 0;
      const refunds: Array<{ id: string; type: "full" | "partial"; amount: number; backerName: string | null; backerEmail: string; reason: string | null; date: string }> = [];

      for (const pledge of projectRefundedPledges) {
        const amount = Number(pledge.amount);
        fullRefundTotal += amount;
        refunds.push({ id: pledge.id, type: "full", amount, backerName: pledge.user.name, backerEmail: pledge.user.email, reason: pledge.lastFailureReason, date: pledge.updatedAt.toISOString() });
      }

      for (const activity of projectRefundActivities) {
        const meta = activity.metadata as Record<string, unknown> | null;
        if (meta?.isPartialRefund) {
          const amount = Number(meta.refundAmount || 0);
          if (amount > 0) {
            partialRefundTotal += amount;
            refunds.push({ id: activity.id, type: "partial", amount, backerName: null, backerEmail: "", reason: activity.description || null, date: activity.createdAt.toISOString() });
          }
        }
      }

      refunds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      refundsByProject.set(projectId, {
        fullRefundTotal,
        fullRefundCount: projectRefundedPledges.length,
        partialRefundTotal,
        partialRefundCount: refunds.filter((r) => r.type === "partial").length,
        totalRefunded: fullRefundTotal + partialRefundTotal,
        refunds,
      });
    }

    const whopPayoutPlatformSettings = await db.platformSettings.findUnique({ where: { id: "default" }, select: { platformFee: true } });
    const whopPlatformFeeRate = whopPayoutPlatformSettings?.platformFee ? Number(whopPayoutPlatformSettings.platformFee) / 100 : 0.03;

    const formattedProjects = projects.map((project) => {
      const totalRaised = project.pledges.reduce((sum: number, pledge: { id: string; amount: unknown }) => sum + Number(pledge.amount), 0);
      const projectRefunds = refundsByProject.get(project.id) || {
        fullRefundTotal: 0, fullRefundCount: 0, partialRefundTotal: 0, partialRefundCount: 0, totalRefunded: 0, refunds: [],
      };

      const effectiveRevenue = Math.round((totalRaised - projectRefunds.partialRefundTotal) * 100) / 100;

      // Whop: 3% fee + Platform: configured rate
      const platformFeeRate = whopPlatformFeeRate;
      const whopFeeRate = 0.03; // Whop's own processor fee is fixed at 3%
      const backerCount = project.pledges.length;
      const processorFee = Math.round(effectiveRevenue * whopFeeRate * 100) / 100;
      const perTransactionFee = 0; // Whop doesn't charge per-transaction
      const partnerFee = processorFee;
      const platformFee = Math.round(effectiveRevenue * platformFeeRate * 100) / 100;
      const totalFees = Math.round((partnerFee + platformFee) * 100) / 100;
      const amountOwed = Math.round((effectiveRevenue - totalFees) * 100) / 100;

      const settlements = project.whopSettlements || [];
      const completedSettlements = settlements.filter((s: { status: string }) => s.status === "COMPLETED");
      const amountSettled = completedSettlements.reduce((sum: number, s: { amount: unknown }) => sum + Number(s.amount), 0);
      const pendingSettlements = settlements.filter((s: { status: string }) => ["PENDING", "PROCESSING", "INITIATED"].includes(s.status));
      const hasPendingSettlement = pendingSettlements.length > 0;
      const remainingAmount = Math.round((amountOwed - amountSettled) * 100) / 100;

      const bankAccount = project.creator.whopBankAccount;

      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        imageUrl: project.imageUrl,
        status: project.status,
        paymentProcessor: "WHOP",
        fundedAt: project.fundedAt,
        totalRaised,
        effectiveRevenue,
        processorFee,
        perTransactionFee,
        partnerFee,
        platformFee,
        totalFees,
        amountOwed,
        amountSettled,
        remainingAmount,
        backerCount,
        hasBank: !!bankAccount,
        bankVerified: bankAccount?.isVerified || false,
        hasPendingSettlement,
        totalRefunded: projectRefunds.totalRefunded,
        fullRefundTotal: projectRefunds.fullRefundTotal,
        fullRefundCount: projectRefunds.fullRefundCount,
        partialRefundTotal: projectRefunds.partialRefundTotal,
        partialRefundCount: projectRefunds.partialRefundCount,
        refunds: projectRefunds.refunds,
        settlementStatus: hasPendingSettlement
          ? "processing"
          : remainingAmount < 0
          ? "overpaid"
          : remainingAmount <= 0
          ? "settled"
          : "pending",
        creator: {
          id: project.creator.id,
          name: project.creator.name,
          email: project.creator.email,
          image: project.creator.image,
          bankAccount: bankAccount
            ? { id: bankAccount.id, bankName: bankAccount.bankNameDisplay, accountLastFour: bankAccount.accountLastFour, accountType: bankAccount.accountType, isVerified: bankAccount.isVerified }
            : null,
        },
        settlements: settlements.map((s: { id: string; amount: unknown; status: string; processedAt: Date | null; completedAt: Date | null }) => ({
          id: s.id,
          amount: Number(s.amount),
          status: s.status,
          processedAt: s.processedAt,
          completedAt: s.completedAt,
        })),
      };
    });

    let filteredProjects = formattedProjects;
    if (status === "pending") filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "pending");
    else if (status === "settled") filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "settled");
    else if (status === "processing") filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "processing");
    else if (status === "overpaid") filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "overpaid");

    const totalRefundedAll = filteredProjects.reduce((sum, p) => sum + p.totalRefunded, 0);
    const overpaidProjects = filteredProjects.filter((p) => p.settlementStatus === "overpaid");

    const stats = {
      totalProjects: filteredProjects.length,
      pendingPayouts: filteredProjects.filter((p) => p.settlementStatus === "pending").length,
      processingPayouts: filteredProjects.filter((p) => p.settlementStatus === "processing").length,
      settledPayouts: filteredProjects.filter((p) => p.settlementStatus === "settled").length,
      overpaidPayouts: overpaidProjects.length,
      totalAmountOwed: filteredProjects.reduce((sum, p) => sum + p.amountOwed, 0),
      totalAmountSettled: filteredProjects.reduce((sum, p) => sum + p.amountSettled, 0),
      totalRemaining: filteredProjects.reduce((sum, p) => sum + p.remainingAmount, 0),
      totalRefunded: totalRefundedAll,
      totalOverpaid: Math.abs(overpaidProjects.reduce((sum, p) => sum + p.remainingAmount, 0)),
      projectsWithoutBank: filteredProjects.filter((p) => !p.hasBank).length,
    };

    return NextResponse.json({ projects: filteredProjects, stats });
  } catch (error) {
    adminPayoutsWhopLogger.error({ err: String(error) }, "Error fetching Whop payouts:");
    return NextResponse.json({ error: "Failed to fetch Whop payouts" }, { status: 500 });
  }
}

// POST - Create a Whop settlement record
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { projectId, amount, adminNotes } = body;

    if (!projectId || !amount) {
      return NextResponse.json({ error: "projectId and amount are required" }, { status: 400 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      include: {
        creator: {
          select: {
            id: true,
            whopBankAccount: { select: { id: true } },
          },
        },
      },
    });

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!project.creator.whopBankAccount) {
      return NextResponse.json({ error: "Creator has no Whop bank account on file" }, { status: 400 });
    }

    // Create settlement inside a transaction with a pg advisory lock keyed
    // by project id. Without the lock, two concurrent "Create Settlement"
    // clicks (double-click, two admins, retry) would both create separate
    // WhopSettlement rows for the same project — real money, hard to
    // reverse. Inside the lock we also check for an existing non-failed
    // settlement and return 409 instead of creating a second one. Same
    // pattern as admin/payouts/paypal.
    let settlement;
    try {
      settlement = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`whop-settlement-${projectId}`}))`;

        const existing = await tx.whopSettlement.findFirst({
          where: {
            projectId,
            status: { in: ["PENDING", "INITIATED", "PROCESSING", "COMPLETED"] },
          },
        });
        if (existing) {
          throw new Error("SETTLEMENT_ALREADY_EXISTS");
        }

        return tx.whopSettlement.create({
          data: {
            bankAccountId: project.creator.whopBankAccount!.id,
            projectId,
            projectName: project.title,
            amount,
            status: "PENDING",
            adminNotes: adminNotes || null,
            processedBy: authResult.user.id,
          },
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "SETTLEMENT_ALREADY_EXISTS") {
        return NextResponse.json(
          { error: "A Whop settlement for this project already exists or is in flight" },
          { status: 409 }
        );
      }
      throw err;
    }

    adminPayoutsWhopLogger.info({ settlementId: settlement.id, projectId, amount }, "Whop settlement created");

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    adminPayoutsWhopLogger.error({ err: String(error) }, "Error creating Whop settlement:");
    return NextResponse.json({ error: "Failed to create settlement" }, { status: 500 });
  }
}
