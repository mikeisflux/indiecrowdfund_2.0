import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueEmail } from "@/lib/email";
import { getDeletionEligibility } from "@/lib/account-deletion/eligibility";
import { performAccountDeletion } from "@/lib/account-deletion/perform";

const log = logger.child({ module: "admin-account-deletion-request-review" });

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

// PATCH /api/admin/account-deletion-requests/[id]
// Body: { action: "APPROVE" | "DENY", notes?: string }
//
// APPROVE runs the same irreversible deletion the self-serve path runs.
// Before it does, eligibility is recomputed and re-checked: a request can
// sit in the queue for days, and the creator may have launched something
// new or taken on backers since filing. Approving a creator who now owes
// fulfillment would release them from obligations they didn't have when
// they asked, so that case is refused with a 409 rather than trusting the
// snapshot stored on the request.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    if (admin?.role !== "ADMIN" && admin?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const notes = typeof body?.notes === "string" ? body.notes.slice(0, 2000) : null;

    if (action !== "APPROVE" && action !== "DENY") {
      return NextResponse.json(
        { error: 'action must be "APPROVE" or "DENY"' },
        { status: 400 }
      );
    }

    const deletionRequest = await db.accountDeletionRequest.findFirst({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!deletionRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (deletionRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request was already ${deletionRequest.status.toLowerCase()}.` },
        { status: 409 }
      );
    }

    const firstName = deletionRequest.user.name?.split(" ")[0] || "there";

    if (action === "DENY") {
      // CAS on status so two admins clicking at once can't both resolve it.
      const denied = await db.accountDeletionRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "DENIED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: notes,
        },
      });
      if (denied.count === 0) {
        return NextResponse.json(
          { error: "This request was just resolved by someone else." },
          { status: 409 }
        );
      }

      await queueEmail({
        to: deletionRequest.user.email,
        subject: "Your IndieCrowdfund account deletion request",
        html: `<p>Hi ${firstName},</p>
<p>We reviewed your request to delete your IndieCrowdfund account and can't process it right now.</p>
${notes ? `<p><strong>Reason:</strong> ${notes}</p>` : ""}
<p>Your account is unchanged and still active. If you have questions, reply to this email and we'll help sort it out.</p>
<p>&mdash; IndieCrowdfund Support</p>`,
        text: `Hi ${firstName} — we reviewed your request to delete your IndieCrowdfund account and can't process it right now.${
          notes ? ` Reason: ${notes}` : ""
        } Your account is unchanged and still active. Reply to this email if you have questions.`,
        skipUnsubscribeCheck: true, // Transactional: response to their own request
        priority: 8,
      }).catch((err) =>
        log.error({ err: formatError(err) }, "Failed to queue deletion-denied email")
      );

      log.info({ requestId: id, adminId: session.user.id }, "Account deletion request denied");
      return NextResponse.json({ success: true, status: "DENIED" });
    }

    // ---- APPROVE ----
    // Re-check against today's data, not the snapshot taken at request time.
    const current = await getDeletionEligibility(deletionRequest.userId);
    if (current.status === "BLOCKED") {
      return NextResponse.json(
        {
          error: `Cannot approve — this creator's situation has changed since they filed. ${current.blockedReason}`,
          eligibility: {
            status: current.status,
            totalUnfulfilled: current.totalUnfulfilled,
            liveProjectCount: current.liveProjectCount,
          },
        },
        { status: 409 }
      );
    }

    // Claim the request before doing anything destructive, so a double
    // click can't run the deletion twice.
    const claimed = await db.accountDeletionRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });
    if (claimed.count === 0) {
      return NextResponse.json(
        { error: "This request was just resolved by someone else." },
        { status: 409 }
      );
    }

    // Send the confirmation before the wipe — deletion sets
    // emailUnsubscribedAt, and the address is the only way to reach them
    // afterwards.
    await queueEmail({
      to: deletionRequest.user.email,
      subject: "Your IndieCrowdfund account has been deleted",
      html: `<p>Hi ${firstName},</p>
<p>Your IndieCrowdfund account has been deleted as you requested. This is permanent and cannot be undone.</p>
<p>You can no longer sign in, and this email address can't be used to create a new account &mdash; it stays attached to the campaign records for anything you ran or backed.</p>
<p>Pledge amounts, dates, and payout records are retained for tax and audit purposes as described in our <a href="${APP_URL}/terms?tab=data-deletion">Data Deletion Policy</a>.</p>
<p>&mdash; IndieCrowdfund Support</p>`,
      text: `Hi ${firstName} — your IndieCrowdfund account has been deleted as you requested. This is permanent and cannot be undone. You can no longer sign in, and this email address can't be used to create a new account. Pledge amounts, dates, and payout records are retained for tax and audit purposes: ${APP_URL}/terms?tab=data-deletion`,
      skipUnsubscribeCheck: true, // Transactional: confirming their own request
      priority: 9,
    }).catch((err) =>
      log.error({ err: formatError(err) }, "Failed to queue deletion-approved email")
    );

    try {
      await performAccountDeletion(deletionRequest.userId);
    } catch (err) {
      // Roll the request back to PENDING so it stays visible in the queue
      // instead of reading as approved-and-done when nothing happened.
      await db.accountDeletionRequest
        .update({
          where: { id },
          data: {
            status: "PENDING",
            reviewedById: null,
            reviewedAt: null,
            reviewNotes: `Approval failed: ${String(err)}`.slice(0, 2000),
          },
        })
        .catch(() => {});
      log.error(
        { err: formatError(err), requestId: id, userId: deletionRequest.userId },
        "Account deletion failed during admin approval"
      );
      return NextResponse.json(
        { error: "Deletion failed. The request has been returned to the queue." },
        { status: 500 }
      );
    }

    log.info(
      {
        requestId: id,
        adminId: session.user.id,
        userId: deletionRequest.userId,
        launchedProjectCount: current.projects.length,
      },
      "Account deletion request approved and executed"
    );

    return NextResponse.json({ success: true, status: "APPROVED" });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to review account deletion request");
    return NextResponse.json(
      { error: "Failed to process this request" },
      { status: 500 }
    );
  }
}
