import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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
    case "failed":
      return "BOUNCED";
    case "temporary_fail":
      return "FAILED";
    default:
      return null; // Don't update status for other events
  }
}

// POST - Handle Mailgun Event Webhook
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let eventData: MailgunEventData | null = null;

    if (contentType.includes("application/json")) {
      // JSON format (newer Mailgun format)
      const payload: MailgunWebhookPayload = await request.json();

      if (payload["event-data"]) {
        eventData = payload["event-data"];
      } else if (payload.event && payload.recipient) {
        // Legacy format
        eventData = {
          event: payload.event as MailgunEventType,
          recipient: payload.recipient,
          timestamp: parseInt(payload.timestamp || "0", 10),
        };
      }
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      // Form data format
      const formData = await request.formData();

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

    if (!eventData) {
      console.error("Could not parse Mailgun webhook payload");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const email = eventData.recipient?.toLowerCase();
    const eventType = eventData.event;

    console.log(`Email ${eventType}: recipient=${email}`);

    // Find recent emails sent to this recipient
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
      // No matching email found - that's ok, just log it
      console.log(`No matching email found for ${email} - event: ${eventType}`);
      return NextResponse.json({ success: true, action: "no_matching_email" });
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
    console.error("Error processing email event webhook:", error);
    // Return 200 to prevent Mailgun from retrying
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
    message: "Mailgun Event Webhook is active",
    endpoint: "/api/webhooks/email/events",
    trackedEvents: [
      "delivered",
      "opened",
      "clicked",
      "permanent_fail",
      "temporary_fail",
      "complained",
      "unsubscribed",
    ],
  });
}
