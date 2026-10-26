import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications/core";
import { PLATFORM_OWNER_EMAIL } from "@/lib/platform-owner";

const log = logger.child({ module: "message-notify" });

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export interface NotifyNewMessageInput {
  messageId: string;
  /** Who the message is addressed to (Message.recipientId). */
  recipientId: string;
  /** The platform user who sent it, or null for an external email sender. */
  senderId: string | null;
  /** Shown in the bell and the email ("Jane Doe", "jane@example.com"). */
  senderName: string;
  projectId?: string | null;
  subject?: string | null;
  content: string;
  /**
   * Whether to also email the recipient. False when the recipient already
   * received the real email (creator → backer replies go out as email first,
   * the Message row is a mirror).
   */
  sendEmailCopy: boolean;
  /** Where the message came from, for the log line. */
  source: "direct" | "inbound-email" | "creator-email";
}

/**
 * Every message that lands in someone's inbox goes through here.
 *
 * Before this, /api/messages emailed the recipient but never created an
 * in-app notification, the inbound-email webhook (mail to a creator's
 * @indiecrowdfund.com handle) did neither, and creator → backer email replies
 * mirrored a Message row with no notification. A creator could have a
 * backer's message sitting unread for days with nothing on the bell and
 * nothing in their real inbox.
 *
 * Recipients: the addressee, plus — for a project-attached message — every
 * accepted collaborator who shares that campaign's inbox (canManageCommunity),
 * since the message appears in their inbox too. The sender is never notified
 * about their own message.
 */
export async function notifyNewMessage(input: NotifyNewMessageInput): Promise<void> {
  try {
    const recipientIds = new Set<string>([input.recipientId]);

    if (input.projectId) {
      const project = await db.project.findFirst({
        where: { id: input.projectId, deletedAt: null },
        select: { creatorId: true, creator: { select: { role: true } } },
      });
      // Only the campaign owner's inbox is shared; a message to a backer stays
      // with the backer.
      if (project && project.creatorId === input.recipientId) {
        // The platform owner's silent support seat on every campaign is not
        // a team member and must not be told about the creator's mail. Same
        // rule as getProjectNotificationRecipients: a SUPER_ADMIN sitting on
        // someone else's campaign is support, not team — unless the campaign
        // is the platform's own (owner is also SUPER_ADMIN).
        const creatorIsSuperAdmin = project.creator?.role === "SUPER_ADMIN";
        const collaborators = await db.projectCollaborator.findMany({
          where: {
            projectId: input.projectId,
            status: "ACCEPTED",
            canManageCommunity: true,
            userId: { not: null },
            user: { deletedAt: null },
            NOT: { email: { equals: PLATFORM_OWNER_EMAIL, mode: "insensitive" } },
          },
          select: { userId: true, user: { select: { role: true } } },
        });
        for (const c of collaborators as { userId: string | null; user: { role: string } | null }[]) {
          if (!c.userId) continue;
          if (c.user?.role === "SUPER_ADMIN" && !creatorIsSuperAdmin) continue;
          recipientIds.add(c.userId);
        }
      }
    }
    if (input.senderId) recipientIds.delete(input.senderId);
    if (recipientIds.size === 0) return;

    const projectTitle = input.projectId
      ? (
          await db.project.findFirst({
            where: { id: input.projectId },
            select: { title: true },
          })
        )?.title ?? null
      : null;

    const preview = input.content.length > 200 ? input.content.slice(0, 200) + "..." : input.content;
    const replyParams = new URLSearchParams();
    if (input.senderId) replyParams.set("recipientId", input.senderId);
    if (input.projectId) replyParams.set("projectId", input.projectId);
    const query = replyParams.toString();
    const inboxPath = `/dashboard/messages${query ? `?${query}` : ""}`;

    const users = await db.user.findMany({
      where: { id: { in: Array.from(recipientIds) }, deletedAt: null },
      select: { id: true, email: true, name: true, creatorEmailHandle: true },
    });

    // Where a reply to the notification email should go. Platform mail is
    // sent from noreply@, so hitting Reply bounced ("blocked as spam"). If
    // the sender is a creator with an @indiecrowdfund.com handle, replies
    // go to that handle and land in their inbox; otherwise the platform's
    // configured reply-to (Settings → Email) applies.
    let replyTo: string | undefined;
    if (input.senderId) {
      const sender = await db.user.findUnique({
        where: { id: input.senderId },
        select: { creatorEmailHandle: true },
      });
      if (sender?.creatorEmailHandle) replyTo = `${sender.creatorEmailHandle}@indiecrowdfund.com`;
    }

    for (const user of users as {
      id: string;
      email: string | null;
      name: string | null;
      creatorEmailHandle: string | null;
    }[]) {
      // In-app, always.
      await createNotification({
        userId: user.id,
        type: "MESSAGE_RECEIVED",
        title: "New message",
        message: projectTitle
          ? `${input.senderName} sent you a message about "${projectTitle}"${input.subject ? `: ${input.subject}` : ""}`
          : `${input.senderName} sent you a message${input.subject ? `: ${input.subject}` : ""}`,
        actionUrl: inboxPath,
        projectId: input.projectId ?? undefined,
        senderId: input.senderId ?? undefined,
      }).catch((err) => log.warn({ err: String(err), userId: user.id }, "message notification create failed"));

      if (!input.sendEmailCopy || !user.email) continue;

      // Never email a creator's own @indiecrowdfund.com handle about mail
      // that arrived at that handle: the inbound webhook would file it as a
      // new message and we'd loop.
      const handleAddress = user.creatorEmailHandle ? `${user.creatorEmailHandle}@indiecrowdfund.com` : null;
      if (handleAddress && user.email.toLowerCase() === handleAddress) {
        log.info({ userId: user.id }, "Recipient's account email is their inbox handle; in-app only");
        continue;
      }

      const subjectLine = projectTitle
        ? `New message from ${input.senderName} about "${projectTitle}"`
        : `New message from ${input.senderName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">You have a new message</h2>
          <p>Hi ${escapeHtml(user.name || "there")},</p>
          <p><strong>${escapeHtml(input.senderName)}</strong> sent you ${projectTitle ? `a message about <strong>${escapeHtml(projectTitle)}</strong>` : "a message"}:</p>
          <div style="background: #f3f4f6; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            ${input.subject ? `<p style="margin: 0 0 8px 0; font-weight: bold;">${escapeHtml(input.subject)}</p>` : ""}
            <p style="margin: 0; color: #374151; white-space: pre-wrap;">${escapeHtml(preview)}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${APP_URL}${inboxPath}" style="background: linear-gradient(to right, #6366f1, #a855f7); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">View &amp; Reply</a>
          </p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            You received this email because someone sent you a message on ${APP_NAME}.
          </p>
        </div>
      `;
      const result = await sendEmail({
        to: user.email,
        subject: subjectLine,
        html,
        text: `${input.senderName} sent you a message${projectTitle ? ` about "${projectTitle}"` : ""}${input.subject ? `: ${input.subject}` : ""}\n\n${preview}\n\nReply: ${APP_URL}${inboxPath}`,
        skipUnsubscribeCheck: true, // Transactional: someone wrote to them
        ...(replyTo ? { replyTo } : {}),
      }).catch((err) => ({ success: false, error: String(err) }));
      if (!result.success) {
        log.warn(
          { messageId: input.messageId, to: user.email, error: result.error, source: input.source },
          "message notification email not sent"
        );
      }
    }

    log.info(
      { messageId: input.messageId, recipients: users.length, emailed: input.sendEmailCopy, source: input.source },
      "New-message notifications sent"
    );
  } catch (error) {
    // Notification trouble must never fail the message itself.
    log.error({ err: String(error), messageId: input.messageId }, "notifyNewMessage failed");
  }
}
