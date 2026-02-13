import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

// GET - Fetch DivinityCoin projects that need payouts
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status"); // pending, settled, all

    // Build where clause for DivinityCoin AND Chain2Pay projects that are funded/failed
    const where: Record<string, unknown> = {
      paymentProcessor: { in: ["DIVINITYCOIN", "CHAIN2PAY"] },
      status: { in: ["FUNDED", "FAILED"] },
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { creator: { name: { contains: search, mode: "insensitive" } } },
        { creator: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Fetch DivinityCoin and Chain2Pay projects with creator and bank account info
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
            chain2payBankAccount: {
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
            paymentProcessor: { in: ["DIVINITYCOIN", "CHAIN2PAY"] },
            deletedAt: null,
          },
          select: {
            id: true,
            amount: true,
            paymentProcessor: true,
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
        chain2paySettlements: {
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

    // Calculate stats and format the response
    const formattedProjects = projects.map((project) => {
      const isChain2Pay = project.paymentProcessor === "CHAIN2PAY";

      // Calculate total raised from completed pledges matching processor
      const totalRaised = project.pledges.reduce(
        (sum: number, pledge: { id: string; amount: unknown; paymentProcessor: string }) => sum + Number(pledge.amount),
        0
      );

      // Calculate total fee: 5.5% for Chain2Pay (3% platform + 2.5% processing), 5% for DivinityCoin
      const feeRate = isChain2Pay ? 0.055 : 0.05;
      const platformFee = totalRaised * feeRate;
      const amountOwed = totalRaised - platformFee;

      // Use correct settlements based on processor
      const settlements = isChain2Pay
        ? project.chain2paySettlements
        : project.divinityCoinSettlements;

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

      const remainingAmount = amountOwed - amountSettled;

      // Get the correct bank account based on processor
      const bankAccount = isChain2Pay
        ? project.creator.chain2payBankAccount
        : project.creator.divinityCoinBankAccount;

      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        imageUrl: project.imageUrl,
        status: project.status,
        paymentProcessor: project.paymentProcessor,
        fundedAt: project.fundedAt,
        totalRaised,
        platformFee,
        amountOwed,
        amountSettled,
        remainingAmount,
        backerCount: project.pledges.length,
        hasBank: !!bankAccount,
        bankVerified: bankAccount?.isVerified || false,
        hasPendingSettlement: pendingSettlements.length > 0,
        settlementStatus: pendingSettlements.length > 0
          ? "processing"
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
    }

    // Calculate summary stats
    const stats = {
      totalProjects: filteredProjects.length,
      pendingPayouts: filteredProjects.filter((p) => p.settlementStatus === "pending").length,
      processingPayouts: filteredProjects.filter((p) => p.settlementStatus === "processing").length,
      settledPayouts: filteredProjects.filter((p) => p.settlementStatus === "settled").length,
      totalAmountOwed: filteredProjects.reduce((sum, p) => sum + p.amountOwed, 0),
      totalAmountSettled: filteredProjects.reduce((sum, p) => sum + p.amountSettled, 0),
      totalRemaining: filteredProjects.reduce((sum, p) => sum + p.remainingAmount, 0),
      projectsWithoutBank: filteredProjects.filter((p) => !p.hasBank).length,
    };

    // Fetch ONLY actual creators (users who have projects) with DivinityCoin balances
    // This excludes regular backers who might have balance for other reasons
    const creatorsWithBalances = await db.user.findMany({
      where: {
        divinityCoinBalance: { gt: 0 },
        // Must have at least one project (funded or otherwise) to be considered a creator
        createdProjects: {
          some: {
            status: { in: ["FUNDED", "LIVE", "FAILED", "DRAFT", "SUBMITTED", "APPROVED"] },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        divinityCoinBalance: true,
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
            status: { in: ["FUNDED", "LIVE", "FAILED"] },
          },
          select: {
            id: true,
            title: true,
            status: true,
            currentAmount: true,
          },
        },
      },
      orderBy: { divinityCoinBalance: "desc" },
    });

    // Get marketplace sales info per creator
    const marketplaceSalesPromises = creatorsWithBalances.map(async (creator) => {
      const sales = await db.marketplacePurchase.aggregate({
        where: {
          book: { creatorId: creator.id },
          paymentProcessor: "DIVINITYCOIN",
          status: "COMPLETED",
        },
        _sum: { amount: true, creatorPayout: true },
        _count: true,
      });

      // Get existing non-project settlements for this creator
      const existingSettlements = creator.divinityCoinBankAccount
        ? await db.divinityCoinSettlement.findMany({
            where: {
              bankAccountId: creator.divinityCoinBankAccount.id,
              projectId: null, // Non-project settlements (for balance payouts)
            },
            select: {
              id: true,
              amount: true,
              status: true,
              processedAt: true,
              completedAt: true,
            },
          })
        : [];

      // Calculate total earnings from their projects
      const projectEarnings = creator.createdProjects.reduce(
        (sum: number, p: { currentAmount: unknown }) => sum + Number(p.currentAmount || 0),
        0
      );

      return {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        image: creator.image,
        balance: Number(creator.divinityCoinBalance),
        projectCount: creator.createdProjects.length,
        projectEarnings,
        projects: creator.createdProjects.map((p: { id: string; title: string; status: string; currentAmount: unknown }) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          amount: Number(p.currentAmount || 0),
        })),
        marketplaceSales: {
          totalAmount: Number(sales._sum.amount || 0),
          creatorEarnings: Number(sales._sum.creatorPayout || 0),
          count: sales._count,
        },
        hasBank: !!creator.divinityCoinBankAccount,
        bankVerified: creator.divinityCoinBankAccount?.isVerified || false,
        bankAccount: creator.divinityCoinBankAccount
          ? {
              id: creator.divinityCoinBankAccount.id,
              bankName: creator.divinityCoinBankAccount.bankNameDisplay,
              accountLastFour: creator.divinityCoinBankAccount.accountLastFour,
              accountType: creator.divinityCoinBankAccount.accountType,
              isVerified: creator.divinityCoinBankAccount.isVerified,
            }
          : null,
        settlements: existingSettlements.map((s: { id: string; amount: unknown; status: string; processedAt: Date | null; completedAt: Date | null }) => ({
          id: s.id,
          amount: Number(s.amount),
          status: s.status,
          processedAt: s.processedAt,
          completedAt: s.completedAt,
        })),
      };
    });

    const creatorBalances = await Promise.all(marketplaceSalesPromises);

    // Calculate creator balance stats
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
    console.error("Error fetching DivinityCoin payouts:", error);
    return NextResponse.json(
      { error: "Failed to fetch DivinityCoin payouts" },
      { status: 500 }
    );
  }
}

// POST - Create a DivinityCoin settlement for a project OR a creator balance payout
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { projectId, creatorId, amount, adminNotes, type } = body;

    if (!amount) {
      return NextResponse.json(
        { error: "Amount is required" },
        { status: 400 }
      );
    }

    // Handle creator balance payout (from marketplace, etc.)
    if (type === "BALANCE_PAYOUT" || (!projectId && creatorId)) {
      if (!creatorId) {
        return NextResponse.json(
          { error: "Creator ID is required for balance payouts" },
          { status: 400 }
        );
      }

      const creator = await db.user.findUnique({
        where: { id: creatorId },
        include: {
          divinityCoinBankAccount: true,
        },
      });

      if (!creator) {
        return NextResponse.json(
          { error: "Creator not found" },
          { status: 404 }
        );
      }

      if (!creator.divinityCoinBankAccount) {
        return NextResponse.json(
          { error: "Creator has no bank account on file" },
          { status: 400 }
        );
      }

      const creatorBalance = Number(creator.divinityCoinBalance || 0);
      if (amount > creatorBalance) {
        return NextResponse.json(
          { error: `Amount exceeds creator balance (${creatorBalance.toFixed(2)})` },
          { status: 400 }
        );
      }

      // Create the settlement record (without projectId - for balance payout)
      const settlement = await db.divinityCoinSettlement.create({
        data: {
          bankAccountId: creator.divinityCoinBankAccount.id,
          projectId: null,
          projectName: `Balance Payout - ${creator.name || creator.email}`,
          amount,
          status: "PENDING",
          adminNotes: adminNotes || `DivinityCoin balance payout for ${creator.email}`,
          processedBy: authResult.user.id,
        },
      });

      // Deduct from creator's balance
      await db.user.update({
        where: { id: creatorId },
        data: {
          divinityCoinBalance: { decrement: amount },
        },
      });

      // Create transaction record for audit
      await db.divinityCoinTransaction.create({
        data: {
          userId: creatorId,
          amount: -amount, // Negative for payout
          type: "PAYOUT",
          description: `Balance payout - Settlement #${settlement.id}`,
          metadata: JSON.stringify({
            settlementId: settlement.id,
            processedBy: authResult.user.id,
            payoutDate: new Date().toISOString(),
          }),
        },
      });

      return NextResponse.json({
        success: true,
        settlement,
        type: "BALANCE_PAYOUT",
      });
    }

    // Handle project-specific settlement
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID or Creator ID is required" },
        { status: 400 }
      );
    }

    // Get the project with creator bank accounts
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          include: {
            divinityCoinBankAccount: true,
            chain2payBankAccount: true,
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

    if (project.paymentProcessor !== "DIVINITYCOIN" && project.paymentProcessor !== "CHAIN2PAY") {
      return NextResponse.json(
        { error: "Project is not using DivinityCoin or Chain2Pay payment processor" },
        { status: 400 }
      );
    }

    // Get the correct bank account based on the project's payment processor
    const isChain2Pay = project.paymentProcessor === "CHAIN2PAY";
    const bankAccount = isChain2Pay
      ? project.creator.chain2payBankAccount
      : project.creator.divinityCoinBankAccount;

    if (!bankAccount) {
      return NextResponse.json(
        { error: `Creator has no ${isChain2Pay ? "Chain2Pay" : "DivinityCoin"} bank account on file` },
        { status: 400 }
      );
    }

    // Create the settlement record using the appropriate model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let settlement: any;
    if (isChain2Pay) {
      settlement = await db.chain2PaySettlement.create({
        data: {
          bankAccountId: bankAccount.id,
          projectId,
          projectName: project.title,
          amount,
          status: "PENDING",
          adminNotes: adminNotes || null,
          processedBy: authResult.user.id,
        },
      });
    } else {
      settlement = await db.divinityCoinSettlement.create({
        data: {
          bankAccountId: bankAccount.id,
          projectId,
          projectName: project.title,
          amount,
          status: "PENDING",
          adminNotes: adminNotes || null,
          processedBy: authResult.user.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settlement,
      type: "PROJECT_PAYOUT",
    });
  } catch (error) {
    console.error("Error creating DivinityCoin settlement:", error);
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
    console.error("Error updating settlement:", error);
    return NextResponse.json(
      { error: "Failed to update settlement" },
      { status: 500 }
    );
  }
}
