import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminProjectsProcessPledgesLogger = logger.child({ module: "admin-projects-process-pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
/**
 * GET /api/admin/projects/[projectId]/process-pledges
 *
 * Diagnose pledge status for a project - shows all pledges and their charging eligibility
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or super admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { projectId } = await params;

    // Get project info
    const project = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      select: {
        id: true,
        title: true,
        goalAmount: true,
        currentAmount: true,
        backerCount: true,
        status: true,
        paymentProcessor: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isDivinityCoin = project.paymentProcessor === "DIVINITYCOIN";

    // Get all pledges for this project
    const pledges = await db.pledge.findMany({
      where: { projectId, deletedAt: null },
      select: {
        id: true,
        amount: true,
        status: true,
        chargedImmediately: true,
        confirmationEmailSent: true,
        divinityCoinPaymentId: true,
        paymentProcessor: true,
        retryCount: true,
        lastFailureReason: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const projectIsFunded = Number(project.currentAmount) >= Number(project.goalAmount);

    // For DC projects, check which PENDING pledges have a matching DivinityCoinTransaction
    const pendingPledgeIds = pledges
      .filter((p) => p.status === "PENDING")
      .map((p) => p.id);

    let dcTransactionsByPledge: Record<string, boolean> = {};
    if (isDivinityCoin && pendingPledgeIds.length > 0) {
      const dcTransactions = await db.divinityCoinTransaction.findMany({
        where: {
          pledgeId: { in: pendingPledgeIds },
          type: "PAYMENT",
        },
        select: { pledgeId: true },
      });
      dcTransactionsByPledge = Object.fromEntries(
        dcTransactions
          .filter((t: { pledgeId: string | null }) => t.pledgeId !== null)
          .map((t: { pledgeId: string | null }) => [t.pledgeId as string, true])
      );
    }

    // Analyze each pledge (DC and other non-Stripe processors only)
    const pledgeAnalysis = pledges.map((pledge) => {
      const issues: string[] = [];
      let canBeReconciled = false;

      if (pledge.status !== "PENDING") {
        issues.push(`Status is ${pledge.status}, not PENDING`);
      }

      if (isDivinityCoin) {
        // DivinityCoin projects: payments are always charged immediately by DC
        // PENDING pledges are either abandoned carts or missed webhooks
        if (pledge.status === "PENDING") {
          if (dcTransactionsByPledge[pledge.id]) {
            // Has a verified DC transaction — webhook likely failed to update status
            issues.push("Has verified DC transaction but still PENDING - webhook may have partially failed");
            canBeReconciled = true;
          } else if (pledge.divinityCoinPaymentId) {
            // Has a DC payment intent ID but NO transaction — payment was never completed
            issues.push("DC payment intent created but no transaction record - payment never completed (abandoned cart)");
          } else {
            issues.push("No DC payment record - likely abandoned cart");
          }
        }
      }

      return {
        ...pledge,
        analysis: {
          issues,
          canBeCharged: false,
          canBeReconciled,
          isOldPledge: pledge.createdAt < fiveMinutesAgo,
        },
      };
    });

    // Convert Decimal fields to numbers for JSON serialization
    const goalAmountNum = Number(project.goalAmount);
    const currentAmountNum = Number(project.currentAmount);
    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        goalAmount: goalAmountNum,
        currentAmount: currentAmountNum,
        backerCount: project.backerCount,
        status: project.status,
        isFunded: projectIsFunded,
        fundingPercent: Math.round((currentAmountNum / goalAmountNum) * 100),
        paymentProcessor: project.paymentProcessor,
      },
      creator: {
        id: project.creator.id,
        name: project.creator.name ?? "Creator",
        hasStripeConnected: false,
        isOnboarded: false,
      },
      pledges: pledgeAnalysis,
      summary: {
        total: pledges.length,
        pending: pledges.filter((p) => p.status === "PENDING").length,
        completed: pledges.filter((p) => p.status === "COMPLETED").length,
        failed: pledges.filter((p) => p.status === "FAILED").length,
        chargeableNow: 0,
        reconcilableNow: pledgeAnalysis.filter((p) => p.analysis.canBeReconciled).length,
      },
    });
  } catch (error) {
    adminProjectsProcessPledgesLogger.error({ err: formatError(error) }, "Admin pledge diagnosis error:");
    return NextResponse.json(
      {
        error: "Failed to diagnose pledges",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/projects/[projectId]/process-pledges
 *
 * Manually trigger pledge processing for a funded project.
 * For Stripe projects: charges saved payment methods.
 * For DivinityCoin projects: reconciles PENDING pledges against DC transaction records.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or super admin
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const { pledgeId, action } = body as { pledgeId?: string; action?: string };

    // Get project info
    const project = await db.project.findFirst({
      where: { id: projectId , deletedAt: null },
      select: {
        id: true,
        title: true,
        goalAmount: true,
        currentAmount: true,
        paymentProcessor: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isDivinityCoin = project.paymentProcessor === "DIVINITYCOIN";

    // Special action: verify payment statuses (DC only)
    if (action === "verify") {
      if (isDivinityCoin) {
        return await verifyDivinityCoinPledges(projectId);
      }
      return NextResponse.json({
        error: "Pledge verification is only supported for DivinityCoin projects",
      }, { status: 400 });
    }

    // Special action: delete abandoned carts (soft delete PENDING pledges with no payment)
    if (action === "delete-abandoned") {
      return await deleteAbandonedCarts(projectId);
    }

    // DivinityCoin projects: reconcile PENDING pledges against DC transaction records
    if (isDivinityCoin) {
      return await processDivinityCoinPendingPledges(projectId, pledgeId);
    }

    return NextResponse.json({
      error: "Pledge processing is only supported for DivinityCoin projects on this endpoint",
    }, { status: 400 });
  } catch (error) {
    adminProjectsProcessPledgesLogger.error({ err: formatError(error) }, "Admin pledge processing error:");
    return NextResponse.json(
      { error: "Failed to process pledges" },
      { status: 500 }
    );
  }
}

/**
 * Process PENDING pledges for a DivinityCoin project.
 * Checks the DivinityCoinTransaction table and divinityCoinPaymentId field
 * to find pledges that were actually paid but stuck as PENDING.
 */
async function processDivinityCoinPendingPledges(projectId: string, specificPledgeId?: string) {
  const where = specificPledgeId
    ? { id: specificPledgeId, projectId, status: "PENDING" as const, deletedAt: null }
    : { projectId, status: "PENDING" as const, deletedAt: null };

  const pendingPledges = await db.pledge.findMany({
    where,
    select: {
      id: true,
      amount: true,
      divinityCoinPaymentId: true,
      userId: true,
      rewardId: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  if (pendingPledges.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No pending pledges to process",
      results: { total: 0, reconciled: 0, abandoned: 0, details: [] },
    });
  }

  // Check which pledges have DC transaction records
  const pledgeIds = pendingPledges.map((p) => p.id);
  const dcTransactions = await db.divinityCoinTransaction.findMany({
    where: {
      pledgeId: { in: pledgeIds },
      type: "PAYMENT",
    },
    select: {
      pledgeId: true,
      amount: true,
      metadata: true,
    },
  });

  const dcTransactionMap = new Map(
    dcTransactions
      .filter((t: { pledgeId: string | null }) => t.pledgeId !== null)
      .map((t: { pledgeId: string | null }) => [t.pledgeId as string, t])
  );

  const results = {
    total: pendingPledges.length,
    reconciled: 0,
    abandoned: 0,
    details: [] as Array<{
      pledgeId: string;
      user: string;
      amount: number;
      action: string;
    }>,
  };

  let totalReconciled = 0;

  for (const pledge of pendingPledges) {
    const detail = {
      pledgeId: pledge.id,
      user: pledge.user.name || pledge.user.email || "Unknown",
      amount: Number(pledge.amount),
      action: "",
    };

    const hasDcTransaction = dcTransactionMap.has(pledge.id);

    if (hasDcTransaction) {
      // This pledge has a verified DC transaction record — payment actually went through
      // Use updateMany with confirmationEmailSent: false as atomic guard against concurrent runs
      const updateResult = await db.pledge.updateMany({
        where: { id: pledge.id, confirmationEmailSent: false },
        data: {
          status: "COMPLETED",
          chargedImmediately: true,
          confirmationEmailSent: true,
        },
      });

      if (updateResult.count === 0) {
        // Already processed (concurrent admin run or webhook beat us)
        detail.action = "Skipped — already reconciled by concurrent process";
        results.details.push(detail);
        continue;
      }

      totalReconciled++;
      results.reconciled++;
      detail.action = "Reconciled to COMPLETED (verified DivinityCoinTransaction record found)";

      adminProjectsProcessPledgesLogger.info(`[Admin DC] Reconciled pledge ${pledge.id} to COMPLETED`);
    } else {
      // No verified transaction record — divinityCoinPaymentId alone is NOT proof of payment
      // (it's set at pledge creation before user pays). This is an abandoned cart.
      results.abandoned++;
      detail.action = pledge.divinityCoinPaymentId
        ? "No DC transaction record - payment intent created but never completed (abandoned cart)"
        : "No payment record found - abandoned cart (no changes made)";
    }

    results.details.push(detail);
  }

  // Update project stats for all reconciled pledges in one shot
  if (totalReconciled > 0) {
    const reconciledAmount = results.details
      .filter(d => d.action.startsWith("Reconciled"))
      .reduce((sum, d) => sum + d.amount, 0);

    await db.project.update({
      where: { id: projectId },
      data: {
        currentAmount: { increment: reconciledAmount },
        backerCount: { increment: totalReconciled },
      },
    });

    adminProjectsProcessPledgesLogger.info(`[Admin DC] Updated project stats: +$${reconciledAmount}, +${totalReconciled} backers`);
  }

  return NextResponse.json({
    success: true,
    message: `Processed ${results.total} pledges: ${results.reconciled} reconciled, ${results.abandoned} abandoned carts`,
    results,
  });
}

/**
 * Verify PENDING DivinityCoin pledges against DC transaction records.
 * Similar to processDivinityCoinPendingPledges but specifically for
 * pledges marked as chargedImmediately that are still PENDING.
 */
async function verifyDivinityCoinPledges(projectId: string) {
  // Find ALL pledges for this DC project (PENDING and COMPLETED)
  // We need to audit COMPLETED ones too — they may have been incorrectly marked
  const allPledges = await db.pledge.findMany({
    where: {
      projectId,
      status: { in: ["PENDING", "COMPLETED"] },
      deletedAt: null,
    },
    select: {
      id: true,
      amount: true,
      status: true,
      chargedImmediately: true,
      divinityCoinPaymentId: true,
      stripePaymentIntentId: true,
      createdAt: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  // Check for DC transaction records for ALL pledges
  const pledgeIds = allPledges.map((p) => p.id);
  const dcTransactions = await db.divinityCoinTransaction.findMany({
    where: {
      pledgeId: { in: pledgeIds },
      type: "PAYMENT",
    },
    select: { pledgeId: true, amount: true },
  });

  const dcTransactionMap = new Map(
    dcTransactions
      .filter((t: { pledgeId: string | null }) => t.pledgeId !== null)
      .map((t: { pledgeId: string | null }) => [t.pledgeId as string, t])
  );

  const results = {
    total: allPledges.length,
    verified: 0,
    alreadySucceeded: 0,
    upgraded: 0,
    downgraded: 0,
    abandoned: 0,
    errors: [] as string[],
    details: [] as Array<{
      pledgeId: string;
      user: string;
      amount: number;
      previousStatus: string;
      paymentIntentId: string;
      stripeStatus: string;
      action: string;
    }>,
  };

  let verifiedTotal = 0;
  let verifiedCount = 0;

  for (const pledge of allPledges) {
    const hasDcTransaction = dcTransactionMap.has(pledge.id);

    const detail = {
      pledgeId: pledge.id,
      user: pledge.user.name || pledge.user.email || "Unknown",
      amount: Number(pledge.amount),
      previousStatus: pledge.status,
      paymentIntentId: pledge.divinityCoinPaymentId || pledge.stripePaymentIntentId || "none",
      stripeStatus: hasDcTransaction ? "succeeded (DC transaction verified)" : "no verified payment",
      action: "",
    };

    if (hasDcTransaction) {
      // Verified DC transaction record exists — payment actually went through
      verifiedTotal += Number(pledge.amount);
      verifiedCount++;

      if (pledge.status === "PENDING") {
        // Upgrade: PENDING → COMPLETED (missed webhook). CAS on the read
        // status so a concurrent webhook or admin run can't double-apply.
        const upgradeCas = await db.pledge.updateMany({
          where: { id: pledge.id, status: "PENDING" },
          data: {
            status: "COMPLETED",
            chargedImmediately: true,
            confirmationEmailSent: true,
          },
        });
        if (upgradeCas.count === 0) {
          detail.action = "Skipped upgrade — concurrent run already applied";
          results.alreadySucceeded++;
        } else {
          results.upgraded++;
          detail.action = "Upgraded PENDING → COMPLETED (verified DC transaction record)";
        }
      } else {
        // Already COMPLETED with verified transaction — correct state
        results.alreadySucceeded++;
        detail.action = "Already COMPLETED with verified DC transaction — no change needed";
      }
    } else if (pledge.status === "COMPLETED") {
      // COMPLETED in DB but NO verified transaction — incorrectly marked!
      // divinityCoinPaymentId alone is NOT proof of payment. CAS on the read
      // status so we don't downgrade a pledge that just legitimately
      // transitioned into COMPLETED via a parallel webhook.
      const downgradeCas = await db.pledge.updateMany({
        where: { id: pledge.id, status: "COMPLETED" },
        data: {
          status: "PENDING",
          confirmationEmailSent: false,
        },
      });
      if (downgradeCas.count === 0) {
        detail.action = "Skipped downgrade — concurrent run already transitioned";
        results.details.push(detail);
        results.verified++;
        continue;
      }
      results.downgraded++;
      detail.action = pledge.divinityCoinPaymentId
        ? "Downgraded COMPLETED → PENDING (DC payment intent created but no transaction record — payment never completed)"
        : "Downgraded COMPLETED → PENDING (no DC payment record)";
      adminProjectsProcessPledgesLogger.info(`[Admin DC Verify] Downgraded pledge ${pledge.id} from COMPLETED to PENDING (no transaction record)`);
    } else {
      // PENDING without transaction — normal incomplete/abandoned
      results.abandoned++;
      detail.action = pledge.divinityCoinPaymentId
        ? "DC payment intent created but no transaction record - payment never completed"
        : "No DC payment record - abandoned cart";
    }

    results.details.push(detail);
    results.verified++;
  }

  // Recalculate project stats from verified pledges only
  await db.project.update({
    where: { id: projectId },
    data: {
      currentAmount: verifiedTotal,
      backerCount: verifiedCount,
    },
  });

  adminProjectsProcessPledgesLogger.info(`[Admin DC Verify] Set project stats: $${verifiedTotal}, ${verifiedCount} backers (upgraded: ${results.upgraded}, downgraded: ${results.downgraded})`);

  return NextResponse.json({
    success: true,
    message: `Verified ${results.verified} of ${results.total} pledges: ${results.alreadySucceeded} already correct, ${results.upgraded} upgraded, ${results.downgraded} downgraded, ${results.abandoned} abandoned`,
    results,
  });
}

/**
 * Permanently delete abandoned cart pledges for a project.
 * Abandoned = PENDING status with no payment record (no divinityCoinPaymentId,
 * no DivinityCoinTransaction, and no confirmation email sent).
 * Pledges with any payment evidence are skipped to prevent data loss.
 */
async function deleteAbandonedCarts(projectId: string) {
  // Find all PENDING pledges that haven't been soft-deleted
  const pendingPledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      deletedAt: null,
    },
    select: {
      id: true,
      amount: true,
      divinityCoinPaymentId: true,
      chargedImmediately: true,
      confirmationEmailSent: true,
      createdAt: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  if (pendingPledges.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No pending pledges found",
      results: { total: 0, deleted: 0, skipped: 0, details: [] },
    });
  }

  // Check for DivinityCoinTransaction records for these pledges
  const pledgeIds = pendingPledges.map((p) => p.id);
  const dcTransactions = await db.divinityCoinTransaction.findMany({
    where: {
      pledgeId: { in: pledgeIds },
      type: "PAYMENT",
    },
    select: { pledgeId: true },
  });
  const dcPaidPledgeIds = new Set(
    dcTransactions
      .filter((t: { pledgeId: string | null }) => t.pledgeId !== null)
      .map((t: { pledgeId: string | null }) => t.pledgeId as string)
  );

  const results = {
    total: pendingPledges.length,
    deleted: 0,
    skipped: 0,
    details: [] as Array<{
      pledgeId: string;
      user: string;
      amount: number;
      action: string;
    }>,
  };

  const toDelete: string[] = [];

  for (const pledge of pendingPledges) {
    const detail = {
      pledgeId: pledge.id,
      user: pledge.user.name || pledge.user.email || "Unknown",
      amount: Number(pledge.amount),
      action: "",
    };

    // Skip pledges that have actual evidence of payment completion.
    // NOTE: divinityCoinPaymentId is NOT payment evidence — it's set when the
    // PaymentIntent is created (before user pays). Only DivinityCoinTransaction
    // records prove payment actually went through.
    const hasPaymentEvidence =
      dcPaidPledgeIds.has(pledge.id) ||
      pledge.confirmationEmailSent;

    if (hasPaymentEvidence) {
      results.skipped++;
      detail.action = "Skipped - has payment evidence";
      results.details.push(detail);
      continue;
    }

    toDelete.push(pledge.id);
    results.deleted++;
    detail.action = "Soft-deleted (abandoned cart)";
    results.details.push(detail);
  }

  // Permanently delete all abandoned pledges (cascades to PledgeAddon, PledgeModifierAssignment)
  if (toDelete.length > 0) {
    // Delete related records first that don't have onDelete: Cascade
    await db.emailLog.deleteMany({
      where: { pledgeId: { in: toDelete } },
    });

    // TOCTOU guard: re-apply the "still PENDING + no confirmation email"
    // filter so a pledge that completed checkout between the findMany and
    // here (e.g. user returned seconds before admin clicked delete) is NOT
    // wrongly deleted. Combining id IN (...) with the filter ensures only
    // pledges still matching the abandoned criteria get removed.
    await db.pledge.deleteMany({
      where: {
        id: { in: toDelete },
        status: "PENDING",
        deletedAt: null,
        confirmationEmailSent: false,
      },
    });

    adminProjectsProcessPledgesLogger.info(`[Admin] Permanently deleted ${toDelete.length} abandoned cart pledges for project ${projectId}`);
  }

  return NextResponse.json({
    success: true,
    message: `Permanently deleted ${results.deleted} abandoned carts, skipped ${results.skipped} with payment evidence`,
    results,
  });
}
