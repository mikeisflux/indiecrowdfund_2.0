import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateCampaignContent, generateMarketingCopy } from "@/lib/ai/anthropic";
import { generateSmartSegments } from "@/lib/ai/marketing-services";
import { getAISettings, clearSettingsCache } from "@/lib/ai/settings-integration";
import {
  renderCampaignEmailHtml,
  preferProjectsWithEmailableImage,
  wrapInEmailShell,
  looksLikeFullEmail,
  findCampaignTokens,
  expandCampaignTokens,
} from "@/lib/ai/campaign-email-template";
import { resolveCampaignRecipients, sendCampaignNow, sendCampaignTest } from "@/lib/email/campaign-send";
import { POST as runAiServiceRoute } from "@/app/api/admin/ai-marketing/run/route";
import { generateSocialPosts } from "@/lib/social/publicist";
import { getTwitterCredentials, postTweet, uploadTwitterMedia } from "@/lib/social/twitter";
import { defineTool, SCOPE_AGENT_READ, SCOPE_AGENT_WRITE, ToolError } from "../registry";
import { Limit, Offset, findProject, money, toCsv } from "../shared";

const log = logger.child({ module: "agent-api-marketing" });
const Confirm = z.literal(true).describe("Must be true. Send only after the user has approved the action.");
const adminBase = () => process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

// ────────────────────────────────────────────────────────────────────────────
// Cross-system matching
// ────────────────────────────────────────────────────────────────────────────

defineTool({
  name: "match_emails",
  description:
    "Compare a list of email addresses (e.g. Shopify or eBay customers) against IndieCrowdfund. For each address: is there an account, have they backed anything (count/total/last), are they on the newsletter, unsubscribed, or blocklisted. Use include to get just the people who have never backed a campaign — the outreach list. Up to 5000 addresses per call; CSV available.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    emails: z.array(z.string().min(3)).min(1).max(5000),
    include: z
      .enum(["all", "not_on_platform", "account_never_backed", "never_backed", "backers"])
      .default("all")
      .describe("Filter rows: never_backed = not_on_platform + account_never_backed."),
    format: z.enum(["json", "csv"]).default("json"),
  }),
  handler: async (a) => {
    const emails = [...new Set(a.emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
    const domains = [...new Set(emails.map((e) => e.split("@")[1]))];
    const chunks: string[][] = [];
    for (let i = 0; i < emails.length; i += 1000) chunks.push(emails.slice(i, i + 1000));

    type U = { id: string; email: string; name: string | null; createdAt: Date; deletedAt: Date | null; emailUnsubscribedAt: Date | null };
    const users: U[] = [];
    const news: { email: string; isActive: boolean }[] = [];
    for (const chunk of chunks) {
      const [u, n] = await Promise.all([
        db.user.findMany({ where: { email: { in: chunk } }, select: { id: true, email: true, name: true, createdAt: true, deletedAt: true, emailUnsubscribedAt: true } }),
        db.newsletterSubscriber.findMany({ where: { email: { in: chunk } }, select: { email: true, isActive: true } }),
      ]);
      users.push(...u);
      news.push(...n);
    }
    const blocks = await db.emailBlocklist.findMany({
      where: { isActive: true, OR: [{ type: "EMAIL", value: { in: emails } }, { type: "DOMAIN", value: { in: domains } }] },
      select: { type: true, value: true },
    });
    const pledges = users.length
      ? await db.pledge.groupBy({
          by: ["userId"],
          where: { userId: { in: users.map((u) => u.id) }, status: "COMPLETED", deletedAt: null },
          _count: { id: true },
          _sum: { amount: true },
          _max: { createdAt: true },
        })
      : [];

    const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    const newsByEmail = new Map(news.map((n) => [n.email.toLowerCase(), n.isActive]));
    const pledgeByUser = new Map(pledges.map((p) => [p.userId, p]));
    const blockedEmails = new Set(blocks.filter((b: { type: string }) => b.type === "EMAIL").map((b: { value: string }) => b.value));
    const blockedDomains = new Set(blocks.filter((b: { type: string }) => b.type === "DOMAIN").map((b: { value: string }) => b.value));

    const rows = emails.map((email) => {
      const u = userByEmail.get(email);
      const p = u ? pledgeByUser.get(u.id) : undefined;
      const status = p ? "backer" : u ? "account_never_backed" : "not_on_platform";
      const blocklisted = blockedEmails.has(email) || blockedDomains.has(email.split("@")[1]);
      const unsubscribed = !!u?.emailUnsubscribedAt;
      return {
        email,
        status,
        name: u?.name ?? null,
        joined: u?.createdAt ?? null,
        pledges: p?._count.id ?? 0,
        totalPledged: money(p?._sum.amount),
        lastPledgeAt: p?._max.createdAt ?? null,
        newsletter: newsByEmail.has(email) ? (newsByEmail.get(email) ? "active" : "inactive") : "none",
        unsubscribed,
        blocklisted,
        deletedAccount: !!u?.deletedAt,
        reachable: !blocklisted && !unsubscribed && !u?.deletedAt,
      };
    });

    const summary = {
      submitted: a.emails.length,
      unique: emails.length,
      backers: rows.filter((r) => r.status === "backer").length,
      accountNeverBacked: rows.filter((r) => r.status === "account_never_backed").length,
      notOnPlatform: rows.filter((r) => r.status === "not_on_platform").length,
      unreachable: rows.filter((r) => !r.reachable).length,
    };
    const filtered =
      a.include === "all" ? rows
      : a.include === "never_backed" ? rows.filter((r) => r.status !== "backer")
      : rows.filter((r) => r.status === (a.include === "backers" ? "backer" : a.include));
    if (a.format === "csv") return { summary, returned: filtered.length, csv: toCsv(filtered) };
    return { summary, returned: filtered.length, rows: filtered };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Email campaigns: create, preview, send
// ────────────────────────────────────────────────────────────────────────────

const AUDIENCES = ["subscriber", "backer", "creator", "retailer", "all"] as const;

defineTool({
  name: "create_email_campaign",
  description:
    "Create a marketing email campaign in Admin → Email. mode 'ai' writes it with the platform's AI from a name, hint and intro, featuring live campaigns (optionally the slugs you choose) as cards; mode 'html' uses your own HTML, wrapped in the branded shell unless it is already a full email. Audience: subscriber (newsletter + verified users), backer, creator, retailer, or all. segmentTags narrows subscriber/all to newsletter subscribers carrying those tags — tag an outreach list with add_newsletter_subscribers first, then target the tag. Created as DRAFT (or SCHEDULED when scheduleFor is set); nothing is sent until send_email_campaign.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    name: z.string().min(3).max(120),
    mode: z.enum(["ai", "html"]),
    subjectHint: z.string().max(200).optional().describe("ai mode: subject line idea the AI should work from."),
    introMessage: z.string().max(2000).optional().describe("ai mode: what the email should say, in your words; the AI polishes it."),
    projectCategory: z.string().max(60).optional().describe("ai mode: only feature live campaigns in this category."),
    projectSlugs: z.array(z.string()).max(10).optional().describe("ai mode: feature exactly these campaigns (slugs)."),
    includeProjectCards: z.boolean().default(true),
    subject: z.string().max(200).optional().describe("html mode: subject line."),
    html: z.string().max(300_000).optional().describe("html mode: body or full email HTML. [[campaign:slug]] tokens become campaign cards."),
    preheader: z.string().max(200).optional(),
    wrapInBrandShell: z.boolean().default(true),
    audience: z.enum(AUDIENCES).default("subscriber"),
    segmentTags: z.array(z.string().min(1).max(40)).max(10).default([]),
    scheduleFor: z.string().optional().describe("ISO datetime to send automatically; omit to leave as a draft."),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    let subject: string;
    let htmlContent: string;
    let preheader = a.preheader ?? "";
    let aiContent: unknown = null;

    if (a.mode === "ai") {
      const where = a.projectSlugs?.length
        ? { deletedAt: null, slug: { in: a.projectSlugs }, status: { in: ["LIVE", "FUNDED"] } }
        : { deletedAt: null, status: "LIVE" as const, ...(a.projectCategory ? { category: a.projectCategory } : {}) };
      const projects = await db.project.findMany({
        where,
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, slug: true, description: true, category: true, goalAmount: true, imageUrl: true, creator: { select: { vanityUrl: true } } },
      });
      if (projects.length === 0) throw new ToolError("No live campaigns match; nothing to feature. Use mode 'html' for an email without campaign cards.");
      preferProjectsWithEmailableImage(projects);
      const content = await generateCampaignContent({
        campaignName: a.name,
        targetAudience: a.audience,
        projectCategory: a.projectCategory || "all",
        subjectTemplate: a.subjectHint || "",
        introMessage: a.introMessage || "",
        projects: projects.map((p) => ({ title: p.title, description: p.description || "", category: p.category, goalAmount: Number(p.goalAmount) })),
      });
      aiContent = content;
      subject = content.subject;
      preheader = content.preheader;
      htmlContent = renderCampaignEmailHtml(
        content,
        projects.map((p) => ({ title: p.title, url: p.creator?.vanityUrl ? `/projects/${p.creator.vanityUrl}/${p.slug}` : `/projects/${p.slug}`, imageUrl: p.imageUrl ?? null, category: p.category })),
        { includeProjectRecommendations: a.includeProjectCards }
      );
    } else {
      if (!a.subject || !a.html) throw new ToolError("html mode needs subject and html.", "invalid_arguments");
      subject = a.subject;
      let body = a.html;
      const slugs = findCampaignTokens(body);
      if (slugs.length > 0) {
        const projects = await db.project.findMany({
          where: { slug: { in: slugs }, deletedAt: null },
          select: { title: true, slug: true, category: true, subtitle: true, imageUrl: true, creator: { select: { vanityUrl: true } } },
        });
        const cards = new Map(
          projects.map((p) => [
            p.slug.toLowerCase(),
            { project: { title: p.title, url: p.creator?.vanityUrl ? `/projects/${p.creator.vanityUrl}/${p.slug}` : `/projects/${p.slug}`, imageUrl: p.imageUrl, category: p.category }, blurb: p.subtitle || "" },
          ])
        );
        body = expandCampaignTokens(body, cards);
      }
      htmlContent = a.wrapInBrandShell && !looksLikeFullEmail(body) ? wrapInEmailShell(body, { subject, preheader }) : body;
    }

    if (a.segmentTags.length > 0 && a.audience !== "subscriber" && a.audience !== "all") {
      throw new ToolError("segmentTags only apply to the subscriber or all audience.", "invalid_arguments");
    }
    const scheduleFor = a.scheduleFor ? new Date(a.scheduleFor) : null;
    if (scheduleFor && (Number.isNaN(scheduleFor.getTime()) || scheduleFor.getTime() < Date.now())) {
      throw new ToolError("scheduleFor must be a future ISO datetime.", "invalid_arguments");
    }
    const filters = {
      createdVia: "agent",
      createdByKey: ctx.key.name,
      aiGenerated: a.mode === "ai",
      preheader,
      projectCategory: a.projectCategory || "all",
      segments: a.segmentTags.length > 0 ? a.segmentTags.map((t) => `tag-${t}`) : undefined,
      aiContent: aiContent ?? undefined,
    };
    const recipients = await resolveCampaignRecipients({ targetAudience: a.audience, filters });
    const campaign = await db.emailCampaign.create({
      data: {
        name: a.name,
        subject,
        htmlContent,
        targetAudience: a.audience,
        status: scheduleFor ? "SCHEDULED" : "DRAFT",
        scheduledFor: scheduleFor,
        recipientCount: recipients.length,
        filters,
        createdBy: `agent:${ctx.key.name}`,
      },
      select: { id: true, status: true },
    });
    log.info({ campaignId: campaign.id, audience: a.audience, recipients: recipients.length, keyId: ctx.key.id }, "agent created email campaign");
    return {
      campaignId: campaign.id,
      status: campaign.status,
      subject,
      preheader,
      audience: a.audience,
      segmentTags: a.segmentTags,
      recipientCount: recipients.length,
      textPreview: htmlContent.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
      adminUrl: `${adminBase()}/admin/ai-marketing`,
      next: "Review with preview_email_campaign, send yourself a copy with send_email_campaign { testTo }, then send_email_campaign to the audience.",
    };
  },
});

defineTool({
  name: "preview_email_campaign",
  description: "Inspect a campaign before sending: subject, status, audience, live recipient count, stats so far, a text rendering of the body, and optionally the full HTML.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ campaignId: z.string(), includeHtml: z.boolean().default(false) }),
  handler: async (a) => {
    const c = await db.emailCampaign.findUnique({
      where: { id: a.campaignId },
      select: { id: true, name: true, subject: true, htmlContent: true, status: true, targetAudience: true, filters: true, scheduledFor: true, sentAt: true, recipientCount: true, sentCount: true, openCount: true, clickCount: true, bounceCount: true, unsubscribeCount: true, createdAt: true, createdBy: true },
    });
    if (!c) throw new ToolError(`No campaign ${a.campaignId}.`, "not_found", 404);
    const recipients = await resolveCampaignRecipients(c);
    const { htmlContent, ...rest } = c;
    return {
      ...rest,
      liveRecipientCount: recipients.length,
      sampleRecipients: recipients.slice(0, 5).map((r) => r.email),
      textPreview: htmlContent.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
      ...(a.includeHtml ? { html: htmlContent.slice(0, 60_000) } : {}),
    };
  },
});

defineTool({
  name: "send_email_campaign",
  description:
    "Send a campaign. With testTo, sends ONE copy to that address with a [TEST] subject and changes nothing else — do this first. Without testTo, queues the email to the whole audience (1/second from the queue) and marks the campaign SENT. resend allows sending a SENT campaign again. Always confirm the recipient count with the user before a real send.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    campaignId: z.string(),
    testTo: z.string().email().optional(),
    resend: z.boolean().default(false),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    if (a.testTo) {
      const res = await sendCampaignTest(a.campaignId, a.testTo);
      if (!res.ok) throw new ToolError(res.error || "Test send failed");
      return { test: true, sentTo: a.testTo };
    }
    const res = await sendCampaignNow(a.campaignId, { resend: a.resend });
    if (!res.ok) throw new ToolError(res.message, res.code, res.code === "not_found" ? 404 : 400);
    log.info({ campaignId: a.campaignId, queued: res.queued, keyId: ctx.key.id }, "agent sent email campaign");
    return { ...res, note: "Emails leave the queue at about one per second; opens and clicks show in email_campaigns." };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// The built-in AI marketing system
// ────────────────────────────────────────────────────────────────────────────

async function callAiRun(action: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ToolError("CRON_SECRET is not set on the server, so the AI service runner cannot be invoked.");
  // Same in-process invocation the AI-services cron uses: the route owns
  // the settings checks and writes the AiRunLog row.
  const req = new Request("http://internal/api/admin/ai-marketing/run", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}`, "x-agent-trigger": "1" },
    body: JSON.stringify({ action, params }),
  });
  const res = await runAiServiceRoute(req);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ToolError(String(data.error || `AI run ${action} failed (${res.status})`));
  return data;
}

const AI_ACTIONS = ["runAutomation", "runSegmentation", "runPredictiveAnalytics", "runSendTimeOptimization", "runAutoTagging", "runUserProfiling", "testEmailPersonalization", "testContentOptimization"] as const;

defineTool({
  name: "run_ai_service",
  description:
    "Run one of the built-in AI marketing services now, exactly as the Run Now buttons in Admin → AI Marketing do. runAutomation = the daily orchestrator (profiles, segments, plans and SENDS one campaign if eligible). runSegmentation, runPredictiveAnalytics, runSendTimeOptimization, runUserProfiling recompute scores. runAutoTagging tags untagged campaigns. The test* actions produce a sample without sending. Disabled services refuse with a message; enable them with update_ai_settings.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    action: z.enum(AI_ACTIONS),
    params: z.record(z.string(), z.unknown()).optional().describe("Optional per-action params, e.g. { limit: 20 } for runAutoTagging, { content, contentType } for testContentOptimization."),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const data = await callAiRun(a.action, a.params);
    log.info({ action: a.action, keyId: ctx.key.id, success: data.success }, "agent ran AI service");
    return data;
  },
});

defineTool({
  name: "ai_status",
  description: "Current state of the built-in AI marketing: feature toggles, limits, quiet hours, the standing directives, the last automated campaign and recent automated-campaign performance.",
  scope: SCOPE_AGENT_READ,
  input: z.object({}),
  handler: async () => {
    const settings = await getAISettings();
    let automation: Record<string, unknown> | null = null;
    try {
      automation = await callAiRun("getAutomationStatus");
    } catch {
      automation = null;
    }
    const lastRuns = await db.aiRunLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { serviceId: true, success: true, message: true, trigger: true, createdAt: true } });
    return { settings, automation, lastRuns };
  },
});

defineTool({
  name: "ai_run_history",
  description: "History of AI service runs (manual, cron and agent-triggered): service, success, summary message, duration.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ serviceId: z.string().optional(), limit: Limit(30, 200), offset: Offset }),
  handler: async (a) => ({
    runs: await db.aiRunLog.findMany({
      where: a.serviceId ? { serviceId: a.serviceId } : {},
      orderBy: { createdAt: "desc" },
      take: a.limit,
      skip: a.offset,
      select: { id: true, action: true, serviceId: true, success: true, message: true, trigger: true, durationMs: true, createdAt: true },
    }),
  }),
});

const TimeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");

defineTool({
  name: "update_ai_settings",
  description: "Turn AI marketing features on or off and set the volume limits. Only the fields you pass change. Takes effect within a minute (settings are cached per worker).",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    emailPersonalization: z.boolean().optional(),
    predictiveAnalytics: z.boolean().optional(),
    smartSegmentation: z.boolean().optional(),
    sendTimeOptimization: z.boolean().optional(),
    contentOptimization: z.boolean().optional(),
    abTesting: z.boolean().optional(),
    autoTagging: z.boolean().optional(),
    emailFrequencyCap: z.number().int().min(1).max(30).optional().describe("Max marketing emails per person per 14 days."),
    dailyEmailLimit: z.number().int().min(10).max(50_000).optional(),
    quietHoursStart: TimeHHMM.optional(),
    quietHoursEnd: TimeHHMM.optional(),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const map: Record<string, string> = {
      emailPersonalization: "aiEmailPersonalization", predictiveAnalytics: "aiPredictiveAnalytics", smartSegmentation: "aiSmartSegmentation",
      sendTimeOptimization: "aiSendTimeOptimization", contentOptimization: "aiContentOptimization", abTesting: "aiAbTesting", autoTagging: "aiAutoTagging",
      emailFrequencyCap: "aiEmailFrequencyCap", dailyEmailLimit: "aiDailyEmailLimit", quietHoursStart: "aiQuietHoursStart", quietHoursEnd: "aiQuietHoursEnd",
    };
    const data: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(map)) {
      const v = (a as Record<string, unknown>)[k];
      if (v !== undefined) data[col] = v;
    }
    if (Object.keys(data).length === 0) throw new ToolError("Nothing to change: pass at least one setting.", "invalid_arguments");
    const row = await db.platformSettings.findFirst({ select: { id: true } });
    if (!row) throw new ToolError("PlatformSettings row missing.");
    await db.platformSettings.update({ where: { id: row.id }, data });
    clearSettingsCache();
    log.info({ changed: Object.keys(data), keyId: ctx.key.id }, "agent updated AI settings");
    return { changed: data, settings: await getAISettings() };
  },
});

defineTool({
  name: "get_marketing_directives",
  description: "The standing plain-English instructions the marketing AI follows when it writes campaign emails, the creator newsletter, social posts and marketing copy.",
  scope: SCOPE_AGENT_READ,
  input: z.object({}),
  handler: async () => ({ directives: (await getAISettings()).marketingDirectives }),
});

defineTool({
  name: "set_marketing_directives",
  description:
    "Give the marketing AI standing instructions in plain English, e.g. 'This month lead with the Tech category', 'Always mention our Shopify store at indiecrowdfund.com/shop', 'No exclamation marks'. They are injected into every marketing prompt from then on. mode replace overwrites; append adds a line. Max 4000 characters.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({ directives: z.string().max(4000), mode: z.enum(["replace", "append"]).default("replace"), confirm: Confirm }),
  handler: async (a, ctx) => {
    const current = (await getAISettings()).marketingDirectives;
    const next = a.mode === "append" && current ? `${current}\n${a.directives.trim()}` : a.directives.trim();
    if (next.length > 4000) throw new ToolError("Directives would exceed 4000 characters; replace instead of append.", "invalid_arguments");
    const row = await db.platformSettings.findFirst({ select: { id: true } });
    if (!row) throw new ToolError("PlatformSettings row missing.");
    await db.platformSettings.update({ where: { id: row.id }, data: { aiMarketingDirectives: next || null } });
    clearSettingsCache();
    log.info({ length: next.length, mode: a.mode, keyId: ctx.key.id }, "agent set marketing directives");
    return { directives: next };
  },
});

defineTool({
  name: "smart_segments",
  description: "The AI's behaviour-based user segments (at-risk churners, high-value, new, dormant…) with sizes and characteristics. Computed live; takes a few seconds.",
  scope: SCOPE_AGENT_READ,
  input: z.object({}),
  handler: async () => {
    const segments = await generateSmartSegments();
    return { segments: segments.map((s) => ({ id: s.id, name: s.name, description: s.description, userCount: s.userCount, avgValue: s.avgValue, characteristics: s.characteristics })) };
  },
});

defineTool({
  name: "generate_marketing_copy",
  description: "Have the platform AI write marketing copy for one campaign: tagline, subtitle, email subject, X/Facebook/Instagram posts and a call to action. Nothing is published; it returns text for you to use.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ project: z.string().describe("Slug or id.") }),
  handler: async (a) => {
    const p = await findProject(a.project);
    const full = await db.project.findFirst({ where: { id: p.id }, select: { description: true, rewards: { where: { type: "TIER" }, orderBy: { amount: "asc" }, take: 5, select: { title: true, description: true, amount: true } } } });
    const copy = await generateMarketingCopy({
      title: p.title,
      description: full?.description || "",
      category: p.category,
      goalAmount: Number(p.goalAmount),
      rewards: (full?.rewards ?? []).map((r: { title: string; description: string; amount: unknown }) => ({ title: r.title, description: r.description, amount: Number(r.amount) })),
    });
    return { project: { slug: p.slug, title: p.title }, copy };
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Social publicist (X)
// ────────────────────────────────────────────────────────────────────────────

defineTool({
  name: "social_posts",
  description: "The AI publicist's queue for X: pending (awaiting approval), posted, failed and rejected posts with their text and the campaign they promote.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ status: z.array(z.enum(["PENDING", "APPROVED", "POSTED", "FAILED", "REJECTED"])).optional(), limit: Limit(25, 100) }),
  handler: async (a) => ({
    posts: await db.socialPost.findMany({
      where: a.status && a.status.length > 0 ? { status: { in: [...a.status] } } : {},
      orderBy: { createdAt: "desc" },
      take: a.limit,
      select: { id: true, platform: true, postType: true, status: true, content: true, imageUrl: true, projectId: true, externalId: true, postedAt: true, error: true, createdAt: true },
    }),
  }),
});

defineTool({
  name: "create_social_post",
  description: "Queue a hand-written post for the platform's X account. It waits as PENDING in Admin → Social Publicist until an admin approves it or you call publish_social_post. Keep under 280 characters including any URL.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({
    content: z.string().min(5).max(280),
    imageUrl: z.string().url().optional(),
    project: z.string().optional().describe("Slug or id of the campaign this promotes, if any."),
    confirm: Confirm,
  }),
  handler: async (a, ctx) => {
    const projectId = a.project ? (await findProject(a.project)).id : null;
    const post = await db.socialPost.create({
      data: {
        platform: "twitter",
        postType: "manual",
        dedupeKey: `twitter:manual:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        content: a.content,
        imageUrl: a.imageUrl ?? null,
        status: "PENDING",
      },
      select: { id: true, status: true, content: true },
    });
    log.info({ postId: post.id, keyId: ctx.key.id }, "agent queued social post");
    return { ...post, adminUrl: `${adminBase()}/admin/social-publicist` };
  },
});

defineTool({
  name: "publish_social_post",
  description: "Post a queued (PENDING or APPROVED) social post to X right now. Irreversible once posted.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({ postId: z.string(), confirm: Confirm }),
  handler: async (a, ctx) => {
    const post = await db.socialPost.findUnique({ where: { id: a.postId } });
    if (!post) throw new ToolError(`No social post ${a.postId}.`, "not_found", 404);
    if (post.status === "POSTED") throw new ToolError("Already posted.");
    if (post.status === "REJECTED") throw new ToolError("This post was rejected; an admin must set it back to pending first.");
    const creds = await getTwitterCredentials();
    if (!creds) throw new ToolError("X credentials are not configured (Admin Settings → Social).");
    const mediaIds: string[] = [];
    if (post.imageUrl) {
      try {
        const base = adminBase();
        const url = post.imageUrl.startsWith("/") ? `${base}${post.imageUrl}` : post.imageUrl;
        const res = await fetch(url);
        const contentType = res.headers.get("content-type") || "image/jpeg";
        if (res.ok && contentType.startsWith("image/")) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) mediaIds.push(await uploadTwitterMedia(creds, buffer, contentType));
        }
      } catch (err) {
        log.warn({ err: String(err), postId: post.id }, "social image upload failed; posting text only");
      }
    }
    try {
      const tweetId = await postTweet(creds, post.content, mediaIds.length ? mediaIds : undefined);
      await db.socialPost.update({ where: { id: post.id }, data: { status: "POSTED", externalId: tweetId, postedAt: new Date(), error: null } });
      log.info({ postId: post.id, tweetId, keyId: ctx.key.id }, "agent published social post");
      return { postId: post.id, status: "POSTED", tweetId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: msg.slice(0, 2000) } });
      throw new ToolError(`X rejected the post: ${msg.slice(0, 300)}`);
    }
  },
});

defineTool({
  name: "generate_social_posts",
  description: "Run the AI publicist's generation pass: find launches, milestones, ending-soon campaigns and the weekly roundup, write posts for them and queue them (respecting the approval setting). Idempotent.",
  scope: SCOPE_AGENT_WRITE,
  mutating: true,
  input: z.object({ confirm: Confirm }),
  handler: async () => generateSocialPosts(),
});
