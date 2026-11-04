import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { defineTool, SCOPE_AGENT_WRITE, ToolError } from "../registry";
import { PROJECT_REF, findProject, money } from "../shared";

const log = logger.child({ module: "agent-api-writes" });

/**
 * The guarded mutations. Every one requires `confirm: true` (enforced by the
 * registry for mutating tools) and the agent:write scope. None of them
 * touches money: no refunds, charges, payouts or pledge edits live here, and
 * none should be added — those stay behind the admin UI where a human clicks.
 */

const Confirm = z.literal(true).describe("Must be true. Send only after the user has approved the change.");

defineTool({
  name: "extend_campaign",
  description: "Push a live or funded campaign's end date out by N days. Refuses campaigns that are FAILED or CANCELLED, since refunds or wind-down have already run on those.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({ project: PROJECT_REF, days: z.number().int().min(1).max(90), confirm: Confirm }),
  handler: async (a, ctx) => {
    const p = await findProject(a.project);
    if (p.status !== "LIVE" && p.status !== "FUNDED") throw new ToolError(`"${p.title}" is ${p.status}; only LIVE or FUNDED campaigns can be extended.`);
    if (!p.endDate) throw new ToolError(`"${p.title}" has no end date to extend.`);
    const newEnd = new Date(p.endDate.getTime() + a.days * 86_400_000);
    await db.project.update({ where: { id: p.id }, data: { endDate: newEnd } });
    log.info({ projectId: p.id, from: p.endDate, to: newEnd, keyId: ctx.key.id }, "agent extended campaign");
    return { project: { slug: p.slug, title: p.title }, previousEndDate: p.endDate, newEndDate: newEnd };
  },
});

defineTool({
  name: "set_campaign_goal",
  description: "Change a campaign's funding goal. Lowering a goal below the amount already raised makes the campaign show as funded immediately.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({ project: PROJECT_REF, goal: z.number().positive().max(10_000_000), confirm: Confirm }),
  handler: async (a, ctx) => {
    const p = await findProject(a.project);
    if (["FAILED", "CANCELLED"].includes(p.status)) throw new ToolError(`"${p.title}" is ${p.status}; its goal can no longer change.`);
    await db.project.update({ where: { id: p.id }, data: { goalAmount: a.goal } });
    log.info({ projectId: p.id, from: Number(p.goalAmount), to: a.goal, keyId: ctx.key.id }, "agent changed campaign goal");
    return { project: { slug: p.slug, title: p.title }, previousGoal: money(p.goalAmount), newGoal: a.goal, raised: money(p.currentAmount) };
  },
});

defineTool({
  name: "add_newsletter_subscribers",
  description:
    "Add addresses to the platform newsletter list (or re-activate them), with optional tags and a source label. Addresses on the blocklist or belonging to accounts that unsubscribed site-wide are skipped and reported, never added.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    emails: z.array(z.string().email()).min(1).max(500),
    tags: z.array(z.string().min(1).max(40)).max(10).default([]),
    source: z.string().max(60).default("agent"),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const emails = [...new Set(a.emails.map((e) => e.trim().toLowerCase()))];
    const domains = [...new Set(emails.map((e) => e.split("@")[1]))];
    const [blocked, optedOut] = await Promise.all([
      db.emailBlocklist.findMany({ where: { isActive: true, OR: [{ type: "EMAIL", value: { in: emails } }, { type: "DOMAIN", value: { in: domains } }] }, select: { type: true, value: true } }),
      db.user.findMany({ where: { email: { in: emails }, emailUnsubscribedAt: { not: null } }, select: { email: true } }),
    ]);
    type BlockRow = { type: string; value: string };
    const blockedEmails = new Set((blocked as BlockRow[]).filter((b) => b.type === "EMAIL").map((b) => b.value));
    const blockedDomains = new Set((blocked as BlockRow[]).filter((b) => b.type === "DOMAIN").map((b) => b.value));
    const unsub = new Set(optedOut.map((u) => u.email.toLowerCase()));

    const skipped: { email: string; reason: string }[] = [];
    let added = 0;
    let updated = 0;
    for (const email of emails) {
      if (blockedEmails.has(email)) { skipped.push({ email, reason: "blocklisted" }); continue; }
      if (blockedDomains.has(email.split("@")[1])) { skipped.push({ email, reason: "domain blocklisted" }); continue; }
      if (unsub.has(email)) { skipped.push({ email, reason: "unsubscribed site-wide" }); continue; }
      const existing = await db.newsletterSubscriber.findFirst({ where: { email }, select: { id: true, tags: true, isActive: true, unsubscribedAt: true } });
      if (existing) {
        if (existing.unsubscribedAt) { skipped.push({ email, reason: "unsubscribed from newsletter" }); continue; }
        await db.newsletterSubscriber.update({ where: { id: existing.id }, data: { isActive: true, tags: [...new Set([...existing.tags, ...a.tags])] } });
        updated += 1;
      } else {
        await db.newsletterSubscriber.create({ data: { email, source: a.source, tags: a.tags, isActive: true } });
        added += 1;
      }
    }
    log.info({ added, updated, skipped: skipped.length, keyId: ctx.key.id }, "agent added newsletter subscribers");
    return { added, updated, skipped };
  },
});

defineTool({
  name: "create_email_campaign_draft",
  description:
    "Create a marketing email campaign as a DRAFT in Admin → Email. It is never sent by this tool: an admin reviews and sends it from the dashboard. targetAudience is a free label the admin picks from in the UI (e.g. all, backers, creators).",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    name: z.string().min(3).max(120),
    subject: z.string().min(3).max(200),
    html: z.string().min(20).max(200_000).describe("Full HTML body."),
    targetAudience: z.string().max(60).default("all"),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const c = await db.emailCampaign.create({
      data: { name: a.name, subject: a.subject, htmlContent: a.html, targetAudience: a.targetAudience, status: "DRAFT", createdBy: `agent:${ctx.key.name}` },
      select: { id: true, name: true, status: true, createdAt: true },
    });
    return { ...c, adminUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com"}/admin/email` };
  },
});
