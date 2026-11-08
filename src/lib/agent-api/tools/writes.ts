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
    "Import or re-activate newsletter subscribers in bulk, e.g. a Shopify or eBay customer export. Pass `subscribers` as objects with email and optional name and per-row tags (up to 5000 per call), or `emails` as bare strings. `tags` applies to every row; `source` labels where they came from (shopify, ebay, csv…). Existing subscribers get the new tags merged and a missing name filled in. Addresses on the blocklist, accounts that unsubscribed site-wide, and anyone who unsubscribed from the newsletter are skipped and listed in the result, never added.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    subscribers: z
      .array(z.object({ email: z.string().email(), name: z.string().max(120).optional(), tags: z.array(z.string().min(1).max(40)).max(10).optional() }))
      .max(5000)
      .optional(),
    emails: z.array(z.string().email()).max(5000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(10).default([]),
    source: z.string().max(60).default("agent"),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const incoming = new Map<string, { name: string | null; tags: string[] }>();
    for (const s of a.subscribers ?? []) {
      const email = s.email.trim().toLowerCase();
      const prev = incoming.get(email);
      incoming.set(email, { name: s.name?.trim() || prev?.name || null, tags: [...new Set([...(prev?.tags ?? []), ...(s.tags ?? []), ...a.tags])] });
    }
    for (const e of a.emails ?? []) {
      const email = e.trim().toLowerCase();
      if (!incoming.has(email)) incoming.set(email, { name: null, tags: [...a.tags] });
    }
    if (incoming.size === 0) throw new ToolError("Pass subscribers or emails.", "invalid_arguments");
    const emails = [...incoming.keys()];
    const domains = [...new Set(emails.map((e) => e.split("@")[1]))];

    // One round of lookups for the whole batch, then per-row decisions in memory.
    const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
    type BlockRow = { type: string; value: string };
    type ExistingRow = { id: string; email: string; name: string | null; tags: string[]; unsubscribedAt: Date | null };
    const blocked: BlockRow[] = [];
    const optedOut: { email: string }[] = [];
    const existing: ExistingRow[] = [];
    for (const part of chunk(emails, 1000)) {
      const [b, u, ex] = await Promise.all([
        db.emailBlocklist.findMany({ where: { isActive: true, OR: [{ type: "EMAIL", value: { in: part } }, { type: "DOMAIN", value: { in: domains } }] }, select: { type: true, value: true } }),
        db.user.findMany({ where: { email: { in: part }, emailUnsubscribedAt: { not: null } }, select: { email: true } }),
        db.newsletterSubscriber.findMany({ where: { email: { in: part } }, select: { id: true, email: true, name: true, tags: true, unsubscribedAt: true } }),
      ]);
      blocked.push(...(b as BlockRow[]));
      optedOut.push(...(u as { email: string }[]));
      existing.push(...(ex as ExistingRow[]));
    }
    const blockedEmails = new Set(blocked.filter((b) => b.type === "EMAIL").map((b) => b.value));
    const blockedDomains = new Set(blocked.filter((b) => b.type === "DOMAIN").map((b) => b.value));
    const unsub = new Set(optedOut.map((u) => u.email.toLowerCase()));
    const existingByEmail = new Map(existing.map((e) => [e.email.toLowerCase(), e]));

    const skipped: { email: string; reason: string }[] = [];
    const toCreate: { email: string; name: string | null; source: string; tags: string[]; isActive: boolean }[] = [];
    let updated = 0;
    for (const [email, row] of incoming) {
      if (blockedEmails.has(email)) { skipped.push({ email, reason: "blocklisted" }); continue; }
      if (blockedDomains.has(email.split("@")[1])) { skipped.push({ email, reason: "domain blocklisted" }); continue; }
      if (unsub.has(email)) { skipped.push({ email, reason: "unsubscribed site-wide" }); continue; }
      const ex = existingByEmail.get(email);
      if (ex) {
        if (ex.unsubscribedAt) { skipped.push({ email, reason: "unsubscribed from newsletter" }); continue; }
        await db.newsletterSubscriber.update({
          where: { id: ex.id },
          data: { isActive: true, tags: [...new Set([...ex.tags, ...row.tags])], ...(ex.name ? {} : row.name ? { name: row.name } : {}) },
        });
        updated += 1;
      } else {
        toCreate.push({ email, name: row.name, source: a.source, tags: row.tags, isActive: true });
      }
    }
    let added = 0;
    for (const part of chunk(toCreate, 500)) {
      const res = await db.newsletterSubscriber.createMany({ data: part, skipDuplicates: true });
      added += res.count;
    }
    log.info({ added, updated, skipped: skipped.length, source: a.source, keyId: ctx.key.id }, "agent imported newsletter subscribers");
    return {
      received: incoming.size,
      added,
      updated,
      skippedCount: skipped.length,
      skipped: skipped.slice(0, 200),
      note: skipped.length > 200 ? `${skipped.length - 200} more skipped rows not shown` : undefined,
    };
  },
});

defineTool({
  name: "reverse_backer_chargebacks",
  description:
    "For a backer whose disputes were withdrawn or won by the platform: refund every creator who was charged a chargeback recoup (disputed amount + dispute fee) for that backer's pledges, and waive any still uncollected. Optionally restore the pledges from CHARGEBACK to COMPLETED when the money stayed with the campaign. Run with dryRun first; it lists each creator and amount. This also runs automatically when an admin unbans the backer.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    email: z.string().email().describe("The backer's account email."),
    restorePledges: z.boolean().default(false).describe("Also reinstate their CHARGEBACK pledges. Only when the disputes were withdrawn and the money stayed."),
    dryRun: z.boolean().default(false).describe("Preview only; nothing changes."),
    reason: z.string().max(300).default("Disputes resolved in the backer's favour"),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const user = await db.user.findFirst({ where: { email: { equals: a.email, mode: "insensitive" } }, select: { id: true } });
    if (!user) throw new ToolError(`No account with email "${a.email}".`, "not_found", 404);
    const { reverseChargebacksForBacker } = await import("@/lib/payments/chargeback-reversal");
    const result = await reverseChargebacksForBacker({ userId: user.id, adminId: `agent:${ctx.key.name}`, reason: a.reason, restorePledges: a.restorePledges, dryRun: a.dryRun });
    log.info({ userId: user.id, dryRun: a.dryRun, summary: result.summary, keyId: ctx.key.id }, "agent reversed backer chargebacks");
    return result;
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
