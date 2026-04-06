import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getR2Storage, generateEmailAttachmentKey } from "@/lib/r2";
import crypto from "crypto";

import { logger } from "@/lib/logger";

const webhooksEmailInboundLogger = logger.child({ module: "webhooks-email-inbound" });

// Verify Mailgun inbound webhook signature (same HMAC-SHA256 scheme as event webhooks)
async function verifyMailgunInboundSignature(
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
      webhooksEmailInboundLogger.error("[Inbound Email] Mailgun webhook signing key not configured - rejecting request");
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
    webhooksEmailInboundLogger.error({ err: error }, "[Inbound Email] Error verifying Mailgun signature:");
    return false;
  }
}


export const dynamic = "force-dynamic";

// Disable body parsing - we need raw multipart/form-data
export const runtime = "nodejs";

interface EmailEnvelope {
  to: string[];
  from: string;
}

interface AttachmentFile {
  filename: string;
  contentType: string;
  size: number;
  data: Buffer;
}

interface ParsedEmail {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  attachmentCount?: number;
  attachmentFiles?: AttachmentFile[];
  envelope?: EmailEnvelope;
}

// Extract name and email from "Name <email@example.com>" format
function parseEmailAddress(address: string): { email: string; name?: string } {
  const match = address.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: address.trim().toLowerCase() };
}

// Find creator by their email handle (e.g., mike@indiecrowdfund.com -> find user with creatorEmailHandle = "mike")
async function findCreatorByEmail(toEmail: string) {
  const emailLower = toEmail.toLowerCase();
  const emailParts = emailLower.split("@");

  if (emailParts.length !== 2) return null;

  const [handle, domain] = emailParts;

  // Check if this is an @indiecrowdfund.com email
  if (domain === "indiecrowdfund.com" || domain === "inbox.indiecrowdfund.com" || domain === "mail.indiecrowdfund.com") {
    const creator = await db.user.findUnique({
      where: { creatorEmailHandle: handle },
      select: {
        id: true,
        name: true,
        email: true,
        creatorEmailHandle: true,
      },
    });

    if (creator) {
      webhooksEmailInboundLogger.info(`[Inbound Email] Found creator ${creator.name} for ${toEmail}`);
      return creator;
    }
  }

  return null;
}

// Find matching mailbox for the recipient email
async function findMailboxForEmail(toEmail: string) {
  // Try exact match first
  let mailbox = await db.mailbox.findUnique({
    where: { email: toEmail.toLowerCase() },
  });

  if (mailbox) return mailbox;

  // Try matching without subdomain variations (e.g., support@mail.domain.com -> support@domain.com)
  const emailParts = toEmail.split("@");
  if (emailParts.length === 2) {
    const localPart = emailParts[0];
    const domainParts = emailParts[1].split(".");

    // Try removing subdomains one at a time
    while (domainParts.length > 2) {
      domainParts.shift();
      const altEmail = `${localPart}@${domainParts.join(".")}`;
      mailbox = await db.mailbox.findUnique({
        where: { email: altEmail.toLowerCase() },
      });
      if (mailbox) return mailbox;
    }
  }

  // Fall back to default mailbox
  mailbox = await db.mailbox.findFirst({
    where: { isDefault: true, isActive: true },
  });

  // If no default, get any active mailbox
  if (!mailbox) {
    mailbox = await db.mailbox.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  return mailbox;
}

// POST - Handle incoming email from Mailgun/SendGrid Inbound Parse
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let emailData: ParsedEmail;

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      // Parse form data (Mailgun and SendGrid both use this)
      const formData = await request.formData();

      // Debug: Log all form fields received
      const formFields: Record<string, string> = {};
      formData.forEach((value, key) => {
        if (typeof value === "string") {
          formFields[key] = value.substring(0, 200); // Truncate for logging
        } else {
          formFields[key] = `[File: ${value.name}]`;
        }
      });
      webhooksEmailInboundLogger.info({ data: Object.keys(formFields).join(", ") }, "[Inbound Email] Received form fields:");

      // Verify Mailgun inbound signature if present
      const mgTimestamp = formData.get("timestamp") as string;
      const mgToken = formData.get("token") as string;
      const mgSignature = formData.get("signature") as string;
      if (mgTimestamp && mgToken && mgSignature) {
        const isValid = await verifyMailgunInboundSignature(mgTimestamp, mgToken, mgSignature);
        if (!isValid) {
          webhooksEmailInboundLogger.error("[Inbound Email] Mailgun signature verification failed");
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }

      // Mailgun uses "recipient" and "sender", SendGrid uses "to" and "from"
      const toRaw = (formData.get("recipient") as string) || (formData.get("to") as string) || "";
      const fromRaw = (formData.get("sender") as string) || (formData.get("from") as string) || "";
      const envelopeRaw = formData.get("envelope") as string;

      // Get email body - try multiple field names (Mailgun and SendGrid variants)
      const textBody = (formData.get("body-plain") as string) ||
                       (formData.get("stripped-text") as string) ||
                       (formData.get("text") as string) || "";
      const htmlBody = (formData.get("body-html") as string) ||
                       (formData.get("stripped-html") as string) ||
                       (formData.get("html") as string) || "";

      let envelope: EmailEnvelope | undefined;
      try {
        if (envelopeRaw) {
          envelope = JSON.parse(envelopeRaw);
        }
      } catch {
        // Ignore envelope parse errors
      }

      // Mailgun uses "attachment-count", SendGrid uses "attachments"
      const attachmentCount = (formData.get("attachment-count") as string) ||
                              (formData.get("attachments") as string) || "0";

      // Extract actual attachment files
      const attachmentFiles: AttachmentFile[] = [];
      const attachmentCountNum = Math.min(Math.max(parseInt(attachmentCount, 10) || 0, 0), 50);

      // Mailgun sends attachments as attachment-1, attachment-2, etc.
      // SendGrid sends them as attachment1, attachment2, etc. or just numbered
      for (let i = 1; i <= Math.max(attachmentCountNum, 10); i++) {
        // Try different naming conventions
        const attachment = (formData.get(`attachment-${i}`) as File) ||
                          (formData.get(`attachment${i}`) as File) ||
                          (formData.get(`${i}`) as File);

        if (attachment && attachment instanceof File && attachment.size > 0) {
          try {
            const arrayBuffer = await attachment.arrayBuffer();
            attachmentFiles.push({
              filename: attachment.name || `attachment-${i}`,
              contentType: attachment.type || "application/octet-stream",
              size: attachment.size,
              data: Buffer.from(arrayBuffer),
            });
            webhooksEmailInboundLogger.info(`[Inbound Email] Found attachment: ${attachment.name} (${attachment.size} bytes)`);
          } catch (err) {
            webhooksEmailInboundLogger.error({ err: err }, `[Inbound Email] Failed to read attachment ${i}:`);
          }
        }
      }

      emailData = {
        to: toRaw,
        from: fromRaw,
        subject: (formData.get("subject") as string) || "(No Subject)",
        text: textBody || undefined,
        html: htmlBody || undefined,
        cc: (formData.get("cc") as string) || (formData.get("Cc") as string) || undefined,
        attachmentCount: attachmentCountNum,
        attachmentFiles: attachmentFiles.length > 0 ? attachmentFiles : undefined,
        envelope,
      };
    } else if (contentType.includes("application/json")) {
      // Parse JSON
      emailData = await request.json();
    } else {
      webhooksEmailInboundLogger.error({ err: contentType }, "Unsupported content type for inbound email:");
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 }
      );
    }

    // Parse sender and recipient
    const fromParsed = parseEmailAddress(emailData.from);
    const toParsed = parseEmailAddress(emailData.to);

    // Get the actual recipient email (prefer envelope for accuracy)
    const recipientEmail = emailData.envelope?.to?.[0] || toParsed.email;

    // Prepare body content - ensure we have content
    const finalBodyHtml = emailData.html || (emailData.text ? emailData.text.replace(/\n/g, "<br>") : "");
    const finalBodyText = emailData.text || "";

    // First, check if this is a creator email (e.g., mike@indiecrowdfund.com)
    const creator = await findCreatorByEmail(recipientEmail);

    if (creator) {
      // This email is for a creator - store as a Message
      webhooksEmailInboundLogger.info(`[Inbound Email] Routing to creator ${creator.name} (${creator.id})`);

      // Try to find the sender as a user in our system
      const sender = await db.user.findUnique({
        where: { email: fromParsed.email.toLowerCase() },
        select: { id: true, name: true },
      });

      // Store the message with the creator as recipient
      // If sender is external (not in our system), include their info in the content
      // and use creator.id as senderId (self-message to inbox)
      const isExternalSender = !sender;
      const messageContent = isExternalSender
        ? `From: ${fromParsed.name || fromParsed.email} <${fromParsed.email}>\n\n${finalBodyText || finalBodyHtml.replace(/<[^>]*>/g, "")}`
        : finalBodyText || finalBodyHtml.replace(/<[^>]*>/g, "");

      const message = await db.message.create({
        data: {
          // For external senders, use creator as sender (like a self-delivered message to inbox)
          // projectId is null for creator inbox emails (not tied to a specific project)
          senderId: sender?.id || creator.id,
          recipientId: creator.id,
          subject: isExternalSender
            ? `[External] ${emailData.subject}`
            : emailData.subject,
          content: messageContent,
          read: false,
        },
      });

      webhooksEmailInboundLogger.info(`[Inbound Email] Created message ${message.id} for creator ${creator.id}`);

      return NextResponse.json({
        success: true,
        type: "creator_message",
        messageId: message.id,
        creatorId: creator.id,
        creatorEmail: `${creator.creatorEmailHandle}@indiecrowdfund.com`,
      });
    }

    // Not a creator email - route to admin mailbox
    const mailbox = await findMailboxForEmail(recipientEmail);

    if (!mailbox) {
      webhooksEmailInboundLogger.warn({ data: recipientEmail }, "No mailbox found for inbound email to:");
      // Still return 200 to prevent SendGrid from retrying
      return NextResponse.json({
        success: false,
        reason: "No matching mailbox or creator found",
        recipient: recipientEmail,
      });
    }

    // Generate a thread ID based on subject (simple threading)
    const subjectForThread = emailData.subject
      .replace(/^(re:|fw:|fwd:)\s*/gi, "")
      .trim()
      .toLowerCase();
    const threadId = `thread_${Buffer.from(subjectForThread).toString("base64").slice(0, 32)}`;

    // Generate email ID first so we can use it for attachment paths
    const emailId = crypto.randomUUID().replace(/-/g, "").substring(0, 25);

    // Upload attachments to R2 if we have any
    interface StoredAttachment {
      id: string;
      filename: string;
      contentType: string;
      size: number;
      r2Key: string;
    }
    const storedAttachments: StoredAttachment[] = [];

    if (emailData.attachmentFiles && emailData.attachmentFiles.length > 0) {
      const r2Storage = await getR2Storage();
      if (r2Storage) {
        for (const attachment of emailData.attachmentFiles) {
          try {
            const attachmentId = crypto.randomUUID();
            const r2Key = generateEmailAttachmentKey(
              mailbox.id,
              emailId,
              attachment.filename,
              attachmentId
            );

            await r2Storage.uploadFile(r2Key, attachment.data, {
              contentType: attachment.contentType,
              metadata: {
                originalFilename: attachment.filename,
                emailId: emailId,
                mailboxId: mailbox.id,
              },
            });

            storedAttachments.push({
              id: attachmentId,
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
              r2Key: r2Key,
            });

            webhooksEmailInboundLogger.info(`[Inbound Email] Uploaded attachment to R2: ${attachment.filename}`);
          } catch (err) {
            webhooksEmailInboundLogger.error({ err: err }, `[Inbound Email] Failed to upload attachment ${attachment.filename}:`);
          }
        }
      } else {
        webhooksEmailInboundLogger.warn("[Inbound Email] R2 storage not configured, skipping attachments");
      }
    }

    // Store the email in admin mailbox
    const email = await db.adminEmail.create({
      data: {
        id: emailId,
        mailboxId: mailbox.id,
        fromEmail: fromParsed.email,
        fromName: fromParsed.name || null,
        toEmail: toParsed.email,
        toName: toParsed.name || null,
        ccEmails: emailData.cc ? emailData.cc.split(",").map((e: string) => e.trim()) : [],
        bccEmails: [],
        subject: emailData.subject,
        bodyHtml: finalBodyHtml,
        bodyText: finalBodyText || null,
        folder: "INBOX",
        status: "DELIVERED",
        isRead: false,
        isStarred: false,
        receivedAt: new Date(),
        threadId,
        attachments: storedAttachments.length > 0
          ? { count: storedAttachments.length, files: storedAttachments }
          : (emailData.attachmentCount ? { count: emailData.attachmentCount } : null),
      },
    });

    return NextResponse.json({
      success: true,
      type: "admin_mailbox",
      emailId: email.id,
      mailboxId: mailbox.id,
      mailboxName: mailbox.name,
    });
  } catch (error) {
    webhooksEmailInboundLogger.error({ err: error }, "Error processing inbound email:");
    // Return 200 anyway to prevent SendGrid from retrying on our errors
    return NextResponse.json({
      success: false,
      error: "Failed to process email",
    });
  }
}

// GET - Health check / verification endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Inbound email webhook is active",
    provider: "Mailgun/SendGrid Inbound Parse",
    endpoint: "/api/webhooks/email/inbound",
  });
}
