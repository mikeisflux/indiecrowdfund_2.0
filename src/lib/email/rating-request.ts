import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const ratingRequestLogger = logger.child({ module: "rating-request-email" });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface SendRatingRequestResult {
  sent: boolean;
  reason?: string;
}

// maybeSendRatingRequest(pledgeId)
//
// The single guarded entry point for the "rate your creator" nudge.
// Called from three places — the fulfillment delivered-trigger, the
// backer-marked-received trigger, and the one-time backlog send — and
// it's safe to call from any of them because it dedupes:
//
//   - Pledge must be COMPLETED and not soft-deleted.
//   - Backer must not already have left a star rating
//     (BackerReview.overallRating). No point nudging someone who
//     already rated.
//   - We must not have already sent this nudge
//     (Pledge.ratingRequestSentAt is null).
//   - Backer must have an email and not be globally unsubscribed.
//
// On success it sends the email (deep-linked straight to the review
// dialog) and stamps ratingRequestSentAt so no other trigger re-sends.
export async function maybeSendRatingRequest(
  pledgeId: string
): Promise<SendRatingRequestResult> {
  try {
    const pledge = await db.pledge.findFirst({
      where: { id: pledgeId, deletedAt: null },
      select: {
        id: true,
        status: true,
        ratingRequestSentAt: true,
        user: { select: { email: true, name: true, emailUnsubscribedAt: true, deletedAt: true } },
        project: {
          select: {
            title: true,
            slug: true,
            creator: { select: { name: true, vanityUrl: true } },
          },
        },
      },
    });

    if (!pledge) return { sent: false, reason: "pledge-not-found" };
    if (pledge.status !== "COMPLETED") return { sent: false, reason: "not-completed" };
    if (pledge.ratingRequestSentAt) return { sent: false, reason: "already-sent" };
    if (!pledge.user || pledge.user.deletedAt) return { sent: false, reason: "no-user" };
    if (!pledge.user.email) return { sent: false, reason: "no-email" };
    if (pledge.user.emailUnsubscribedAt) return { sent: false, reason: "unsubscribed" };

    // Skip if they've already rated.
    const existing = await db.backerReview.findUnique({
      where: { pledgeId },
      select: { overallRating: true },
    });
    if (existing?.overallRating != null) {
      // Still stamp so the backlog job doesn't keep re-scanning it.
      await db.pledge.updateMany({
        where: { id: pledgeId, ratingRequestSentAt: null },
        data: { ratingRequestSentAt: new Date() },
      });
      return { sent: false, reason: "already-rated" };
    }

    const backerName = pledge.user.name || "there";
    const creatorName = pledge.project.creator.name || "the creator";
    const projectTitle = pledge.project.title;
    const reviewUrl = `${APP_URL}/dashboard/backer?review=${pledgeId}`;

    const subject = `How was your experience with ${creatorName}?`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #028858;">How did it go?</h2>
        <p>Hi ${escapeHtml(backerName)},</p>
        <p>
          Your order from <strong>${escapeHtml(projectTitle)}</strong> by
          ${escapeHtml(creatorName)} has been delivered. We'd love to hear how
          it went — your honest rating helps other backers know which creators
          deliver, and helps great creators stand out.
        </p>
        <p>It takes about 20 seconds — just tap the stars.</p>
        <p style="margin: 28px 0;">
          <a href="${reviewUrl}"
             style="background: #028858; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            ⭐ Rate ${escapeHtml(creatorName)}
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          Didn't receive your reward yet, or something went wrong? Reply to this
          email or contact
          <a href="mailto:support@indiecrowdfund.com" style="color: #028858;">support@indiecrowdfund.com</a>
          and we'll help.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">— The IndieCrowdfund Team</p>
      </div>
    `;
    const text = `Hi ${backerName},\n\nYour order from "${projectTitle}" by ${creatorName} has been delivered. We'd love your honest rating — it takes about 20 seconds.\n\nRate ${creatorName}: ${reviewUrl}\n\nDidn't get your reward or something went wrong? Contact support@indiecrowdfund.com.\n\n— The IndieCrowdfund Team`;

    const result = (await sendEmail({ to: pledge.user.email, subject, html, text })) as {
      success: boolean;
      error?: string;
      queued?: boolean;
    };

    // Stamp regardless of transient send outcome: if it queued or sent
    // we don't want a retry storm from the backlog job. (sendEmail
    // auto-queues failures for retry internally.)
    await db.pledge.updateMany({
      where: { id: pledgeId, ratingRequestSentAt: null },
      data: { ratingRequestSentAt: new Date() },
    });

    if (!result.success && !result.queued) {
      ratingRequestLogger.warn({ pledgeId, err: result.error }, "Rating request email send reported failure");
      return { sent: false, reason: "send-failed" };
    }

    ratingRequestLogger.info({ pledgeId }, "Rating request email sent");
    return { sent: true };
  } catch (err) {
    ratingRequestLogger.error({ err: String(err), pledgeId }, "maybeSendRatingRequest threw");
    return { sent: false, reason: "exception" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
}
