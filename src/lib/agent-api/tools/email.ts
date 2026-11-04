import { z } from "zod";
import { db } from "@/lib/db";
import { defineTool, SCOPE_AGENT_READ } from "../registry";
import { DateRange, Limit, findUserByEmail, parseRange } from "../shared";

defineTool({
  name: "email_engagement",
  description:
    "Sent / opened / clicked counts for platform email in a date window, grouped by recipient domain, email type, or day. Opens are tracked on marketing mail only, so transactional types show opens as null. Use it to spot a mailbox provider that stopped delivering.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    ...DateRange,
    groupBy: z.enum(["domain", "type", "day"]).default("domain"),
    minSent: z.number().int().min(1).default(20).describe("Hide groups with fewer sends than this."),
    limit: Limit(25, 200),
  }),
  handler: async (a) => {
    const { from, to } = parseRange(a, 30);
    const rows = await db.emailLog.findMany({
      where: { sentAt: { gte: from, lte: to } },
      select: { recipientEmail: true, type: true, sentAt: true, openedAt: true, clickedAt: true },
    });
    const transactional = new Set(["PASSWORD_RESET", "EMAIL_VERIFICATION", "PLEDGE_CONFIRMATION", "PLEDGE_MODIFICATION", "PLEDGE_CANCELLATION", "PLEDGE_REFUND", "WELCOME"]);
    const agg = new Map<string, { sent: number; opened: number; clicked: number; trackable: number }>();
    for (const r of rows) {
      const key =
        a.groupBy === "domain" ? r.recipientEmail.split("@")[1]?.toLowerCase() ?? "?" : a.groupBy === "type" ? r.type : r.sentAt.toISOString().slice(0, 10);
      const cur = agg.get(key) ?? { sent: 0, opened: 0, clicked: 0, trackable: 0 };
      cur.sent += 1;
      if (!transactional.has(r.type)) {
        cur.trackable += 1;
        if (r.openedAt) cur.opened += 1;
        if (r.clickedAt) cur.clicked += 1;
      }
      agg.set(key, cur);
    }
    const out = [...agg.entries()]
      .filter(([, v]) => v.sent >= a.minSent)
      .map(([group, v]) => ({
        group,
        sent: v.sent,
        opened: v.trackable ? v.opened : null,
        openRatePercent: v.trackable ? Math.round((v.opened / v.trackable) * 1000) / 10 : null,
        clicked: v.trackable ? v.clicked : null,
      }))
      .sort((x, y) => y.sent - x.sent)
      .slice(0, a.limit);
    return { from, to, groupBy: a.groupBy, groups: out };
  },
});

defineTool({
  name: "user_email_history",
  description:
    "What we've sent one person and what became of it: transactional/marketing log with open times, plus the Sent-folder copies with the mail provider's delivery verdict (delivered, bounced, not delivered) and reason. Also reports blocklist and unsubscribe state. First stop for 'they say they never got the email'.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ email: z.string(), limit: Limit(20, 100) }),
  handler: async (a) => {
    const email = a.email.trim().toLowerCase();
    const [user, logs, sent, blocklist, newsletter] = await Promise.all([
      db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, name: true, emailUnsubscribedAt: true, emailVerified: true } }),
      db.emailLog.findMany({ where: { recipientEmail: { equals: email, mode: "insensitive" } }, orderBy: { sentAt: "desc" }, take: a.limit, select: { type: true, subject: true, sentAt: true, openedAt: true, clickedAt: true } }),
      db.adminEmail.findMany({ where: { toEmail: { equals: email, mode: "insensitive" }, folder: "SENT" }, orderBy: { sentAt: "desc" }, take: a.limit, select: { subject: true, status: true, sentAt: true, openedAt: true, attachments: true, fromEmail: true } }),
      db.emailBlocklist.findMany({ where: { isActive: true, OR: [{ type: "EMAIL", value: email }, { type: "DOMAIN", value: email.split("@")[1] ?? "" }] }, select: { type: true, value: true, reason: true, createdAt: true } }),
      db.newsletterSubscriber.findFirst({ where: { email }, select: { isActive: true, source: true, subscribedAt: true, unsubscribedAt: true } }),
    ]);
    return {
      account: user ? { id: user.id, name: user.name, emailVerified: !!user.emailVerified, unsubscribed: !!user.emailUnsubscribedAt } : null,
      blocklisted: blocklist,
      newsletter,
      emailLog: logs,
      sentFolder: sent.map((s: { fromEmail: string; subject: string; sentAt: Date | null; status: string; openedAt: Date | null; attachments: unknown }) => {
        const att = (s.attachments ?? {}) as Record<string, unknown>;
        return {
          from: s.fromEmail,
          subject: s.subject,
          sentAt: s.sentAt,
          providerStatus: s.status,
          deliveredAt: (att.deliveredAt as string | undefined) ?? null,
          openedAt: s.openedAt,
          bounceReason: (att.bounceReason as string | undefined) ?? null,
          bounceCode: (att.bounceCode as string | undefined) ?? null,
        };
      }),
    };
  },
});

defineTool({
  name: "email_campaigns",
  description: "Marketing email campaigns with their send stats: recipients, sent, opens, clicks, bounces, unsubscribes and attributed pledges.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    status: z.array(z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"])).optional(),
    limit: Limit(20, 100),
  }),
  handler: async (a) => {
    const campaigns = await db.emailCampaign.findMany({
      where: a.status && a.status.length > 0 ? { status: { in: [...a.status] } } : {},
      orderBy: { createdAt: "desc" },
      take: a.limit,
      select: {
        id: true, name: true, subject: true, status: true, targetAudience: true, scheduledFor: true, sentAt: true, createdAt: true,
        recipientCount: true, sentCount: true, openCount: true, clickCount: true, bounceCount: true, unsubscribeCount: true, conversionCount: true,
      },
    });
    return {
      campaigns: campaigns.map((c: { sentCount: number; openCount: number; clickCount: number } & Record<string, unknown>) => ({
        ...c,
        openRatePercent: c.sentCount ? Math.round((c.openCount / c.sentCount) * 1000) / 10 : null,
        clickRatePercent: c.sentCount ? Math.round((c.clickCount / c.sentCount) * 1000) / 10 : null,
      })),
    };
  },
});

defineTool({
  name: "newsletter_stats",
  description: "Newsletter list size, active vs unsubscribed, growth over the last 30/90 days, and subscribers by source and tag.",
  scope: SCOPE_AGENT_READ,
  input: z.object({}),
  handler: async () => {
    const d30 = new Date(Date.now() - 30 * 86_400_000);
    const d90 = new Date(Date.now() - 90 * 86_400_000);
    const [total, active, added30, added90, unsub30, bySource, tagged] = await Promise.all([
      db.newsletterSubscriber.count(),
      db.newsletterSubscriber.count({ where: { isActive: true } }),
      db.newsletterSubscriber.count({ where: { subscribedAt: { gte: d30 } } }),
      db.newsletterSubscriber.count({ where: { subscribedAt: { gte: d90 } } }),
      db.newsletterSubscriber.count({ where: { unsubscribedAt: { gte: d30 } } }),
      db.newsletterSubscriber.groupBy({ by: ["source"], where: { isActive: true }, _count: { id: true } }),
      db.newsletterSubscriber.findMany({ where: { isActive: true, NOT: { tags: { isEmpty: true } } }, select: { tags: true } }),
    ]);
    const tagCounts = new Map<string, number>();
    for (const t of tagged) for (const tag of t.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    return {
      total,
      active,
      unsubscribed: total - active,
      growth: { last30Days: added30, last90Days: added90, unsubscribedLast30Days: unsub30 },
      bySource: bySource
        .map((s: { source: string | null; _count: { id: number } }) => ({ source: s.source ?? "unknown", count: s._count.id }))
        .sort((x: { count: number }, y: { count: number }) => y.count - x.count),
      topTags: [...tagCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((x, y) => y.count - x.count).slice(0, 30),
    };
  },
});

// Kept separate from user_email_history so an agent can answer "is this
// address reachable" in one cheap call before building a list around it.
defineTool({
  name: "email_deliverability",
  description: "Can we email this address? Checks the blocklist, site-wide unsubscribe, newsletter status and the last provider verdict for the address.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ email: z.string() }),
  handler: async (a) => {
    const email = a.email.trim().toLowerCase();
    let unsubscribed = false;
    try {
      const u = await findUserByEmail(email);
      unsubscribed = !!u.emailUnsubscribedAt;
    } catch {
      // Not an account; newsletter-only addresses are fine.
    }
    const [block, last, news] = await Promise.all([
      db.emailBlocklist.findFirst({ where: { isActive: true, OR: [{ type: "EMAIL", value: email }, { type: "DOMAIN", value: email.split("@")[1] ?? "" }] }, select: { type: true, reason: true } }),
      db.adminEmail.findFirst({ where: { toEmail: { equals: email, mode: "insensitive" }, folder: "SENT" }, orderBy: { sentAt: "desc" }, select: { status: true, sentAt: true, attachments: true } }),
      db.newsletterSubscriber.findFirst({ where: { email }, select: { isActive: true } }),
    ]);
    const att = (last?.attachments ?? {}) as Record<string, unknown>;
    const reachable = !block && !unsubscribed && last?.status !== "BOUNCED";
    return {
      email,
      reachable,
      blocklisted: block ? { type: block.type, reason: block.reason } : null,
      unsubscribedSiteWide: unsubscribed,
      newsletterActive: news?.isActive ?? null,
      lastSend: last ? { at: last.sentAt, providerStatus: last.status, bounceReason: (att.bounceReason as string | undefined) ?? null } : null,
    };
  },
});
