import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

import { logger } from "@/lib/logger";

const webhooksEmailEventsLogger = logger.child({ module: "webhooks-email-events" });


export const dynamic = "force-dynamic";

// Verify Mailgun webhook signature using HMAC-SHA256
// See: https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#securing-webhooks
async function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): Promise<boolean> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { mailgunWebhookSigningKey: true },
    });

    const signingKey = settings?.mailgunWebhookSigningKey;
    if (!signingKey) {
      webhooksEmailEventsLogger.error("[Webhook] Mailgun webhook signing key not configured — rejecting webhook");
      return false;
    }

    const encodedToken = crypto
      .createHmac("sha256", signingKey)
      .update(timestamp.concat(token))
      .digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(encodedToken), Buffer.from(signature));
    } catch {
      return false;
    }
  } catch (error) {
    webhooksEmailEventsLogger.error({ err: error }, "[Webhook] Error verifying Mailgun signature:");
    return false;
  }
}

// Verify SendGrid webhook signature using ECDSA
// See: https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
async function verifySendGridSignature(
  publicKey: string,
  payload: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  try {
    const timestampPayload = timestamp + payload;
    const decodedSignature = Buffer.from(signature, "base64");

    // Import the ECDSA public key - try PEM first, then DER
    let keyObject: crypto.KeyObject;
    const trimmedKey = publicKey.trim();
    if (trimmedKey.startsWith("-----BEGIN")) {
      // Already PEM formatted
      keyObject = crypto.createPublicKey(trimmedKey);
    } else {
      // SendGrid provides a base64-encoded key - wrap it as PEM
      const pemKey = `-----BEGIN PUBLIC KEY-----\n${trimmedKey}\n-----END PUBLIC KEY-----`;
      keyObject = crypto.createPublicKey(pemKey);
    }

    const verifier = crypto.createVerify("sha256");
    verifier.update(timestampPayload);
    verifier.end();

    return verifier.verify(keyObject, decodedSignature);
  } catch (error) {
    webhooksEmailEventsLogger.error({ err: error }, "[Webhook] Error verifying SendGrid signature:");
    webhooksEmailEventsLogger.error({ keyLength: publicKey.length, keyPrefix: publicKey.substring(0, 20) }, "SendGrid key details");
    return false;
  }
}

// Mailgun Event Types
type MailgunEventType =
  | "accepted"
  | "delivered"
  | "opened"
  | "clicked"
  | "unsubscribed"
  | "complained"
  | "temporary_fail"
  | "permanent_fail"
  | "failed";

// SendGrid Event Types
type SendGridEventType =
  | "processed"
  | "dropped"
  | "delivered"
  | "deferred"
  | "bounce"
  | "blocked"
  | "open"
  | "click"
  | "spamreport"
  | "unsubscribe"
  | "group_unsubscribe"
  | "group_resubscribe";

interface MailgunEventData {
  event: MailgunEventType;
  recipient: string;
  timestamp: number;
  "message-id"?: string;
  "user-agent"?: string;
  ip?: string;
  url?: string; // For click events
  "delivery-status"?: {
    message?: string;
    code?: number;
    description?: string;
  };
  reason?: string;
  severity?: string;
}

interface SendGridEventData {
  event: SendGridEventType;
  email: string;
  timestamp: number;
  sg_message_id?: string;
  useragent?: string;
  ip?: string;
  url?: string;
  reason?: string;
  status?: string;
  type?: string; // bounce type: "bounce" or "blocked"
  bounce_classification?: string;
}

interface MailgunWebhookPayload {
  signature?: {
    timestamp: string;
    token: string;
    signature: string;
  };
  "event-data"?: MailgunEventData;
  // Legacy format fields
  event?: string;
  recipient?: string;
  timestamp?: string;
}

// Map Mailgun events to our email status
function mapEventToStatus(event: MailgunEventType): string | null {
  switch (event) {
    case "delivered":
      return "DELIVERED";
    case "permanent_fail":
      return "BOUNCED";
    case "failed":
    case "temporary_fail":
      return "FAILED";
    default:
      return null; // Don't update status for other events
  }
}

// Add email to blocklist and update all related records
async function handleBounce(email: string, reason?: string, source?: string) {
  const normalizedEmail = email.toLowerCase().trim();

  webhooksEmailEventsLogger.info(`[Bounce] Processing bounce for: ${normalizedEmail}, reason: ${reason}`);

  // 1. Add to EmailBlocklist if not already there
  const existingBlock = await db.emailBlocklist.findFirst({
    where: {
      type: "EMAIL",
      value: normalizedEmail,
    },
  });

  if (!existingBlock) {
    await db.emailBlocklist.create({
      data: {
        type: "EMAIL",
        value: normalizedEmail,
        reason: reason || "Email bounced",
        source: source || "webhook-bounce",
        isActive: true,
      },
    });
    webhooksEmailEventsLogger.info(`[Bounce] Added ${normalizedEmail} to blocklist`);
  } else {
    // Update existing blocklist entry
    await db.emailBlocklist.update({
      where: { id: existingBlock.id },
      data: {
        blockedCount: { increment: 1 },
        lastBlockedAt: new Date(),
        reason: reason || existingBlock.reason,
      },
    });
  }

  // 2. Full removal from all lists + cancel pending queue emails
  await removeFromAllLists(normalizedEmail, "bounce", "bounced");

  return { blockedEmail: normalizedEmail };
}

// Handle spam complaint - more severe than bounce
async function handleSpamComplaint(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  webhooksEmailEventsLogger.info(`[Spam] Processing spam complaint for: ${normalizedEmail}`);

  // Add to blocklist with spam reason
  const existingBlock = await db.emailBlocklist.findFirst({
    where: {
      type: "EMAIL",
      value: normalizedEmail,
    },
  });

  if (!existingBlock) {
    await db.emailBlocklist.create({
      data: {
        type: "EMAIL",
        value: normalizedEmail,
        reason: "Spam complaint",
        source: "webhook-spam",
        isActive: true,
      },
    });
  } else {
    await db.emailBlocklist.update({
      where: { id: existingBlock.id },
      data: {
        reason: "Spam complaint",
        blockedCount: { increment: 1 },
        lastBlockedAt: new Date(),
      },
    });
  }

  // Full removal from all lists + cancel pending queue emails
  await removeFromAllLists(normalizedEmail, "spam complaint");
}

// Remove an email from all subscriber lists, newsletter, project followers, and cancel pending queue emails
async function removeFromAllLists(email: string, reason: string, subscriberStatus: "unsubscribed" | "bounced" = "unsubscribed") {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Update EmailListSubscriber status for all creators
  const updatedSubs = await db.emailListSubscriber.updateMany({
    where: { email: normalizedEmail },
    data: { status: subscriberStatus },
  });
  if (updatedSubs.count > 0) {
    webhooksEmailEventsLogger.info(`[${reason}] Set ${updatedSubs.count} EmailListSubscriber record(s) to ${subscriberStatus} for ${normalizedEmail}`);
  }

  // 2. Set User.emailUnsubscribedAt if user exists
  try {
    await db.user.updateMany({
      where: { email: normalizedEmail, emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: new Date() },
    });
  } catch {
    // User might not exist
  }

  // 3. Deactivate NewsletterSubscriber
  try {
    await db.newsletterSubscriber.updateMany({
      where: { email: normalizedEmail, isActive: true },
      data: { isActive: false, unsubscribedAt: new Date() },
    });
  } catch {
    // Table might not exist
  }

  // 4. Delete ProjectFollower records
  try {
    await db.projectFollower.deleteMany({
      where: { email: normalizedEmail },
    });
  } catch {
    // Table might not exist
  }

  // 5. Cancel any pending emails in the queue
  try {
    const cancelled = await db.emailQueue.updateMany({
      where: {
        toEmail: normalizedEmail,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "FAILED",
        error: `Recipient removed: ${reason}`,
      },
    });
    if (cancelled.count > 0) {
      webhooksEmailEventsLogger.info(`[${reason}] Cancelled ${cancelled.count} pending queue email(s) for ${normalizedEmail}`);
    }
  } catch {
    // Queue table might not exist
  }
}

// POST - Handle Mailgun/SendGrid Event Webhook
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let eventData: MailgunEventData | null = null;
    let sendGridEvents: SendGridEventData[] | null = null;

    if (contentType.includes("application/json")) {
      // Read raw body for SendGrid signature verification
      const rawBody = await request.text();
      const payload = JSON.parse(rawBody);

      // Check if it's a SendGrid webhook (array of events)
      if (Array.isArray(payload)) {
        // Verify SendGrid webhook signature — require signature when a verification key is configured
        const sgSignature = request.headers.get("x-twilio-email-event-webhook-signature");
        const sgTimestamp = request.headers.get("x-twilio-email-event-webhook-timestamp");

        const settings = await db.platformSettings.findUnique({
          where: { id: "default" },
          select: { sendgridWebhookVerificationKey: true },
        });

        if (settings?.sendgridWebhookVerificationKey) {
          // Verification key is configured — signature headers are required
          if (!sgSignature || !sgTimestamp) {
            webhooksEmailEventsLogger.error("[Webhook] SendGrid webhook missing signature headers — rejecting");
            return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
          }

          const key = settings.sendgridWebhookVerificationKey;
          const isValid = await verifySendGridSignature(
            key,
            rawBody,
            sgSignature,
            sgTimestamp
          );

          if (!isValid) {
            webhooksEmailEventsLogger.error("[Webhook] SendGrid signature verification failed");
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
          }
          webhooksEmailEventsLogger.info("[Webhook] SendGrid signature verification passed!");
        } else {
          webhooksEmailEventsLogger.warn("[Webhook] SendGrid verification key not configured — accepting without signature verification");
        }

        sendGridEvents = payload as SendGridEventData[];
      } else {
        // Mailgun JSON format - verify signature
        const mailgunPayload = payload as MailgunWebhookPayload;

        if (mailgunPayload.signature) {
          const { timestamp, token, signature } = mailgunPayload.signature;
          if (timestamp && token && signature) {
            const isValid = await verifyMailgunSignature(timestamp, token, signature);
            if (!isValid) {
              webhooksEmailEventsLogger.error("[Webhook] Mailgun signature verification failed");
              return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
          } else {
            // Signature block present but fields missing — reject
            webhooksEmailEventsLogger.error("[Webhook] Mailgun signature block incomplete — rejecting");
            return NextResponse.json({ error: "Incomplete signature" }, { status: 401 });
          }
        } else {
          // No signature block — verify via signing key if configured
          const mgSettings = await db.platformSettings.findUnique({
            where: { id: "default" },
            select: { mailgunWebhookSigningKey: true },
          });
          if (mgSettings?.mailgunWebhookSigningKey) {
            // Signing key configured but no signature in payload — reject
            webhooksEmailEventsLogger.error("[Webhook] Mailgun JSON webhook missing signature — rejecting");
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
          }
          webhooksEmailEventsLogger.warn("[Webhook] Mailgun signing key not configured — accepting without signature verification");
        }

        if (mailgunPayload["event-data"]) {
          eventData = mailgunPayload["event-data"];
        } else if (mailgunPayload.event && mailgunPayload.recipient) {
          // Legacy format
          eventData = {
            event: mailgunPayload.event as MailgunEventType,
            recipient: mailgunPayload.recipient,
            timestamp: parseInt(mailgunPayload.timestamp || "0", 10),
          };
        }
      }
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      // Mailgun Form data format
      const formData = await request.formData();

      // Verify Mailgun signature from form data if present
      const mgTimestamp = formData.get("timestamp") as string;
      const mgToken = formData.get("token") as string;
      const mgSignature = formData.get("signature") as string;

      if (mgTimestamp && mgToken && mgSignature) {
        const isValid = await verifyMailgunSignature(mgTimestamp, mgToken, mgSignature);
        if (!isValid) {
          webhooksEmailEventsLogger.error("[Webhook] Mailgun form signature verification failed");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }

      // Try to get event-data as JSON string first
      const eventDataStr = formData.get("event-data") as string;
      if (eventDataStr) {
        try {
          eventData = JSON.parse(eventDataStr);
        } catch {
          // Not JSON, parse form fields directly
        }
      }

      if (!eventData) {
        // Parse individual form fields
        const event = formData.get("event") as string;
        const recipient = formData.get("recipient") as string;
        const timestamp = formData.get("timestamp") as string;

        if (event && recipient) {
          eventData = {
            event: event as MailgunEventType,
            recipient: recipient,
            timestamp: parseInt(timestamp || "0", 10),
            url: formData.get("url") as string || undefined,
            reason: formData.get("reason") as string || undefined,
          };
        }
      }
    }

    // Handle SendGrid events
    if (sendGridEvents && sendGridEvents.length > 0) {
      for (const sgEvent of sendGridEvents) {
        const email = sgEvent.email?.toLowerCase();
        if (!email) continue;

        webhooksEmailEventsLogger.info(`[SendGrid] Event ${sgEvent.event}: ${email}`);

        switch (sgEvent.event) {
          case "bounce":
            // Only blocklist on hard bounces (invalid/non-existent addresses)
            // Soft bounces (mailbox full, temp issues) should NOT permanently block
            if (sgEvent.bounce_classification === "Reputable" || sgEvent.bounce_classification === "Content") {
              // "Reputable" = ISP reputation block (temporary), "Content" = content-based block
              // These are NOT invalid addresses - don't blocklist
              webhooksEmailEventsLogger.info(`[SendGrid] Skipping blocklist for soft/reputation bounce: ${email} (${sgEvent.bounce_classification})`);
            } else {
              await handleBounce(email, sgEvent.reason || sgEvent.bounce_classification, "sendgrid-bounce");
            }
            break;
          case "blocked":
            // "blocked" = ISP temporarily rejected (rate limiting, reputation throttling)
            // Very common with Hotmail/Outlook - NOT a permanent failure, do NOT blocklist
            webhooksEmailEventsLogger.info(`[SendGrid] ISP block (temporary) for: ${email}, reason: ${sgEvent.reason} - NOT adding to blocklist`);
            break;
          case "dropped":
            // "dropped" = SendGrid's own suppression (previous bounce/spam) - already handled
            webhooksEmailEventsLogger.info(`[SendGrid] Dropped by SendGrid for: ${email}, reason: ${sgEvent.reason} - NOT adding to blocklist`);
            break;
          case "spamreport":
            await handleSpamComplaint(email);
            break;
          case "unsubscribe":
          case "group_unsubscribe":
            await removeFromAllLists(email, "unsubscribed via SendGrid");
            break;
        }
      }

      return NextResponse.json({ success: true, processed: sendGridEvents.length });
    }

    // Handle Mailgun events
    if (!eventData) {
      webhooksEmailEventsLogger.error("Could not parse webhook payload");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const email = eventData.recipient?.toLowerCase();
    const eventType = eventData.event;

    webhooksEmailEventsLogger.info(`[Mailgun] Email ${eventType}: recipient=${email}`);

    // Handle bounce and spam events globally (update blocklist and subscriber lists)
    switch (eventType) {
      case "permanent_fail":
        // Only permanent failures should be blocklisted
        if (email) {
          await handleBounce(
            email,
            eventData.reason || eventData["delivery-status"]?.description,
            "mailgun-bounce"
          );
        }
        break;
      case "failed":
        // Generic "failed" could be temporary - log but don't blocklist
        webhooksEmailEventsLogger.info(`[Mailgun] Generic failure for: ${email}, reason: ${eventData.reason || eventData["delivery-status"]?.description} - NOT adding to blocklist`);
        break;
      case "complained":
        if (email) {
          await handleSpamComplaint(email);
        }
        break;
      case "unsubscribed":
        if (email) {
          await removeFromAllLists(email, "unsubscribed via Mailgun");
        }
        break;
    }

    // Find recent emails sent to this recipient for AdminEmail tracking
    if (!email) {
      webhooksEmailEventsLogger.info("[Mailgun] No recipient email in event data, skipping AdminEmail tracking");
      return NextResponse.json({ success: true, action: "no_recipient" });
    }

    const recentEmails = await db.adminEmail.findMany({
      where: {
        toEmail: email,
        folder: "SENT",
        sentAt: {
          // Look for emails sent in the last 7 days
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { sentAt: "desc" },
      take: 5,
    });

    if (recentEmails.length === 0) {
      // No matching email found - that's ok, we already processed bounce/spam
      webhooksEmailEventsLogger.info(`No matching AdminEmail found for ${email} - event: ${eventType}`);
      return NextResponse.json({ success: true, action: "processed_globally" });
    }

    // Use the most recent email
    const adminEmail = recentEmails[0];
    const updateData: Record<string, unknown> = {};

    // Update status if applicable
    const newStatus = mapEventToStatus(eventType);
    if (newStatus) {
      updateData.status = newStatus;
    }

    // Handle specific events
    switch (eventType) {
      case "opened":
        updateData.openedAt = new Date(eventData.timestamp * 1000);
        break;

      case "permanent_fail":
      case "temporary_fail":
      case "failed":
        // Store bounce/fail reason in attachments field as metadata
        updateData.attachments = {
          ...(adminEmail.attachments as Record<string, unknown> || {}),
          bounceReason: eventData.reason || eventData["delivery-status"]?.description,
          bounceCode: eventData["delivery-status"]?.code,
          bounceSeverity: eventData.severity,
          bounceTimestamp: new Date(eventData.timestamp * 1000).toISOString(),
        };
        break;

      case "complained":
        updateData.attachments = {
          ...(adminEmail.attachments as Record<string, unknown> || {}),
          spamReported: true,
          spamReportTimestamp: new Date(eventData.timestamp * 1000).toISOString(),
        };
        break;

      case "clicked":
        // Track click in attachments
        const existingAttachments = adminEmail.attachments as Record<string, unknown> || {};
        const clicks = (existingAttachments.clicks as Array<{ url: string; timestamp: string }>) || [];
        clicks.push({
          url: eventData.url || "unknown",
          timestamp: new Date(eventData.timestamp * 1000).toISOString(),
        });
        updateData.attachments = {
          ...existingAttachments,
          clicks,
          lastClickAt: new Date(eventData.timestamp * 1000).toISOString(),
        };
        break;

      case "unsubscribed":
        updateData.attachments = {
          ...(adminEmail.attachments as Record<string, unknown> || {}),
          unsubscribed: true,
          unsubscribeTimestamp: new Date(eventData.timestamp * 1000).toISOString(),
        };
        break;
    }

    // Only update if we have something to update
    if (Object.keys(updateData).length > 0) {
      await db.adminEmail.update({
        where: { id: adminEmail.id },
        data: updateData,
      });

      return NextResponse.json({ success: true, emailId: adminEmail.id, event: eventType });
    }

    return NextResponse.json({ success: true, event: eventType, action: "no_update_needed" });
  } catch (error) {
    webhooksEmailEventsLogger.error({ err: error }, "Error processing email event webhook:");
    // Return 200 to prevent retries
    return NextResponse.json({
      success: false,
      error: "Failed to process event",
    });
  }
}

// GET - Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Email Event Webhook is active (Mailgun + SendGrid)",
    endpoint: "/api/webhooks/email/events",
    trackedEvents: {
      mailgun: [
        "delivered",
        "opened",
        "clicked",
        "permanent_fail",
        "temporary_fail",
        "complained",
        "unsubscribed",
      ],
      sendgrid: [
        "bounce",
        "blocked",
        "dropped",
        "spamreport",
        "unsubscribe",
      ],
    },
  });
}
