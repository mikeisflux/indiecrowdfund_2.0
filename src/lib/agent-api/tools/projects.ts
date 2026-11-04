import { z } from "zod";
import { db } from "@/lib/db";
import { getBatchProjectStats } from "@/lib/stats";
import { defineTool, SCOPE_AGENT_READ } from "../registry";
import { DateRange, Limit, Offset, PROJECT_REF, findProject, money, parseRange, projectUrl, toCsv } from "../shared";

const PROJECT_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "LIVE", "PAUSED", "FUNDED", "FAILED", "CANCELLED"] as const;
const PLEDGE_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED", "CHARGEBACK"] as const;

defineTool({
  name: "platform_overview",
  description:
    "Platform-wide snapshot: live/funded/total campaigns, money raised and backers in the last 30 days and all time, new accounts, and the top categories. Start here for any 'how are we doing' question.",
  scope: SCOPE_AGENT_READ,
  input: z.object({}),
  handler: async () => {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [byStatus, raisedAll, raised30, backersAll, backers30, newUsers30, creators, categories] = await Promise.all([
      db.project.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { id: true } }),
      db.pledge.aggregate({ where: { status: "COMPLETED", deletedAt: null }, _sum: { amount: true }, _count: { id: true } }),
      db.pledge.aggregate({ where: { status: "COMPLETED", deletedAt: null, createdAt: { gte: since30 } }, _sum: { amount: true }, _count: { id: true } }),
      db.pledge.findMany({ where: { status: "COMPLETED", deletedAt: null }, distinct: ["userId"], select: { userId: true } }),
      db.pledge.findMany({ where: { status: "COMPLETED", deletedAt: null, createdAt: { gte: since30 } }, distinct: ["userId"], select: { userId: true } }),
      db.user.count({ where: { createdAt: { gte: since30 }, deletedAt: null } }),
      db.project.findMany({ where: { deletedAt: null, status: { in: ["LIVE", "FUNDED", "FAILED", "CANCELLED"] } }, distinct: ["creatorId"], select: { creatorId: true } }),
      db.project.groupBy({ by: ["category"], where: { deletedAt: null, status: { in: ["LIVE", "FUNDED"] } }, _count: { id: true }, _sum: { currentAmount: true } }),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const s of byStatus) statusCounts[s.status] = s._count.id;
    return {
      campaigns: statusCounts,
      allTime: { raised: money(raisedAll._sum.amount), pledges: raisedAll._count.id, uniqueBackers: backersAll.length, creatorsWhoLaunched: creators.length },
      last30Days: { raised: money(raised30._sum.amount), pledges: raised30._count.id, uniqueBackers: backers30.length, newAccounts: newUsers30 },
      topCategories: categories
        .map((c) => ({ category: c.category, liveOrFundedCampaigns: c._count.id, raised: money(c._sum.currentAmount) }))
        .sort((a, b) => b.raised - a.raised)
        .slice(0, 10),
    };
  },
});

defineTool({
  name: "list_projects",
  description:
    "List campaigns with live funding stats. Filter by status, category, creator email or a title search. Use this to find a campaign's slug before calling get_project or project_backers.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    status: z.array(z.enum(PROJECT_STATUSES)).optional().describe("Only these statuses. Default: LIVE and FUNDED."),
    category: z.string().optional().describe("Category slug, e.g. comics, tech."),
    creatorEmail: z.string().optional().describe("Only campaigns by this creator."),
    search: z.string().optional().describe("Case-insensitive match on title or subtitle."),
    sort: z.enum(["newest", "ending_soon", "most_funded", "most_backed", "recently_updated"]).default("newest"),
    limit: Limit(25, 100),
    offset: Offset,
  }),
  handler: async (a) => {
    const sorts = {
      newest: { createdAt: "desc" as const },
      ending_soon: { endDate: "asc" as const },
      most_funded: { currentAmount: "desc" as const },
      most_backed: { backerCount: "desc" as const },
      recently_updated: { updatedAt: "desc" as const },
    };
    const where = {
      deletedAt: null,
      status: { in: a.status && a.status.length > 0 ? [...a.status] : ["LIVE", "FUNDED"] },
      ...(a.category ? { category: a.category } : {}),
      ...(a.creatorEmail ? { creator: { email: { equals: a.creatorEmail, mode: "insensitive" as const } } } : {}),
      ...(a.search
        ? { OR: [{ title: { contains: a.search, mode: "insensitive" as const } }, { subtitle: { contains: a.search, mode: "insensitive" as const } }] }
        : {}),
    };
    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: sorts[a.sort],
        take: a.limit,
        skip: a.offset,
        select: {
          id: true, slug: true, title: true, status: true, category: true, subcategory: true, campaignType: true, paymentProcessor: true,
          goalAmount: true, currentAmount: true, backerCount: true, followerCount: true, launchDate: true, endDate: true, createdAt: true,
          creator: { select: { name: true, email: true, vanityUrl: true } },
        },
      }),
      db.project.count({ where }),
    ]);
    const stats = await getBatchProjectStats(projects.map((p) => ({ id: p.id, status: p.status, goalAmount: Number(p.goalAmount) })));
    return {
      total,
      projects: projects.map((p) => {
        const s = stats.get(p.id);
        const raised = s ? s.currentAmount : money(p.currentAmount);
        return {
          id: p.id,
          slug: p.slug,
          title: p.title,
          url: projectUrl(p),
          status: p.status,
          category: p.category,
          subcategory: p.subcategory,
          campaignType: p.campaignType,
          paymentProcessor: p.paymentProcessor,
          goal: money(p.goalAmount),
          raised,
          fundedPercent: Number(p.goalAmount) > 0 ? Math.round((raised / Number(p.goalAmount)) * 1000) / 10 : null,
          backers: s ? s.backerCount : p.backerCount,
          followers: p.followerCount,
          launchDate: p.launchDate,
          endDate: p.endDate,
          creator: { name: p.creator.name, email: p.creator.email },
        };
      }),
    };
  },
});

defineTool({
  name: "get_project",
  description:
    "Everything about one campaign: funding, dates, creator, reward tiers and add-ons with claimed counts, pledge status breakdown, update count, and a daily funding timeline. Pass the slug from the campaign URL.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    project: PROJECT_REF,
    timelineDays: z.number().int().min(0).max(365).default(60).describe("Days of daily pledge history to include (0 to skip)."),
  }),
  handler: async (a) => {
    const p = await findProject(a.project);
    const [rewards, pledgeStatus, updates, timeline] = await Promise.all([
      db.reward.findMany({
        where: { projectId: p.id },
        orderBy: [{ type: "asc" }, { amount: "asc" }],
        select: { id: true, type: true, title: true, amount: true, category: true, quantityAvailable: true, quantityClaimed: true, isEnded: true, shippingType: true, estimatedDelivery: true, unlockAtAmount: true },
      }),
      db.pledge.groupBy({ by: ["status"], where: { projectId: p.id, deletedAt: null }, _count: { id: true }, _sum: { amount: true } }),
      db.update.count({ where: { projectId: p.id, status: "PUBLISHED" } }),
      a.timelineDays > 0
        ? db.pledge.findMany({
            where: { projectId: p.id, status: "COMPLETED", deletedAt: null, createdAt: { gte: new Date(Date.now() - a.timelineDays * 86_400_000) } },
            select: { amount: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);
    const byDay = new Map<string, { pledges: number; amount: number }>();
    for (const row of timeline) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(day) ?? { pledges: 0, amount: 0 };
      cur.pledges += 1;
      cur.amount = money(cur.amount + Number(row.amount));
      byDay.set(day, cur);
    }
    const stats = await getBatchProjectStats([{ id: p.id, status: p.status, goalAmount: Number(p.goalAmount) }]);
    const s = stats.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      url: projectUrl(p),
      status: p.status,
      category: p.category,
      subcategory: p.subcategory,
      campaignType: p.campaignType,
      paymentProcessor: p.paymentProcessor,
      goal: money(p.goalAmount),
      raised: s ? s.currentAmount : money(p.currentAmount),
      backers: s ? s.backerCount : p.backerCount,
      followers: p.followerCount,
      launchDate: p.launchDate,
      endDate: p.endDate,
      preOrdersEnabled: p.preOrdersEnabled,
      staffPick: p.isStaffPick,
      creator: p.creator,
      publishedUpdates: updates,
      pledgesByStatus: pledgeStatus.map((r) => ({ status: r.status, count: r._count.id, amount: money(r._sum.amount) })),
      rewards: rewards.filter((r) => r.type === "TIER").map(rewardRow),
      addons: rewards.filter((r) => r.type === "ADDON").map(rewardRow),
      timeline: [...byDay.entries()].sort().map(([date, v]) => ({ date, ...v })),
    };
  },
});

function rewardRow(r: { id: string; title: string; amount: unknown; category: string | null; quantityAvailable: number | null; quantityClaimed: number; isEnded: boolean; shippingType: string; estimatedDelivery: Date | null; unlockAtAmount: unknown }) {
  return {
    id: r.id,
    title: r.title,
    price: money(r.amount),
    category: r.category,
    claimed: r.quantityClaimed,
    limit: r.quantityAvailable,
    remaining: r.quantityAvailable === null ? null : Math.max(0, r.quantityAvailable - r.quantityClaimed),
    ended: r.isEnded,
    shipping: r.shippingType,
    estimatedDelivery: r.estimatedDelivery,
    unlocksAt: r.unlockAtAmount === null ? null : money(r.unlockAtAmount),
  };
}

defineTool({
  name: "project_backers",
  description:
    "Backers of one campaign with what they pledged: name, email, amount, reward, add-ons, country, survey and fulfillment state. Addresses are only included when includeAddress is true. Returns CSV when format is csv.",
  scope: SCOPE_AGENT_READ,
  input: z.object({
    project: PROJECT_REF,
    status: z.array(z.enum(PLEDGE_STATUSES)).default(["COMPLETED"]).describe("Pledge statuses to include. Default COMPLETED only."),
    includeAddress: z.boolean().default(false).describe("Include the shipping address from the survey."),
    format: z.enum(["json", "csv"]).default("json"),
    limit: Limit(100, 1000),
    offset: Offset,
  }),
  handler: async (a) => {
    const p = await findProject(a.project);
    const where = { projectId: p.id, deletedAt: null, status: { in: [...a.status] } };
    const [pledges, total] = await Promise.all([
      db.pledge.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: a.limit,
        skip: a.offset,
        select: {
          id: true, backerNumber: true, status: true, amount: true, rewardAmount: true, addonsAmount: true, shippingAmount: true,
          surveyCompleted: true, fulfillmentStatus: true, shippingAddress: true, createdAt: true,
          user: { select: { name: true, email: true } },
          reward: { select: { title: true } },
          addons: { select: { quantity: true, addon: { select: { title: true } } } },
        },
      }),
      db.pledge.count({ where }),
    ]);
    const rows = pledges.map((pl) => {
      const addr = (pl.shippingAddress ?? null) as Record<string, string> | null;
      return {
        pledgeId: pl.id,
        backerNumber: pl.backerNumber,
        name: pl.user.name,
        email: pl.user.email,
        status: pl.status,
        amount: money(pl.amount),
        reward: pl.reward?.title ?? null,
        addons: pl.addons.map((x: { quantity: number; addon: { title: string } }) => (x.quantity > 1 ? `${x.quantity}x ${x.addon.title}` : x.addon.title)).join("; "),
        shippingPaid: money(pl.shippingAmount),
        country: addr?.country ?? null,
        surveyCompleted: pl.surveyCompleted,
        fulfillment: pl.fulfillmentStatus,
        backedAt: pl.createdAt,
        ...(a.includeAddress
          ? { address: addr ? [addr.name, addr.line1 || addr.address1, addr.line2 || addr.address2, addr.city, addr.state, addr.postalCode || addr.zip, addr.country].filter(Boolean).join(", ") : null }
          : {}),
      };
    });
    if (a.format === "csv") return { total, csv: toCsv(rows) };
    return { total, project: { slug: p.slug, title: p.title }, backers: rows };
  },
});

defineTool({
  name: "campaign_performance",
  description:
    "Money raised per campaign in a date window, with pledge count, unique backers, average pledge and refunds. Use for 'what did well this month' and comparisons between campaigns.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ ...DateRange, limit: Limit(50, 200) }),
  handler: async (a) => {
    const { from, to } = parseRange(a);
    const pledges = await db.pledge.findMany({
      where: { deletedAt: null, createdAt: { gte: from, lte: to }, status: { in: ["COMPLETED", "REFUNDED", "CHARGEBACK"] } },
      select: { projectId: true, userId: true, amount: true, status: true, project: { select: { slug: true, title: true, category: true, status: true } } },
    });
    const agg = new Map<string, { slug: string; title: string; category: string; status: string; raised: number; pledges: number; backers: Set<string>; refunded: number; refunds: number }>();
    for (const pl of pledges) {
      const cur =
        agg.get(pl.projectId) ??
        { slug: pl.project.slug, title: pl.project.title, category: pl.project.category, status: pl.project.status, raised: 0, pledges: 0, backers: new Set<string>(), refunded: 0, refunds: 0 };
      if (pl.status === "COMPLETED") {
        cur.raised += Number(pl.amount);
        cur.pledges += 1;
        cur.backers.add(pl.userId);
      } else {
        cur.refunded += Number(pl.amount);
        cur.refunds += 1;
      }
      agg.set(pl.projectId, cur);
    }
    const rows = [...agg.entries()]
      .map(([id, v]) => ({
        projectId: id, slug: v.slug, title: v.title, category: v.category, status: v.status,
        raised: money(v.raised), pledges: v.pledges, uniqueBackers: v.backers.size,
        averagePledge: v.pledges ? money(v.raised / v.pledges) : 0, refunds: v.refunds, refunded: money(v.refunded),
      }))
      .sort((x, y) => y.raised - x.raised)
      .slice(0, a.limit);
    return { from, to, campaigns: rows, totals: { raised: money(rows.reduce((s, r) => s + r.raised, 0)), pledges: rows.reduce((s, r) => s + r.pledges, 0) } };
  },
});

defineTool({
  name: "category_breakdown",
  description: "Campaigns launched, money raised and pledges per category in a date window. Good for deciding where outreach should focus.",
  scope: SCOPE_AGENT_READ,
  input: z.object(DateRange),
  handler: async (a) => {
    const { from, to } = parseRange(a, 90);
    const [launched, pledges] = await Promise.all([
      db.project.groupBy({ by: ["category"], where: { deletedAt: null, launchDate: { gte: from, lte: to } }, _count: { id: true } }),
      db.pledge.findMany({ where: { deletedAt: null, status: "COMPLETED", createdAt: { gte: from, lte: to } }, select: { amount: true, project: { select: { category: true } } } }),
    ]);
    const map = new Map<string, { launched: number; raised: number; pledges: number }>();
    for (const l of launched) map.set(l.category, { launched: l._count.id, raised: 0, pledges: 0 });
    for (const pl of pledges) {
      const cur = map.get(pl.project.category) ?? { launched: 0, raised: 0, pledges: 0 };
      cur.raised += Number(pl.amount);
      cur.pledges += 1;
      map.set(pl.project.category, cur);
    }
    return { from, to, categories: [...map.entries()].map(([category, v]) => ({ category, ...v, raised: money(v.raised) })).sort((x, y) => y.raised - x.raised) };
  },
});

defineTool({
  name: "project_updates",
  description: "A campaign's posted updates: title, status, publish date, likes and comment counts. Tells you how actively a creator is communicating with backers.",
  scope: SCOPE_AGENT_READ,
  input: z.object({ project: PROJECT_REF, limit: Limit(20, 100) }),
  handler: async (a) => {
    const p = await findProject(a.project);
    const updates = await db.update.findMany({
      where: { projectId: p.id },
      orderBy: { createdAt: "desc" },
      take: a.limit,
      select: { id: true, title: true, status: true, visibility: true, publishedAt: true, likes: true, commentsCount: true, createdAt: true },
    });
    return { project: { slug: p.slug, title: p.title }, updates };
  },
});
