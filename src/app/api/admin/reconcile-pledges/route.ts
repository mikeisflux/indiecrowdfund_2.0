import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminReconcilePledgesLogger = logger.child({ module: "admin-reconcile-pledges" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeInstance } from "@/lib/payments/stripe";
import { notifyBackerPledgeConfirmed } from "@/lib/notifications";
import Stripe from "stripe";

interface ReconciliationResult {
  projectId: string;
  projectTitle: string;
  paymentProcessor: string;
  database: {
    currentAmount: number;
    backerCount: number;
    pledgeCount: number;
  };
  verified: {
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
    downgraded: string[];
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
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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
    adminReconcilePledgesLogger.error({ err: String(error) }, "Reconciliation error:");
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
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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
    adminReconcilePledgesLogger.error({ err: String(error) }, "Reconciliation fix error:");
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
    where: projectId ? { id: projectId, deletedAt: null } : { status: { in: ["LIVE", "FUNDED"] }, deletedAt: null },
    select: {
      id: true,
      title: true,
      currentAmount: true,
      backerCount: true,
      paymentProcessor: true,
      creator: {
        select: {
          stripeConfig: {
            select: {
              stripeAccountId: true,
            },
          },
        },
      },
      pledges: {
        where: { deletedAt: null },
        select: {
          id: true,
          amount: true,
          status: true,
          stripePaymentIntentId: true,
          stripeSetupIntentId: true,
          stripePaymentMethodId: true,
          divinityCoinPaymentId: true,
          chargedImmediately: true,
          paymentProcessor: true,
          userId: true,
          confirmationEmailSent: true,
        },
      },
    },
  });

  const results: ReconciliationResult[] = [];
  let totalFixesApplied = 0;

  for (const project of projects) {
    // NMI / Mentom Payments and Whop reconciliation isn't implemented
    // yet — those processors store transaction state on different
    // fields (nmiTransactionId, whopPaymentId) and the Stripe
    // reconcile helper would silently fail or, worse, mis-apply
    // fixes by comparing against missing Stripe fields. Emit a
    // skip-marker result so the admin sees these projects in the
    // UI as "needs per-processor reconciler" rather than letting
    // them silently fall through to the Stripe path and corrupt data.
    if (project.paymentProcessor === "NMI" || project.paymentProcessor === "WHOP") {
      results.push({
        projectId: project.id,
        projectTitle: project.title,
        paymentProcessor: project.paymentProcessor,
        database: {
          currentAmount: Number(project.currentAmount),
          backerCount: project.backerCount,
          pledgeCount: 0,
        },
        verified: { totalAmount: 0, successfulPayments: 0, pendingSetupIntents: 0 },
        discrepancy: { amountDiff: 0, backerDiff: 0, hasIssues: false },
        details: {
          missingInDb: [],
          statusMismatch: [],
          amountMismatch: [],
          downgraded: [`SKIPPED — reconciliation for ${project.paymentProcessor} not yet implemented; use per-pledge admin tools instead`],
        },
      });
      continue;
    }

    const result = project.paymentProcessor === "DIVINITYCOIN"
      ? await reconcileDCProject(project, applyFixes)
      : project.paymentProcessor === "PAYPAL"
        ? await reconcilePayPalProject(project, applyFixes)
        : await reconcileStripeProject(stripeClient, project, applyFixes);
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

// ─── DivinityCoin project reconciliation ───────────────────────────────────

interface ProjectData {
  id: string;
  title: string;
  currentAmount: unknown;
  backerCount: number;
  paymentProcessor: string;
  creator: {
    stripeConfig: {
      stripeAccountId: string;
    } | null;
  };
  pledges: {
    id: string;
    amount: unknown;
    status: string;
    stripePaymentIntentId: string | null;
    stripeSetupIntentId: string | null;
    stripePaymentMethodId: string | null;
    divinityCoinPaymentId: string | null;
    chargedImmediately: boolean;
    paymentProcessor: string;
    userId: string;
    confirmationEmailSent: boolean;
  }[];
}

async function reconcileDCProject(
  project: ProjectData,
  applyFixes: boolean
): Promise<ReconciliationResult> {
  const details = {
    missingInDb: [] as string[],
    statusMismatch: [] as string[],
    amountMismatch: [] as string[],
    downgraded: [] as string[],
  };

  // For DC projects, the source of truth is DivinityCoinTransaction records
  // (NOT divinityCoinPaymentId which is set at pledge creation before payment)
  const pledgeIds = project.pledges.map((p) => p.id);

  const dcTransactions = await db.divinityCoinTransaction.findMany({
    where: {
      pledgeId: { in: pledgeIds },
      type: "PAYMENT",
    },
    select: { pledgeId: true, amount: true },
  });

  // Set of pledge IDs that have verified DC transactions
  const verifiedPledgeIds = new Set(
    dcTransactions.map((t: { pledgeId: string | null }) => t.pledgeId).filter(Boolean)
  );

  let verifiedTotal = 0;
  let verifiedCount = 0;

  for (const pledge of project.pledges) {
    const hasTransaction = verifiedPledgeIds.has(pledge.id);
    const pledgeAmount = Number(pledge.amount);

    if (hasTransaction) {
      // Verified payment — should be COMPLETED
      verifiedTotal += pledgeAmount;
      verifiedCount++;

      if (pledge.status !== "COMPLETED") {
        details.statusMismatch.push(
          `${pledge.id}: DC transaction verified but DB status=${pledge.status}`
        );

        if (applyFixes) {
          await db.pledge.update({
            where: { id: pledge.id },
            data: {
              status: "COMPLETED",
              chargedImmediately: true,
              confirmationEmailSent: true,
            },
          });
        }
      }
    } else if (pledge.status === "COMPLETED") {
      // COMPLETED in DB but NO verified transaction — this is the Matt T bug
      // divinityCoinPaymentId alone is NOT proof of payment
      details.downgraded.push(
        `${pledge.id}: COMPLETED in DB but no DC transaction record (amount: $${pledgeAmount})`
      );
      details.statusMismatch.push(
        `${pledge.id}: DB=COMPLETED but no verified DC payment — downgrading to PENDING`
      );

      if (applyFixes) {
        await db.pledge.update({
          where: { id: pledge.id },
          data: {
            status: "PENDING",
            confirmationEmailSent: false,
          },
        });
        adminReconcilePledgesLogger.info(`[Reconcile] Downgraded DC pledge ${pledge.id} from COMPLETED to PENDING (no transaction record)`);
      }
    }
    // PENDING pledges without transactions are fine — they're just incomplete/abandoned
  }

  const dbCurrentAmount = Number(project.currentAmount);
  const amountDiff = verifiedTotal - dbCurrentAmount;
  const backerDiff = verifiedCount - project.backerCount;
  const hasIssues =
    Math.abs(amountDiff) > 0.01 ||
    Math.abs(backerDiff) > 0 ||
    details.statusMismatch.length > 0 ||
    details.downgraded.length > 0;

  // Apply project total fixes
  if (applyFixes && hasIssues) {
    await db.project.update({
      where: { id: project.id },
      data: {
        currentAmount: verifiedTotal,
        backerCount: verifiedCount,
      },
    });
    adminReconcilePledgesLogger.info(`[Reconcile] DC project ${project.id}: set currentAmount=$${verifiedTotal}, backerCount=${verifiedCount}`);
  }

  return {
    projectId: project.id,
    projectTitle: project.title,
    paymentProcessor: "DIVINITYCOIN",
    database: {
      currentAmount: dbCurrentAmount,
      backerCount: project.backerCount,
      pledgeCount: project.pledges.length,
    },
    verified: {
      totalAmount: verifiedTotal,
      successfulPayments: verifiedCount,
      pendingSetupIntents: 0,
    },
    discrepancy: {
      amountDiff,
      backerDiff,
      hasIssues,
    },
    details,
  };
}

// ─── PayPal project reconciliation ─────────────────────────────────────────
// For PayPal projects, the source of truth is pledge.status === "COMPLETED"
// combined with pledge.paypalOrderId being set (proof the order was captured).

async function reconcilePayPalProject(
  project: ProjectData,
  applyFixes: boolean
): Promise<ReconciliationResult> {
  const details = {
    missingInDb: [] as string[],
    statusMismatch: [] as string[],
    amountMismatch: [] as string[],
    downgraded: [] as string[],
  };

  let verifiedTotal = 0;
  let verifiedCount = 0;

  for (const pledge of project.pledges) {
    const pledgeAmount = Number(pledge.amount);

    if (pledge.status === "COMPLETED") {
      verifiedTotal += pledgeAmount;
      verifiedCount++;
    }
  }

  const dbCurrentAmount = Number(project.currentAmount);
  const amountDiff = verifiedTotal - dbCurrentAmount;
  const backerDiff = verifiedCount - project.backerCount;
  const hasIssues =
    Math.abs(amountDiff) > 0.01 ||
    Math.abs(backerDiff) > 0 ||
    details.statusMismatch.length > 0;

  if (applyFixes && hasIssues) {
    await db.project.update({
      where: { id: project.id },
      data: {
        currentAmount: verifiedTotal,
        backerCount: verifiedCount,
      },
    });
    adminReconcilePledgesLogger.info(`[Reconcile] PayPal project ${project.id}: set currentAmount=$${verifiedTotal}, backerCount=${verifiedCount}`);
  }

  return {
    projectId: project.id,
    projectTitle: project.title,
    paymentProcessor: "PAYPAL",
    database: {
      currentAmount: dbCurrentAmount,
      backerCount: project.backerCount,
      pledgeCount: project.pledges.length,
    },
    verified: {
      totalAmount: verifiedTotal,
      successfulPayments: verifiedCount,
      pendingSetupIntents: 0,
    },
    discrepancy: {
      amountDiff,
      backerDiff,
      hasIssues,
    },
    details,
  };
}

// ─── Stripe project reconciliation ─────────────────────────────────────────

async function reconcileStripeProject(
  stripeClient: Stripe,
  project: ProjectData,
  applyFixes: boolean
): Promise<ReconciliationResult> {
  const details = {
    missingInDb: [] as string[],
    statusMismatch: [] as string[],
    amountMismatch: [] as string[],
    downgraded: [] as string[],
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
    adminReconcilePledgesLogger.warn({ data: error }, `Could not fetch PaymentIntents for project ${project.id}:`);
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
    adminReconcilePledgesLogger.warn({ data: error }, `Could not fetch SetupIntents for project ${project.id}:`);
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
      if (Math.abs(stripeData.amount - Number(dbPledge.amount)) > 0.01) {
        details.amountMismatch.push(
          `${pledgeId}: Stripe=$${stripeData.amount}, DB=$${Number(dbPledge.amount)}`
        );
      }
    }
  });

  const amountDiff = stripeTotal - Number(project.currentAmount);
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

    // Fix pledge statuses and payment method IDs
    const entries = Array.from(stripePledgeStatus.entries());
    for (let i = 0; i < entries.length; i++) {
      const [pledgeId, stripeData] = entries[i];
      const dbPledge = dbPledges.find((p) => p.id === pledgeId);
      if (dbPledge) {
        // Fix PaymentIntent pledges - mark as COMPLETED
        if (stripeData.status === "succeeded" && dbPledge.status !== "COMPLETED") {
          await db.pledge.update({
            where: { id: pledgeId },
            data: { status: "COMPLETED" },
          });

          // Send confirmation email if not already sent
          if (!dbPledge.confirmationEmailSent) {
            try {
              await notifyBackerPledgeConfirmed(pledgeId, true);
            } catch (e) {
              adminReconcilePledgesLogger.warn({ data: e }, `Could not send confirmation email for pledge ${pledgeId}:`);
            }
          }
        }

        // Fix SetupIntent pledges - update payment method ID if missing
        // This ensures pledges with saved cards are properly tracked
        if (stripeData.status === "card_saved" && stripeData.type === "setup_intent") {
          // Fetch the actual SetupIntent to get the payment method ID
          try {
            if (dbPledge.stripeSetupIntentId) {
              const setupIntent = await stripeClient.setupIntents.retrieve(dbPledge.stripeSetupIntentId);
              if (setupIntent.payment_method && !dbPledge.stripePaymentMethodId) {
                await db.pledge.update({
                  where: { id: pledgeId },
                  data: {
                    stripePaymentMethodId: setupIntent.payment_method as string,
                  },
                });

                // Send confirmation email if not already sent
                if (!dbPledge.confirmationEmailSent) {
                  try {
                    await notifyBackerPledgeConfirmed(pledgeId, false);
                  } catch (e) {
                    adminReconcilePledgesLogger.warn({ data: e }, `Could not send confirmation email for pledge ${pledgeId}:`);
                  }
                }
              }
            }
          } catch (e) {
            adminReconcilePledgesLogger.warn({ data: e }, `Could not update payment method for pledge ${pledgeId}:`);
          }
        }
      }
    }
  }

  return {
    projectId: project.id,
    projectTitle: project.title,
    paymentProcessor: "STRIPE",
    database: {
      currentAmount: Number(project.currentAmount),
      backerCount: project.backerCount,
      pledgeCount: dbPledges.length,
    },
    verified: {
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
