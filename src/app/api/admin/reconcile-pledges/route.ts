import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import Stripe from "stripe";

interface ReconciliationResult {
  projectId: string;
  projectTitle: string;
  database: {
    currentAmount: number;
    backerCount: number;
    pledgeCount: number;
  };
  stripe: {
    totalAmount: number;
    successfulPayments: number;
    pendingSetupIntents: number;
  };
  discrepancy: {
    amountDiff: number;
    backerDiff: number;
    hasIssues: boolean;
  };
  details: {
    missingInDb: string[];
    statusMismatch: string[];
    amountMismatch: string[];
  };
}

interface ReconciliationSummary {
  totalProjects: number;
  projectsWithIssues: number;
  totalAmountDiscrepancy: number;
  totalBackerDiscrepancy: number;
  results: ReconciliationResult[];
  fixesApplied?: number;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    const summary = await reconcilePledges(projectId || undefined);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Reconciliation error:", error);
    return NextResponse.json(
      { error: "Failed to reconcile pledges" },
      { status: 500 }
    );
  }
}

// POST to apply fixes
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { projectId, applyFixes } = body;

    if (!applyFixes) {
      return NextResponse.json({ error: "applyFixes must be true" }, { status: 400 });
    }

    const summary = await reconcilePledges(projectId, true);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Reconciliation fix error:", error);
    return NextResponse.json(
      { error: "Failed to apply reconciliation fixes" },
      { status: 500 }
    );
  }
}

async function reconcilePledges(
  projectId?: string,
  applyFixes: boolean = false
): Promise<ReconciliationSummary> {
  const stripeClient = await getStripeInstance();

  // Get projects to reconcile
  const projects = await db.project.findMany({
    where: projectId ? { id: projectId } : { status: { in: ["LIVE", "FUNDED", "COMPLETED"] } },
    include: {
      creator: {
        include: {
          stripeConfig: true,
        },
      },
      pledges: {
        select: {
          id: true,
          amount: true,
          status: true,
          stripePaymentIntentId: true,
          stripeSetupIntentId: true,
          stripePaymentMethodId: true,
          chargedImmediately: true,
          userId: true,
        },
      },
    },
  });

  const results: ReconciliationResult[] = [];
  let totalFixesApplied = 0;

  for (const project of projects) {
    const result = await reconcileProject(stripeClient, project, applyFixes);
    results.push(result);
    if (applyFixes && result.discrepancy.hasIssues) {
      totalFixesApplied++;
    }
  }

  const summary: ReconciliationSummary = {
    totalProjects: results.length,
    projectsWithIssues: results.filter((r) => r.discrepancy.hasIssues).length,
    totalAmountDiscrepancy: results.reduce((sum, r) => sum + Math.abs(r.discrepancy.amountDiff), 0),
    totalBackerDiscrepancy: results.reduce((sum, r) => sum + Math.abs(r.discrepancy.backerDiff), 0),
    results,
  };

  if (applyFixes) {
    summary.fixesApplied = totalFixesApplied;
  }

  return summary;
}

interface ProjectWithPledges {
  id: string;
  title: string;
  currentAmount: number;
  backerCount: number;
  creator: {
    stripeConfig: {
      stripeAccountId: string;
    } | null;
  };
  pledges: {
    id: string;
    amount: number;
    status: string;
    stripePaymentIntentId: string | null;
    stripeSetupIntentId: string | null;
    stripePaymentMethodId: string | null;
    chargedImmediately: boolean;
    userId: string;
  }[];
}

async function reconcileProject(
  stripeClient: Stripe,
  project: ProjectWithPledges,
  applyFixes: boolean
): Promise<ReconciliationResult> {
  const details = {
    missingInDb: [] as string[],
    statusMismatch: [] as string[],
    amountMismatch: [] as string[],
  };

  // Collect Stripe data
  let stripeTotal = 0;
  let successfulPayments = 0;
  let pendingSetupIntents = 0;

  // Map of pledge IDs to their Stripe status
  const stripePledgeStatus = new Map<string, { amount: number; status: string; type: string }>();

  // Fetch PaymentIntents from Stripe for this project
  try {
    const paymentIntents = await stripeClient.paymentIntents.list({
      limit: 100,
    });

    for (const pi of paymentIntents.data) {
      if (pi.metadata.projectId === project.id) {
        const pledgeId = pi.metadata.pledgeId;
        const amountInDollars = pi.amount / 100;

        if (pi.status === "succeeded") {
          stripeTotal += amountInDollars;
          successfulPayments++;
          stripePledgeStatus.set(pledgeId, {
            amount: amountInDollars,
            status: "succeeded",
            type: "payment_intent",
          });
        } else if (pi.status === "processing") {
          stripePledgeStatus.set(pledgeId, {
            amount: amountInDollars,
            status: "processing",
            type: "payment_intent",
          });
        }
      }
    }

    // Fetch more if there are more
    let hasMore = paymentIntents.has_more;
    let lastId = paymentIntents.data[paymentIntents.data.length - 1]?.id;

    while (hasMore && lastId) {
      const morePayments = await stripeClient.paymentIntents.list({
        limit: 100,
        starting_after: lastId,
      });

      for (const pi of morePayments.data) {
        if (pi.metadata.projectId === project.id) {
          const pledgeId = pi.metadata.pledgeId;
          const amountInDollars = pi.amount / 100;

          if (pi.status === "succeeded") {
            stripeTotal += amountInDollars;
            successfulPayments++;
            stripePledgeStatus.set(pledgeId, {
              amount: amountInDollars,
              status: "succeeded",
              type: "payment_intent",
            });
          }
        }
      }

      hasMore = morePayments.has_more;
      lastId = morePayments.data[morePayments.data.length - 1]?.id;
    }
  } catch (error) {
    console.warn(`Could not fetch PaymentIntents for project ${project.id}:`, error);
  }

  // Fetch SetupIntents from Stripe
  try {
    const setupIntents = await stripeClient.setupIntents.list({
      limit: 100,
    });

    for (const si of setupIntents.data) {
      if (si.metadata?.projectId === project.id) {
        const pledgeId = si.metadata.pledgeId;
        const amountInDollars = parseInt(si.metadata.amount || "0") / 100;

        if (si.status === "succeeded" && si.payment_method) {
          // SetupIntent succeeded - card saved, pledge should be counted
          if (!stripePledgeStatus.has(pledgeId)) {
            // Not yet charged via PaymentIntent
            stripeTotal += amountInDollars;
            pendingSetupIntents++;
            stripePledgeStatus.set(pledgeId, {
              amount: amountInDollars,
              status: "card_saved",
              type: "setup_intent",
            });
          }
        }
      }
    }

    // Fetch more SetupIntents if needed
    let hasMore = setupIntents.has_more;
    let lastId = setupIntents.data[setupIntents.data.length - 1]?.id;

    while (hasMore && lastId) {
      const moreSetups = await stripeClient.setupIntents.list({
        limit: 100,
        starting_after: lastId,
      });

      for (const si of moreSetups.data) {
        if (si.metadata?.projectId === project.id) {
          const pledgeId = si.metadata.pledgeId;
          const amountInDollars = parseInt(si.metadata.amount || "0") / 100;

          if (si.status === "succeeded" && si.payment_method) {
            if (!stripePledgeStatus.has(pledgeId)) {
              stripeTotal += amountInDollars;
              pendingSetupIntents++;
              stripePledgeStatus.set(pledgeId, {
                amount: amountInDollars,
                status: "card_saved",
                type: "setup_intent",
              });
            }
          }
        }
      }

      hasMore = moreSetups.has_more;
      lastId = moreSetups.data[moreSetups.data.length - 1]?.id;
    }
  } catch (error) {
    console.warn(`Could not fetch SetupIntents for project ${project.id}:`, error);
  }

  // Compare with database
  const dbPledges = project.pledges;

  // Check for pledges in Stripe but not properly recorded in DB
  Array.from(stripePledgeStatus.entries()).forEach(([pledgeId, stripeData]) => {
    const dbPledge = dbPledges.find((p) => p.id === pledgeId);

    if (!dbPledge) {
      details.missingInDb.push(`${pledgeId} (${stripeData.type}: $${stripeData.amount})`);
    } else {
      // Check status mismatch
      if (stripeData.status === "succeeded" && dbPledge.status !== "COMPLETED") {
        details.statusMismatch.push(`${pledgeId}: Stripe=succeeded, DB=${dbPledge.status}`);
      }
      if (stripeData.status === "card_saved" && !dbPledge.stripePaymentMethodId) {
        details.statusMismatch.push(`${pledgeId}: Stripe=card_saved, DB=no payment method`);
      }

      // Check amount mismatch
      if (Math.abs(stripeData.amount - dbPledge.amount) > 0.01) {
        details.amountMismatch.push(
          `${pledgeId}: Stripe=$${stripeData.amount}, DB=$${dbPledge.amount}`
        );
      }
    }
  });

  const amountDiff = stripeTotal - project.currentAmount;
  const uniqueBackers = stripePledgeStatus.size;
  const backerDiff = uniqueBackers - project.backerCount;
  const hasIssues =
    Math.abs(amountDiff) > 0.01 ||
    Math.abs(backerDiff) > 0 ||
    details.missingInDb.length > 0 ||
    details.statusMismatch.length > 0;

  // Apply fixes if requested
  if (applyFixes && hasIssues) {
    // Update project totals based on Stripe data
    await db.project.update({
      where: { id: project.id },
      data: {
        currentAmount: stripeTotal,
        backerCount: uniqueBackers,
      },
    });

    // Fix pledge statuses
    const entries = Array.from(stripePledgeStatus.entries());
    for (let i = 0; i < entries.length; i++) {
      const [pledgeId, stripeData] = entries[i];
      const dbPledge = dbPledges.find((p) => p.id === pledgeId);
      if (dbPledge) {
        if (stripeData.status === "succeeded" && dbPledge.status !== "COMPLETED") {
          await db.pledge.update({
            where: { id: pledgeId },
            data: { status: "COMPLETED" },
          });
        }
      }
    }
  }

  return {
    projectId: project.id,
    projectTitle: project.title,
    database: {
      currentAmount: project.currentAmount,
      backerCount: project.backerCount,
      pledgeCount: dbPledges.length,
    },
    stripe: {
      totalAmount: stripeTotal,
      successfulPayments,
      pendingSetupIntents,
    },
    discrepancy: {
      amountDiff,
      backerDiff,
      hasIssues,
    },
    details,
  };
}
