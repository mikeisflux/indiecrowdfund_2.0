import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAndParseSendGridWebhook } from "@/lib/email/sendgrid-verify";

export const dynamic = "force-dynamic";

// SendGrid Event Types
type SendGridEventType =
  | "processed"
  | "dropped"
  | "delivered"
  | "deferred"
  | "bounce"
  | "open"
  | "click"
  | "spam_report"
  | "unsubscribe"
  | "group_unsubscribe"
  | "group_resubscribe";

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: SendGridEventType;
  sg_event_id: string;
  sg_message_id: string;
  useragent?: string;
  ip?: string;
  url?: string; // For click events
  reason?: string; // For bounce/dropped
  status?: string; // SMTP status code
  response?: string; // SMTP response
  category?: string[];
}

// Map SendGrid events to our email status
function mapEventToStatus(event: SendGridEventType): string | null {
  switch (event) {
    case "delivered":
      return "DELIVERED";
    case "bounce":
      return "BOUNCED";
    case "dropped":
      return "FAILED";
    default:
      return null; // Don't update status for other events
  }
}

// POST - Handle SendGrid Event Webhook
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify SendGrid signature
    const verification = await verifyAndParseSendGridWebhook(request.headers, rawBody);
    if (!verification.valid) {
      console.error("SendGrid signature verification failed:", verification.error);
      return NextResponse.json(
        { error: "Invalid signature", details: verification.error },
        { status: 401 }
      );
    }

    // Parse the JSON body
    const events: SendGridEvent[] = JSON.parse(rawBody);

    if (!Array.isArray(events)) {
      console.error("Invalid event webhook payload - expected array");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    console.log(`Processing ${events.length} SendGrid events (signature verified)`);

    const results = await Promise.allSettled(
      events.map(async (event) => {
        try {
          // Find email by recipient address and recent timestamp
          // SendGrid doesn't send our internal ID, so we match by email + time window
          const recentEmails = await db.adminEmail.findMany({
            where: {
              toEmail: event.email.toLowerCase(),
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
            console.log(`No matching email found for event: ${event.event} to ${event.email}`);
            return { success: false, reason: "No matching email" };
          }

          // Use the most recent email (or implement better matching with sg_message_id if stored)
          const email = recentEmails[0];

          const updateData: Record<string, unknown> = {};

          // Update status if applicable
          const newStatus = mapEventToStatus(event.event);
          if (newStatus) {
            updateData.status = newStatus;
          }

          // Handle specific events
          switch (event.event) {
            case "open":
              updateData.openedAt = new Date(event.timestamp * 1000);
              break;

            case "bounce":
            case "dropped":
              // Store bounce/drop reason in attachments field as metadata
              updateData.attachments = {
                ...(email.attachments as Record<string, unknown> || {}),
                bounceReason: event.reason || event.response,
                bounceStatus: event.status,
                bounceTimestamp: new Date(event.timestamp * 1000).toISOString(),
              };
              break;

            case "spam_report":
              updateData.attachments = {
                ...(email.attachments as Record<string, unknown> || {}),
                spamReported: true,
                spamReportTimestamp: new Date(event.timestamp * 1000).toISOString(),
              };
              break;

            case "click":
              // Track click in attachments
              const existingAttachments = email.attachments as Record<string, unknown> || {};
              const clicks = (existingAttachments.clicks as Array<{ url: string; timestamp: string }>) || [];
              clicks.push({
                url: event.url || "unknown",
                timestamp: new Date(event.timestamp * 1000).toISOString(),
              });
              updateData.attachments = {
                ...existingAttachments,
                clicks,
                lastClickAt: new Date(event.timestamp * 1000).toISOString(),
              };
              break;
          }

          // Only update if we have something to update
          if (Object.keys(updateData).length > 0) {
            await db.adminEmail.update({
              where: { id: email.id },
              data: updateData,
            });

            console.log(`Updated email ${email.id} with event: ${event.event}`);
            return { success: true, emailId: email.id, event: event.event };
          }

          return { success: true, event: event.event, action: "no_update_needed" };
        } catch (err) {
          console.error(`Error processing event ${event.event}:`, err);
          return { success: false, error: String(err) };
        }
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      processed: events.length,
      succeeded,
      failed,
    });
  } catch (error) {
    console.error("Error processing event webhook:", error);
    // Return 200 to prevent SendGrid from retrying
    return NextResponse.json({
      success: false,
      error: "Failed to process events",
    });
  }
}

// GET - Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SendGrid Event Webhook is active",
    endpoint: "/api/webhooks/email/events",
    trackedEvents: [
      "delivered",
      "open",
      "click",
      "bounce",
      "dropped",
      "spam_report",
    ],
  });
}
