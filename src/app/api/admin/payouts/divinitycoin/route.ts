import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPayoutsDivinitycoinLogger = logger.child({ module: "admin-payouts-divinitycoin" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPayoutCreatedEmail } from "@/lib/notifications/email-templates";

// Force dynamic - this route uses auth/headers
export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Fetch DivinityCoin projects that need payouts + creator marketplace balances
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status"); // pending, settled, processing, all

    // Build where clause for DivinityCoin projects only
    // Stripe projects use Stripe Connect - payouts are automatic
    // Include FUNDED/FAILED projects AND LIVE projects that ended with goal met
    // (safety net for before the cron transitions status)
    const now = new Date();
    const where: Record<string, unknown> = {
      paymentProcessor: "DIVINITYCOIN",
      deletedAt: null,
      OR: [
        { status: { in: ["FUNDED", "FAILED"] } },
        {
          status: "LIVE",
          fundedAt: { not: null },
          endDate: { lt: now },
        },
      ],
    };

    if (search) {
      // Wrap existing OR + search in an AND to combine them properly
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

    // Fetch DC projects with creator info and bank accounts
    const projects = await db.project.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            divinityCoinBankAccount: {
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
          where: {
            status: "COMPLETED",
            deletedAt: null,
          },
          select: {
            id: true,
            amount: true,
          },
        },
        divinityCoinSettlements: {
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

    // Fetch refund data for all projects in batch
    const projectIds = projects.map((p) => p.id);

    // Get fully refunded pledges per project
    const refundedPledges = await db.pledge.findMany({
      where: {
        projectId: { in: projectIds },
        status: "REFUNDED",
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        amount: true,
        lastFailureReason: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    // Get all refund activities (both full and partial) per project
    const refundActivities = await db.fulfillmentActivity.findMany({
      where: {
        projectId: { in: projectIds },
        type: "REFUND_ISSUED",
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        description: true,
        metadata: true,
        pledgeId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group refund data by project
    const refundsByProject = new Map<string, {
      fullRefundTotal: number;
      fullRefundCount: number;
      partialRefundTotal: number;
      partialRefundCount: number;
      totalRefunded: number;
      refunds: Array<{
        id: string;
        type: "full" | "partial";
        amount: number;
        backerName: string | null;
        backerEmail: string;
        reason: string | null;
        date: string;
      }>;
    }>();

    for (const projectId of projectIds) {
      const projectRefundedPledges = refundedPledges.filter((p) => p.projectId === projectId);
      const projectRefundActivities = refundActivities.filter((a: { projectId: string }) => a.projectId === projectId);

      let fullRefundTotal = 0;
      let partialRefundTotal = 0;
      const refunds: Array<{
        id: string;
        type: "full" | "partial";
        amount: number;
        backerName: string | null;
        backerEmail: string;
        reason: string | null;
        date: string;
      }> = [];

      // Track full refunds from REFUNDED pledges
      for (const pledge of projectRefundedPledges) {
        const amount = Number(pledge.amount);
        fullRefundTotal += amount;
        refunds.push({
          id: pledge.id,
          type: "full",
          amount,
          backerName: pledge.user.name,
          backerEmail: pledge.user.email,
          reason: pledge.lastFailureReason,
          date: pledge.updatedAt.toISOString(),
        });
      }

      // Track partial refunds from FulfillmentActivity
      for (const activity of projectRefundActivities) {
        const meta = activity.metadata as Record<string, unknown> | null;
        if (meta?.isPartialRefund) {
          const amount = Number(meta.refundAmount || 0);
          if (amount > 0) {
            partialRefundTotal += amount;
            refunds.push({
              id: activity.id,
              type: "partial",
              amount,
              backerName: null,
              backerEmail: "",
              reason: activity.description || null,
              date: activity.createdAt.toISOString(),
            });
          }
        }
      }

      // Sort refunds by date descending
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

    // Calculate stats and format the response
    const formattedProjects = projects.map((project) => {
      // Calculate total raised from completed pledges
      // Note: Full refunds (REFUNDED status) are already excluded from this query
      const totalRaised = project.pledges.reduce(
        (sum: number, pledge: { id: string; amount: unknown }) => sum + Number(pledge.amount),
        0
      );

      // Get refund data for this project
      const projectRefunds = refundsByProject.get(project.id) || {
        fullRefundTotal: 0,
        fullRefundCount: 0,
        partialRefundTotal: 0,
        partialRefundCount: 0,
        totalRefunded: 0,
        refunds: [],
      };

      // Partial refunds need to be deducted from effective revenue
      // (Full refunds are already excluded since pledge status is REFUNDED)
      const effectiveRevenue = Math.round((totalRaised - projectRefunds.partialRefundTotal) * 100) / 100;

      // DivinityCoin Partner Fee: 6% + $0.30 per transaction
      // IndieCrowdfund Platform Fee: 3%
      const partnerFeeRate = 0.06;
      const platformFeeRate = 0.03;
      const stripePerTransactionFee = 0.30; // per-transaction processing fee
      const backerCount = project.pledges.length;
      const partnerFee = Math.round((effectiveRevenue * partnerFeeRate + stripePerTransactionFee * backerCount) * 100) / 100;
      const platformFee = Math.round(effectiveRevenue * platformFeeRate * 100) / 100;
      const totalFees = Math.round((partnerFee + platformFee) * 100) / 100;
      const amountOwed = Math.round((effectiveRevenue - totalFees) * 100) / 100;

      const settlements = project.divinityCoinSettlements || [];

      // Calculate amount already settled
      const completedSettlements = settlements.filter(
        (s: { status: string }) => s.status === "COMPLETED"
      );
      const amountSettled = completedSettlements.reduce(
        (sum: number, s: { amount: unknown }) => sum + Number(s.amount),
        0
      );

      // Check for pending/processing settlements
      const pendingSettlements = settlements.filter(
        (s: { status: string }) => s.status === "PENDING" || s.status === "PROCESSING" || s.status === "INITIATED"
      );
      const hasPendingSettlement = pendingSettlements.length > 0;

      // Remaining can be negative if creator was already paid and then refunds occurred
      const remainingAmount = Math.round((amountOwed - amountSettled) * 100) / 100;

      const bankAccount = project.creator.divinityCoinBankAccount;

      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        imageUrl: project.imageUrl,
        status: project.status,
        paymentProcessor: "DIVINITYCOIN",
        fundedAt: project.fundedAt,
        totalRaised,
        effectiveRevenue,
        partnerFee,
        platformFee,
        totalFees,
        amountOwed,
        amountSettled,
        remainingAmount,
        backerCount: project.pledges.length,
        hasBank: !!bankAccount,
        bankVerified: bankAccount?.isVerified || false,
        hasPendingSettlement,
        // Refund tracking
        totalRefunded: projectRefunds.totalRefunded,
        fullRefundTotal: projectRefunds.fullRefundTotal,
        fullRefundCount: projectRefunds.fullRefundCount,
        partialRefundTotal: projectRefunds.partialRefundTotal,
        partialRefundCount: projectRefunds.partialRefundCount,
        refunds: projectRefunds.refunds,
        // Settlement status: negative remaining means creator was overpaid
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
            ? {
                id: bankAccount.id,
                bankName: bankAccount.bankNameDisplay,
                accountLastFour: bankAccount.accountLastFour,
                accountType: bankAccount.accountType,
                isVerified: bankAccount.isVerified,
              }
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

    // Filter by settlement status if provided
    let filteredProjects = formattedProjects;
    if (status === "pending") {
      filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "pending");
    } else if (status === "settled") {
      filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "settled");
    } else if (status === "processing") {
      filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "processing");
    } else if (status === "overpaid") {
      filteredProjects = formattedProjects.filter((p) => p.settlementStatus === "overpaid");
    }

    // Calculate summary stats
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

    // Fetch creator balances from marketplace sales (via books → purchases)
    const creatorsWithSales = await db.user.findMany({
      where: {
        marketplaceBooks: {
          some: {
            purchases: {
              some: {
                status: "COMPLETED",
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        divinityCoinBankAccount: {
          select: {
            id: true,
            bankNameDisplay: true,
            accountLastFour: true,
            accountType: true,
            isVerified: true,
          },
        },
        createdProjects: {
          where: {
            deletedAt: null,
            status: { in: ["FUNDED", "LIVE"] },
          },
          select: {
            id: true,
            title: true,
            status: true,
            currentAmount: true,
          },
        },
        marketplaceBooks: {
          select: {
            purchases: {
              where: {
                status: "COMPLETED",
              },
              select: {
                id: true,
                amount: true,
                creatorPayout: true,
              },
            },
          },
        },
      },
    });

    const creatorBalances = creatorsWithSales
      .map((creator) => {
        // Flatten all purchases across creator's books
        const allPurchases = creator.marketplaceBooks.flatMap(
          (book: { purchases: { id: string; amount: number; creatorPayout: number }[] }) => book.purchases
        );

        const totalMarketplaceSales = allPurchases.reduce(
          (sum: number, s: { amount: number }) => sum + Number(s.amount),
          0
        );
        const totalCreatorEarnings = allPurchases.reduce(
          (sum: number, s: { creatorPayout: number }) => sum + Number(s.creatorPayout),
          0
        );

        const projectEarnings = creator.createdProjects.reduce(
          (sum: number, p: { currentAmount: number | null }) => sum + Number(p.currentAmount || 0),
          0
        );

        const bankAccount = creator.divinityCoinBankAccount;

        return {
          id: creator.id,
          name: creator.name,
          email: creator.email,
          image: creator.image,
          balance: totalCreatorEarnings,
          projectCount: creator.createdProjects.length,
          projectEarnings,
          projects: creator.createdProjects.map((p: { id: string; title: string; status: string; currentAmount: number | null }) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            amount: Number(p.currentAmount || 0),
          })),
          marketplaceSales: {
            totalAmount: totalMarketplaceSales,
            creatorEarnings: totalCreatorEarnings,
            count: allPurchases.length,
          },
          hasBank: !!bankAccount,
          bankVerified: bankAccount?.isVerified || false,
          bankAccount: bankAccount
            ? {
                id: bankAccount.id,
                bankName: bankAccount.bankNameDisplay,
                accountLastFour: bankAccount.accountLastFour,
                accountType: bankAccount.accountType,
                isVerified: bankAccount.isVerified,
              }
            : null,
          settlements: [],
        };
      })
      .filter((c) => c.balance > 0);

    const balanceStats = {
      totalCreatorsWithBalance: creatorBalances.length,
      totalBalance: creatorBalances.reduce((sum, c) => sum + c.balance, 0),
      creatorsWithoutBank: creatorBalances.filter((c) => !c.hasBank).length,
    };

    return NextResponse.json({
      projects: filteredProjects,
      stats,
      creatorBalances,
      balanceStats,
    });
  } catch (error) {
    adminPayoutsDivinitycoinLogger.error({ err: String(error) }, "Error fetching payouts:");
    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

// POST - Create a DivinityCoin settlement for a project
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { projectId, amount, adminNotes } = body;

    if (!amount) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get the project with creator bank account
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          include: {
            divinityCoinBankAccount: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.paymentProcessor !== "DIVINITYCOIN") {
      return NextResponse.json(
        { error: "This endpoint only handles DivinityCoin project payouts. Stripe projects use Stripe Connect." },
        { status: 400 }
      );
    }

    const bankAccount = project.creator.divinityCoinBankAccount;

    if (!bankAccount) {
      return NextResponse.json(
        { error: "Creator has no bank account on file" },
        { status: 400 }
      );
    }

    // Calculate fee breakdown for the email
    const [totalRaised, backerCount] = await Promise.all([
      db.pledge.aggregate({
        where: { projectId, status: "COMPLETED", deletedAt: null },
        _sum: { amount: true },
      }),
      db.pledge.count({
        where: { projectId, status: "COMPLETED", deletedAt: null },
      }),
    ]);
    const grossAmount = Number(totalRaised._sum.amount || 0);
    const partnerFee = Math.round((grossAmount * 0.06 + 0.30 * backerCount) * 100) / 100;
    const platformFee = Math.round(grossAmount * 0.03 * 100) / 100;

    // Create the DivinityCoin settlement record as COMPLETED
    const settlement = await db.divinityCoinSettlement.create({
      data: {
        bankAccountId: bankAccount.id,
        projectId,
        projectName: project.title,
        amount,
        status: "COMPLETED",
        completedAt: new Date(),
        adminNotes: adminNotes || null,
        processedBy: authResult.user.id,
      },
    });

    // Send email notification to creator (fire-and-forget, don't block response)
    sendPayoutCreatedEmail(
      project.creator.email!,
      project.creator.name || "Creator",
      project.title,
      `/projects/${project.slug}`,
      grossAmount,
      partnerFee,
      platformFee,
      Number(amount),
      bankAccount.bankNameDisplay || "Bank Account",
      bankAccount.accountLastFour || "****"
    ).catch((emailError) => {
      adminPayoutsDivinitycoinLogger.error({ err: String(emailError) }, "Failed to send payout created email:");
    });

    return NextResponse.json({
      success: true,
      settlement,
      type: "PROJECT_PAYOUT",
    });
  } catch (error) {
    adminPayoutsDivinitycoinLogger.error({ err: String(error) }, "Error creating settlement:");
    return NextResponse.json(
      { error: "Failed to create settlement" },
      { status: 500 }
    );
  }
}

// PATCH - Update settlement status
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { settlementId, action, adminNotes } = body;

    if (!settlementId || !action) {
      return NextResponse.json(
        { error: "Settlement ID and action are required" },
        { status: 400 }
      );
    }

    const settlement = await db.divinityCoinSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "INITIATE":
        if (settlement.status !== "PENDING") {
          return NextResponse.json(
            { error: "Only pending settlements can be initiated" },
            { status: 400 }
          );
        }
        updateData = {
          status: "INITIATED",
          initiatedAt: new Date(),
          processedBy: authResult.user.id,
          adminNotes: adminNotes || settlement.adminNotes,
        };
        break;

      case "PROCESS":
        if (settlement.status !== "PENDING" && settlement.status !== "INITIATED") {
          return NextResponse.json(
            { error: "Only pending or initiated settlements can be processed" },
            { status: 400 }
          );
        }
        updateData = {
          status: "PROCESSING",
          processedAt: new Date(),
          processedBy: authResult.user.id,
          adminNotes: adminNotes || settlement.adminNotes,
        };
        break;

      case "COMPLETE":
        if (settlement.status !== "PROCESSING") {
          return NextResponse.json(
            { error: "Only processing settlements can be completed" },
            { status: 400 }
          );
        }
        updateData = {
          status: "COMPLETED",
          completedAt: new Date(),
          adminNotes: adminNotes || settlement.adminNotes,
        };
        break;

      case "FAIL":
        if (settlement.status === "COMPLETED" || settlement.status === "CANCELLED") {
          return NextResponse.json(
            { error: "Cannot fail completed or cancelled settlements" },
            { status: 400 }
          );
        }
        updateData = {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: adminNotes || "Settlement failed",
          adminNotes: adminNotes || settlement.adminNotes,
        };
        break;

      case "CANCEL":
        if (settlement.status === "COMPLETED") {
          return NextResponse.json(
            { error: "Cannot cancel completed settlements" },
            { status: 400 }
          );
        }
        updateData = {
          status: "CANCELLED",
          adminNotes: adminNotes || settlement.adminNotes,
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    const updatedSettlement = await db.divinityCoinSettlement.update({
      where: { id: settlementId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      settlement: updatedSettlement,
    });
  } catch (error) {
    adminPayoutsDivinitycoinLogger.error({ err: String(error) }, "Error updating settlement:");
    return NextResponse.json(
      { error: "Failed to update settlement" },
      { status: 500 }
    );
  }
}
