import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Unified transaction type for the admin diagnostic view
interface UnifiedTransaction {
  id: string;
  type: "PLEDGE" | "MARKETPLACE" | "DC_TRANSACTION" | "DC_REDEMPTION" | "PAYOUT" | "SETTLEMENT";
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  projectId: string | null;
  projectName: string | null;
  itemDescription: string;
  amount: number;
  currency: string;
  processorFees: number;
  platformFees: number;
  paymentProcessor: string | null;
  stripePaymentIntentId: string | null;
  stripeSetupIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  divinityCoinPaymentId: string | null;
  externalTransactionId: string | null;
  status: string;
  failureReason: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  chargedImmediately: boolean | null;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * GET /api/admin/transactions
 *
 * Unified transaction diagnostic endpoint that queries ALL transaction types:
 * - Pledges (crowdfunding)
 * - Marketplace purchases (digital marketplace)
 * - DivinityCoin transactions (internal ledger)
 * - DivinityCoin redemptions (gift cards)
 * - Payouts (creator payouts)
 * - DivinityCoin settlements (bank settlements)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const status = searchParams.get("status") || "all";
    const processor = searchParams.get("processor") || "all";
    const search = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    const results: UnifiedTransaction[] = [];

    // Query each type based on filter
    const shouldQuery = (t: string) => type === "all" || type === t;

    // 1. PLEDGES
    if (shouldQuery("pledge")) {
      const pledges = await queryPledges(search, status, processor, dateFilter);
      results.push(...pledges);
    }

    // 2. MARKETPLACE PURCHASES
    if (shouldQuery("marketplace")) {
      const purchases = await queryMarketplacePurchases(search, status, processor, dateFilter);
      results.push(...purchases);
    }

    // 3. DIVINITYCOIN TRANSACTIONS
    if (shouldQuery("dc_transaction")) {
      const dcTxns = await queryDCTransactions(search, dateFilter);
      results.push(...dcTxns);
    }

    // 4. DIVINITYCOIN REDEMPTIONS
    if (shouldQuery("dc_redemption")) {
      const redemptions = await queryDCRedemptions(search, dateFilter);
      results.push(...redemptions);
    }

    // 5. PAYOUTS
    if (shouldQuery("payout")) {
      const payouts = await queryPayouts(search, status, dateFilter);
      results.push(...payouts);
    }

    // 6. DC SETTLEMENTS
    if (shouldQuery("settlement")) {
      const settlements = await querySettlements(search, status, dateFilter);
      results.push(...settlements);
    }

    // Sort by date descending
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const totalCount = results.length;
    const paginatedResults = results.slice((page - 1) * limit, page * limit);

    // Compute stats
    const stats = computeStats(results);

    return NextResponse.json({
      transactions: paginatedResults,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("Error fetching unified transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeStats(transactions: UnifiedTransaction[]): Record<string, any> {
  const pledges = transactions.filter(t => t.type === "PLEDGE");
  const marketplace = transactions.filter(t => t.type === "MARKETPLACE");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return {
    totalTransactions: transactions.length,
    totalVolume: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),

    pledgeCount: pledges.length,
    pledgeVolume: pledges.reduce((sum, t) => sum + t.amount, 0),
    pledgeCompleted: pledges.filter(t => t.status === "COMPLETED").length,
    pledgeFailed: pledges.filter(t => t.status === "FAILED").length,
    pledgePending: pledges.filter(t => t.status === "PENDING").length,
    pledgeRefunded: pledges.filter(t => t.status === "REFUNDED").length,

    marketplaceCount: marketplace.length,
    marketplaceVolume: marketplace.reduce((sum, t) => sum + t.amount, 0),

    failedTransactions: transactions.filter(t => t.status === "FAILED").length,
    refundedTransactions: transactions.filter(t => t.status === "REFUNDED").length,

    stripeTransactions: transactions.filter(t => t.paymentProcessor === "STRIPE").length,
    dcTransactions: transactions.filter(t => t.paymentProcessor === "DIVINITYCOIN").length,

    todayTransactions: transactions.filter(t => new Date(t.createdAt) >= todayStart).length,
    todayVolume: transactions
      .filter(t => new Date(t.createdAt) >= todayStart)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0),

    totalPlatformFees: transactions.reduce((sum, t) => sum + t.platformFees, 0),
    totalProcessorFees: transactions.reduce((sum, t) => sum + t.processorFees, 0),

    byType: {
      PLEDGE: pledges.length,
      MARKETPLACE: marketplace.length,
      DC_TRANSACTION: transactions.filter(t => t.type === "DC_TRANSACTION").length,
      DC_REDEMPTION: transactions.filter(t => t.type === "DC_REDEMPTION").length,
      PAYOUT: transactions.filter(t => t.type === "PAYOUT").length,
      SETTLEMENT: transactions.filter(t => t.type === "SETTLEMENT").length,
    },

    byStatus: {
      PENDING: transactions.filter(t => t.status === "PENDING").length,
      COMPLETED: transactions.filter(t => t.status === "COMPLETED").length,
      FAILED: transactions.filter(t => t.status === "FAILED").length,
      REFUNDED: transactions.filter(t => t.status === "REFUNDED").length,
      CANCELLED: transactions.filter(t => t.status === "CANCELLED").length,
      CHARGEBACK: transactions.filter(t => t.status === "CHARGEBACK").length,
    },
  };
}

async function queryPledges(
  search: string,
  status: string,
  processor: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<UnifiedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { deletedAt: null };

  if (status !== "all") where.status = status;
  if (processor !== "all") where.paymentProcessor = processor;
  if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { project: { title: { contains: search, mode: "insensitive" } } },
      { stripePaymentIntentId: { contains: search, mode: "insensitive" } },
      { stripeSetupIntentId: { contains: search, mode: "insensitive" } },
      { divinityCoinPaymentId: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  const pledges = await db.pledge.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, title: true } },
      reward: { select: { id: true, title: true } },
      addons: {
        include: { addon: { select: { title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return pledges.map((p: typeof pledges[number]) => {
    const addonNames = p.addons.map((a: typeof p.addons[number]) => a.addon.title).join(", ");
    const description = p.reward
      ? `${p.reward.title}${addonNames ? ` + ${addonNames}` : ""}`
      : `Pledge${addonNames ? ` (${addonNames})` : ""}`;

    return {
      id: p.id,
      type: "PLEDGE" as const,
      userId: p.userId,
      userName: p.user.name,
      userEmail: p.user.email,
      userImage: p.user.image,
      projectId: p.projectId,
      projectName: p.project.title,
      itemDescription: description,
      amount: Number(p.amount),
      currency: "USD",
      processorFees: 0,
      platformFees: 0,
      paymentProcessor: p.paymentProcessor,
      stripePaymentIntentId: p.stripePaymentIntentId,
      stripeSetupIntentId: p.stripeSetupIntentId,
      stripeCheckoutSessionId: null,
      divinityCoinPaymentId: p.divinityCoinPaymentId,
      externalTransactionId: p.stripePaymentIntentId || p.stripeSetupIntentId || p.divinityCoinPaymentId,
      status: p.status,
      failureReason: p.lastFailureReason,
      retryCount: p.retryCount,
      nextRetryAt: p.nextRetryAt?.toISOString() || null,
      chargedImmediately: p.chargedImmediately,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.status === "COMPLETED" ? p.updatedAt.toISOString() : null,
      refundedAt: p.status === "REFUNDED" ? p.updatedAt.toISOString() : null,
      metadata: p.metadata as Record<string, unknown> | null,
    };
  });
}

async function queryMarketplacePurchases(
  search: string,
  status: string,
  processor: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<UnifiedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (status !== "all") where.status = status;
  if (processor !== "all") where.paymentProcessor = processor;
  if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

  if (search) {
    where.OR = [
      { buyer: { name: { contains: search, mode: "insensitive" } } },
      { buyer: { email: { contains: search, mode: "insensitive" } } },
      { book: { title: { contains: search, mode: "insensitive" } } },
      { stripePaymentIntentId: { contains: search, mode: "insensitive" } },
      { stripeCheckoutSessionId: { contains: search, mode: "insensitive" } },
      { divinityCoinPaymentId: { contains: search, mode: "insensitive" } },
      { transactionId: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  const purchases = await db.marketplacePurchase.findMany({
    where,
    include: {
      book: {
        select: {
          id: true,
          title: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      },
      buyer: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return purchases.map((p: typeof purchases[number]) => ({
    id: p.id,
    type: "MARKETPLACE" as const,
    userId: p.buyerId,
    userName: p.buyer.name,
    userEmail: p.buyer.email,
    userImage: p.buyer.image,
    projectId: null,
    projectName: p.book.title,
    itemDescription: `Marketplace: ${p.book.title} (by ${p.book.creator.name || p.book.creator.email})`,
    amount: Number(p.amount),
    currency: p.currency,
    processorFees: 0,
    platformFees: Number(p.platformFee),
    paymentProcessor: p.paymentProcessor,
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeSetupIntentId: null,
    stripeCheckoutSessionId: p.stripeCheckoutSessionId,
    divinityCoinPaymentId: p.divinityCoinPaymentId,
    externalTransactionId: p.stripePaymentIntentId || p.stripeCheckoutSessionId || p.divinityCoinPaymentId || p.transactionId,
    status: p.status,
    failureReason: null,
    retryCount: 0,
    nextRetryAt: null,
    chargedImmediately: null,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() || null,
    refundedAt: p.refundedAt?.toISOString() || null,
    metadata: null,
  }));
}

async function queryDCTransactions(
  search: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<UnifiedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { description: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  const txns = await db.divinityCoinTransaction.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      pledge: {
        select: {
          id: true,
          project: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return txns.map((t: typeof txns[number]) => ({
    id: t.id,
    type: "DC_TRANSACTION" as const,
    userId: t.userId,
    userName: t.user.name,
    userEmail: t.user.email,
    userImage: t.user.image,
    projectId: t.pledge?.project?.id || null,
    projectName: t.pledge?.project?.title || null,
    itemDescription: t.description || `DC ${t.type}`,
    amount: Number(t.amount),
    currency: "USD",
    processorFees: 0,
    platformFees: 0,
    paymentProcessor: "DIVINITYCOIN",
    stripePaymentIntentId: null,
    stripeSetupIntentId: null,
    stripeCheckoutSessionId: null,
    divinityCoinPaymentId: null,
    externalTransactionId: t.id,
    status: t.type === "REFUND" || t.type === "REFUND_DEDUCTION" ? "REFUNDED" : "COMPLETED",
    failureReason: null,
    retryCount: 0,
    nextRetryAt: null,
    chargedImmediately: null,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.createdAt.toISOString(),
    refundedAt: t.type === "REFUND" ? t.createdAt.toISOString() : null,
    metadata: t.metadata ? JSON.parse(t.metadata) : null,
  }));
}

async function queryDCRedemptions(
  search: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<UnifiedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (dateFilter.gte || dateFilter.lte) where.redeemedAt = dateFilter;

  if (search) {
    where.OR = [
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { code: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  const redemptions = await db.divinityCoinRedemption.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { redeemedAt: "desc" },
    take: 500,
  });

  return redemptions.map((r: typeof redemptions[number]) => ({
    id: r.id,
    type: "DC_REDEMPTION" as const,
    userId: r.userId,
    userName: r.user.name,
    userEmail: r.user.email,
    userImage: r.user.image,
    projectId: null,
    projectName: null,
    itemDescription: `Gift Card Redeemed: ${r.code}`,
    amount: Number(r.amount),
    currency: "USD",
    processorFees: 0,
    platformFees: 0,
    paymentProcessor: "DIVINITYCOIN",
    stripePaymentIntentId: null,
    stripeSetupIntentId: null,
    stripeCheckoutSessionId: null,
    divinityCoinPaymentId: null,
    externalTransactionId: r.code,
    status: "COMPLETED",
    failureReason: null,
    retryCount: 0,
    nextRetryAt: null,
    chargedImmediately: null,
    createdAt: r.redeemedAt.toISOString(),
    completedAt: r.redeemedAt.toISOString(),
    refundedAt: null,
    metadata: null,
  }));
}

async function queryPayouts(
  search: string,
  status: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<UnifiedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { deletedAt: null };

  if (status !== "all") where.status = status;
  if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

  if (search) {
    where.OR = [
      { project: { title: { contains: search, mode: "insensitive" } } },
      { project: { user: { name: { contains: search, mode: "insensitive" } } } },
      { project: { user: { email: { contains: search, mode: "insensitive" } } } },
      { payoutId: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  const payouts = await db.payout.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          title: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return payouts.map((p: typeof payouts[number]) => ({
    id: p.id,
    type: "PAYOUT" as const,
    userId: p.project.user.id,
    userName: p.project.user.name,
    userEmail: p.project.user.email,
    userImage: p.project.user.image,
    projectId: p.projectId,
    projectName: p.project.title,
    itemDescription: `${p.type} Payout - ${p.project.title}`,
    amount: Number(p.amount),
    currency: "USD",
    processorFees: Number(p.processorFees),
    platformFees: Number(p.platformFees),
    paymentProcessor: null,
    stripePaymentIntentId: null,
    stripeSetupIntentId: null,
    stripeCheckoutSessionId: null,
    divinityCoinPaymentId: null,
    externalTransactionId: p.payoutId,
    status: p.status,
    failureReason: null,
    retryCount: 0,
    nextRetryAt: null,
    chargedImmediately: null,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.sentAt?.toISOString() || null,
    refundedAt: null,
    metadata: null,
  }));
}

async function querySettlements(
  search: string,
  status: string,
  dateFilter: { gte?: Date; lte?: Date }
): Promise<UnifiedTransaction[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (status !== "all") {
    // Map common statuses to settlement-specific statuses
    const statusMap: Record<string, string> = {
      PENDING: "PENDING",
      PROCESSING: "PROCESSING",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
      CANCELLED: "CANCELLED",
    };
    if (statusMap[status]) where.status = statusMap[status];
  }
  if (dateFilter.gte || dateFilter.lte) where.createdAt = dateFilter;

  if (search) {
    where.OR = [
      { projectName: { contains: search, mode: "insensitive" } },
      { bankAccount: { user: { name: { contains: search, mode: "insensitive" } } } },
      { bankAccount: { user: { email: { contains: search, mode: "insensitive" } } } },
      { divinitySettlementId: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  const settlements = await db.divinityCoinSettlement.findMany({
    where,
    include: {
      bankAccount: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return settlements.map((s: typeof settlements[number]) => ({
    id: s.id,
    type: "SETTLEMENT" as const,
    userId: s.bankAccount.user.id,
    userName: s.bankAccount.user.name,
    userEmail: s.bankAccount.user.email,
    userImage: s.bankAccount.user.image,
    projectId: s.projectId,
    projectName: s.projectName || s.project?.title || null,
    itemDescription: `DC Settlement - ${s.projectName || s.project?.title || "N/A"}`,
    amount: Number(s.amount),
    currency: s.currency,
    processorFees: 0,
    platformFees: 0,
    paymentProcessor: "DIVINITYCOIN",
    stripePaymentIntentId: null,
    stripeSetupIntentId: null,
    stripeCheckoutSessionId: null,
    divinityCoinPaymentId: null,
    externalTransactionId: s.divinitySettlementId,
    status: s.status,
    failureReason: s.failureReason,
    retryCount: 0,
    nextRetryAt: null,
    chargedImmediately: null,
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt?.toISOString() || null,
    refundedAt: null,
    metadata: s.adminNotes ? { adminNotes: s.adminNotes, processedBy: s.processedBy } : null,
  }));
}
