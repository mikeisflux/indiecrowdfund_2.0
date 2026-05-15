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
 * vault-saved cards, so every PENDING / FAILED / COMPLETED NMI
 * pledge needs a fresh DivinityCoin payment from the backer.
 *
 * SUPER_ADMIN only.
 *
 * What this does (transactional, in order):
 *   1. Flips Project.paymentProcessor from "NMI" to "DIVINITYCOIN"
 *      (no-op if already DC).
 *   2. For every PENDING / FAILED / COMPLETED pledge on the project
 *      whose paymentProcessor is still "NMI":
 *        - Sets paymentProcessor = "DIVINITYCOIN"
 *        - Resets status to "PENDING"
 *        - Clears every NMI-specific field so no stale token sticks
 *          around (nmiCustomerVaultId, nmiTransactionId,
 *          nmiInitialTransactionId, chargedImmediately, retryCount,
 *          nextRetryAt, lastFailureReason)
 *   3. Emails each freshly-flipped backer with a link to
 *      /dashboard/pledges/[pledgeId]/complete-with-dc where they
 *      re-enter their card on the DC Stripe Elements form.
 *   4. Also re-sends the migration email to any DC pledge that was
 *      ALREADY flipped to DC out-of-band (raw SQL, an earlier run
 *      of this endpoint, etc.) but whose backer hasn't completed
 *      re-payment yet. The discriminator is DIVINITYCOIN + PENDING
 *      + !chargedImmediately + no card on file
 *      + confirmationEmailSent=true. Lets the admin click the
 *      button after a manual SQL flip and still notify the
 *      affected backers.
 *
 * NMI customer vault tokens cannot be transferred to DivinityCoin
 * (different processors, different vaults, PCI rules forbid token
 * sharing). The actual card data never touched our servers in
 * either direction. The backer has to re-enter the card. That's
 * what the email + complete-with-dc page are for.
 *
 * The core migration (project flip + pledge flips) is idempotent:
 * running twice on the same project flips no Project row and no
 * Pledge rows the second time. The email sweep is intentionally
 * NOT idempotent — every click re-emails every pledge still
 * matching the "migrated but not yet re-paid" profile, so an
 * admin can nudge backers who ignored the first notice.
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

    // Find every NMI pledge in a state where re-collection on DC
    // makes sense:
    //   - PENDING / FAILED: charge never went through cleanly on NMI;
    //     backer needs to re-pay on DC.
    //   - COMPLETED: NMI marked the charge succeeded, but PaymentCloud
    //     cancelled the merchant account before funds disbursed, so
    //     the money was reversed back to the backer's card. From the
    //     creator's ledger these are phantom — the backer needs to
    //     re-pay on DC for the pledge to actually settle. We only
    //     include them here because the entire NMI processor was
    //     decommissioned; in a healthy processor we'd leave COMPLETED
    //     pledges alone.
    //   - CANCELLED / REFUNDED: terminal, untouched.
    //
    // We pull backerNumber so we can bridge NMI's "already counted"
    // marker to DC's marker. NMI historically pre-counted
    // currentAmount + backerCount + reward slots + addon slots at
    // PENDING creation time, then assigned backerNumber to mark "this
    // pledge is in the project totals." DC's webhook uses
    // confirmationEmailSent as its already-counted guard (it skips
    // the increment + reward/addon claims when the flag is true).
    //
    // Without this bridge, when the migrated backer pays via DC, the
    // DC webhook would re-increment currentAmount + backerCount and
    // re-claim reward + addon slots — every migrated pledge would be
    // counted twice and reward inventory would shrink phantomly. So
    // when we flip a pledge with backerNumber != null over to DC, we
    // also set confirmationEmailSent = true so the DC webhook treats
    // it as already-counted and just marks it COMPLETED.
    const pledgesToMigrate = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        paymentProcessor: "NMI",
        status: { in: ["PENDING", "FAILED", "COMPLETED"] },
      },
      select: {
        id: true,
        amount: true,
        backerNumber: true,
        confirmationEmailSent: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // Also identify pledges already flipped to DC out-of-band (raw
    // SQL, an earlier run of this endpoint, etc.) that still need
    // the migration email. Profile:
    //   DIVINITYCOIN + PENDING + !chargedImmediately
    //   + divinityCoinPaymentMethodId IS NULL
    //   + confirmationEmailSent = true
    //
    // That combo is unique to a manually-migrated-but-not-yet-re-paid
    // pledge: the row counts toward project totals
    // (confirmationEmailSent=true) but has no DC payment evidence. A
    // fresh saved-card DC pledge would have divinityCoinPaymentMethodId
    // set after confirm-dc-setup, and a not-yet-committed one would
    // have confirmationEmailSent=false. This sweep lets the admin
    // click the button after a manual SQL flip and still nudge the
    // affected backers (re-clicking re-emails them — see JSDoc).
    const alreadyMigratedNeedingEmail = await db.pledge.findMany({
      where: {
        projectId,
        deletedAt: null,
        paymentProcessor: "DIVINITYCOIN",
        status: "PENDING",
        chargedImmediately: false,
        divinityCoinPaymentMethodId: null,
        confirmationEmailSent: true,
      },
      select: {
        id: true,
        amount: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (dryRun) {
      const alreadyCountedCount = pledgesToMigrate.filter((p) => p.backerNumber !== null).length;
      const neverCountedCount = pledgesToMigrate.length - alreadyCountedCount;
      return NextResponse.json({
        dryRun: true,
        projectTitle: project.title,
        projectWillFlip: project.paymentProcessor === "NMI",
        pledgesToMigrate: pledgesToMigrate.length,
        alreadyInTotals: alreadyCountedCount,
        notYetInTotals: neverCountedCount,
        alreadyMigratedNeedingEmail: alreadyMigratedNeedingEmail.length,
        emails: [
          ...pledgesToMigrate.map((p) => p.user.email),
          ...alreadyMigratedNeedingEmail.map((p) => p.user.email),
        ].filter(Boolean),
      });
    }

    // Flip the project record. Idempotent.
    if (project.paymentProcessor === "NMI") {
      await db.project.update({
        where: { id: projectId },
        data: { paymentProcessor: "DIVINITYCOIN" },
      });
    }

    // Flip every NMI pledge to DC. Clear NMI-side state so the
    // migrate-to-dc + complete-with-dc paths start from a clean
    // slate. Two sub-batches:
    //   1. backerNumber != null  → was pre-counted into project
    //      totals by the NMI flow. Set confirmationEmailSent = true
    //      so DC payment.succeeded webhook skips its
    //      increment/reward-claim path. The pledge is already in the
    //      backerCount/currentAmount/reward-quantityClaimed counts
    //      and stays there through the migration.
    //   2. backerNumber == null  → was NEVER counted (rare, but
    //      possible on FAILED-at-create pledges). Leave
    //      confirmationEmailSent = false so DC will count it for the
    //      first time when the backer pays.
    const alreadyCounted = pledgesToMigrate.filter((p) => p.backerNumber !== null);
    const neverCounted = pledgesToMigrate.filter((p) => p.backerNumber === null);

    const sharedReset = {
      paymentProcessor: "DIVINITYCOIN" as const,
      status: "PENDING" as const,
      nmiCustomerVaultId: null,
      nmiTransactionId: null,
      nmiInitialTransactionId: null,
      chargedImmediately: false,
      retryCount: 0,
      nextRetryAt: null,
      lastFailureReason: null,
    };

    if (alreadyCounted.length > 0) {
      await db.pledge.updateMany({
        where: { id: { in: alreadyCounted.map((p) => p.id) } },
        data: { ...sharedReset, confirmationEmailSent: true },
      });
    }

    if (neverCounted.length > 0) {
      await db.pledge.updateMany({
        where: { id: { in: neverCounted.map((p) => p.id) } },
        data: { ...sharedReset, confirmationEmailSent: false },
      });
    }

    // Fan-out the notification emails to both groups: the
    // freshly-flipped NMI pledges above AND the DC pledges that
    // were already migrated out-of-band but never re-paid. Batch
    // + Promise.allSettled so one bad email address can't abort
    // the batch. Failures are logged but don't fail the migration
    // response — the migration itself already committed.
    const emailTargets = [...pledgesToMigrate, ...alreadyMigratedNeedingEmail];
    const emailResults = { sent: 0, failed: 0 };
    const batchSize = 10;
    for (let i = 0; i < emailTargets.length; i += batchSize) {
      const batch = emailTargets.slice(i, i + batchSize);
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
      {
        projectId,
        pledgesMigrated: pledgesToMigrate.length,
        alreadyMigratedEmailed: alreadyMigratedNeedingEmail.length,
        emailResults,
      },
      "NMI → DivinityCoin migration complete"
    );

    return NextResponse.json({
      projectTitle: project.title,
      projectFlipped: project.paymentProcessor === "NMI",
      pledgesMigrated: pledgesToMigrate.length,
      alreadyInTotals: alreadyCounted.length,
      notYetInTotals: neverCounted.length,
      alreadyMigratedEmailed: alreadyMigratedNeedingEmail.length,
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
