import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminTransactionsLogger = logger.child({ module: "admin-transactions" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/transactions/[id]
 *
 * Get full diagnostic details for a single transaction.
 * Accepts query param ?type=PLEDGE|MARKETPLACE|DC_TRANSACTION|DC_REDEMPTION|PAYOUT|SETTLEMENT
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type) {
      return NextResponse.json({ error: "type parameter required" }, { status: 400 });
    }

    let detail = null;

    switch (type) {
      case "PLEDGE":
        detail = await getPledgeDetail(id);
        break;
      case "MARKETPLACE":
        detail = await getMarketplacePurchaseDetail(id);
        break;
      case "DC_TRANSACTION":
        detail = await getDCTransactionDetail(id);
        break;
      case "DC_REDEMPTION":
        detail = await getDCRedemptionDetail(id);
        break;
      case "PAYOUT":
        detail = await getPayoutDetail(id);
        break;
      case "SETTLEMENT":
        detail = await getSettlementDetail(id);
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!detail) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error) {
    adminTransactionsLogger.error({ err: String(error) }, "Error fetching transaction detail:");
    return NextResponse.json(
      { error: "Failed to fetch transaction detail" },
      { status: 500 }
    );
  }
}

async function getPledgeDetail(id: string) {
  const pledge = await db.pledge.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          stripeCustomerId: true,
          divinityCoinBalance: true,
          createdAt: true,
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          goalAmount: true,
          currentAmount: true,
          fundedAt: true,
          paymentProcessor: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      },
      reward: {
        select: {
          id: true,
          title: true,
          amount: true,
          type: true,
          estimatedDelivery: true,
        },
      },
      addons: {
        include: {
          addon: { select: { id: true, title: true, amount: true, type: true } },
        },
      },
      divinityCoinTransactions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pledge) return null;

  return {
    type: "PLEDGE",
    record: {
      id: pledge.id,
      status: pledge.status,
      amount: Number(pledge.amount),
      rewardAmount: Number(pledge.rewardAmount),
      addonsAmount: Number(pledge.addonsAmount),
      shippingAmount: Number(pledge.shippingAmount),
      paymentProcessor: pledge.paymentProcessor,
      stripePaymentIntentId: pledge.stripePaymentIntentId,
      stripeSetupIntentId: pledge.stripeSetupIntentId,
      stripePaymentMethodId: pledge.stripePaymentMethodId,
      stripeCustomerId: pledge.stripeCustomerId,
      divinityCoinPaymentId: pledge.divinityCoinPaymentId,
      chargedImmediately: pledge.chargedImmediately,
      retryCount: pledge.retryCount,
      nextRetryAt: pledge.nextRetryAt?.toISOString() || null,
      lastFailureReason: pledge.lastFailureReason,
      backerNumber: pledge.backerNumber,
      surveyCompleted: pledge.surveyCompleted,
      fulfillmentStatus: pledge.fulfillmentStatus,
      confirmationEmailSent: pledge.confirmationEmailSent,
      shippingAddress: pledge.shippingAddress,
      surveyResponses: pledge.surveyResponses,
      metadata: pledge.metadata,
      createdAt: pledge.createdAt.toISOString(),
      updatedAt: pledge.updatedAt.toISOString(),
      deletedAt: pledge.deletedAt?.toISOString() || null,
    },
    user: {
      ...pledge.user,
      divinityCoinBalance: Number(pledge.user.divinityCoinBalance),
      createdAt: pledge.user.createdAt.toISOString(),
    },
    project: {
      ...pledge.project,
      fundingGoal: Number(pledge.project.goalAmount),
      currentFunding: Number(pledge.project.currentAmount),
      fundedAt: pledge.project.fundedAt?.toISOString() || null,
      creator: pledge.project.creator,
    },
    reward: pledge.reward
      ? {
          ...pledge.reward,
          amount: Number(pledge.reward.amount),
          estimatedDelivery: pledge.reward.estimatedDelivery?.toISOString() || null,
        }
      : null,
    addons: pledge.addons.map((a: typeof pledge.addons[number]) => ({
      id: a.id,
      quantity: a.quantity,
      amount: Number(a.amount),
      addon: {
        ...a.addon,
        amount: Number(a.addon.amount),
      },
    })),
    dcTransactions: pledge.divinityCoinTransactions.map((t: typeof pledge.divinityCoinTransactions[number]) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
    timeline: buildPledgeTimeline(pledge),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPledgeTimeline(pledge: any) {
  const events: { date: string; event: string; detail?: string }[] = [];

  events.push({
    date: pledge.createdAt.toISOString(),
    event: "Pledge Created",
    detail: `$${Number(pledge.amount).toFixed(2)} via ${pledge.paymentProcessor}`,
  });

  if (pledge.stripeSetupIntentId) {
    events.push({
      date: pledge.createdAt.toISOString(),
      event: "SetupIntent Created",
      detail: pledge.stripeSetupIntentId,
    });
  }

  if (pledge.stripePaymentIntentId) {
    events.push({
      date: pledge.createdAt.toISOString(),
      event: "PaymentIntent Created",
      detail: pledge.stripePaymentIntentId,
    });
  }

  if (pledge.chargedImmediately) {
    events.push({
      date: pledge.createdAt.toISOString(),
      event: "Charged Immediately",
      detail: "Campaign was already funded at time of pledge",
    });
  }

  if (pledge.backerNumber) {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Backer Number Assigned",
      detail: `#${pledge.backerNumber}`,
    });
  }

  if (pledge.retryCount > 0) {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: `Payment Retried (${pledge.retryCount}x)`,
      detail: pledge.lastFailureReason || undefined,
    });
  }

  if (pledge.lastFailureReason) {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Last Failure",
      detail: pledge.lastFailureReason,
    });
  }

  if (pledge.status === "COMPLETED") {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Payment Completed",
    });
  }

  if (pledge.status === "FAILED") {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Payment Failed",
      detail: pledge.lastFailureReason || undefined,
    });
  }

  if (pledge.status === "REFUNDED") {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Refunded",
    });
  }

  if (pledge.status === "CANCELLED") {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Cancelled",
    });
  }

  if (pledge.status === "CHARGEBACK") {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Chargeback Filed",
    });
  }

  if (pledge.confirmationEmailSent) {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Confirmation Email Sent",
    });
  }

  if (pledge.surveyCompleted) {
    events.push({
      date: pledge.updatedAt.toISOString(),
      event: "Survey Completed",
    });
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return events;
}

async function getMarketplacePurchaseDetail(id: string) {
  const purchase = await db.marketplacePurchase.findUnique({
    where: { id },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          paymentProcessor: true,
          status: true,
          creator: { select: { id: true, name: true, email: true } },
        },
      },
      buyer: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          stripeCustomerId: true,
          divinityCoinBalance: true,
          createdAt: true,
        },
      },
      codeRedemption: {
        include: {
          code: { select: { code: true, type: true } },
        },
      },
    },
  });

  if (!purchase) return null;

  return {
    type: "MARKETPLACE",
    record: {
      id: purchase.id,
      status: purchase.status,
      amount: Number(purchase.amount),
      platformFee: Number(purchase.platformFee),
      creatorPayout: Number(purchase.creatorPayout),
      currency: purchase.currency,
      paymentProcessor: purchase.paymentProcessor,
      stripePaymentIntentId: purchase.stripePaymentIntentId,
      stripeCheckoutSessionId: purchase.stripeCheckoutSessionId,
      stripeCustomerId: purchase.stripeCustomerId,
      divinityCoinPaymentId: purchase.divinityCoinPaymentId,
      transactionId: purchase.transactionId,
      downloadCount: purchase.downloadCount,
      lastDownloadedAt: purchase.lastDownloadedAt?.toISOString() || null,
      deliveredAt: purchase.deliveredAt?.toISOString() || null,
      refundedAt: purchase.refundedAt?.toISOString() || null,
      refundReason: purchase.refundReason,
      createdAt: purchase.createdAt.toISOString(),
      updatedAt: purchase.updatedAt.toISOString(),
      completedAt: purchase.completedAt?.toISOString() || null,
    },
    user: {
      ...purchase.buyer,
      divinityCoinBalance: Number(purchase.buyer.divinityCoinBalance),
      createdAt: purchase.buyer.createdAt.toISOString(),
    },
    book: {
      ...purchase.book,
      price: Number(purchase.book.price),
    },
    discountCode: purchase.codeRedemption
      ? {
          code: purchase.codeRedemption.code.code,
          type: purchase.codeRedemption.code.type,
          discountAmount: Number(purchase.codeRedemption.discountAmount),
        }
      : null,
  };
}

async function getDCTransactionDetail(id: string) {
  const txn = await db.divinityCoinTransaction.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          divinityCoinBalance: true,
          createdAt: true,
        },
      },
      pledge: {
        include: {
          project: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!txn) return null;

  return {
    type: "DC_TRANSACTION",
    record: {
      id: txn.id,
      txnType: txn.type,
      amount: Number(txn.amount),
      description: txn.description,
      metadata: txn.metadata ? JSON.parse(txn.metadata) : null,
      createdAt: txn.createdAt.toISOString(),
    },
    user: {
      ...txn.user,
      divinityCoinBalance: Number(txn.user.divinityCoinBalance),
      createdAt: txn.user.createdAt.toISOString(),
    },
    pledge: txn.pledge
      ? {
          id: txn.pledge.id,
          status: txn.pledge.status,
          amount: Number(txn.pledge.amount),
          project: txn.pledge.project,
        }
      : null,
  };
}

async function getDCRedemptionDetail(id: string) {
  const redemption = await db.divinityCoinRedemption.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          divinityCoinBalance: true,
          createdAt: true,
        },
      },
    },
  });

  if (!redemption) return null;

  return {
    type: "DC_REDEMPTION",
    record: {
      id: redemption.id,
      code: redemption.code,
      amount: Number(redemption.amount),
      redeemedAt: redemption.redeemedAt.toISOString(),
    },
    user: {
      ...redemption.user,
      divinityCoinBalance: Number(redemption.user.divinityCoinBalance),
      createdAt: redemption.user.createdAt.toISOString(),
    },
  };
}

async function getPayoutDetail(id: string) {
  const payout = await db.payout.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          goalAmount: true,
          currentAmount: true,
          paymentProcessor: true,
          creator: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  if (!payout) return null;

  return {
    type: "PAYOUT",
    record: {
      id: payout.id,
      status: payout.status,
      type: payout.type,
      amount: Number(payout.amount),
      grossAmount: Number(payout.grossAmount),
      processorFees: Number(payout.processorFees),
      platformFees: Number(payout.platformFees),
      payoutId: payout.payoutId,
      bankAccountLast4: payout.bankAccountLast4,
      sentAt: payout.sentAt?.toISOString() || null,
      createdAt: payout.createdAt.toISOString(),
      deletedAt: payout.deletedAt?.toISOString() || null,
    },
    project: {
      ...payout.project,
      fundingGoal: Number(payout.project.goalAmount),
      currentFunding: Number(payout.project.currentAmount),
    },
    creator: payout.project.creator,
  };
}

async function getSettlementDetail(id: string) {
  const settlement = await db.divinityCoinSettlement.findUnique({
    where: { id },
    include: {
      bankAccount: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              divinityCoinBalance: true,
            },
          },
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  if (!settlement) return null;

  return {
    type: "SETTLEMENT",
    record: {
      id: settlement.id,
      status: settlement.status,
      amount: Number(settlement.amount),
      currency: settlement.currency,
      projectName: settlement.projectName,
      divinitySettlementId: settlement.divinitySettlementId,
      divinityBatchId: settlement.divinityBatchId,
      adminNotes: settlement.adminNotes,
      processedBy: settlement.processedBy,
      initiatedAt: settlement.initiatedAt?.toISOString() || null,
      processedAt: settlement.processedAt?.toISOString() || null,
      completedAt: settlement.completedAt?.toISOString() || null,
      failedAt: settlement.failedAt?.toISOString() || null,
      failureReason: settlement.failureReason,
      createdAt: settlement.createdAt.toISOString(),
      updatedAt: settlement.updatedAt.toISOString(),
    },
    bankAccount: {
      accountLastFour: settlement.bankAccount.accountLastFour,
      accountType: settlement.bankAccount.accountType,
      bankNameDisplay: settlement.bankAccount.bankNameDisplay,
      isVerified: settlement.bankAccount.isVerified,
    },
    user: {
      ...settlement.bankAccount.user,
      divinityCoinBalance: Number(settlement.bankAccount.user.divinityCoinBalance),
    },
    project: settlement.project,
  };
}
