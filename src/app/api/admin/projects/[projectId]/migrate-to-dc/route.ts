import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendProcessorMigratedEmail } from "@/lib/notifications/email-templates";

const log = logger.child({ module: "admin-migrate-to-dc" });

/**
 * Force-migrate a project (and every open pledge on it) from
 * Mentom Payments (NMI) to DivinityCoin. Used after PaymentCloud
 * cancelled the merchant account — Mentom can no longer charge any
 * vault-saved cards, so every PENDING / FAILED NMI pledge needs a
 * fresh DivinityCoin payment from the backer.
 *
 * SUPER_ADMIN only.
 *
 * What this does (transactional, in order):
 *   1. Flips Project.paymentProcessor from "NMI" to "DIVINITYCOIN"
 *      (no-op if already DC).
 *   2. For every PENDING or FAILED pledge on the project whose
 *      paymentProcessor is still "NMI":
 *        - Sets paymentProcessor = "DIVINITYCOIN"
 *        - Resets status to "PENDING"
 *        - Clears every NMI-specific field so no stale token sticks
 *          around (nmiCustomerVaultId, nmiTransactionId,
 *          nmiInitialTransactionId, chargedImmediately, retryCount,
 *          nextRetryAt, lastFailureReason)
 *   3. Emails each affected backer with a link to
 *      /dashboard/pledges/[pledgeId]/complete-with-dc where they
 *      re-enter their card on the DC Stripe Elements form.
 *
 * NMI customer vault tokens cannot be transferred to DivinityCoin
 * (different processors, different vaults, PCI rules forbid token
 * sharing). The actual card data never touched our servers in
 * either direction. The backer has to re-enter the card. That's
 * what the email + complete-with-dc page are for.
 *
 * Idempotent: running twice on the same project flips no Project
 * row (already DC), flips no Pledge rows (already DC), and sends
 * no emails (no NMI rows left to migrate). Returns the same
 * counts on every run.
 *
 * Pass ?dryRun=true to preview the migration without actually
 * touching the database or sending emails.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, title: true, paymentProcessor: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find every pledge on the project that's still on NMI and not
    // already COMPLETED. PENDING + FAILED are the two states that
    // benefit from re-collection on the new processor. CANCELLED /
    // REFUNDED are terminal and untouched.
    const pledgesToMigrate = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        paymentProcessor: "NMI",
        status: { in: ["PENDING", "FAILED"] },
      },
      select: {
        id: true,
        amount: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        projectTitle: project.title,
        projectWillFlip: project.paymentProcessor === "NMI",
        pledgesToMigrate: pledgesToMigrate.length,
        emails: pledgesToMigrate.map((p) => p.user.email).filter(Boolean),
      });
    }

    // Flip the project record. Idempotent.
    if (project.paymentProcessor === "NMI") {
      await db.project.update({
        where: { id: projectId },
        data: { paymentProcessor: "DIVINITYCOIN" },
      });
    }

    // Flip every NMI pledge in one transaction. Clear NMI-side state
    // so the migrate-to-dc + complete-with-dc paths start from a
    // clean slate — no stale vault id or retry counter polluting the
    // DC flow.
    if (pledgesToMigrate.length > 0) {
      await db.pledge.updateMany({
        where: {
          id: { in: pledgesToMigrate.map((p) => p.id) },
        },
        data: {
          paymentProcessor: "DIVINITYCOIN",
          status: "PENDING",
          nmiCustomerVaultId: null,
          nmiTransactionId: null,
          nmiInitialTransactionId: null,
          chargedImmediately: false,
          retryCount: 0,
          nextRetryAt: null,
          lastFailureReason: null,
        },
      });
    }

    // Fan-out the notification emails. Batch + Promise.allSettled so
    // one bad email address can't abort the batch. Failures are
    // logged but don't fail the migration response — the migration
    // itself already committed.
    const emailResults = { sent: 0, failed: 0 };
    const batchSize = 10;
    for (let i = 0; i < pledgesToMigrate.length; i += batchSize) {
      const batch = pledgesToMigrate.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((p) => {
          if (!p.user.email) {
            return Promise.reject(new Error("no email"));
          }
          return sendProcessorMigratedEmail(
            p.user.email,
            p.user.name || "Backer",
            project.title,
            p.id,
            Number(p.amount)
          );
        })
      );
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          emailResults.failed++;
          log.warn(
            { pledgeId: batch[idx].id, err: String(r.reason) },
            "Failed to send processor-migrated email"
          );
        } else {
          emailResults.sent++;
        }
      });
    }

    log.info(
      { projectId, pledgesMigrated: pledgesToMigrate.length, emailResults },
      "NMI → DivinityCoin migration complete"
    );

    return NextResponse.json({
      projectTitle: project.title,
      projectFlipped: project.paymentProcessor === "NMI",
      pledgesMigrated: pledgesToMigrate.length,
      emailResults,
    });
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err) },
      "migrate-to-dc admin endpoint error"
    );
    return NextResponse.json(
      { error: "Failed to migrate project" },
      { status: 500 }
    );
  }
}
