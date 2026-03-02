import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processPendingPledgesForProject, chargeSavedPledge, getStripeInstance } from "@/lib/payments/stripe";

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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { projectId } = await params;

    // Get project info
    const project = await db.project.findUnique({
      where: { id: projectId },
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
            stripeConfig: {
              select: {
                stripeAccountId: true,
                isOnboarded: true,
              },
            },
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
      where: { projectId },
      select: {
        id: true,
        amount: true,
        status: true,
        chargedImmediately: true,
        confirmationEmailSent: true,
        stripePaymentMethodId: true,
        stripeCustomerId: true,
        stripePaymentIntentId: true,
        stripeSetupIntentId: true,
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
    const creatorHasStripe = !!project.creator.stripeConfig?.stripeAccountId;

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
        dcTransactions.map((t: { pledgeId: string | null }) => [t.pledgeId!, true])
      );
    }

    // Analyze each pledge
    const pledgeAnalysis = pledges.map((pledge) => {
      const issues: string[] = [];
      let canBeCharged = true;
      let canBeReconciled = false;

      if (pledge.status !== "PENDING") {
        issues.push(`Status is ${pledge.status}, not PENDING`);
        canBeCharged = false;
      }

      if (isDivinityCoin) {
        // DivinityCoin projects: payments are always charged immediately by DC
        // PENDING pledges are either abandoned carts or missed webhooks
        if (pledge.status === "PENDING") {
          if (pledge.divinityCoinPaymentId || dcTransactionsByPledge[pledge.id]) {
            issues.push("Has DC payment record but still PENDING - webhook may have partially failed");
            canBeReconciled = true;
          } else {
            issues.push("No DC payment record - likely abandoned cart");
          }
        }
        canBeCharged = false; // DC pledges can't be "charged" from our side
      } else {
        // Stripe projects: original logic
        if (pledge.chargedImmediately) {
          issues.push("Was charged immediately (PaymentIntent), not a SetupIntent pledge");
          canBeCharged = false;
        }

        if (!pledge.stripePaymentMethodId) {
          issues.push("Missing stripePaymentMethodId - webhook may not have fired");
          canBeCharged = false;
        }

        if (!pledge.stripeCustomerId) {
          issues.push("Missing stripeCustomerId");
          canBeCharged = false;
        }

        if (!pledge.confirmationEmailSent && pledge.createdAt > fiveMinutesAgo) {
          issues.push("Not confirmed (confirmationEmailSent=false) and created < 5 min ago");
          canBeCharged = false;
        }

        if (!projectIsFunded) {
          issues.push("Project not funded yet");
          canBeCharged = false;
        }

        if (!creatorHasStripe) {
          issues.push("Creator has not connected Stripe account");
          canBeCharged = false;
        }
      }

      return {
        ...pledge,
        analysis: {
          issues,
          canBeCharged: canBeCharged && issues.length === 0,
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
        name: project.creator.name,
        hasStripeConnected: creatorHasStripe,
        isOnboarded: project.creator.stripeConfig?.isOnboarded || false,
      },
      pledges: pledgeAnalysis,
      summary: {
        total: pledges.length,
        pending: pledges.filter((p) => p.status === "PENDING").length,
        completed: pledges.filter((p) => p.status === "COMPLETED").length,
        failed: pledges.filter((p) => p.status === "FAILED").length,
        chargeableNow: pledgeAnalysis.filter((p) => p.analysis.canBeCharged).length,
        reconcilableNow: pledgeAnalysis.filter((p) => p.analysis.canBeReconciled).length,
      },
    });
  } catch (error) {
    console.error("Admin pledge diagnosis error:", error);
    return NextResponse.json(
      {
        error: "Failed to diagnose pledges",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const { pledgeId, force, action } = body as { pledgeId?: string; force?: boolean; action?: string };

    // Get project info
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        goalAmount: true,
        currentAmount: true,
        paymentProcessor: true,
        creator: {
          select: {
            stripeConfig: {
              select: { stripeAccountId: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isDivinityCoin = project.paymentProcessor === "DIVINITYCOIN";

    // Special action: verify payment statuses
    if (action === "verify") {
      if (isDivinityCoin) {
        return await verifyDivinityCoinPledges(projectId);
      }
      return await verifyPaymentIntents(projectId);
    }

    // DivinityCoin projects: reconcile PENDING pledges against DC transaction records
    if (isDivinityCoin) {
      return await processDivinityCoinPendingPledges(projectId, pledgeId);
    }

    // Stripe projects: original logic
    const projectIsFunded = Number(project.currentAmount) >= Number(project.goalAmount);
    const creatorHasStripe = !!project.creator.stripeConfig?.stripeAccountId;

    if (!creatorHasStripe) {
      return NextResponse.json({
        error: "Creator has not connected Stripe account - cannot process pledges",
      }, { status: 400 });
    }

    if (!projectIsFunded && !force) {
      return NextResponse.json({
        error: "Project is not funded yet. Use force=true to process anyway.",
        currentAmount: project.currentAmount,
        goalAmount: project.goalAmount,
      }, { status: 400 });
    }

    // If a specific pledgeId is provided, charge just that one
    if (pledgeId) {
      console.log(`[Admin] Manually charging pledge ${pledgeId}`);
      try {
        const success = await chargeSavedPledge(pledgeId);
        return NextResponse.json({
          success,
          message: success ? "Pledge charged successfully" : "Pledge could not be charged (check logs)",
          pledgeId,
        });
      } catch (error) {
        console.error(`[Admin] Error charging pledge ${pledgeId}:`, error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          pledgeId,
        }, { status: 500 });
      }
    }

    // Otherwise, process all pending pledges
    console.log(`[Admin] Manually processing all pledges for project ${projectId}`);
    const results = await processPendingPledgesForProject(projectId);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.total} pledges`,
      results,
    });
  } catch (error) {
    console.error("Admin pledge processing error:", error);
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
    ? { id: specificPledgeId, projectId, status: "PENDING" as const }
    : { projectId, status: "PENDING" as const };

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
    dcTransactions.map((t: { pledgeId: string | null }) => [t.pledgeId!, t])
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

  for (const pledge of pendingPledges) {
    const detail = {
      pledgeId: pledge.id,
      user: pledge.user.name || pledge.user.email || "Unknown",
      amount: Number(pledge.amount),
      action: "",
    };

    const hasDcPaymentId = !!pledge.divinityCoinPaymentId;
    const hasDcTransaction = dcTransactionMap.has(pledge.id);

    if (hasDcPaymentId || hasDcTransaction) {
      // This pledge was paid — fix the status
      await db.pledge.update({
        where: { id: pledge.id },
        data: {
          status: "COMPLETED",
          chargedImmediately: true,
        },
      });

      results.reconciled++;
      detail.action = hasDcPaymentId
        ? `Reconciled to COMPLETED (had divinityCoinPaymentId: ${pledge.divinityCoinPaymentId})`
        : "Reconciled to COMPLETED (found DivinityCoinTransaction record)";

      console.log(`[Admin DC] Reconciled pledge ${pledge.id} to COMPLETED`);
    } else {
      // No payment record — abandoned cart
      results.abandoned++;
      detail.action = "No payment record found - abandoned cart (no changes made)";
    }

    results.details.push(detail);
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
  // Find all PENDING pledges for this DC project
  const pendingPledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
    },
    select: {
      id: true,
      amount: true,
      chargedImmediately: true,
      divinityCoinPaymentId: true,
      stripePaymentIntentId: true,
      createdAt: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  // Check for DC transaction records
  const pledgeIds = pendingPledges.map((p) => p.id);
  const dcTransactions = await db.divinityCoinTransaction.findMany({
    where: {
      pledgeId: { in: pledgeIds },
      type: "PAYMENT",
    },
    select: { pledgeId: true, amount: true },
  });

  const dcTransactionMap = new Map(
    dcTransactions.map((t: { pledgeId: string | null }) => [t.pledgeId!, t])
  );

  const results = {
    total: pendingPledges.length,
    verified: 0,
    alreadySucceeded: 0,
    abandoned: 0,
    errors: [] as string[],
    details: [] as Array<{
      pledgeId: string;
      user: string;
      amount: number;
      paymentIntentId: string;
      stripeStatus: string;
      action: string;
    }>,
  };

  for (const pledge of pendingPledges) {
    const hasDcPaymentId = !!pledge.divinityCoinPaymentId;
    const hasDcTransaction = dcTransactionMap.has(pledge.id);

    const detail = {
      pledgeId: pledge.id,
      user: pledge.user.name || pledge.user.email || "Unknown",
      amount: Number(pledge.amount),
      paymentIntentId: pledge.divinityCoinPaymentId || pledge.stripePaymentIntentId || "none",
      stripeStatus: hasDcPaymentId || hasDcTransaction ? "succeeded (DC)" : "no payment found",
      action: "",
    };

    if (hasDcPaymentId || hasDcTransaction) {
      // Payment was recorded — update pledge to COMPLETED
      await db.pledge.update({
        where: { id: pledge.id },
        data: {
          status: "COMPLETED",
          chargedImmediately: true,
        },
      });
      results.alreadySucceeded++;
      detail.action = "Updated to COMPLETED (DC payment verified)";
    } else {
      results.abandoned++;
      detail.action = "No DC payment record - abandoned cart";
    }

    results.details.push(detail);
    results.verified++;
  }

  return NextResponse.json({
    success: true,
    message: `Verified ${results.verified} of ${results.total} pledges: ${results.alreadySucceeded} completed, ${results.abandoned} abandoned`,
    results,
  });
}

/**
 * Verify PaymentIntent statuses with Stripe and update pledges accordingly.
 * This fixes pledges that were charged immediately but webhook didn't fire.
 */
async function verifyPaymentIntents(projectId: string) {
  const stripeClient = await getStripeInstance();

  // Find all PENDING pledges that were charged immediately (have PaymentIntentId)
  const pendingPledges = await db.pledge.findMany({
    where: {
      projectId,
      status: "PENDING",
      chargedImmediately: true,
      stripePaymentIntentId: { not: null },
    },
    select: {
      id: true,
      amount: true,
      stripePaymentIntentId: true,
      stripePaymentMethodId: true,
      user: {
        select: { name: true, email: true },
      },
    },
  });

  const results = {
    total: pendingPledges.length,
    verified: 0,
    alreadySucceeded: 0,
    stillProcessing: 0,
    failed: 0,
    errors: [] as string[],
    details: [] as Array<{
      pledgeId: string;
      user: string;
      amount: number;
      paymentIntentId: string;
      stripeStatus: string;
      action: string;
    }>,
  };

  for (const pledge of pendingPledges) {
    try {
      // Retrieve PaymentIntent from Stripe
      const paymentIntent = await stripeClient.paymentIntents.retrieve(
        pledge.stripePaymentIntentId!
      );

      const detail = {
        pledgeId: pledge.id,
        user: pledge.user.name || pledge.user.email || "Unknown",
        amount: Number(pledge.amount),
        paymentIntentId: pledge.stripePaymentIntentId!,
        stripeStatus: paymentIntent.status,
        action: "",
      };

      if (paymentIntent.status === "succeeded") {
        // Payment succeeded! Update pledge to COMPLETED
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "COMPLETED",
            stripePaymentMethodId: typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : paymentIntent.payment_method?.id || pledge.stripePaymentMethodId,
          },
        });
        results.alreadySucceeded++;
        detail.action = "Updated to COMPLETED";
      } else if (paymentIntent.status === "processing") {
        results.stillProcessing++;
        detail.action = "Still processing - no action taken";
      } else if (paymentIntent.status === "requires_payment_method" || paymentIntent.status === "canceled") {
        // Payment failed - update pledge to FAILED
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "FAILED",
            lastFailureReason: `PaymentIntent status: ${paymentIntent.status}`,
          },
        });
        results.failed++;
        detail.action = `Marked as FAILED (status: ${paymentIntent.status})`;
      } else {
        detail.action = `Unknown status: ${paymentIntent.status} - no action taken`;
      }

      results.details.push(detail);
      results.verified++;
    } catch (error) {
      results.errors.push(
        `Pledge ${pledge.id}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `Verified ${results.verified} of ${results.total} pledges`,
    results,
  });
}
