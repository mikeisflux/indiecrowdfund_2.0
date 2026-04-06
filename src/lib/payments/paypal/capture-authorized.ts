/**
 * Captures all authorized (deferred) PayPal pledges for a project.
 * Called when a campaign reaches its funding goal, mirroring processPendingPledgesForProject()
 * for Stripe SetupIntent pledges.
 *
 * PayPal authorization holds expire after 29 days, so this must run promptly on goal-reached.
 */
import { db } from "@/lib/db";
import { getPayPalConfig, getPayPalAccessToken } from "./config";
import { logger } from "@/lib/logger";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";

const captureLogger = logger.child({ module: "paypal-capture-authorized" });

export async function captureAuthorizedPaypalPledges(projectId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      paymentProcessor: "PAYPAL",
      status: "PENDING",
      paypalAuthorizationId: { not: null },
      deletedAt: null,
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          currency: true,
          creator: { select: { vanityUrl: true } },
        },
      },
      user: { select: { id: true, email: true, name: true } },
      reward: { select: { id: true, title: true } },
    },
  });

  if (pledges.length === 0) return { total: 0, successful: 0, failed: 0 };

  captureLogger.info({ projectId, count: pledges.length }, "Capturing authorized PayPal pledges");

  const config = await getPayPalConfig();
  const accessToken = await getPayPalAccessToken();

  let successful = 0;
  let failed = 0;

  for (const pledge of pledges) {
    try {
      const captureRes = await fetch(
        `${config.baseUrl}/v2/payments/authorizations/${pledge.paypalAuthorizationId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `capture_auth_${pledge.id}`,
          },
          body: JSON.stringify({ final_capture: true }),
        }
      );

      if (!captureRes.ok) {
        const errBody = await captureRes.text();
        captureLogger.error({ pledgeId: pledge.id, err: errBody }, "Failed to capture PayPal authorization");
        await db.pledge.update({
          where: { id: pledge.id },
          data: { status: "FAILED", lastFailureReason: `PayPal capture failed: ${errBody.slice(0, 200)}` },
        });
        // Stats were incremented when authorization was confirmed — reverse them on capture failure
        if (pledge.confirmationEmailSent) {
          await db.project.update({
            where: { id: pledge.projectId },
            data: {
              currentAmount: { decrement: Number(pledge.amount) },
              backerCount: { decrement: 1 },
            },
          });
          if (pledge.reward?.id) {
            await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
          }
        }
        failed++;
        continue;
      }

      const captureData = await captureRes.json();
      if (captureData.status !== "COMPLETED") {
        captureLogger.warn({ pledgeId: pledge.id, status: captureData.status }, "PayPal capture not COMPLETED");
        await db.pledge.update({
          where: { id: pledge.id },
          data: { status: "FAILED", lastFailureReason: `PayPal capture returned status: ${captureData.status}` },
        });
        // Stats were incremented when authorization was confirmed — reverse them on capture failure
        if (pledge.confirmationEmailSent) {
          await db.project.update({
            where: { id: pledge.projectId },
            data: {
              currentAmount: { decrement: Number(pledge.amount) },
              backerCount: { decrement: 1 },
            },
          });
          if (pledge.reward?.id) {
            await db.$executeRaw`UPDATE "Reward" SET "quantityClaimed" = GREATEST(0, "quantityClaimed" - 1) WHERE id = ${pledge.reward.id}`;
          }
        }
        failed++;
        continue;
      }

      // Mark pledge as completed
      await db.pledge.update({
        where: { id: pledge.id },
        data: { status: "COMPLETED", chargedImmediately: true },
      });

      captureLogger.info({ pledgeId: pledge.id }, "PayPal authorization captured successfully");
      successful++;

      // Send confirmation email
      try {
        const emailEnabled = await isEmailTypeEnabled("pledgeConfirmation");
        if (emailEnabled && pledge.user.email) {
          await sendPledgeConfirmationEmail(
            pledge.user.email,
            pledge.user.name || "Backer",
            pledge.project.title,
            pledge.project.slug,
            Number(pledge.amount),
            pledge.reward?.title || null,
            true,
            pledge.project.imageUrl,
            pledge.project.currency || "USD",
            [],
            null,
            pledge.project.creator?.vanityUrl
              ? `/projects/${pledge.project.creator?.vanityUrl}/${pledge.project.slug}`
              : undefined,
            undefined,
            undefined,
            "PAYPAL",
            null,
            pledge.id
          );
        }
      } catch (emailErr) {
        captureLogger.error({ err: String(emailErr), pledgeId: pledge.id }, "Failed to send capture confirmation email");
      }
    } catch (err) {
      captureLogger.error({ err: String(err), pledgeId: pledge.id }, "Unexpected error capturing PayPal authorization");
      failed++;
    }
  }

  captureLogger.info({ projectId, successful, failed, total: pledges.length }, "Finished capturing PayPal authorizations");
  return { total: pledges.length, successful, failed };
}

/** Fire-and-forget wrapper — does not block the response */
export function captureAuthorizedPaypalPledgesAsync(projectId: string): void {
  captureAuthorizedPaypalPledges(projectId).catch(err =>
    captureLogger.error({ err: String(err), projectId }, "captureAuthorizedPaypalPledges failed")
  );
}
