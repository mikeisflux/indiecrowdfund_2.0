import sgMail from "@sendgrid/mail";
import Mailgun from "mailgun.js";
import type { MailgunMessageData } from "mailgun.js/definitions";
import formData from "form-data";
import crypto from "crypto";
import { db } from "@/lib/db";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Email priority levels for the queue
// Higher priority = processed first
export const EMAIL_PRIORITY = {
  SYSTEM: 10,    // Account creation, payment receipts, password reset - highest priority
  CREATOR: 5,    // Creator emails, campaigns to backers - medium priority
  AI_MARKETING: 1, // AI-generated marketing campaigns - lowest priority
} as const;

// Secret key for signing unsubscribe tokens - requires proper secret in production
// Lazily get the secret to avoid build-time errors
function getUnsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("UNSUBSCRIBE_SECRET or AUTH_SECRET environment variable is required in production");
  }
  return secret || "development-secret";
}

// Attachment type for email attachments
export interface EmailAttachment {
  filename: string;
  data: Buffer | string; // Buffer or base64 string
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  skipUnsubscribeCheck?: boolean; // For transactional emails like password reset
  replyTo?: string; // Custom reply-to address
  fromEmail?: string; // Custom from email (e.g., creator email)
  fromName?: string; // Custom from name
  isCreatorEmail?: boolean; // True when sending from a creator's email handle
  attachments?: EmailAttachment[]; // Optional attachments
}

// Get email settings from database
async function getEmailSettings() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
    });
    return settings;
  } catch {
    return null;
  }
}

// Email notification type checks - returns true if email type is enabled
export async function isEmailTypeEnabled(emailType: "welcome" | "pledgeConfirmation" | "projectUpdate" | "verification"): Promise<boolean> {
  const settings = await getEmailSettings();
  if (!settings) return true; // Default to enabled if no settings

  switch (emailType) {
    case "welcome":
      return settings.welcomeEmailEnabled !== false;
    case "pledgeConfirmation":
      return settings.pledgeConfirmationEnabled !== false;
    case "projectUpdate":
      return settings.projectUpdateNotifications !== false;
    case "verification":
      return settings.emailVerificationRequired !== false;
    default:
      return true;
  }
}

// Check if email verification is required
export async function isEmailVerificationRequired(): Promise<boolean> {
  const settings = await getEmailSettings();
  return settings?.emailVerificationRequired ?? false;
}

// Generate a signed unsubscribe token for an email
export function generateUnsubscribeToken(email: string): string {
  const data = `${email}:${getUnsubscribeSecret()}`;
  const hash = crypto.createHash("sha256").update(data).digest("hex").slice(0, 32);
  const token = Buffer.from(`${email}:${hash}`).toString("base64url");
  return token;
}

// Generate the full unsubscribe URL for an email
export function getUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  return `${APP_URL}/api/unsubscribe?token=${token}`;
}

// Check if an email is unsubscribed
export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { emailUnsubscribedAt: true },
    });
    return !!user?.emailUnsubscribedAt;
  } catch {
    return false;
  }
}

// Check if an email is on the blocklist (bounced, spam reported, etc.)
// Note: "ratelimit" entries are NOT treated as blocks - rate limiting is temporary
// and emails should be queued/retried, not permanently blocked.
export async function isEmailBlocked(email: string): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is directly blocked
    const blockedEmail = await db.emailBlocklist.findFirst({
      where: {
        type: "EMAIL",
        value: normalizedEmail,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (blockedEmail) {
      // Skip blocking for rate-limited emails - these are temporary and should go through
      if (blockedEmail.reason === "ratelimit") {
        console.log(`[Email] Allowing rate-limited email through for: ${normalizedEmail}`);
        return { blocked: false };
      }

      // Update blocked count
      await db.emailBlocklist.update({
        where: { id: blockedEmail.id },
        data: {
          blockedCount: { increment: 1 },
          lastBlockedAt: new Date(),
        },
      });
      return { blocked: true, reason: blockedEmail.reason || "Email is on blocklist" };
    }

    // Check if domain is blocked
    const domain = normalizedEmail.split("@")[1];
    if (domain) {
      const blockedDomain = await db.emailBlocklist.findFirst({
        where: {
          type: "DOMAIN",
          value: domain,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (blockedDomain) {
        await db.emailBlocklist.update({
          where: { id: blockedDomain.id },
          data: {
            blockedCount: { increment: 1 },
            lastBlockedAt: new Date(),
          },
        });
        return { blocked: true, reason: blockedDomain.reason || "Domain is blocked" };
      }
    }

    return { blocked: false };
  } catch (error) {
    console.error("[Email] Error checking blocklist:", error);
    return { blocked: false };
  }
}

// Add whitelist banner to the top of HTML email
function addWhitelistBanner(html: string, fromEmail: string): string {
  const whitelistGuideUrl = `${APP_URL}/help/whitelist`;
  const banner = `
    <div style="background: linear-gradient(90deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #166534;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align: middle;">
            <strong style="color: #15803d;">Ensure delivery:</strong> Add <span style="font-family: monospace; background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${fromEmail}</span> to your contacts or safe sender list.
            <a href="${whitelistGuideUrl}" style="color: #16a34a; text-decoration: underline; margin-left: 8px;">How to whitelist</a>
          </td>
        </tr>
      </table>
    </div>
  `;

  // Insert after opening <body...> tag if it exists
  const bodyTagMatch = html.match(/<body[^>]*>/i);
  if (bodyTagMatch) {
    const bodyTag = bodyTagMatch[0];
    const insertPosition = html.indexOf(bodyTag) + bodyTag.length;
    return html.slice(0, insertPosition) + banner + html.slice(insertPosition);
  }

  // Otherwise prepend
  return banner + html;
}

// Add unsubscribe footer to HTML email
function addUnsubscribeFooter(html: string, email: string): string {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const footer = `
    <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
      <p style="margin: 0;">
        You're receiving this email because you have an account on ${APP_NAME}.
        <br>
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe from all emails</a>
      </p>
    </div>
  `;

  // Insert before closing </body> tag if it exists, otherwise append
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return html + footer;
}

// Add unsubscribe notice to plain text email
function addUnsubscribeText(text: string, email: string): string {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  return `${text}\n\n---\nTo unsubscribe from all emails: ${unsubscribeUrl}`;
}

// Add whitelist notice to plain text email
function addWhitelistText(text: string, fromEmail: string): string {
  const whitelistGuideUrl = `${APP_URL}/help/whitelist`;
  return `[Ensure delivery: Add ${fromEmail} to your contacts or safe sender list. Learn how: ${whitelistGuideUrl}]\n\n${text}`;
}

// Send email via SendGrid
async function sendViaSendGrid(
  to: string,
  subject: string,
  html: string,
  text: string,
  fromEmail: string,
  fromName: string,
  apiKey: string,
  replyTo?: string,
  unsubscribeUrl?: string
): Promise<{ success: boolean; error?: string }> {
  sgMail.setApiKey(apiKey);

  try {
    // Build headers with List-Unsubscribe for one-click unsubscribe (RFC 8058)
    const headers: Record<string, string> = {};
    if (unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const response = await sgMail.send({
      to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      replyTo: replyTo || fromEmail,
      subject,
      html,
      text,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    console.log("Email sent via SendGrid, status:", response[0]?.statusCode);
    return { success: true };
  } catch (error: unknown) {
    console.error("SendGrid Error:");
    if (error && typeof error === "object" && "response" in error) {
      const sgError = error as { response?: { body?: unknown; statusCode?: number } };
      console.error("SendGrid status code:", sgError.response?.statusCode);
      console.error("SendGrid response body:", JSON.stringify(sgError.response?.body, null, 2));
    }
    return { success: false, error: String(error) };
  }
}

// Send email via Mailgun
async function sendViaMailgun(
  to: string,
  subject: string,
  html: string,
  text: string,
  fromEmail: string,
  fromName: string,
  apiKey: string,
  domain: string,
  replyTo?: string,
  unsubscribeUrl?: string,
  attachments?: EmailAttachment[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const mailgun = new Mailgun(formData);
    const mg = mailgun.client({
      username: "api",
      key: apiKey,
    });

    // Build message with List-Unsubscribe headers for one-click unsubscribe (RFC 8058)
    const messageData: MailgunMessageData = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text,
      html,
      "h:Reply-To": replyTo || fromEmail,
    };

    // Add List-Unsubscribe headers for one-click unsubscribe support
    if (unsubscribeUrl) {
      messageData["h:List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      messageData["h:List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.attachment = attachments.map((att) => ({
        filename: att.filename,
        data: typeof att.data === "string" ? Buffer.from(att.data, "base64") : att.data,
        contentType: att.contentType,
      }));
    }

    const response = await mg.messages.create(domain, messageData);

    console.log("Email sent via Mailgun, id:", response.id);
    return { success: true };
  } catch (error: unknown) {
    console.error("Mailgun Error:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendEmail({ to, subject, html, text, skipUnsubscribeCheck, replyTo, fromEmail: customFromEmail, fromName: customFromName, isCreatorEmail, attachments }: SendEmailOptions) {
  console.log(`[Email] sendEmail called - to: ${to}, subject: ${subject}`);

  // Check if email is on the blocklist (bounced, spam reported, etc.)
  // This check applies to ALL emails including transactional ones
  const blocklistCheck = await isEmailBlocked(to);
  if (blocklistCheck.blocked) {
    console.log(`[Email] Skipping email - address is blocked: ${to}, reason: ${blocklistCheck.reason}`);
    return { success: false, error: blocklistCheck.reason || "Email address is blocked", skipped: true, blocked: true };
  }

  // Check if user has unsubscribed (unless this is a transactional email)
  if (!skipUnsubscribeCheck) {
    const unsubscribed = await isEmailUnsubscribed(to);
    if (unsubscribed) {
      console.log(`[Email] Skipping email - user has unsubscribed: ${to}`);
      return { success: false, error: "User has unsubscribed from emails", skipped: true };
    }
  }

  const settings = await getEmailSettings();
  console.log(`[Email] Settings loaded:`, {
    hasSettings: !!settings,
    emailProvider: settings?.emailProvider,
    smtpFromEmail: settings?.smtpFromEmail,
    smtpFromName: settings?.smtpFromName,
    hasMailgunKey: !!settings?.mailgunApiKey,
    mailgunDomain: settings?.mailgunDomain,
    hasSendgridKey: !!settings?.sendgridApiKey,
  });

  // Use custom from address if provided, otherwise fall back to settings/defaults
  const fromEmail = customFromEmail || settings?.smtpFromEmail || process.env.EMAIL_FROM || "noreply@indiecrowdfund.com";
  const fromName = customFromName || settings?.smtpFromName || APP_NAME;

  // Add whitelist banner and unsubscribe footer to emails (unless it's a transactional email that should skip)
  let finalHtml = html;
  let plainText: string;
  if (!skipUnsubscribeCheck) {
    finalHtml = addWhitelistBanner(finalHtml, fromEmail);
    finalHtml = addUnsubscribeFooter(finalHtml, to);
    // Build plain text with whitelist + unsubscribe notices
    const baseText = text || html.replace(/<[^>]*>/g, "");
    plainText = addWhitelistText(addUnsubscribeText(baseText, to), fromEmail);
  } else {
    plainText = text || html.replace(/<[^>]*>/g, "");
  }

  // Generate unsubscribe URL for List-Unsubscribe header (unless transactional email)
  const unsubscribeUrl = skipUnsubscribeCheck ? undefined : getUnsubscribeUrl(to);

  // Get email provider from settings (defaults to sendgrid for backward compatibility)
  const emailProvider = settings?.emailProvider || "sendgrid";

  // Get email provider credentials from database settings or environment variables
  const mailgunApiKey = settings?.mailgunApiKey || process.env.MAILGUN_API_KEY;
  const mailgunDomain = settings?.mailgunDomain || process.env.MAILGUN_DOMAIN;
  const sendgridApiKey = settings?.sendgridApiKey || process.env.SENDGRID_API_KEY;

  let result: { success: boolean; error?: string };

  // Use the provider that's selected in admin settings
  if (emailProvider === "mailgun") {
    // Mailgun is explicitly selected
    if (!mailgunApiKey || !mailgunDomain) {
      console.error("[Email] Mailgun selected but credentials incomplete - API key:", !!mailgunApiKey, ", Domain:", !!mailgunDomain);
      return { success: false, error: "Mailgun selected but API key or domain is missing" };
    }
    console.log(`[Email] Sending email via Mailgun to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}, domain: ${mailgunDomain}, attachments: ${attachments?.length || 0}`);
    result = await sendViaMailgun(to, subject, finalHtml, plainText, fromEmail, fromName, mailgunApiKey, mailgunDomain, replyTo, unsubscribeUrl, attachments);
    console.log(`[Email] Mailgun result:`, result);
  } else if (emailProvider === "sendgrid") {
    // SendGrid is explicitly selected
    if (!sendgridApiKey) {
      console.error("[Email] SendGrid selected but API key is missing");
      return { success: false, error: "SendGrid selected but API key is missing" };
    }
    console.log(`[Email] Sending email via SendGrid to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}`);
    result = await sendViaSendGrid(to, subject, finalHtml, plainText, fromEmail, fromName, sendgridApiKey, replyTo, unsubscribeUrl);
    console.log(`[Email] SendGrid result:`, result);
  } else {
    // Try Mailgun first if configured, then SendGrid
    if (mailgunApiKey && mailgunDomain) {
      console.log(`[Email] Sending email via Mailgun (auto) to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}, domain: ${mailgunDomain}, attachments: ${attachments?.length || 0}`);
      result = await sendViaMailgun(to, subject, finalHtml, plainText, fromEmail, fromName, mailgunApiKey, mailgunDomain, replyTo, unsubscribeUrl, attachments);
    } else if (sendgridApiKey) {
      console.log(`[Email] Sending email via SendGrid (auto) to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}`);
      result = await sendViaSendGrid(to, subject, finalHtml, plainText, fromEmail, fromName, sendgridApiKey, replyTo, unsubscribeUrl);
    } else {
      console.warn("[Email] NOT CONFIGURED - no Mailgun or SendGrid API key found");
      console.log("[Email] Would send email to:", to);
      console.log("[Email] Subject:", subject);
      return { success: false, error: "Email not configured - no Mailgun or SendGrid API key" };
    }
  }

  if (result.success) {
    // Save a copy to admin email system (sent folder)
    try {
      let mailbox = await db.mailbox.findFirst({
        where: { email: fromEmail },
      });

      if (!mailbox) {
        mailbox = await db.mailbox.create({
          data: {
            name: fromName,
            email: fromEmail,
            description: isCreatorEmail ? "Creator email" : "System outgoing emails",
            isDefault: !isCreatorEmail, // Only admin mailboxes can be default
            isActive: true,
            isCreatorMailbox: isCreatorEmail || false,
          },
        });
        console.log(`Created ${isCreatorEmail ? "creator" : "system"} mailbox for ${fromEmail}`);
      }

      await db.adminEmail.create({
        data: {
          mailboxId: mailbox.id,
          fromEmail: fromEmail,
          fromName: fromName,
          toEmail: to,
          subject: subject,
          bodyHtml: finalHtml,
          bodyText: plainText,
          folder: "SENT",
          status: "SENT",
          isRead: true,
          sentAt: new Date(),
        },
      });
      console.log(`Saved outgoing email to admin sent folder`);
    } catch (saveError) {
      console.error("Failed to save email to admin sent folder:", saveError);
    }
  }

  return result;
}

// Queue an email for rate-limited sending (1 per second max)
export async function queueEmail(options: SendEmailOptions & { priority?: number }): Promise<{ success: boolean; queueId?: string; error?: string }> {
  const { to, subject, html, text, fromEmail, fromName, replyTo, isCreatorEmail, priority = 0 } = options;

  try {
    const queueEntry = await db.emailQueue.create({
      data: {
        toEmail: to,
        subject,
        bodyHtml: html,
        bodyText: text || null,
        fromEmail: fromEmail || null,
        fromName: fromName || null,
        replyTo: replyTo || null,
        isCreatorEmail: isCreatorEmail || false,
        priority,
        status: "PENDING",
      },
    });

    console.log(`[Email Queue] Added email to queue: ${queueEntry.id} -> ${to}`);
    return { success: true, queueId: queueEntry.id };
  } catch (error) {
    console.error("[Email Queue] Failed to queue email:", error);
    return { success: false, error: String(error) };
  }
}

// Process a single email from the queue
// Rate limited to max 1 email per second when called from the cron job
export async function processEmailQueue(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Get next pending email (highest priority first, then oldest)
    const queueEntry = await db.emailQueue.findFirst({
      where: {
        status: "PENDING",
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "asc" },
      ],
    });

    if (!queueEntry) {
      return { processed: 0, errors: 0 };
    }

    // Skip if already at max attempts
    if (queueEntry.attempts >= queueEntry.maxAttempts) {
      await db.emailQueue.update({
        where: { id: queueEntry.id },
        data: { status: "FAILED", error: "Max attempts reached" },
      });
      return { processed: 0, errors: 1 };
    }

    // Mark as processing
    await db.emailQueue.update({
      where: { id: queueEntry.id },
      data: {
        status: "PROCESSING",
        processedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Send the email
    const result = await sendEmail({
      to: queueEntry.toEmail,
      subject: queueEntry.subject,
      html: queueEntry.bodyHtml,
      text: queueEntry.bodyText || undefined,
      fromEmail: queueEntry.fromEmail || undefined,
      fromName: queueEntry.fromName || undefined,
      replyTo: queueEntry.replyTo || undefined,
      isCreatorEmail: queueEntry.isCreatorEmail,
    });

    if (result.success) {
      await db.emailQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });
      console.log(`[Email Queue] Successfully sent queued email: ${queueEntry.id}`);
      processed = 1;
    } else {
      const newAttempts = queueEntry.attempts + 1;
      await db.emailQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: newAttempts >= queueEntry.maxAttempts ? "FAILED" : "PENDING",
          error: result.error || "Unknown error",
        },
      });
      console.error(`[Email Queue] Failed to send queued email: ${queueEntry.id}`, result.error);
      errors = 1;
    }
  } catch (error) {
    console.error("[Email Queue] Error processing email:", error);
    errors = 1;
  }

  return { processed, errors };
}

// Get queue stats
export async function getEmailQueueStats(): Promise<{
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  enabled: boolean;
  pausedAt: Date | null;
}> {
  const [pending, processing, sent, failed, settings] = await Promise.all([
    db.emailQueue.count({ where: { status: "PENDING" } }),
    db.emailQueue.count({ where: { status: "PROCESSING" } }),
    db.emailQueue.count({ where: { status: "SENT" } }),
    db.emailQueue.count({ where: { status: "FAILED" } }),
    db.platformSettings.findUnique({ where: { id: "default" }, select: { emailQueueEnabled: true, emailQueuePausedAt: true } }),
  ]);

  return {
    pending,
    processing,
    sent,
    failed,
    enabled: settings?.emailQueueEnabled ?? true,
    pausedAt: settings?.emailQueuePausedAt ?? null,
  };
}

// Check if email queue is enabled
export async function isEmailQueueEnabled(): Promise<boolean> {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { emailQueueEnabled: true },
    });
    return settings?.emailQueueEnabled ?? true;
  } catch {
    return true; // Default to enabled if settings not found
  }
}

// Enable/disable email queue processing
export async function setEmailQueueEnabled(enabled: boolean): Promise<void> {
  await db.platformSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      emailQueueEnabled: enabled,
      emailQueuePausedAt: enabled ? null : new Date(),
    },
    update: {
      emailQueueEnabled: enabled,
      emailQueuePausedAt: enabled ? null : new Date(),
    },
  });
  console.log(`[Email Queue] Queue ${enabled ? "enabled" : "disabled"}`);
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Reset Password
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #0066cc; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  // Password reset is a transactional email - always send even if unsubscribed
  return sendEmail({
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html,
    skipUnsubscribeCheck: true,
  });
}

export async function sendCollaboratorInviteEmail(
  email: string,
  inviterName: string,
  projectTitle: string,
  collaboratorId: string
) {
  const respondUrl = `${APP_URL}/collaborate/${collaboratorId}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've Been Invited to Collaborate</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">You've Been Invited to Collaborate!</h2>
          <p><strong>${inviterName}</strong> has invited you to collaborate on the project:</p>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${projectTitle}</h3>
          </div>

          <p>As a collaborator, you'll be able to help manage this project based on the permissions granted to you.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${respondUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
              Accept Invitation
            </a>
            <a href="${respondUrl}" style="display: inline-block; background: #fff; color: #666; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; border: 1px solid #ddd;">
              View Details
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            You'll need to log in to your ${APP_NAME} account to accept or decline this invitation.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${inviterName} invited you to collaborate on "${projectTitle}"`,
    html,
  });
}

// Project Review Email Functions
export async function sendProjectSubmittedEmail(
  email: string,
  creatorName: string,
  projectTitle: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Submitted for Review</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0f9ff; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bae6fd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              UNDER REVIEW
            </div>
          </div>

          <h2 style="margin-top: 0; color: #0369a1; text-align: center;">Project Submitted!</h2>
          <p>Hi ${creatorName || "Creator"},</p>
          <p>Your project <strong>"${projectTitle}"</strong> has been submitted for review.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>What happens next?</strong></p>
            <p style="margin: 10px 0 0 0;">Our team will review your project within 1-2 business days. We'll notify you by email once the review is complete.</p>
          </div>

          <p>In the meantime, you can continue to make edits to your project. Any changes will be included in the review.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              View Your Projects
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for using ${APP_NAME}!
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Your project "${projectTitle}" is under review`,
    html,
  });
}

export async function sendProjectApprovedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  projectSlug: string,
  notes?: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Project Has Been Approved!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #22c55e; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ✓ APPROVED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #15803d; text-align: center;">Congratulations, ${creatorName || "Creator"}!</h2>
          <p style="text-align: center;">Your project <strong>"${projectTitle}"</strong> has been approved and is ready to launch!</p>

          ${notes ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Notes from reviewer:</strong></p>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>
          ` : ""}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Launch Your Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Head to your dashboard to set your launch date and go live!
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🎉 Your project "${projectTitle}" has been approved!`,
    html,
  });
}

export async function sendProjectRejectedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  rejectionReason: string,
  notes?: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const reasonLabels: Record<string, string> = {
    INCOMPLETE_INFORMATION: "Incomplete Information",
    POLICY_VIOLATION: "Policy Violation",
    PROHIBITED_CONTENT: "Prohibited Content",
    INTELLECTUAL_PROPERTY: "Intellectual Property Issues",
    FRAUD_SUSPECTED: "Suspected Fraud",
    UNREALISTIC_GOALS: "Unrealistic Goals",
    MISSING_REWARDS: "Missing or Inadequate Rewards",
    IDENTITY_VERIFICATION: "Identity Verification Required",
    OTHER: "Other",
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Review Update</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fef2f2; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fecaca;">
          <h2 style="margin-top: 0; color: #dc2626;">Project Not Approved</h2>
          <p>Hi ${creatorName || "Creator"},</p>
          <p>Unfortunately, your project <strong>"${projectTitle}"</strong> was not approved at this time.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Reason:</strong></p>
            <p style="margin: 10px 0 0 0; font-weight: 500;">${reasonLabels[rejectionReason] || rejectionReason}</p>
          </div>

          ${notes ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Reviewer feedback:</strong></p>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>
          ` : ""}

          <p>You may edit your project and resubmit it for review. Please address the issues mentioned above before resubmitting.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Edit Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            If you have questions about this decision, please contact our support team.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Update on your project "${projectTitle}"`,
    html,
  });
}

/**
 * Send pledge confirmation email to backer
 */
export async function sendPledgeConfirmationEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  projectSlug: string,
  amount: number,
  rewardTitle: string | null,
  chargedImmediately: boolean,
  imageUrl?: string | null,
  currency: string = "USD",
  addons: Array<{ title: string; quantity: number; amount: number }> = [],
  shippingInfo?: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null,
  projectUrlPath?: string,
  rewardAmount?: number,
  shippingAmount?: number,
  paymentMethod?: "STRIPE" | "DIVINITYCOIN"
) {
  // Use provided projectUrlPath if available (for vanity URLs), otherwise fallback to legacy format
  const projectUrl = projectUrlPath ? `${APP_URL}${projectUrlPath}` : `${APP_URL}/projects/${projectSlug}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  // Ensure image URL is absolute
  const absoluteImageUrl = imageUrl
    ? (imageUrl.startsWith("http") ? imageUrl : `${APP_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`)
    : null;

  // Format amount with the project's currency
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(value);

  const formattedAmount = formatCurrency(amount);

  const chargeMessage = chargedImmediately
    ? `Your payment of <strong>${formattedAmount}</strong> has been processed successfully.`
    : `Your card has been saved and will be charged <strong>${formattedAmount}</strong> when the campaign reaches its funding goal.`;

  // Build addons HTML
  const addonsHtml = addons.length > 0 ? addons.map(addon => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">Add-on: ${addon.title}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(addon.amount)}</td>
    </tr>
  `).join("") : "";

  // Payment method label
  const paymentMethodLabel = paymentMethod === "DIVINITYCOIN" ? "DivinityCoin" : "Card";

  // Build shipping HTML
  const hasShipping = shippingInfo && (shippingInfo.address || shippingInfo.city || shippingInfo.country);
  const shippingHtml = hasShipping ? `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Shipping Address</h3>
      <p style="margin: 0; color: #333;">
        ${shippingInfo!.name || backerName}<br>
        ${shippingInfo!.address || ""}<br>
        ${[shippingInfo!.city, shippingInfo!.state, shippingInfo!.postalCode].filter(Boolean).join(", ")}<br>
        ${shippingInfo!.country || ""}
      </p>
    </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pledge Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Thank You for Your Pledge!</h2>

          ${absoluteImageUrl ? `<img src="${absoluteImageUrl}" alt="${projectTitle}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin: 20px auto; display: block;">` : ""}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: white;">${projectTitle}</h3>
            ${rewardTitle ? `<p style="margin: 0; color: rgba(255,255,255,0.9);">Reward: ${rewardTitle}</p>` : `<p style="margin: 0; color: rgba(255,255,255,0.9);">Pledge without reward</p>`}
            ${addons.length > 0 ? `<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9);">+ ${addons.length} add-on${addons.length > 1 ? "s" : ""}</p>` : ""}
          </div>

          <p style="text-align: center; margin-bottom: 0;">Hi ${backerName || "there"},</p>
          <p style="text-align: center;">${chargeMessage}</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Pledge Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">${rewardTitle || "Pledge (no reward)"}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${rewardAmount !== undefined ? formatCurrency(rewardAmount) : "—"}</td>
            </tr>
            ${addonsHtml}
            ${shippingAmount && shippingAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">Shipping${shippingInfo?.country ? ` (${shippingInfo.country})` : ""}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(shippingAmount)}</td>
            </tr>
            ` : ""}
            <tr style="background: #f0f0f0;">
              <td style="padding: 12px 8px; font-weight: 600; font-size: 16px;">Total</td>
              <td style="padding: 12px 8px; text-align: right; font-weight: 600; font-size: 16px; color: #028858;">${formattedAmount}</td>
            </tr>
          </table>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e5e5;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #666;">Payment Method</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 500;">${paymentMethodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666;">Status</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #028858;">${chargedImmediately ? "✓ Paid" : "Card Saved"}</td>
              </tr>
            </table>
          </div>
        </div>

        ${shippingHtml}

        ${!chargedImmediately ? `
        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> Your card will only be charged if the campaign successfully reaches its funding goal. If the campaign doesn't reach its goal, you won't be charged.</p>
        </div>
        ` : ""}

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">You'll receive updates from the creator as the project progresses. ${!hasShipping ? "We'll send you a survey to collect shipping details closer to the estimated delivery date." : "The creator will reach out when it's time to ship your rewards."}</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
            View Project
          </a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            My Dashboard
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you backed a project on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = `Your pledge for "${projectTitle}" is confirmed!`;
  const result = await sendEmail({
    to: email,
    subject,
    html,
  });

  // Return both the result and the email content for logging
  return {
    ...result,
    subject,
    html,
  };
}

/**
 * Send welcome email to new user on signup
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
) {
  const dashboardUrl = `${APP_URL}/dashboard`;
  const exploreUrl = `${APP_URL}/explore`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${APP_NAME}!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Welcome to ${APP_NAME}!</h2>
          <p style="text-align: center;">Hi ${userName || "there"},</p>
          <p style="text-align: center;">Thank you for joining our community! You're now part of a platform where creators bring their ideas to life and backers help make them happen.</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">What can you do on ${APP_NAME}?</h3>
          <ul style="color: #666; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;"><strong>Discover Projects</strong> - Explore creative projects across various categories</li>
            <li style="margin-bottom: 10px;"><strong>Back Projects</strong> - Support creators and get exclusive rewards</li>
            <li style="margin-bottom: 10px;"><strong>Create Projects</strong> - Launch your own crowdfunding campaign</li>
            <li style="margin-bottom: 10px;"><strong>Connect</strong> - Join a community of creators and backers</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${exploreUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin-right: 10px;">
            Explore Projects
          </a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Go to Dashboard
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you signed up for ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}! 🎉`,
    html,
  });
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  userName: string,
  verificationToken: string
) {
  const verifyUrl = `${APP_URL}/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Verify Your Email Address</h2>
          <p>Hi ${userName || "there"},</p>
          <p>Please click the button below to verify your email address and complete your registration.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Verify Email Address
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyUrl}" style="color: #0066cc; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  // Email verification is a transactional email - always send even if unsubscribed
  return sendEmail({
    to: email,
    subject: `Verify your ${APP_NAME} email address`,
    html,
    skipUnsubscribeCheck: true,
  });
}

export async function sendProjectChangesRequestedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  notes: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Changes Requested for Your Project</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              CHANGES REQUESTED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #d97706; text-align: center;">Almost There!</h2>
          <p>Hi ${creatorName || "Creator"},</p>
          <p>Your project <strong>"${projectTitle}"</strong> is close to being approved, but we need a few changes first.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Requested changes:</strong></p>
            <p style="margin: 10px 0 0 0;">${notes}</p>
          </div>

          <p>Please make these changes and resubmit your project for review.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #f59e0b; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Edit Your Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Once you've made the requested changes, click "Submit for Review" again.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Changes requested for "${projectTitle}"`,
    html,
  });
}

/**
 * Send survey available notification email to backer
 */
export async function sendSurveyAvailableEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  creatorName: string,
  pledgeId: string
) {
  const surveyUrl = `${APP_URL}/dashboard/pledges/${pledgeId}/survey`;
  const dashboardUrl = `${APP_URL}/dashboard/backer`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Survey Available - Action Required</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              📋 SURVEY AVAILABLE
            </div>
          </div>

          <h2 style="margin-top: 0; color: white; text-align: center;">Action Required</h2>
          <p style="text-align: center;">Hi ${backerName || "there"},</p>
          <p style="text-align: center;"><strong>${creatorName}</strong> has sent you a survey for your pledge to <strong>"${projectTitle}"</strong>.</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Why do I need to fill this out?</h3>
          <p style="color: #666; margin: 0;">The creator needs additional information from you to fulfill your reward. This may include:</p>
          <ul style="color: #666; margin: 10px 0 0 0; padding-left: 20px;">
            <li>Shipping address confirmation</li>
            <li>Size or color preferences</li>
            <li>Custom reward options</li>
            <li>Other fulfillment details</li>
          </ul>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>⏰ Please complete this survey soon!</strong> The creator may need this information to begin fulfillment.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${surveyUrl}" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Complete Survey Now
          </a>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${dashboardUrl}" style="color: #666; font-size: 14px; text-decoration: underline;">View all your pledges</a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you backed "${projectTitle}" on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return queueEmail({
    to: email,
    subject: `📋 Survey available for "${projectTitle}" - Action Required`,
    html,
    priority: EMAIL_PRIORITY.CREATOR,
  });
}

/**
 * Send retailer approval email with access code
 */
export async function sendRetailerApprovalEmail(
  email: string,
  businessName: string,
  contactName: string,
  accessCode: string
) {
  const loginUrl = `${APP_URL}/retailers/login`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Retailer Application Has Been Approved!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          <p style="color: #10b981; font-weight: 500; margin-top: 5px;">Retailer Portal</p>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ✓ APPROVED
            </div>
          </div>
          <h2 style="margin-top: 0; color: white; text-align: center;">Congratulations, ${contactName || businessName}!</h2>
          <p style="text-align: center;">Your retailer application for <strong>${businessName}</strong> has been approved!</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">Your Retailer Access Code</h3>
          <p style="color: #666; margin-bottom: 15px;">Use this access code to sign in to the retailer portal:</p>

          <div style="background: #fff; border: 2px dashed #10b981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #10b981;">${accessCode}</span>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            <strong>Important:</strong> Keep this code safe. You can also set up a password after logging in for easier access.
          </p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #333;">What You Can Do Now</h3>
          <ul style="color: #666; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Access exclusive wholesale pricing on all projects</li>
            <li style="margin-bottom: 10px;">Place bulk orders for your retail locations</li>
            <li style="margin-bottom: 10px;">Track your orders and invoices</li>
            <li style="margin-bottom: 10px;">Get priority support from our retailer team</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Sign In to Retailer Portal
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because your retailer application was approved on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  // This is a transactional email - always send
  return sendEmail({
    to: email,
    subject: `Your ${APP_NAME} retailer application has been approved!`,
    html,
    skipUnsubscribeCheck: true,
  });
}

/**
 * Send retailer rejection email
 */
export async function sendRetailerRejectionEmail(
  email: string,
  businessName: string,
  contactName: string,
  reason?: string
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Update on Your Retailer Application</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
          <p style="color: #10b981; font-weight: 500; margin-top: 5px;">Retailer Portal</p>
        </div>

        <div style="background: #fef2f2; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fecaca;">
          <h2 style="margin-top: 0; color: #dc2626;">Application Not Approved</h2>
          <p>Hi ${contactName || businessName},</p>
          <p>Thank you for your interest in becoming a certified retailer with ${APP_NAME}. After reviewing your application for <strong>${businessName}</strong>, we were unable to approve it at this time.</p>

          ${reason ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Feedback:</strong></p>
            <p style="margin: 10px 0 0 0;">${reason}</p>
          </div>
          ` : ""}

          <p>If you believe this decision was made in error or if you have additional information that might support your application, please don't hesitate to contact our retailer support team.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="mailto:retailers@indiecrowdfund.com" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Contact Retailer Support
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Update on your ${APP_NAME} retailer application`,
    html,
    skipUnsubscribeCheck: true,
  });
}

/**
 * Add a user to a creator's email list.
 * Used when:
 * - A backer pledges to a project (source: "pledge")
 * - A user follows a project for updates (source: "follow")
 * - A user signs up for prelaunch notifications (source: "prelaunch")
 *
 * @param options - Options for adding to email list
 * @returns The created or existing email list subscriber record
 */
export async function addToCreatorEmailList(options: {
  creatorId: string;
  email: string;
  name?: string | null;
  source: "pledge" | "follow" | "prelaunch" | "import" | "manual";
  sourceProjectId?: string;
}): Promise<{ success: boolean; isNew: boolean; subscriberId?: string }> {
  const { creatorId, email, name, source, sourceProjectId } = options;

  if (!email || !email.includes("@")) {
    console.log(`[addToCreatorEmailList] Invalid email: ${email}`);
    return { success: false, isNew: false };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if already exists in creator's email list
    const existing = await db.emailListSubscriber.findUnique({
      where: {
        creatorId_email: {
          creatorId,
          email: normalizedEmail,
        },
      },
    });

    if (existing) {
      console.log(`[addToCreatorEmailList] Email ${normalizedEmail} already in list for creator ${creatorId}`);
      return { success: true, isNew: false, subscriberId: existing.id };
    }

    // Add to creator's email list
    const subscriber = await db.emailListSubscriber.create({
      data: {
        creatorId,
        email: normalizedEmail,
        name: name || null,
        source,
        sourceProjectId: sourceProjectId || null,
        status: "subscribed",
      },
    });

    console.log(`[addToCreatorEmailList] Added ${normalizedEmail} to list for creator ${creatorId} (source: ${source})`);
    return { success: true, isNew: true, subscriberId: subscriber.id };
  } catch (error) {
    // Handle race condition where another request added the same email
    if ((error as { code?: string })?.code === "P2002") {
      console.log(`[addToCreatorEmailList] Race condition: ${normalizedEmail} already exists`);
      return { success: true, isNew: false };
    }

    console.error(`[addToCreatorEmailList] Error adding ${normalizedEmail}:`, error);
    return { success: false, isNew: false };
  }
}
