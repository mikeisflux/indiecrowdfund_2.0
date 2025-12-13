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
    const projectIsFunded = project.currentAmount >= project.goalAmount;
    const creatorHasStripe = !!project.creator.stripeConfig?.stripeAccountId;

    // Analyze each pledge
    const pledgeAnalysis = pledges.map((pledge) => {
      const issues: string[] = [];
      let canBeCharged = true;

      if (pledge.status !== "PENDING") {
        issues.push(`Status is ${pledge.status}, not PENDING`);
        canBeCharged = false;
      }

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

      return {
        ...pledge,
        analysis: {
          issues,
          canBeCharged: canBeCharged && issues.length === 0,
          isOldPledge: pledge.createdAt < fiveMinutesAgo,
        },
      };
    });

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        goalAmount: project.goalAmount,
        currentAmount: project.currentAmount,
        backerCount: project.backerCount,
        status: project.status,
        isFunded: projectIsFunded,
        fundingPercent: Math.round((project.currentAmount / project.goalAmount) * 100),
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
 * Manually trigger pledge processing for a funded project
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

    // Special action: verify PaymentIntent statuses
    if (action === "verify") {
      return await verifyPaymentIntents(projectId);
    }

    // Get project info
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        goalAmount: true,
        currentAmount: true,
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

    const projectIsFunded = project.currentAmount >= project.goalAmount;
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
        amount: pledge.amount,
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
