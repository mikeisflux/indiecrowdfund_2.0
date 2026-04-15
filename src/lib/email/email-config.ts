import sgMail from "@sendgrid/mail";
import Mailgun from "mailgun.js";
import type { MailgunMessageData } from "mailgun.js/definitions";
import formData from "form-data";
import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { circuitBreaker } from "@/lib/circuit-breaker";

const emailLogger = logger.child({ module: "email" });

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
  _fromQueue?: boolean; // Internal: skip auto-queue when called from queue processor
}

// Microsoft/Outlook domains that commonly block emails due to IP reputation
const MICROSOFT_DOMAINS = new Set([
  "outlook.com", "hotmail.com", "live.com", "msn.com",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it",
  "hotmail.es", "hotmail.co.jp", "outlook.co.uk", "outlook.fr",
  "outlook.de", "outlook.it", "outlook.es", "outlook.co.jp",
  "live.co.uk", "live.fr", "live.de", "live.it",
]);

// Get email settings from database
async function getEmailSettings() {
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        emailProvider: true,
        smtpHost: true, smtpPort: true, smtpUser: true, smtpPassword: true,
        smtpFromEmail: true, smtpFromName: true, smtpReplyToEmail: true,
        sendgridApiKey: true, sendgridWebhookVerificationKey: true,
        mailgunApiKey: true, mailgunDomain: true, mailgunWebhookSigningKey: true,
        emailVerificationRequired: true, welcomeEmailEnabled: true,
        pledgeConfirmationEnabled: true, projectUpdateNotifications: true,
      },
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
        emailLogger.info(`[Email] Allowing rate-limited email through for: ${normalizedEmail}`);
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
    emailLogger.error({ err: error }, "[Email] Error checking blocklist:");
    return { blocked: false };
  }
}

// Add whitelist banner to the top of HTML email
function addWhitelistBanner(html: string, fromEmail: string): string {
  const whitelistGuideUrl = `${APP_URL}/help/whitelist`;
  const safeFromEmail = escapeHtmlForEmail(fromEmail);
  const banner = `
    <div style="background: linear-gradient(90deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #166534;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="vertical-align: middle;">
            <strong style="color: #15803d;">Ensure delivery:</strong> Add <span style="font-family: monospace; background: #dcfce7; padding: 2px 6px; border-radius: 4px;">${safeFromEmail}</span> to your contacts or safe sender list.
            <a href="${whitelistGuideUrl}" style="color: #16a34a; text-decoration: underline; margin-left: 8px;" clicktracking="off">How to whitelist</a>
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
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;" clicktracking="off">Unsubscribe from all emails</a>
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

    const response = await circuitBreaker.execute("sendgrid", () =>
      sgMail.send({
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
      })
    );

    emailLogger.info({ data: response[0]?.statusCode }, "Email sent via SendGrid, status:");
    return { success: true };
  } catch (error: unknown) {
    emailLogger.error("SendGrid Error:");
    if (error && typeof error === "object" && "response" in error) {
      const sgError = error as { response?: { body?: unknown; statusCode?: number } };
      emailLogger.error({ err: sgError.response?.statusCode }, "SendGrid status code:");
      emailLogger.error({ err: JSON.stringify(sgError.response?.body, null, 2) }, "SendGrid response body:");
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

    const response = await circuitBreaker.execute("mailgun", () =>
      mg.messages.create(domain, messageData)
    );

    emailLogger.info({ data: response.id }, "Email sent via Mailgun, id:");
    return { success: true };
  } catch (error: unknown) {
    emailLogger.error({ err: error }, "Mailgun Error:");
    return { success: false, error: String(error) };
  }
}

export async function sendEmail({ to, subject, html, text, skipUnsubscribeCheck, replyTo, fromEmail: customFromEmail, fromName: customFromName, isCreatorEmail, attachments, _fromQueue }: SendEmailOptions) {
  emailLogger.info(`[Email] sendEmail called - to: ${to}, subject: ${subject}${_fromQueue ? " (from queue)" : ""}`);

  // Check if email is on the blocklist (bounced, spam reported, etc.)
  // This check applies to ALL emails including transactional ones
  const blocklistCheck = await isEmailBlocked(to);
  if (blocklistCheck.blocked) {
    emailLogger.info(`[Email] Skipping email - address is blocked: ${to}, reason: ${blocklistCheck.reason}`);
    return { success: false, error: blocklistCheck.reason || "Email address is blocked", skipped: true, blocked: true };
  }

  // Check if user has unsubscribed (unless this is a transactional email)
  if (!skipUnsubscribeCheck) {
    const unsubscribed = await isEmailUnsubscribed(to);
    if (unsubscribed) {
      emailLogger.info(`[Email] Skipping email - user has unsubscribed: ${to}`);
      return { success: false, error: "User has unsubscribed from emails", skipped: true };
    }
  }

  const settings = await getEmailSettings();
  emailLogger.info({ data: {
    hasSettings: !!settings,
    emailProvider: settings?.emailProvider,
    smtpFromEmail: settings?.smtpFromEmail,
    smtpFromName: settings?.smtpFromName,
    hasMailgunKey: !!settings?.mailgunApiKey,
    mailgunDomain: settings?.mailgunDomain,
    hasSendgridKey: !!settings?.sendgridApiKey,
  } }, `[Email] Settings loaded:`);

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
      emailLogger.error({ hasApiKey: !!mailgunApiKey, hasDomain: !!mailgunDomain }, "Mailgun selected but credentials incomplete");
      return { success: false, error: "Mailgun selected but API key or domain is missing" };
    }
    emailLogger.info(`[Email] Sending email via Mailgun to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}, domain: ${mailgunDomain}, attachments: ${attachments?.length || 0}`);
    result = await sendViaMailgun(to, subject, finalHtml, plainText, fromEmail, fromName, mailgunApiKey, mailgunDomain, replyTo, unsubscribeUrl, attachments);
    emailLogger.info({ data: result }, `[Email] Mailgun result:`);
  } else if (emailProvider === "sendgrid") {
    // SendGrid is explicitly selected
    if (!sendgridApiKey) {
      emailLogger.error("[Email] SendGrid selected but API key is missing");
      return { success: false, error: "SendGrid selected but API key is missing" };
    }
    emailLogger.info(`[Email] Sending email via SendGrid to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}`);
    result = await sendViaSendGrid(to, subject, finalHtml, plainText, fromEmail, fromName, sendgridApiKey, replyTo, unsubscribeUrl);
    emailLogger.info({ data: result }, `[Email] SendGrid result:`);
  } else {
    // Try Mailgun first if configured, then SendGrid
    if (mailgunApiKey && mailgunDomain) {
      emailLogger.info(`[Email] Sending email via Mailgun (auto) to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}, domain: ${mailgunDomain}, attachments: ${attachments?.length || 0}`);
      result = await sendViaMailgun(to, subject, finalHtml, plainText, fromEmail, fromName, mailgunApiKey, mailgunDomain, replyTo, unsubscribeUrl, attachments);
    } else if (sendgridApiKey) {
      emailLogger.info(`[Email] Sending email via SendGrid (auto) to: ${to}, from: ${fromEmail} (${fromName}), replyTo: ${replyTo || fromEmail}`);
      result = await sendViaSendGrid(to, subject, finalHtml, plainText, fromEmail, fromName, sendgridApiKey, replyTo, unsubscribeUrl);
    } else {
      emailLogger.warn("[Email] NOT CONFIGURED - no Mailgun or SendGrid API key found");
      emailLogger.info({ data: to }, "[Email] Would send email to:");
      emailLogger.info({ data: subject }, "[Email] Subject:");
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
        emailLogger.info(`Created ${isCreatorEmail ? "creator" : "system"} mailbox for ${fromEmail}`);
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
      emailLogger.info(`Saved outgoing email to admin sent folder`);
    } catch (saveError) {
      emailLogger.error({ err: saveError }, "Failed to save email to admin sent folder:");
    }
  } else if (!_fromQueue) {
    // Send failed and this was a direct call (not from the queue processor).
    // Auto-queue the email for retry in the secondary queue instead of dropping it.
    const recipientDomain = to.split("@")[1]?.toLowerCase();
    const isMicrosoftDomain = recipientDomain ? MICROSOFT_DOMAINS.has(recipientDomain) : false;

    emailLogger.warn(`[Email] Direct send failed to ${to}${isMicrosoftDomain ? " (Microsoft domain)" : ""} — auto-queuing for retry. Error: ${result.error}`);

    try {
      const queueEntry = await db.emailQueue.create({
        data: {
          toEmail: to,
          subject,
          bodyHtml: html, // Use original HTML (queue processor's sendEmail will re-add banners/footers)
          bodyText: text || null,
          fromEmail: customFromEmail || null,
          fromName: customFromName || null,
          replyTo: replyTo || null,
          isCreatorEmail: isCreatorEmail || false,
          priority: EMAIL_PRIORITY.RETRY,
          status: "PENDING",
          error: `Auto-queued after direct send failure: ${result.error}`,
        },
      });
      emailLogger.info(`[Email] Auto-queued failed email as ${queueEntry.id} for retry to ${to}`);
      // Return success:false but include the queueId so callers know it wasn't dropped
      return { success: false, error: result.error, queued: true, queueId: queueEntry.id };
    } catch (queueError) {
      emailLogger.error({ err: queueError }, `[Email] Failed to auto-queue email for ${to}:`);
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

    emailLogger.info(`[Email Queue] Added email to queue: ${queueEntry.id} -> ${to}`);
    return { success: true, queueId: queueEntry.id };
  } catch (error) {
    emailLogger.error({ err: error }, "[Email Queue] Failed to queue email:");
    return { success: false, error: String(error) };
  }
}

// Process a single email from the queue
// Rate limited to max 1 email per second when called from the cron job
export async function processEmailQueue(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  let claimedId: string | null = null;

  // Note: the hourly-throttled background jobs (SENT-row sweep and
  // pledge-confirmation reconciliation) are called from
  // /api/cron/email-queue instead of here. They need to run even on
  // quiet days when the queue is empty, and this function's caller in
  // that cron route returns early before reaching here on pending=0
  // ticks. Keeping the throttle-calls in the cron route ensures the
  // hourly cadence holds regardless of queue state.

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
    claimedId = queueEntry.id;

    // Send the email with a 10-second timeout
    // If sendEmail hangs (network issue to Mailgun/SendGrid), this prevents the email
    // from being stuck in PROCESSING forever. The catch block will reset it to PENDING.
    const sendPromise = sendEmail({
      to: queueEntry.toEmail,
      subject: queueEntry.subject,
      html: queueEntry.bodyHtml,
      text: queueEntry.bodyText || undefined,
      fromEmail: queueEntry.fromEmail || undefined,
      fromName: queueEntry.fromName || undefined,
      replyTo: queueEntry.replyTo || undefined,
      isCreatorEmail: queueEntry.isCreatorEmail,
      _fromQueue: true,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Email send timed out after 10 seconds")), 10000)
    );
    const result = await Promise.race([sendPromise, timeoutPromise]);

    if (result.success) {
      // Mark as SENT with a timestamp so the periodic sweep (below) can
      // delete it after a short retention window. We keep SENT rows for
      // a few days for debugging/audit ("did that receipt actually go out?")
      // but never forever — otherwise the queue becomes a 200+ MB append-only
      // log masquerading as a queue.
      await db.emailQueue.update({
        where: { id: queueEntry.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });
      emailLogger.info(`[Email Queue] Successfully sent queued email: ${queueEntry.id}`);
      processed = 1;
    } else {
      // If the email is permanently blocked or skipped (unsubscribed), fail immediately - no retries
      const isPermanentFailure = ("blocked" in result && result.blocked === true) || ("skipped" in result && result.skipped === true);
      const newAttempts = queueEntry.attempts + 1;
      const shouldFail = isPermanentFailure || newAttempts >= queueEntry.maxAttempts;

      // Demote retryable failures to RETRY priority (-1) so they don't block the main queue
      // This creates a "secondary queue" effect - fresh emails always process first
      const isRateLimited = result.error
        ? (result.error.toLowerCase().includes("ratelimit") || result.error.toLowerCase().includes("rate limit"))
        : false;
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
            emailLogger.info(`[Email Queue] Removed ${removed.count} subscriber records for blocked address: ${queueEntry.toEmail}`);
          }
        } catch (cleanupError) {
          emailLogger.error({ err: cleanupError }, `[Email Queue] Failed to clean up subscriber for ${queueEntry.toEmail}:`);
        }
      }

      // Expected operational outcomes — user unsubscribed, spam complaint,
      // bounced/blocked address — are not errors. Log at info level so
      // they don't pollute the error dashboard.
      const errMsg = String(result.error || "");
      const isExpectedOutcome =
        errMsg.includes("unsubscribed") ||
        errMsg.includes("Spam complaint") ||
        errMsg.includes("bounced") ||
        errMsg.includes("suppressed") ||
        errMsg.includes("blocked");
      if (isExpectedOutcome) {
        emailLogger.info(
          { reason: errMsg },
          `[Email Queue] Skipped queued email: ${queueEntry.id}`
        );
      } else {
        emailLogger.error(
          { err: result.error },
          `[Email Queue] Failed to send queued email: ${queueEntry.id}`
        );
      }
      errors = 1;
    }
  } catch (error) {
    emailLogger.error({ err: error }, "[Email Queue] Error processing email:");
    errors = 1;

    // Reset the claimed email back to PENDING so it doesn't get stuck in PROCESSING
    if (claimedId) {
      try {
        await db.emailQueue.update({
          where: { id: claimedId },
          data: { status: "PENDING", error: `Processing error: ${String(error)}` },
        });
        emailLogger.info(`[Email Queue] Reset stuck email ${claimedId} back to PENDING`);
      } catch (resetError) {
        emailLogger.error({ err: resetError }, `[Email Queue] Failed to reset email ${claimedId}:`);
      }
    }
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

/**
 * Delete SENT rows older than the retention window to prevent the queue
 * from growing unboundedly. EmailQueue is a QUEUE, not a log — sent rows
 * should be purged. EmailLog is the proper place for long-term audit.
 *
 * Default: keep SENT rows for 3 days (enough to debug "did X actually send
 * yesterday"), delete anything older. Uses a batch LIMIT so a runaway
 * backlog never blocks the main queue tick for long.
 *
 * Called periodically by processEmailQueue (throttled to once per hour)
 * and can be invoked manually by the admin "Prune Email Queue" action.
 */
export async function sweepOldSentEmails(
  retentionDays: number = 3,
  maxDeletePerCall: number = 5000
): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    // Raw SQL with LIMIT for a bounded batch delete — Prisma's deleteMany
    // doesn't support LIMIT, and we don't want a single statement
    // potentially deleting hundreds of thousands of rows at once.
    const result = await db.$executeRaw`
      DELETE FROM "EmailQueue"
      WHERE "id" IN (
        SELECT "id" FROM "EmailQueue"
        WHERE "status" = 'SENT'
          AND "sentAt" < ${cutoff}
        LIMIT ${maxDeletePerCall}
      )
    `;
    if (result > 0) {
      emailLogger.info(`[Email Queue] Swept ${result} old SENT rows (older than ${retentionDays}d)`);
    }
    return result;
  } catch (error) {
    emailLogger.error({ err: error }, "[Email Queue] Error sweeping old SENT rows:");
    return 0;
  }
}

// Throttle the inline sweep so it only runs occasionally from the main tick
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // once per hour

export async function maybeSweepOldSentEmails(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  await sweepOldSentEmails();
}

/**
 * Find COMPLETED pledges whose pledge confirmation email never actually
 * got delivered and re-send them.
 *
 * Why this exists: the confirm route sets `confirmationEmailSent: true`
 * atomically BEFORE calling sendPledgeConfirmationEmail, to de-dup
 * concurrent confirm requests and prevent double-counting project stats.
 * If the email provider call itself then fails (transient network
 * error, Mailgun/SendGrid 5xx, etc.), the flag is already true but the
 * backer never receives their email. The direct-send failure path in
 * sendEmail auto-queues for retry via EmailQueue, but that path can
 * also be missed if the failure happens outside sendEmail (e.g. a
 * thrown error caught by a higher-level try/catch).
 *
 * EmailLog of type PLEDGE_CONFIRMATION is our source of truth for
 * "email actually delivered" — it's only created in the success branch
 * of the send path. So any COMPLETED pledge that lacks a matching
 * PLEDGE_CONFIRMATION EmailLog is a candidate for re-sending.
 *
 * notifyBackerPledgeConfirmed() has its own EmailLog-based guard, so
 * calling it here is idempotent — pledges that DID get their email
 * sent (just with the old flag-check guard that we've now replaced)
 * are safely skipped.
 *
 * Window: only retry pledges created in the last 14 days (anything
 * older is likely either already sent or intentionally skipped) and
 * at least 5 minutes old (give the normal confirm flow time to
 * complete so we don't race with in-flight requests).
 *
 * Batch limit: process up to 100 pledges per run so we don't block
 * the email queue tick for too long. The throttle runs hourly, so
 * worst case we'd catch up on 100/hour * 24 hours = 2,400 missed
 * pledges per day — more than enough headroom for an app our size.
 */
const RECONCILE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RECONCILE_MIN_AGE_MS = 5 * 60 * 1000; // 5 minutes
// Cooldown after any manual/automated touch of a pledge row. If the
// pledge's updatedAt is fresher than this, we assume a manual Resend is
// in-flight (the resend endpoint resets confirmationEmailSent=false,
// which bumps updatedAt) or just finished, and we skip the pledge for
// now. This prevents a race where the creator clicks "Resend" in the
// same minute that the reconcile cron tick fires, and both code paths
// reach sendEmail before either has written a PLEDGE_CONFIRMATION
// EmailLog — which would double-send. Two minutes is more than enough
// for the manual resend's full send + EmailLog write to complete.
const RECONCILE_RECENT_UPDATE_COOLDOWN_MS = 2 * 60 * 1000;
const RECONCILE_BATCH_LIMIT = 100;

export async function reconcileMissedPledgeConfirmationEmails(): Promise<{
  checked: number;
  resent: number;
  errors: number;
}> {
  let checked = 0;
  let resent = 0;
  let errors = 0;

  try {
    const now = Date.now();
    const windowStart = new Date(now - RECONCILE_WINDOW_MS);
    const latestAllowed = new Date(now - RECONCILE_MIN_AGE_MS);
    const recentUpdateCutoff = new Date(
      now - RECONCILE_RECENT_UPDATE_COOLDOWN_MS
    );

    // Find COMPLETED pledges in the reconciliation window that have no
    // PLEDGE_CONFIRMATION EmailLog entry. Uses Prisma's `none` relation
    // filter which generates a NOT EXISTS subquery — efficient even
    // with thousands of pledges.
    //
    // Filters:
    //   - createdAt within the last 14 days but at least 5 minutes old
    //     (old enough that the normal confirm flow has had time to run,
    //     young enough that retrying matters)
    //   - updatedAt older than 2 minutes (cooldown — see comment on
    //     RECONCILE_RECENT_UPDATE_COOLDOWN_MS above; prevents racing a
    //     manual Resend click)
    //   - No EmailLog of type PLEDGE_CONFIRMATION already exists
    //
    // We DON'T filter by `user.email != null` at the Prisma level
    // because Prisma 7 rejects `{ not: null }` on nullable string
    // filters at runtime with "Argument `not` must not be null."
    // notifyBackerPledgeConfirmed() already short-circuits on pledges
    // whose user has no email, so including those rows here is a no-op.
    const missedPledges = await db.pledge.findMany({
      where: {
        status: "COMPLETED",
        deletedAt: null,
        createdAt: { gte: windowStart, lte: latestAllowed },
        updatedAt: { lt: recentUpdateCutoff },
        emailLogs: {
          none: { type: "PLEDGE_CONFIRMATION" },
        },
      },
      select: {
        id: true,
        chargedImmediately: true,
      },
      take: RECONCILE_BATCH_LIMIT,
      orderBy: { createdAt: "asc" },
    });

    checked = missedPledges.length;
    if (checked === 0) {
      return { checked: 0, resent: 0, errors: 0 };
    }

    emailLogger.info(
      { count: checked },
      "[Reconcile] Found COMPLETED pledges missing PLEDGE_CONFIRMATION EmailLog — re-sending"
    );

    // Lazy dynamic import to avoid a static circular dependency between
    // src/lib/email/email-config.ts ↔ src/lib/notifications/pledge-notifications.ts
    // (notifications imports @/lib/email which re-exports email-config).
    // Dynamic import defers resolution until this function actually runs,
    // at which point all modules are fully initialized.
    const { notifyBackerPledgeConfirmed } = await import(
      "@/lib/notifications/pledge-notifications"
    );

    // Reset the flag on each missed pledge first so any stale
    // confirmationEmailSent=true from the old atomic-before-send flow
    // doesn't need to be the source of truth. notifyBackerPledgeConfirmed
    // now uses EmailLog as the guard, so this flag reset is mostly for
    // belt-and-suspenders and for visibility in the admin UI.
    //
    // Rate-limit the actual sends (150ms delay between each, ≈ 6/sec)
    // so we don't burst the email provider on a big reconciliation run.
    const RECONCILE_DELAY_MS = 150;

    for (const pledge of missedPledges) {
      try {
        await notifyBackerPledgeConfirmed(pledge.id, pledge.chargedImmediately);
        resent++;
      } catch (err) {
        errors++;
        emailLogger.error(
          { err: String(err), pledgeId: pledge.id },
          "[Reconcile] Failed to resend confirmation email for pledge"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RECONCILE_DELAY_MS));
    }

    emailLogger.info(
      { checked, resent, errors },
      "[Reconcile] Pledge confirmation email reconciliation done"
    );
  } catch (err) {
    emailLogger.error(
      { err: String(err) },
      "[Reconcile] Unexpected error during pledge confirmation reconciliation"
    );
  }

  return { checked, resent, errors };
}

// Throttle the reconciliation so it only runs occasionally from the main
// queue tick. Same cadence as the SENT-row sweep — once per hour.
let lastReconcileAt = 0;
const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;

export async function maybeReconcileMissedPledgeConfirmationEmails(): Promise<void> {
  const now = Date.now();
  if (now - lastReconcileAt < RECONCILE_INTERVAL_MS) return;
  lastReconcileAt = now;
  await reconcileMissedPledgeConfirmationEmails();
}

// Auto-recover emails stuck in PROCESSING for more than 5 seconds
// Sending an email takes under a second — anything beyond 5s is stuck
export async function recoverStuckProcessingEmails(): Promise<number> {
  try {
    const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
    const result = await db.emailQueue.updateMany({
      where: {
        status: "PROCESSING",
        processedAt: { lt: fiveSecondsAgo },
      },
      data: {
        status: "PENDING",
        error: "Auto-recovered: stuck in PROCESSING for over 5 seconds",
      },
    });
    if (result.count > 0) {
      emailLogger.info(`[Email Queue] Auto-recovered ${result.count} stuck PROCESSING email(s)`);
    }
    return result.count;
  } catch (error) {
    emailLogger.error({ err: error }, "[Email Queue] Error recovering stuck emails:");
    return 0;
  }
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
  emailLogger.info(`[Email Queue] Queue ${enabled ? "enabled" : "disabled"}`);
}
