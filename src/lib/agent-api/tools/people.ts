import { z } from "zod";
import { db } from "@/lib/db";
import { defineTool, SCOPE_AGENT_READ, ToolError } from "../registry";
import { Limit, Offset, findUserByEmail, money, toCsv } from "../shared";

defineTool({
  name: "find_user",
  description:
    "Look up accounts by exact email or a name/email search. Returns role, join date, pledge count and total, campaigns created, and whether they've unsubscribed. Use user_pledges or user_email_history for the detail.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    email: z.string().optional().describe("Exact email (case-insensitive)."),
    search: z.string().optional().describe("Partial match on name or email."),
    limit: Limit(10, 50),
  }),
  handler: async (a) => {
    if (!a.email && !a.search) throw new ToolError("Pass email or search.", "invalid_arguments");
    const users = await db.user.findMany({
      where: a.email
        ? { email: { equals: a.email.trim(), mode: "insensitive" } }
        : { OR: [{ email: { contains: a.search!, mode: "insensitive" } }, { name: { contains: a.search!, mode: "insensitive" } }] },
      take: a.limit,
      select: {
        id: true, email: true, name: true, role: true, createdAt: true, deletedAt: true, emailUnsubscribedAt: true, vanityUrl: true, emailVerified: true,
        _count: { select: { pledges: true, createdProjects: true } },
      },
    });
    const totals = await db.pledge.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((u) => u.id) }, status: "COMPLETED", deletedAt: null },
      _sum: { amount: true },
      _count: { id: true },
      _max: { createdAt: true },
    });
    const totalMap = new Map(totals.map((t) => [t.userId, t]));
    return {
      users: users.map((u) => {
        const t = totalMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          joined: u.createdAt,
          deleted: !!u.deletedAt,
          emailVerified: !!u.emailVerified,
          unsubscribed: !!u.emailUnsubscribedAt,
          vanityUrl: u.vanityUrl,
          pledges: { all: u._count.pledges, completed: t?._count.id ?? 0, totalPledged: money(t?._sum.amount), lastPledgeAt: t?._max.createdAt ?? null },
          campaignsCreated: u._count.createdProjects,
        };
      }),
    };
  },
});

defineTool({
  name: "user_pledges",
  description: "Every pledge by one backer, with campaign, amount, status, reward, survey and fulfillment state. Newest first.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ email: z.string().describe("The backer's account email."), limit: Limit(50, 200) }),
  handler: async (a) => {
    const user = await findUserByEmail(a.email);
    const pledges = await db.pledge.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: a.limit,
      select: {
        id: true, status: true, amount: true, shippingAmount: true, paymentProcessor: true, backerNumber: true, surveyCompleted: true, fulfillmentStatus: true, createdAt: true, lastFailureReason: true,
        project: { select: { slug: true, title: true, status: true } },
        reward: { select: { title: true } },
        addons: { select: { quantity: true, addon: { select: { title: true } } } },
      },
    });
    return {
      user: { id: user.id, email: user.email, name: user.name },
      pledges: pledges.map((p) => ({
        id: p.id,
        campaign: p.project.title,
        slug: p.project.slug,
        campaignStatus: p.project.status,
        status: p.status,
        amount: money(p.amount),
        shipping: money(p.shippingAmount),
        processor: p.paymentProcessor,
        backerNumber: p.backerNumber,
        reward: p.reward?.title ?? null,
        addons: p.addons.map((x: { quantity: number; addon: { title: string } }) => (x.quantity > 1 ? `${x.quantity}x ${x.addon.title}` : x.addon.title)),
        surveyCompleted: p.surveyCompleted,
        fulfillment: p.fulfillmentStatus,
        failureReason: p.lastFailureReason,
        backedAt: p.createdAt,
      })),
    };
  },
});

const SEGMENTS = ["lapsed", "repeat", "top_spenders", "category_fans", "project_backers", "creator_backers", "new_backers"] as const;

defineTool({
  name: "backer_segments",
  description:
    "Build an outreach list of backers. Segments: lapsed (haven't pledged in N days), repeat (at least N completed pledges), top_spenders, category_fans (backed campaigns in a category), project_backers (backed one campaign), creator_backers (backed any campaign by a creator), new_backers (first pledge within N days). Unsubscribed and deleted accounts are excluded unless includeUnsubscribed is true. Returns email, name, pledge count, total, last pledge and categories; CSV when format is csv.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    segment: z.enum(SEGMENTS),
    days: z.number().int().min(1).max(3650).default(90).describe("Window for lapsed / new_backers."),
    minPledges: z.number().int().min(1).max(100).default(2).describe("Threshold for repeat; minimum for every other segment is 1."),
    category: z.string().optional().describe("For category_fans."),
    project: z.string().optional().describe("Slug or id, for project_backers."),
    creatorEmail: z.string().optional().describe("For creator_backers."),
    includeUnsubscribed: z.boolean().default(false),
    format: z.enum(["json", "csv"]).default("json"),
    limit: Limit(200, 2000),
    offset: Offset,
  }),
  handler: async (a) => {
    const now = Date.now();
    const cutoff = new Date(now - a.days * 86_400_000);

    let projectFilter: { projectId?: { in: string[] } | string } = {};
    if (a.segment === "category_fans") {
      if (!a.category) throw new ToolError("category is required for category_fans.", "invalid_arguments");
      const ids = await db.project.findMany({ where: { deletedAt: null, category: a.category }, select: { id: true } });
      projectFilter = { projectId: { in: ids.map((p) => p.id) } };
    } else if (a.segment === "project_backers") {
      if (!a.project) throw new ToolError("project is required for project_backers.", "invalid_arguments");
      const p = await db.project.findFirst({ where: { deletedAt: null, OR: [{ slug: a.project }, { id: a.project }] }, select: { id: true } });
      if (!p) throw new ToolError(`No project matches "${a.project}".`, "not_found", 404);
      projectFilter = { projectId: p.id };
    } else if (a.segment === "creator_backers") {
      if (!a.creatorEmail) throw new ToolError("creatorEmail is required for creator_backers.", "invalid_arguments");
      const ids = await db.project.findMany({ where: { deletedAt: null, creator: { email: { equals: a.creatorEmail, mode: "insensitive" } } }, select: { id: true } });
      projectFilter = { projectId: { in: ids.map((p) => p.id) } };
    }

    // One pass over completed pledges, grouped per backer. The platform's
    // pledge table is small enough for this to be a single indexed read.
    const grouped = await db.pledge.groupBy({
      by: ["userId"],
      where: { status: "COMPLETED", deletedAt: null, ...projectFilter },
      _count: { id: true },
      _sum: { amount: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    let picked = grouped;
    if (a.segment === "lapsed") picked = grouped.filter((g) => g._max.createdAt && g._max.createdAt < cutoff);
    if (a.segment === "new_backers") picked = grouped.filter((g) => g._min.createdAt && g._min.createdAt >= cutoff);
    if (a.segment === "repeat") picked = grouped.filter((g) => g._count.id >= a.minPledges);
    picked.sort((x, y) => (a.segment === "top_spenders" ? Number(y._sum.amount) - Number(x._sum.amount) : (y._max.createdAt?.getTime() ?? 0) - (x._max.createdAt?.getTime() ?? 0)));

    const totalMatched = picked.length;
    const page = picked.slice(a.offset, a.offset + a.limit);
    const users = await db.user.findMany({
      where: { id: { in: page.map((g) => g.userId) }, deletedAt: null, ...(a.includeUnsubscribed ? {} : { emailUnsubscribedAt: null }) },
      select: { id: true, email: true, name: true, emailUnsubscribedAt: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const cats = await db.pledge.findMany({
      where: { userId: { in: users.map((u) => u.id) }, status: "COMPLETED", deletedAt: null },
      select: { userId: true, project: { select: { category: true } } },
    });
    const catMap = new Map<string, Set<string>>();
    for (const c of cats) {
      const set = catMap.get(c.userId) ?? new Set<string>();
      set.add(c.project.category);
      catMap.set(c.userId, set);
    }

    const rows = page
      .filter((g) => userMap.has(g.userId))
      .map((g) => {
        const u = userMap.get(g.userId)!;
        return {
          email: u.email,
          name: u.name,
          pledges: g._count.id,
          totalPledged: money(g._sum.amount),
          firstPledgeAt: g._min.createdAt,
          lastPledgeAt: g._max.createdAt,
          categories: [...(catMap.get(g.userId) ?? [])].join("; "),
          unsubscribed: !!u.emailUnsubscribedAt,
        };
      });

    if (a.format === "csv") return { segment: a.segment, totalMatched, returned: rows.length, csv: toCsv(rows) };
    return { segment: a.segment, totalMatched, returned: rows.length, backers: rows };
  },
});

const STAGES = ["drafts", "submitted", "approved_not_launched", "live", "ended", "never_created"] as const;

defineTool({
  name: "creator_pipeline",
  description:
    "Creators by where their campaign is stuck: drafts (started but never submitted), submitted (waiting on review), approved_not_launched, live, ended, or never_created (CREATOR role with no campaign at all). For nudging creators toward launch.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    stage: z.enum(STAGES),
    inactiveDays: z.number().int().min(0).max(3650).default(0).describe("Only include campaigns not touched for at least this many days."),
    limit: Limit(50, 500),
    offset: Offset,
  }),
  handler: async (a) => {
    const staleBefore = a.inactiveDays > 0 ? new Date(Date.now() - a.inactiveDays * 86_400_000) : null;
    if (a.stage === "never_created") {
      const where = { deletedAt: null, role: "CREATOR" as const, createdProjects: { none: {} }, ...(staleBefore ? { updatedAt: { lt: staleBefore } } : {}) };
      const [users, total] = await Promise.all([
        db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: a.limit, skip: a.offset, select: { email: true, name: true, createdAt: true, emailUnsubscribedAt: true } }),
        db.user.count({ where }),
      ]);
      return { stage: a.stage, total, creators: users.map((u) => ({ email: u.email, name: u.name, joined: u.createdAt, unsubscribed: !!u.emailUnsubscribedAt })) };
    }
    const statusFor = {
      drafts: ["DRAFT"], submitted: ["SUBMITTED"], approved_not_launched: ["APPROVED"], live: ["LIVE"], ended: ["FUNDED", "FAILED", "CANCELLED"],
    } as const;
    const where = { deletedAt: null, status: { in: [...statusFor[a.stage]] }, ...(staleBefore ? { updatedAt: { lt: staleBefore } } : {}) };
    const [projects, total] = await Promise.all([
      db.project.findMany({
        where, orderBy: { updatedAt: "desc" }, take: a.limit, skip: a.offset,
        select: { slug: true, title: true, status: true, category: true, goalAmount: true, currentAmount: true, createdAt: true, updatedAt: true, launchDate: true, endDate: true, creator: { select: { email: true, name: true, emailUnsubscribedAt: true } } },
      }),
      db.project.count({ where }),
    ]);
    return {
      stage: a.stage,
      total,
      campaigns: projects.map((p) => ({
        slug: p.slug, title: p.title, status: p.status, category: p.category, goal: money(p.goalAmount), raised: money(p.currentAmount),
        createdAt: p.createdAt, lastTouched: p.updatedAt, launchDate: p.launchDate, endDate: p.endDate,
        creator: { email: p.creator.email, name: p.creator.name, unsubscribed: !!p.creator.emailUnsubscribedAt },
      })),
    };
  },
});
