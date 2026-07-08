/**
 * Captures all authorized (deferred) PayPal Connect pledges for a project.
 * Called when a campaign reaches its funding goal — the marketplace equivalent
 * of the standard PayPal capture-authorized flow.
 *
 * PayPal authorization holds expire after 29 days, so this must run promptly on
 * goal-reached.
 */
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPledgeConfirmationEmail, isEmailTypeEnabled } from "@/lib/email";
import { getPayPalConnectConfig, getPayPalConnectAccessToken } from "./config";

const captureLogger = logger.child({ module: "paypal-connect-capture-authorized" });

export async function captureAuthorizedPayPalConnectPledges(projectId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
}> {
  const pledges = await db.pledge.findMany({
    where: {
      projectId,
      paymentProcessor: "PAYPAL_CONNECT",
      status: "PENDING",
      NOT: { paypalConnectAuthorizationId: null },
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

  captureLogger.info({ projectId, count: pledges.length }, "Capturing authorized PayPal Connect pledges");

  const config = await getPayPalConnectConfig();
  const accessToken = await getPayPalConnectAccessToken();

  let successful = 0;
  let failed = 0;

  for (const pledge of pledges) {
    try {
      const captureRes = await fetch(
        `${config.baseUrl}/v2/payments/authorizations/${pledge.paypalConnectAuthorizationId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `capture_auth_connect_${pledge.id}`,
            "PayPal-Partner-Attribution-Id": config.bnCode,
          },
          body: JSON.stringify({ final_capture: true }),
        },
      );

      if (!captureRes.ok) {
        const errBody = await captureRes.text();
        captureLogger.error({ pledgeId: pledge.id, err: errBody }, "Failed to capture PayPal Connect authorization");
        const failCas = await db.pledge.updateMany({
          where: { id: pledge.id, status: "PENDING", deletedAt: null },
          data: { status: "FAILED", lastFailureReason: `PayPal Connect capture failed: ${errBody.slice(0, 200)}` },
        });
        if (failCas.count > 0 && pledge.confirmationEmailSent) {
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
        captureLogger.warn({ pledgeId: pledge.id, status: captureData.status }, "PayPal Connect capture not COMPLETED");
        const failCas = await db.pledge.updateMany({
          where: { id: pledge.id, status: "PENDING", deletedAt: null },
          data: { status: "FAILED", lastFailureReason: `PayPal Connect capture returned status: ${captureData.status}` },
        });
        if (failCas.count > 0 && pledge.confirmationEmailSent) {
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

      // Stamp the capture id (best-effort) then CAS PENDING → COMPLETED.
      const captureId = captureData?.id as string | undefined;
      const completeCas = await db.pledge.updateMany({
        where: { id: pledge.id, status: "PENDING", deletedAt: null },
        data: { status: "COMPLETED", chargedImmediately: true, paypalConnectCaptureId: captureId },
      });
      if (completeCas.count === 0) {
        captureLogger.info({ pledgeId: pledge.id }, "PayPal Connect capture succeeded but pledge status already changed — skipping side effects");
        continue;
      }

      captureLogger.info({ pledgeId: pledge.id }, "PayPal Connect authorization captured successfully");
      successful++;

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
            pledge.id,
          );
        }
      } catch (emailErr) {
        captureLogger.error({ err: String(emailErr), pledgeId: pledge.id }, "Failed to send capture confirmation email");
      }
    } catch (err) {
      captureLogger.error({ err: String(err), pledgeId: pledge.id }, "Unexpected error capturing PayPal Connect authorization");
      failed++;
    }
  }

  captureLogger.info({ projectId, successful, failed, total: pledges.length }, "Finished capturing PayPal Connect authorizations");
  return { total: pledges.length, successful, failed };
}

/** Fire-and-forget wrapper — does not block the response */
export function captureAuthorizedPayPalConnectPledgesAsync(projectId: string): void {
  captureAuthorizedPayPalConnectPledges(projectId).catch((err) =>
    captureLogger.error({ err: String(err), projectId }, "captureAuthorizedPayPalConnectPledges failed"),
  );
}
