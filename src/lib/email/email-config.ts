import sgMail from "@sendgrid/mail";
import Mailgun from "mailgun.js";
import type { MailgunMessageData } from "mailgun.js/definitions";
import formData from "form-data";
import crypto from "crypto";
import { db } from "@/lib/db";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Escape HTML special characters to prevent XSS/injection in email bodies
export function escapeHtmlForEmail(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Email priority levels for the queue
// Higher priority = processed first
export const EMAIL_PRIORITY = {
  SYSTEM: 10,    // Account creation, payment receipts, password reset - highest priority
  CREATOR: 5,    // Creator emails, campaigns to backers - medium priority
  AI_MARKETING: 1, // AI-generated marketing campaigns - lowest priority
  RETRY: -1,     // Demoted emails (ratelimited/temp failures) - processed last, won't block main queue
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

export interface SendEmailOptions {
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
    // Atomically claim the next pending email to prevent race conditions
    // Uses UPDATE ... RETURNING to find and claim in a single query
    const claimed = await db.$queryRaw<Array<{
      id: string;
      toEmail: string;
      subject: string;
      bodyHtml: string;
      bodyText: string | null;
      fromEmail: string | null;
      fromName: string | null;
      replyTo: string | null;
      isCreatorEmail: boolean;
      attempts: number;
      maxAttempts: number;
      priority: number;
    }>>`
      UPDATE "EmailQueue"
      SET "status" = 'PROCESSING',
          "processedAt" = NOW(),
          "attempts" = "attempts" + 1
      WHERE "id" = (
        SELECT "id" FROM "EmailQueue"
        WHERE "status" = 'PENDING'
          AND "attempts" < "maxAttempts"
        ORDER BY "priority" DESC, "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "toEmail", "subject", "bodyHtml", "bodyText",
                "fromEmail", "fromName", "replyTo", "isCreatorEmail",
                "attempts", "maxAttempts", "priority"
    `;

    if (!claimed || claimed.length === 0) {
      return { processed: 0, errors: 0 };
    }

    const queueEntry = claimed[0];

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
      // If the email is permanently blocked or skipped (unsubscribed), fail immediately - no retries
      const isPermanentFailure = ("blocked" in result && result.blocked === true) || ("skipped" in result && result.skipped === true);
      const newAttempts = queueEntry.attempts + 1;
      const shouldFail = isPermanentFailure || newAttempts >= queueEntry.maxAttempts;

      // Demote retryable failures to RETRY priority (-1) so they don't block the main queue
      // This creates a "secondary queue" effect - fresh emails always process first
      const isRateLimited = result.error?.toLowerCase().includes("ratelimit") || result.error?.toLowerCase().includes("rate limit");
      const demotePriority = !shouldFail && (isRateLimited || newAttempts > 1);

      await db.emailQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: shouldFail ? "FAILED" : "PENDING",
          error: result.error || "Unknown error",
          // Demote to RETRY priority so new emails always go first
          ...(demotePriority ? { priority: EMAIL_PRIORITY.RETRY } : {}),
        },
      });

      // Remove blocked addresses from all subscriber lists so they don't appear in future campaigns
      if (isPermanentFailure) {
        try {
          const removed = await db.emailListSubscriber.deleteMany({
            where: { email: queueEntry.toEmail.toLowerCase().trim() },
          });
          if (removed.count > 0) {
            console.log(`[Email Queue] Removed ${removed.count} subscriber records for blocked address: ${queueEntry.toEmail}`);
          }
        } catch (cleanupError) {
          console.error(`[Email Queue] Failed to clean up subscriber for ${queueEntry.toEmail}:`, cleanupError);
        }
      }

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
