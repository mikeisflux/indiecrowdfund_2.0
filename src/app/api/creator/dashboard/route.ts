import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorDashboardLogger = logger.child({ module: "creator-dashboard" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    // Validate days parameter - default 30, min 1, max 365
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30") || 30));

    // Get user role for conditional UI (e.g. hiding IndieKit 1.0 for non-super-admins)
    const currentUser = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    const userRole = currentUser?.role || "USER";

    // Get user's own projects
    const ownProjects = await db.project.findMany({
      where: {
        creatorId: session.user.id,
        deletedAt: null,
      },
      orderBy: [
        { status: "asc" }, // LIVE projects first
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        imageUrl: true,
        goalAmount: true,
        currentAmount: true,
        backerCount: true,
        endDate: true,
        launchDate: true,
        launchedAt: true,
        createdAt: true,
        creator: {
          select: {
            vanityUrl: true,
          },
        },
      },
    });

    // Get projects user is collaborating on (by userId or email)
    const userEmail = session.user.email?.toLowerCase();
    const collaborations = await db.projectCollaborator.findMany({
      where: {
        OR: [
          { userId: session.user.id, status: "ACCEPTED" },
          ...(userEmail ? [{ email: { equals: userEmail, mode: "insensitive" as const }, status: "ACCEPTED" as const }] : []),
        ],
      },
      select: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            imageUrl: true,
            goalAmount: true,
            currentAmount: true,
            backerCount: true,
            endDate: true,
            launchDate: true,
            launchedAt: true,
            createdAt: true,
            deletedAt: true,
            creator: {
              select: {
                vanityUrl: true,
              },
            },
          },
        },
      },
    });

    // Combine own projects and collaborated projects (avoiding duplicates and soft-deleted projects)
    const ownProjectIds = new Set(ownProjects.map(p => p.id));
    type ProjectType = typeof ownProjects[number];
    const collaboratedProjects = collaborations
      .filter((c: { project: ProjectType & { deletedAt: Date | null } }) => !c.project.deletedAt)
      .map((c: { project: ProjectType & { deletedAt: Date | null } }) => c.project)
      .filter((p: ProjectType) => !ownProjectIds.has(p.id));

    const projects = [...ownProjects, ...collaboratedProjects].sort((a, b) => {
      // LIVE projects first, then by createdAt desc
      if (a.status !== b.status) {
        return a.status === "LIVE" ? -1 : b.status === "LIVE" ? 1 : 0;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // If no projects, return empty dashboard
    if (projects.length === 0) {
      return NextResponse.json({
        projects: [],
        selectedProject: null,
        stats: null,
        fundingData: [],
        recentBackers: [],
        rewardStats: [],
        addonStats: [],
        skuStats: [],
        referrers: [],
      });
    }

    // Select project - use provided projectId only if it belongs to the user
    const projectIds = projects.map(p => p.id);
    const validatedProjectId = (projectId && projectIds.includes(projectId))
      ? projectId
      : projects.find(p => p.status === "LIVE")?.id || projects[0].id;

    const selectedProjectId = validatedProjectId;
    const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Fetch all dashboard data in parallel
    const [
      todayPledges,
      todayBackers,
      todayViews,
      yesterdayPledges,
      totalViews,
      weeklyViews,
      lastWeekViews,
      recentBackers,
      rewardStats,
      addonsList,
      dailyFunding,
      preWindowTotalAgg,
      referrerData,
      fulfillmentData,
      actualPledgeTotals,
    ] = await Promise.all([
      // Today's pledges amount. Counts both COMPLETED and PENDING so
      // AoN campaigns (which hold pledges in PENDING until goal) show
      // real numbers on the creator dashboard instead of $0.
      db.pledge.aggregate({
        where: {
          projectId: selectedProjectId,
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
        _sum: { amount: true },
      }),

      // Today's backer count
      db.pledge.count({
        where: {
          projectId: selectedProjectId,
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
      }),

      // Today's views
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: { gte: todayStart },
        },
      }),

      // Yesterday's pledges (for comparison)
      db.pledge.aggregate({
        where: {
          projectId: selectedProjectId,
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
          createdAt: {
            gte: new Date(todayStart.getTime() - 24 * 60 * 60 * 1000),
            lt: todayStart,
          },
        },
        _sum: { amount: true },
      }),

      // Total views in period
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: { gte: startDate },
        },
      }),

      // This week's views
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Last week's views (for comparison)
      db.userBehavior.count({
        where: {
          projectId: selectedProjectId,
          eventType: "PROJECT_VIEW",
          timestamp: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent backers with user info. Include PENDING so backers
      // on AoN / NMI campaigns (whose pledges are held in the vault
      // until the funded-cron fires) show up in the Recent Backers
      // panel during a live campaign, not just after success.
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          status: { in: ["COMPLETED", "PENDING", "CANCELLED", "REFUNDED"] },
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 500, // Increased limit for CSV export
        select: {
          id: true,
          status: true,
          amount: true,
          shippingAmount: true,
          createdAt: true,
          fulfillmentStatus: true,
          shippingAddress: true, // JSON field containing { name, line1, city, state, postalCode, country }
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          reward: {
            select: {
              id: true,
              title: true,
            },
          },
          addons: {
            select: {
              quantity: true,
              addon: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),

      // Reward statistics
      db.reward.findMany({
        where: {
          projectId: selectedProjectId,
          type: "TIER",
        },
        include: {
          _count: {
            select: {
              pledges: {
                // Count both COMPLETED and PENDING so PENDING NMI / AoN
                // pledges (held in the vault until campaign success)
                // show up on per-reward stats during a live campaign,
                // not just after the funded-cron fires.
                where: {
                  status: { in: ["COMPLETED", "PENDING"] },
                  deletedAt: null,
                },
              },
            },
          },
        },
        orderBy: { amount: "asc" },
      }),

      // All addons for this project (with performance stats)
      db.reward.findMany({
        where: {
          projectId: selectedProjectId,
          type: "ADDON",
        },
        select: {
          id: true,
          title: true,
          amount: true,
          quantityAvailable: true,
          quantityClaimed: true,
          selectedAddons: {
            where: {
              pledge: { status: { in: ["COMPLETED", "PENDING"] }, deletedAt: null },
            },
            select: {
              quantity: true,
              amount: true,
            },
          },
        },
        orderBy: { amount: "asc" },
      }),

      // Daily funding data for chart. Mirror the lib/stats widening:
      // COMPLETED OR (PENDING AND committed) — committed means
      // confirmationEmailSent (Stripe / PayPal / Whop / DC) OR
      // nmiCustomerVaultId set (NMI / Mentom Payments AoN). This
      // excludes abandoned-cart PENDING noise that would otherwise
      // inflate the chart with $0 / pre-checkout rows.
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          deletedAt: null,
          createdAt: { gte: startDate },
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
            { status: "PENDING", NOT: { nmiCustomerVaultId: null } },
          ],
        },
        select: {
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      // Pre-window total — sum of all committed pledges BEFORE the
      // chart's startDate. Used to seed `cumulative` so the running
      // line starts at the real campaign total, not 0. Without this,
      // an old AoN campaign with most pledges outside the visible
      // window plots a flat line at $0 even though the project has
      // raised real money.
      db.pledge.aggregate({
        where: {
          projectId: selectedProjectId,
          deletedAt: null,
          createdAt: { lt: startDate },
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
            { status: "PENDING", NOT: { nmiCustomerVaultId: null } },
          ],
        },
        _sum: { amount: true },
      }),

      // Referrer data
      db.referralTracker.findMany({
        where: {
          projectId: selectedProjectId,
          date: { gte: startDate },
        },
        orderBy: { pledgeAmount: "desc" },
      }),

      // Fulfillment data - all pledges with their rewards and addons
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
          deletedAt: null,
        },
        select: {
          id: true,
          fulfillmentStatus: true,
          reward: {
            select: {
              id: true,
              title: true,
              items: {
                select: {
                  id: true,
                  title: true,
                  projectItemId: true,
                  projectItem: {
                    select: { id: true, title: true, sku: true },
                  },
                },
              },
            },
          },
          addons: {
            select: {
              quantity: true,
              addon: {
                select: {
                  id: true,
                  title: true,
                  items: {
                    select: {
                      id: true,
                      title: true,
                      projectItemId: true,
                      projectItem: {
                        select: { id: true, title: true, sku: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Actual totals from COMPLETED + PENDING pledges. Was previously
      // COMPLETED-only, which zeroed out the dashboard headline cards
      // for AoN/NMI campaigns where every pledge sits in PENDING until
      // the cron runs at goal — making the dashboard look empty during
      // live campaigns. Project.currentAmount on the model already
      // includes PENDING, so this matches what's displayed elsewhere.
      db.pledge.aggregate({
        where: {
          projectId: selectedProjectId,
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Use actual completed pledge totals instead of stored project fields
    const actualCurrentAmount = Number(actualPledgeTotals._sum.amount || 0);
    const actualBackerCount = actualPledgeTotals._count;

    // Calculate days remaining
    let daysRemaining = 0;
    if (selectedProject.endDate) {
      daysRemaining = Math.max(0, Math.ceil(
        (new Date(selectedProject.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ));
    }

    // Calculate weekly growth
    const weeklyGrowth = lastWeekViews > 0
      ? ((weeklyViews - lastWeekViews) / lastWeekViews) * 100
      : weeklyViews > 0 ? 100 : 0;

    // Calculate conversion rate
    const conversionRate = totalViews > 0
      ? (actualBackerCount / totalViews) * 100
      : 0;

    // Calculate average pledge
    const avgPledge = actualBackerCount > 0
      ? actualCurrentAmount / actualBackerCount
      : 0;

    // Calculate today vs yesterday change
    const todayAmount = Number(todayPledges._sum.amount || 0);
    const yesterdayAmount = Number(yesterdayPledges._sum.amount || 0);
    const dailyChange = yesterdayAmount > 0
      ? ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100
      : todayAmount > 0 ? 100 : 0;

    // Process daily funding into chart format. `cumulative` is seeded
    // with the pre-window total so the running line starts at the
    // real campaign total at startDate, not $0 — important for old
    // AoN campaigns where most pledges happened before the visible
    // window.
    const fundingByDate = new Map<string, { amount: number; cumulative: number }>();
    let cumulative = Number(preWindowTotalAgg._sum.amount ?? 0);

    // Initialize all dates in range
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      fundingByDate.set(dateStr, { amount: 0, cumulative: 0 });
    }

    // Fill in actual pledge data
    dailyFunding.forEach((pledge) => {
      const dateStr = pledge.createdAt.toISOString().split("T")[0];
      const existing = fundingByDate.get(dateStr);
      if (existing) {
        existing.amount += Number(pledge.amount);
      }
    });

    // Calculate cumulative
    const fundingData: { date: string; amount: number; cumulative: number }[] = [];
    Array.from(fundingByDate.entries()).forEach(([date, data]) => {
      cumulative += data.amount;
      fundingData.push({
        date,
        amount: Math.round(data.amount * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      });
    });

    // Process reward stats
    // Total = reward price * backer count (not pledge.amount which includes addons/extras)
    const processedRewardStats = rewardStats.map((reward) => {
      const backerCount = reward._count.pledges;
      const rewardPrice = Number(reward.amount);
      const remaining = reward.quantityAvailable !== null
        ? reward.quantityAvailable - reward.quantityClaimed
        : null;

      return {
        id: reward.id,
        title: reward.title,
        amount: rewardPrice,
        backers: backerCount,
        total: Math.round(rewardPrice * backerCount * 100) / 100,
        remaining,
      };
    });

    // Process referrer data
    const referrerMap = new Map<string, { visits: number; pledges: number; amount: number }>();
    referrerData.forEach((r) => {
      const existing = referrerMap.get(r.referrer) || { visits: 0, pledges: 0, amount: 0 };
      existing.visits += r.visits;
      existing.pledges += r.pledges;
      existing.amount += Number(r.pledgeAmount);
      referrerMap.set(r.referrer, existing);
    });

    const totalReferrerVisits = Array.from(referrerMap.values()).reduce((sum, r) => sum + r.visits, 0);
    const processedReferrers = Array.from(referrerMap.entries())
      .map(([source, data]) => ({
        source,
        visits: data.visits,
        pledges: data.pledges,
        amount: Math.round(data.amount * 100) / 100,
        percentage: totalReferrerVisits > 0 ? Math.round((data.visits / totalReferrerVisits) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Process fulfillment data
    const totalBackers = fulfillmentData.length;
    const shippedBackers = fulfillmentData.filter(
      (p) => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED"
    ).length;
    const fulfillmentPercentage = totalBackers > 0 ? Math.round((shippedBackers / totalBackers) * 100) : 0;

    // Count items needed for fulfillment (from rewards and addons)
    // Key by projectItemId or item title to deduplicate items that appear in multiple reward tiers
    const itemCounts = new Map<string, { name: string; count: number; projectItemId: string | null; sku: string | null; inStock: boolean }>();
    // SKU-level aggregation: sums item qty across rewards + addons for every backer
    // (aftersales add-ons create new PledgeAddon rows, so they're included automatically)
    const skuCounts = new Map<string, { sku: string | null; name: string; quantity: number; backerIds: Set<string>; projectItemId: string | null }>();

    fulfillmentData.forEach((pledge) => {
      // Count items from reward tiers
      if (pledge.reward?.items) {
        pledge.reward.items.forEach((item: { id: string; title: string; projectItemId: string | null; projectItem?: { id: string; title: string; sku: string | null } | null }) => {
          const itemName = item.projectItem?.title || item.title;
          const itemKey = item.projectItemId
            ? `projectItem_${item.projectItemId}`
            : `itemTitle_${item.title}`;
          const existingItem = itemCounts.get(itemKey);
          if (existingItem) {
            existingItem.count += 1;
          } else {
            itemCounts.set(itemKey, { name: itemName, count: 1, projectItemId: item.projectItemId, sku: null, inStock: false });
          }

          const skuValue = item.projectItem?.sku?.trim() || null;
          const existingSku = skuCounts.get(itemKey);
          if (existingSku) {
            existingSku.quantity += 1;
            existingSku.backerIds.add(pledge.id);
          } else {
            skuCounts.set(itemKey, {
              sku: skuValue,
              name: itemName,
              quantity: 1,
              backerIds: new Set([pledge.id]),
              projectItemId: item.projectItemId,
            });
          }
        });
      }

      // Count items from addons (with quantity multiplier)
      pledge.addons?.forEach((pledgeAddon: { quantity: number; addon: { id: string; title: string; items?: { id: string; title: string; projectItemId: string | null; projectItem?: { id: string; title: string; sku: string | null } | null }[] } }) => {
        pledgeAddon.addon.items?.forEach((item) => {
          const itemName = item.projectItem?.title || item.title;
          const itemKey = item.projectItemId
            ? `projectItem_${item.projectItemId}`
            : `itemTitle_${item.title}`;
          const existingItem = itemCounts.get(itemKey);
          if (existingItem) {
            existingItem.count += pledgeAddon.quantity;
          } else {
            itemCounts.set(itemKey, { name: itemName, count: pledgeAddon.quantity, projectItemId: item.projectItemId, sku: null, inStock: false });
          }

          const skuValue = item.projectItem?.sku?.trim() || null;
          const existingSku = skuCounts.get(itemKey);
          if (existingSku) {
            existingSku.quantity += pledgeAddon.quantity;
            existingSku.backerIds.add(pledge.id);
          } else {
            skuCounts.set(itemKey, {
              sku: skuValue,
              name: itemName,
              quantity: pledgeAddon.quantity,
              backerIds: new Set([pledge.id]),
              projectItemId: item.projectItemId,
            });
          }
        });
      });
    });

    // Build SKU stats sorted by quantity sold desc
    const skuStats = Array.from(skuCounts.entries())
      .map(([key, s]) => ({
        id: key,
        projectItemId: s.projectItemId,
        sku: s.sku,
        name: s.name,
        quantity: s.quantity,
        backers: s.backerIds.size,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    // Convert to array and sort by count descending
    const fulfillmentItems = Array.from(itemCounts.values())
      .sort((a, b) => b.count - a.count);

    // Calculate production progress based on inStock items
    const totalItems = fulfillmentItems.length;
    const inStockItems = fulfillmentItems.filter((item) => item.inStock).length;
    const productionPercentage = totalItems > 0 ? Math.round((inStockItems / totalItems) * 100) : 0;

    const fulfillmentStats = {
      totalBackers,
      shippedBackers,
      fulfillmentPercentage,
      productionPercentage,
      inStockCount: inStockItems,
      totalItemTypes: totalItems,
      items: fulfillmentItems,
      statusBreakdown: {
        notStarted: fulfillmentData.filter((p) => p.fulfillmentStatus === "NOT_STARTED").length,
        inProgress: fulfillmentData.filter((p) => p.fulfillmentStatus === "IN_PROGRESS").length,
        shipped: fulfillmentData.filter((p) => p.fulfillmentStatus === "SHIPPED").length,
        delivered: fulfillmentData.filter((p) => p.fulfillmentStatus === "DELIVERED").length,
      },
    };

    // Process recent backers
    const processedBackers = recentBackers.map((pledge) => {
      const now = Date.now();
      const pledgeTime = pledge.createdAt.getTime();
      const diffMs = now - pledgeTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo: string;
      if (diffMins < 1) {
        timeAgo = "just now";
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      } else {
        timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      }

      // Format addons as a string list for display
      const addonsDisplay = pledge.addons?.map((a: { quantity: number; addon: { id: string; title: string } }) =>
        a.quantity > 1 ? `${a.addon.title} (x${a.quantity})` : a.addon.title
      ).join(", ") || "";

      // Create addon map for CSV export (addonId -> quantity)
      const addonsMap: Record<string, number> = {};
      pledge.addons?.forEach((a: { quantity: number; addon: { id: string; title: string } }) => {
        addonsMap[a.addon.id] = a.quantity;
      });

      // Parse shipping address from JSON field
      const shippingData = pledge.shippingAddress as { line1?: string; city?: string; state?: string; country?: string } | null;

      return {
        id: pledge.id,
        status: pledge.status,
        fulfillmentStatus: pledge.fulfillmentStatus || "NOT_STARTED",
        userId: pledge.user.id,
        name: pledge.user.name || "Anonymous",
        email: pledge.user.email,
        image: pledge.user.image,
        amount: Number(pledge.amount),
        shippingAmount: Number(pledge.shippingAmount || 0),
        shippingAddress: shippingData?.line1 || "",
        shippingCity: shippingData?.city || "",
        shippingState: shippingData?.state || "",
        shippingCountry: shippingData?.country || "",
        rewardId: pledge.reward?.id || null,
        reward: pledge.reward?.title || "No Reward",
        addons: addonsDisplay,
        addonsMap,
        time: timeAgo,
      };
    });

    // Helper to build project URL with vanity URL if available
    const buildProjectUrl = (slug: string, projectCreatorVanityUrl: string | null) => {
      return projectCreatorVanityUrl
        ? `/projects/${projectCreatorVanityUrl}/${slug}`
        : `/projects/${slug}`;
    };

    return NextResponse.json({
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        imageUrl: p.imageUrl,
        projectUrl: buildProjectUrl(p.slug, p.creator?.vanityUrl || null),
      })),
      selectedProject: {
        id: selectedProject.id,
        title: selectedProject.title,
        slug: selectedProject.slug,
        status: selectedProject.status,
        imageUrl: selectedProject.imageUrl,
        goalAmount: Number(selectedProject.goalAmount),
        currentAmount: actualCurrentAmount,
        backerCount: actualBackerCount,
        daysRemaining,
        endDate: selectedProject.endDate,
        launchedAt: selectedProject.launchedAt,
        projectUrl: buildProjectUrl(selectedProject.slug, selectedProject.creator?.vanityUrl || null),
      },
      stats: {
        todayPledges: Math.round(todayAmount * 100) / 100,
        todayBackers,
        todayViews,
        weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgPledge: Math.round(avgPledge * 100) / 100,
        dailyChange: Math.round(dailyChange * 10) / 10,
      },
      fundingData,
      recentBackers: processedBackers,
      rewardStats: processedRewardStats,
      // All rewards for CSV column headers
      allRewards: rewardStats.map((r) => ({ id: r.id, title: r.title })),
      // All addons for CSV column headers
      allAddons: addonsList.map((a) => ({ id: a.id, title: a.title })),
      // Addon performance stats
      addonStats: addonsList.map((addon) => {
        const totalQuantity = addon.selectedAddons.reduce((sum: number, pa: { quantity: number; amount: unknown }) => sum + pa.quantity, 0);
        const totalRevenue = addon.selectedAddons.reduce((sum: number, pa: { quantity: number; amount: unknown }) => sum + Number(pa.amount), 0);
        const uniqueBackers = addon.selectedAddons.length;
        const remaining = addon.quantityAvailable !== null
          ? addon.quantityAvailable - addon.quantityClaimed
          : null;
        return {
          id: addon.id,
          title: addon.title,
          amount: Number(addon.amount),
          backers: uniqueBackers,
          quantity: totalQuantity,
          total: Math.round(totalRevenue * 100) / 100,
          remaining,
        };
      }),
      referrers: processedReferrers,
      productionOrderStats: fulfillmentStats,
      skuStats,
      userRole,
    });
  } catch (error) {
    creatorDashboardLogger.error({ err: String(error) }, "Creator dashboard error:");
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
