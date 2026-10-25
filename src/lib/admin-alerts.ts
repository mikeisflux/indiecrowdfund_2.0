import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { queueEmail, EMAIL_PRIORITY } from "@/lib/email/email-config";
import { createNotification } from "@/lib/notifications/core";

const log = logger.child({ module: "admin-alerts" });
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Tell the people who run the platform that something needs them.
 *
 * Things used to happen silently: a support email sat unread in the admin
 * inbox, the support bot failed every request for weeks on a bad API key,
 * and a backer's paid pledge sat PENDING for five days. Every admin gets
 * an in-app notification; with `email: true` they also get it in their
 * own inbox, which is where a human actually looks.
 *
 * `throttleKey` + `throttleMinutes` stop a repeating fault from sending
 * the same alert on every tick: the alert goes once per window.
 */
export async function alertAdmins(input: {
  title: string;
  message: string;
  actionUrl?: string;
  email?: boolean;
  throttleKey?: string;
  throttleMinutes?: number;
  /** Don't email this address even if it belongs to an admin (e.g. the mailbox the alert is about). */
  skipEmail?: string | null;
}): Promise<{ notified: number; emailed: number; throttled: boolean }> {
  try {
    if (input.throttleKey && input.throttleMinutes) {
      const since = new Date(Date.now() - input.throttleMinutes * 60 * 1000);
      const recent = await db.notification.findFirst({
        where: { type: "SYSTEM", title: input.title, createdAt: { gt: since } },
        select: { id: true },
      });
      if (recent) return { notified: 0, emailed: 0, throttled: true };
    }

    const admins = await db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null, bannedAt: null },
      select: { id: true, email: true, name: true },
    });

    let emailed = 0;
    for (const admin of admins as { id: string; email: string | null; name: string | null }[]) {
      await createNotification({
        userId: admin.id,
        type: "SYSTEM",
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
      }).catch(() => {});

      if (!input.email || !admin.email) continue;
      if (input.skipEmail && admin.email.toLowerCase() === input.skipEmail.toLowerCase()) continue;
      const link = input.actionUrl ? `${APP_URL}${input.actionUrl}` : APP_URL;
      const ok = await queueEmail({
        to: admin.email,
        subject: `[${APP_NAME} admin] ${input.title}`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color:#0f766e;">${escapeHtml(input.title)}</h2>
  <p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
  <p><a href="${link}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open in admin</a></p>
</div>`,
        text: `${input.title}\n\n${input.message}\n\n${link}`,
        skipUnsubscribeCheck: true,
        priority: EMAIL_PRIORITY.SYSTEM,
      }).catch(() => ({ success: false }));
      if (ok.success) emailed++;
    }
    return { notified: admins.length, emailed, throttled: false };
  } catch (err) {
    log.error({ err: String(err), title: input.title }, "alertAdmins failed");
    return { notified: 0, emailed: 0, throttled: false };
  }
}
