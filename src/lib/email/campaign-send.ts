import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { queueEmail, sendEmail, EMAIL_PRIORITY, getUnsubscribeUrl, hasVisibleEmailContent } from "@/lib/email/email-config";
import { MARKETING_RECIPIENT_WHERE } from "@/lib/email/marketing-eligibility";

const log = logger.child({ module: "campaign-send" });

/**
 * Sending a marketing EmailCampaign: who gets it, how each copy is
 * personalised and tracked, and the status handshake around the send.
 *
 * Lifted out of the admin send route so the Agent API can send a campaign
 * through exactly the same path an admin's Send button uses — same audience
 * resolution, same eligibility filters, same tracking, same CAS guard
 * against a double send.
 */

export interface Recipient {
  email: string;
  name: string | null;
}

export interface CampaignForSend {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  targetAudience: string | null;
  status: string;
  filters: unknown;
}

type SegmentFilter = { tags: { has: string } } | { source: { in: string[] } };

/** "tag-foo" / "source-bar" / bare tag → Prisma filter. */
export function segmentFilters(segmentIds: string[]): SegmentFilter[] {
  return segmentIds.map((segmentId) => {
    if (segmentId.startsWith("source-")) return { source: { in: [segmentId.replace("source-", "")] } };
    if (segmentId.startsWith("tag-")) return { tags: { has: segmentId.replace(/^tag-/, "") } };
    return { tags: { has: segmentId } };
  });
}

export async function resolveCampaignRecipients(campaign: { targetAudience: string | null; filters: unknown }): Promise<Recipient[]> {
  const recipientMap = new Map<string, Recipient>();
  const add = (email: string, name: string | null, preferName = false) => {
    const key = email.toLowerCase();
    const existing = recipientMap.get(key);
    if (!existing || (preferName && name && !existing.name)) recipientMap.set(key, { email: key, name });
  };
  const audience = campaign.targetAudience || "all";
  const filters = campaign.filters as { segments?: string[] } | null;
  const segmentIds = filters?.segments || [];

  switch (audience) {
    case "subscriber": {
      const where =
        segmentIds.length > 0
          ? { isActive: true, OR: segmentFilters(segmentIds) }
          : { isActive: true, NOT: { source: { contains: "retailer", mode: "insensitive" as const } } };
      const [subscribers, verifiedUsers] = await Promise.all([
        db.newsletterSubscriber.findMany({ where, select: { email: true, name: true } }),
        segmentIds.length === 0
          ? db.user.findMany({ where: { emailVerified: { not: null }, ...MARKETING_RECIPIENT_WHERE }, select: { email: true, name: true } })
          : Promise.resolve([] as { email: string; name: string | null }[]),
      ]);
      subscribers.forEach((s: Recipient) => add(s.email, s.name));
      verifiedUsers.forEach((u: Recipient) => add(u.email, u.name, true));
      break;
    }
    case "backer": {
      const backerPledges = await db.pledge.findMany({ where: { status: "COMPLETED", deletedAt: null }, select: { userId: true }, distinct: ["userId"] });
      const users = await db.user.findMany({
        where: { id: { in: backerPledges.map((p: { userId: string }) => p.userId) }, ...MARKETING_RECIPIENT_WHERE },
        select: { email: true, name: true },
      });
      users.forEach((u: Recipient) => add(u.email, u.name));
      break;
    }
    case "creator": {
      const creators = await db.user.findMany({ where: { createdProjects: { some: {} }, ...MARKETING_RECIPIENT_WHERE }, select: { email: true, name: true } });
      creators.forEach((c: Recipient) => add(c.email, c.name));
      break;
    }
    case "retailer": {
      const retailers = await db.newsletterSubscriber.findMany({
        where: { isActive: true, source: { contains: "retailer", mode: "insensitive" } },
        select: { email: true, name: true },
      });
      retailers.forEach((r: Recipient) => add(r.email, r.name));
      break;
    }
    default: {
      if (segmentIds.length > 0) {
        const subs = await db.newsletterSubscriber.findMany({ where: { isActive: true, OR: segmentFilters(segmentIds) }, select: { email: true, name: true } });
        subs.forEach((s: Recipient) => add(s.email, s.name));
      } else {
        const all = await db.user.findMany({ where: { emailVerified: { not: null }, ...MARKETING_RECIPIENT_WHERE }, select: { email: true, name: true } });
        all.forEach((u: Recipient) => add(u.email, u.name));
      }
    }
  }
  return [...recipientMap.values()];
}

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

export function replaceTemplateVariables(content: string, recipient: Recipient): string {
  const displayName = recipient.name ? recipient.name.split(" ")[0] : "there";
  return content
    .replace(/\{\{USER_NAME\}\}/gi, displayName)
    .replace(/\{\{NAME\}\}/gi, displayName)
    .replace(/\{\{FIRST_NAME\}\}/gi, displayName)
    .replace(/\{\{USER_EMAIL\}\}/gi, recipient.email)
    .replace(/\{\{EMAIL\}\}/gi, recipient.email)
    // Resolve the site URL BEFORE click-tracking so CTA links are absolute.
    .replace(/\{\{SITE_URL\}\}/gi, baseUrl());
}

export function convertRelativeUrls(html: string): string {
  const base = baseUrl();
  return html
    .replace(/src="\/([^"]*)"/gi, `src="${base}/$1"`)
    .replace(/src='\/([^']*)'/gi, `src='${base}/$1'`)
    .replace(/href="\/([^#"][^"]*)"/gi, `href="${base}/$1"`)
    .replace(/href='\/([^#'][^']*)'/gi, `href='${base}/$1'`)
    .replace(/url\(["']?\/([^"')]+)["']?\)/gi, `url("${base}/$1")`);
}

export function addEmailTracking(html: string, campaignId: string, recipientEmail: string): string {
  const base = baseUrl();
  const encodedEmail = encodeURIComponent(Buffer.from(recipientEmail).toString("base64"));
  const pixel = `<img src="${base}/api/email/track/open?c=${campaignId}&e=${encodedEmail}" width="1" height="1" style="display:none;" alt="" />`;
  let result = html.includes("</body>") ? html.replace("</body>", `${pixel}</body>`) : html + pixel;
  result = result.replace(/href="(https?:\/\/(?:www\.)?indiecrowdfund\.com[^"]*)"/gi, (_m, url) => {
    const encodedUrl = encodeURIComponent(Buffer.from(url).toString("base64"));
    return `href="${base}/api/email/track/click?c=${campaignId}&e=${encodedEmail}&url=${encodedUrl}"`;
  });
  return result;
}

/** One recipient's copy: variables, absolute URLs, tracking, unsubscribe link. */
export function personalizeCampaign(campaign: { id: string; subject: string; htmlContent: string }, recipient: Recipient): { subject: string; html: string } {
  const subject = replaceTemplateVariables(campaign.subject, recipient);
  let html = replaceTemplateVariables(campaign.htmlContent, recipient);
  html = convertRelativeUrls(html);
  html = addEmailTracking(html, campaign.id, recipient.email);
  // After tracking so the opt-out link stays a clean signed URL.
  html = html.replace(/\{\{UNSUBSCRIBE_URL\}\}/gi, getUnsubscribeUrl(recipient.email));
  return { subject, html };
}

export type SendCampaignResult =
  | { ok: true; queued: number; failed: number; totalRecipients: number }
  | { ok: false; code: "not_found" | "no_content" | "already_sent" | "sending" | "conflict"; message: string };

/**
 * Queue a campaign to its whole audience. Status CAS → SENDING guards two
 * concurrent sends; status ends SENT with the counts. On an unexpected
 * failure the status is put back to DRAFT if it is still SENDING.
 */
export async function sendCampaignNow(campaignId: string, opts: { resend?: boolean } = {}): Promise<SendCampaignResult> {
  const campaign = await db.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, subject: true, htmlContent: true, targetAudience: true, status: true, recipientCount: true, filters: true },
  });
  if (!campaign) return { ok: false, code: "not_found", message: "Campaign not found" };
  if (campaign.status === "SENT" && !opts.resend) return { ok: false, code: "already_sent", message: "Campaign has already been sent. Use resend to send again." };
  if (campaign.status === "SENDING") return { ok: false, code: "sending", message: "Campaign is already being sent" };
  if (!hasVisibleEmailContent(campaign.htmlContent)) {
    return { ok: false, code: "no_content", message: "This campaign has no body content — nothing was sent. Regenerate or edit the campaign, then try again." };
  }

  const cas = await db.emailCampaign.updateMany({
    where: { id: campaignId, status: opts.resend ? { notIn: ["SENDING"] } : { notIn: ["SENDING", "SENT"] } },
    data: { status: "SENDING" },
  });
  if (cas.count === 0) return { ok: false, code: "conflict", message: "Campaign is already being sent or has just been sent." };

  try {
    const recipients = await resolveCampaignRecipients(campaign);
    log.info({ campaignId, name: campaign.name, recipients: recipients.length }, "queueing campaign");

    let queued = 0;
    let failed = 0;
    const emailLogBatch: { recipientEmail: string; subject: string; htmlContent: string; sentAt: Date; type: "WEEKLY_DISCOVERY" }[] = [];
    for (const recipient of recipients) {
      try {
        const copy = personalizeCampaign(campaign, recipient);
        const result = await queueEmail({ to: recipient.email, subject: copy.subject, html: copy.html, priority: EMAIL_PRIORITY.AI_MARKETING });
        if (result.success) {
          emailLogBatch.push({ recipientEmail: recipient.email, subject: copy.subject, htmlContent: copy.html, sentAt: new Date(), type: "WEEKLY_DISCOVERY" });
          queued += 1;
        } else {
          failed += 1;
          log.error({ err: String(result.error), to: recipient.email }, "failed to queue campaign email");
        }
      } catch (err) {
        failed += 1;
        log.error({ err: String(err), to: recipient.email }, "error queueing campaign email");
      }
    }
    if (emailLogBatch.length > 0) await db.emailLog.createMany({ data: emailLogBatch });

    await db.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENT", sentAt: new Date(), sentCount: queued, recipientCount: recipients.length },
    });
    log.info({ campaignId, queued, failed }, "campaign queued");
    return { ok: true, queued, failed, totalRecipients: recipients.length };
  } catch (err) {
    await db.emailCampaign.updateMany({ where: { id: campaignId, status: "SENDING" }, data: { status: "DRAFT" } }).catch(() => {});
    throw err;
  }
}

/** One copy to one address, subject prefixed [TEST]; campaign status untouched. */
export async function sendCampaignTest(campaignId: string, to: string, name?: string | null): Promise<{ ok: boolean; error?: string }> {
  const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId }, select: { id: true, subject: true, htmlContent: true } });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  const copy = personalizeCampaign(campaign, { email: to.toLowerCase(), name: name ?? null });
  const result = await sendEmail({ to, subject: `[TEST] ${copy.subject}`, html: copy.html, skipUnsubscribeCheck: true });
  return result.success ? { ok: true } : { ok: false, error: result.error };
}
