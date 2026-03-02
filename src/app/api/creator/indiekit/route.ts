import { NextRequest, NextResponse } from "next/server";
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

    // Get user role and check if they have at least one approved prelaunch page or campaign
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    const userRole = user?.role || "USER";

    const approvedProjectCount = await db.project.count({
      where: {
        creatorId: session.user.id,
        deletedAt: null,
        OR: [
          { status: { in: ["APPROVED", "LIVE", "FUNDED"] } },
          { prelaunchStatus: "APPROVED" },
        ],
      },
    });
    const hasApprovedProject = approvedProjectCount > 0;

    // Get user's own projects that are funded/completed (eligible for fulfillment)
    // Also include DRAFT projects with prelaunchActive=true
    const ownProjects = await db.project.findMany({
      where: {
        creatorId: session.user.id,
        OR: [
          { status: { in: ["FUNDED", "LIVE"] } },
          { status: "DRAFT", prelaunchActive: true },
        ],
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        currentAmount: true,
        backerCount: true,
        prelaunchActive: true,
        imageUrl: true,
        creator: {
          select: { vanityUrl: true },
        },
      },
    });

    // Get collaborated projects
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
            currentAmount: true,
            backerCount: true,
            imageUrl: true,
            creator: {
              select: { vanityUrl: true },
            },
          },
        },
      },
    });

    // Combine projects
    const ownProjectIds = new Set(ownProjects.map(p => p.id));
    type ProjectType = typeof ownProjects[number];
    const collaboratedProjects = collaborations
      .map((c: { project: ProjectType }) => c.project)
      .filter((p: ProjectType) => !ownProjectIds.has(p.id));

    const projects = [...ownProjects, ...collaboratedProjects];

    if (projects.length === 0) {
      return NextResponse.json({
        projects: [],
        stats: null,
        backers: [],
        packageGroups: [],
        digitalFiles: [],
        distributionRules: [],
        emailCampaigns: [],
        workflowState: null,
      });
    }

    // Select project
    const selectedProjectId = projectId || projects[0].id;
    const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

    // Compute post-campaign sales across creator projects that have ENDED (FUNDED status)
    // Post-campaign = add-ons purchased via IndieKit survey after the campaign closed
    // LIVE projects are still in their funding period and should NOT be included
    // Tracked in pledge.metadata.completedAdditionalItems array
    const endedProjectIds = projects
      .filter(p => p.status === "FUNDED")
      .map(p => p.id);
    const postCampaignPledges = endedProjectIds.length > 0 ? await db.pledge.findMany({
      where: {
        projectId: { in: endedProjectIds },
        status: "COMPLETED",
        metadata: {
          path: ["completedAdditionalItems"],
          not: { equals: null },
        },
      },
      select: {
        projectId: true,
        metadata: true,
      },
    }) : [];

    // Sum up post-campaign sales per project
    const postCampaignByProject = new Map<string, number>();
    let postCampaignTotal = 0;

    for (const pledge of postCampaignPledges) {
      const meta = pledge.metadata as Record<string, unknown> | null;
      const completedItems = (meta?.completedAdditionalItems as Array<{ amount?: number }>) || [];
      for (const item of completedItems) {
        const amount = Number(item.amount || 0);
        if (amount > 0) {
          postCampaignTotal += amount;
          postCampaignByProject.set(
            pledge.projectId,
            (postCampaignByProject.get(pledge.projectId) || 0) + amount
          );
        }
      }
    }

    // Build per-project breakdown for the chart
    const postCampaignPerProject = projects
      .map(p => ({
        projectId: p.id,
        projectTitle: p.title,
        amount: postCampaignByProject.get(p.id) || 0,
      }))
      .filter(p => p.amount > 0);

    // Fetch all IndieKit data in parallel
    const [
      pledges,
      survey,
      surveyResponses,
      addOnSales,
      segments,
      products,
      recentActivity,
      digitalFilesData,
      distributionRulesData,
      emailCampaignsData,
      emailMemberCount,
      projectRewards,
      projectAddons,
    ] = await Promise.all([
      // Get all COMPLETED pledges for the project with user info
      // Only show completed pledges - pending ones are incomplete transactions
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          status: "COMPLETED",
        },
        include: {
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
              amount: true,
              shippingType: true,
              shippingCost: true,
            },
          },
          addons: {
            include: {
              addon: {
                select: {
                  id: true,
                  title: true,
                  amount: true,
                  isModifier: true,
                  shippingType: true,
                  shippingCost: true,
                },
              },
            },
          },
          modifierAssignments: {
            select: {
              id: true,
              rewardId: true,
              modifierAddonId: true,
              isAutoAssigned: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Get survey for this project
      db.survey.findUnique({
        where: { projectId: selectedProjectId },
        include: {
          itemQuestions: {
            include: {
              variants: true,
              customQuestions: true,
            },
          },
          backerQuestions: true,
        },
      }),

      // Get survey responses
      db.surveyResponse.findMany({
        where: {
          survey: {
            projectId: selectedProjectId,
          },
        },
        include: {
          survey: true,
        },
      }),

      // Calculate add-on sales total and counts
      db.pledgeAddon.aggregate({
        where: {
          pledge: {
            projectId: selectedProjectId,
            status: "COMPLETED",
          },
        },
        _sum: { amount: true, quantity: true },
        _count: true,
      }),

      // Get segments for this project
      db.backerSegment.findMany({
        where: { projectId: selectedProjectId },
        orderBy: { createdAt: "desc" },
      }),

      // Get products for this project
      db.fulfillmentProduct.findMany({
        where: { projectId: selectedProjectId },
        orderBy: { createdAt: "desc" },
      }),

      // Get recent activity
      db.fulfillmentActivity.findMany({
        where: { projectId: selectedProjectId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // Get digital files
      db.digitalFile.findMany({
        where: { projectId: selectedProjectId },
        include: {
          distributions: true,
        },
        orderBy: { createdAt: "desc" },
      }),

      // Get distribution rules (wrapped in catch to handle missing table before migration)
      db.distributionRule.findMany({
        where: { projectId: selectedProjectId },
        include: {
          digitalFile: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }).catch(() => []),

      // Get email campaigns - either created by this user OR associated with the selected project
      db.emailCampaign.findMany({
        where: {
          OR: [
            { createdBy: session.user.id },
            {
              filters: {
                path: ["projectId"],
                equals: selectedProjectId,
              },
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // Get email list member count for this creator (using EmailListSubscriber table)
      db.emailListSubscriber.count({
        where: {
          creatorId: session.user.id,
          status: "subscribed",
        },
      }),

      // Get rewards for this project (type: TIER)
      db.reward.findMany({
        where: { projectId: selectedProjectId, type: "TIER" },
        select: { id: true, title: true, amount: true },
        orderBy: { amount: "asc" },
      }),

      // Get addons for this project (type: ADDON) - include all for admin view
      db.reward.findMany({
        where: { projectId: selectedProjectId, type: "ADDON" },
        select: {
          id: true,
          title: true,
          description: true,
          amount: true,
          imageUrl: true,
          quantityAvailable: true,
          quantityClaimed: true,
          isEnded: true,
          visibility: true,
          showInSurvey: true,
        },
        orderBy: { amount: "asc" },
      }),
    ]);

    // Build survey response map for quick lookup
    const surveyResponseMap = new Map(
      surveyResponses.map(sr => [sr.pledgeId, sr])
    );

    // Calculate stats
    const totalBackers = pledges.filter(p => p.status === "COMPLETED").length;
    const surveysCompleted = surveyResponses.filter(sr => sr.isComplete).length;
    const surveysPending = totalBackers - surveysCompleted;

    // Count fulfilled backers (those with shipped status in fulfillmentStatus)
    const fulfilledBackers = pledges.filter(
      p => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED"
    ).length;

    // Count packages shipped
    const packagesShipped = pledges.filter(
      p => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED"
    ).length;

    // Count digital downloads distributed
    const digitalDownloads = surveyResponses.filter(sr => sr.isComplete).length;

    // Calculate pledge level breakdown
    const pledgeLevelCounts = new Map<string, number>();
    pledges.filter(p => p.status === "COMPLETED").forEach(pledge => {
      const level = pledge.reward?.title || "No Reward";
      pledgeLevelCounts.set(level, (pledgeLevelCounts.get(level) || 0) + 1);
    });
    const pledgeLevelBreakdown = Array.from(pledgeLevelCounts.entries())
      .map(([label, count]) => ({
        label,
        count,
        percentage: totalBackers > 0 ? Math.round((count / totalBackers) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate survey status breakdown
    const surveyStatusBreakdown = [
      {
        label: "Completed",
        count: surveysCompleted,
        percentage: totalBackers > 0 ? Math.round((surveysCompleted / totalBackers) * 100) : 0,
        color: "bg-green-500",
      },
      {
        label: "Pending",
        count: surveysPending,
        percentage: totalBackers > 0 ? Math.round((surveysPending / totalBackers) * 100) : 0,
        color: "bg-yellow-500",
      },
    ];

    // Calculate shipping region breakdown
    const regionCounts = new Map<string, number>();
    surveyResponses.forEach(sr => {
      const address = sr.shippingAddress as { country?: string } | null;
      const country = address?.country || "Unknown";
      regionCounts.set(country, (regionCounts.get(country) || 0) + 1);
    });
    const shippingRegionBreakdown = Array.from(regionCounts.entries())
      .map(([label, count]) => ({
        label,
        count,
        percentage: surveyResponses.length > 0 ? Math.round((count / surveyResponses.length) * 100) : 0,
        color: "bg-teal-500",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 regions

    // Payment status breakdown - we only fetch COMPLETED pledges now
    // so all pledges shown are successful payments
    const totalPledges = pledges.length;
    const paymentStatusBreakdown = [
      { label: "Completed", count: totalPledges, percentage: 100, color: "bg-green-500" },
    ];

    // Pre-order count
    const preOrderBackers = pledges.filter(p => p.isPreOrder).length;

    // Calculate balance due per pledge for post-campaign charge tracking
    // Balance due is stored in metadata.balanceDue when orders are edited via IndieKit
    // Falls back to computed values from related reward/addon data
    const pledgesWithBalance = pledges.map(p => {
      const meta = (p.metadata as Record<string, unknown>) || {};
      const storedBalanceDue = meta.balanceDue != null ? Number(meta.balanceDue) : null;
      if (storedBalanceDue !== null) {
        return { ...p, balanceDue: Math.round(storedBalanceDue * 100) / 100 };
      }
      // Compute from actual related data
      const pledgeTotal = Number(p.amount);
      const computedRewardAmt = p.reward ? Number(p.reward.amount) : 0;
      const computedAddonsAmt = p.addons.reduce((sum: number, a: { amount: unknown }) => sum + Number(a.amount || 0), 0);
      // Shipping from reward + addon per-country rates
      const sr = surveyResponseMap.get(p.id);
      const country = (sr?.shippingAddress as Record<string, string> | null)?.country || "";
      let computedShipping = 0;
      if (p.reward && (p.reward as { shippingType?: string }).shippingType !== "NO_SHIPPING" && country) {
        const rates = ((p.reward as { shippingCost?: unknown }).shippingCost as Record<string, number>) || {};
        computedShipping += Number(rates[country] || 0);
      }
      for (const pa of p.addons) {
        const addonRec = pa as { addon: { shippingType?: string; shippingCost?: unknown }; quantity: number };
        if (addonRec.addon.shippingType && addonRec.addon.shippingType !== "NO_SHIPPING" && country) {
          const rates = (addonRec.addon.shippingCost as Record<string, number>) || {};
          computedShipping += Number(rates[country] || 0) * addonRec.quantity;
        }
      }
      const expectedTotal = computedRewardAmt + computedAddonsAmt + computedShipping;
      const balanceDue = Math.round((expectedTotal - pledgeTotal) * 100) / 100;
      return { ...p, balanceDue };
    });

    // Post-survey addon revenue = sum of positive balance due amounts only
    // This represents money owed from post-campaign order edits (addon additions, shipping changes)
    const backersWithBalanceDue = pledgesWithBalance.filter(p => p.balanceDue > 0);
    const postSurveyAddonRevenue = backersWithBalanceDue.reduce((sum, p) => sum + p.balanceDue, 0);

    // Calculate charge stats for workflow
    // "Charge Cards" is for ADDITIONAL charges (add-ons added via survey, shipping upgrades, etc.)
    // NOT for initial pledge payments - those are already collected when status is COMPLETED
    const statsChargeStats = {
      notCharged: backersWithBalanceDue.length, // Backers with outstanding balance from post-campaign changes
      errored: pledges.filter(p => p.chargeStatus === "FAILED").length,
      charged: 0, // TODO: track successful additional charge collections
      paypalCollected: 0,
    };

    // Calculate backers with addons (campaign + post-campaign)
    const backersWithAddons = pledges.filter(p => p.addons && p.addons.length > 0).length;

    const stats = {
      totalBackers,
      fulfilledBackers,
      surveysCompleted,
      surveysPending,
      totalRaised: Number(selectedProject.currentAmount),
      addOnPurchases: Number(addOnSales._sum.amount || 0), // Total campaign addon sales (all time)
      postSurveyAddonRevenue, // Revenue from post-campaign IndieKit order edits only
      backersWithBalanceDue: backersWithBalanceDue.length,
      backersWithAddons,
      totalAddonItems: Number(addOnSales._sum.quantity || 0),
      addonPurchaseCount: addOnSales._count || 0,
      digitalDownloads,
      packagesShipped,
      preOrderBackers,
      chargeStats: statsChargeStats,
      pledgeLevelBreakdown,
      surveyStatusBreakdown,
      shippingRegionBreakdown,
      paymentStatusBreakdown,
      // Post-campaign sales (from IndieKit survey add-on purchases across ALL projects)
      postCampaignTotalRaised: postCampaignTotal,
      postCampaignAddonSales: postCampaignTotal, // All post-campaign sales are addon sales
      postCampaignPerProject,
    };

    // Deduplicate pledges by ID (in case of data issues)
    const seenPledgeIds = new Set<string>();
    const uniquePledges = pledges.filter(pledge => {
      if (seenPledgeIds.has(pledge.id)) return false;
      seenPledgeIds.add(pledge.id);
      return true;
    });

    // Process backers for display
    const processedBackers = uniquePledges.map(pledge => {
      const surveyResponse = surveyResponseMap.get(pledge.id);
      const shippingAddress = surveyResponse?.shippingAddress as {
        name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
        phone?: string;
      } | null;

      // Map fulfillment status to our display status
      let status: "not_pushed" | "push_errored" | "pushed" | "shipped" = "not_pushed";
      if (pledge.fulfillmentStatus === "SHIPPED" || pledge.fulfillmentStatus === "DELIVERED") {
        status = "shipped";
      } else if (pledge.fulfillmentStatus === "FAILED") {
        status = "push_errored";
      } else if (pledge.fulfillmentStatus === "IN_PROGRESS") {
        status = "pushed";
      } else if (pledge.status === "COMPLETED" && surveyResponse?.isComplete) {
        status = "not_pushed"; // Ready to push
      }

      // Build items list - only the main reward, addons are separate
      const items = pledge.reward ? [{ name: pledge.reward.title, quantity: 1 }] : [];

      // Build addons list with proper structure
      const addons = pledge.addons.map((a: { addon: { id: string; title: string; amount: unknown; isModifier?: boolean }; quantity: number }) => ({
        id: a.addon.id,
        name: a.addon.title,
        quantity: a.quantity,
        amount: Number(a.addon.amount),
        isModifier: a.addon.isModifier || false,
      }));

      // Check if backer has modifier addons that need assignment
      const hasModifierAddons = pledge.addons.some((a: { addon: { isModifier?: boolean } }) => a.addon.isModifier);
      const modifierAssignments = (pledge.modifierAssignments || []).map((ma: { id: string; rewardId: string; modifierAddonId: string; isAutoAssigned: boolean }) => {
        const modifierAddon = pledge.addons.find((a: { addon: { id: string } }) => a.addon.id === ma.modifierAddonId);
        return {
          id: ma.id,
          rewardId: ma.rewardId,
          rewardTitle: pledge.reward?.title,
          modifierAddonId: ma.modifierAddonId,
          modifierAddonTitle: modifierAddon?.addon?.title,
          isAutoAssigned: ma.isAutoAssigned,
        };
      });
      const needsModifierAssignment = hasModifierAddons && modifierAssignments.length < pledge.addons.filter((a: { addon: { isModifier?: boolean } }) => a.addon.isModifier).length;

      // Calculate balance fields from actual related data (not stored pledge fields which may be stale)
      const pledgeTotal = Number(pledge.amount);

      // Pledge level = the reward tier's price
      const rewardAmt = pledge.reward ? Number(pledge.reward.amount) : 0;

      // Addons = sum of each PledgeAddon line total (price × quantity, stored on PledgeAddon.amount)
      const addonsAmt = pledge.addons.reduce((sum: number, a: { amount: unknown }) => {
        return sum + Number(a.amount || 0);
      }, 0);

      // Shipping = reward shipping + addon shipping based on backer's country
      const backerCountry = shippingAddress?.country || "";
      let shippingAmt = 0;
      if (pledge.reward && pledge.reward.shippingType !== "NO_SHIPPING" && backerCountry) {
        const rewardShipRates = (pledge.reward.shippingCost as Record<string, number>) || {};
        shippingAmt += Number(rewardShipRates[backerCountry] || 0);
      }
      for (const pa of pledge.addons) {
        const addonRec = pa as { addon: { shippingType?: string; shippingCost?: unknown }; quantity: number };
        if (addonRec.addon.shippingType && addonRec.addon.shippingType !== "NO_SHIPPING" && backerCountry) {
          const addonShipRates = (addonRec.addon.shippingCost as Record<string, number>) || {};
          shippingAmt += Number(addonShipRates[backerCountry] || 0) * addonRec.quantity;
        }
      }

      // Use stored balanceDue from metadata if available (set by order edits)
      const pledgeMeta = (pledge.metadata as Record<string, unknown>) || {};
      const storedBalance = pledgeMeta.balanceDue != null ? Number(pledgeMeta.balanceDue) : null;
      const balanceDue = storedBalance !== null
        ? storedBalance
        : (rewardAmt + addonsAmt + shippingAmt) - pledgeTotal;

      // Determine charge status
      let chargeStatus: "not_charged" | "errored" | "charged" | "paypal_collected" = "not_charged";
      if (pledge.status === "COMPLETED") {
        chargeStatus = pledge.paymentProcessor === "DIVINITYCOIN" ? "paypal_collected" : "charged";
      } else if (pledge.status === "FAILED") {
        chargeStatus = "errored";
      }

      // Check if address is complete
      const addressComplete = !!(shippingAddress?.line1 && shippingAddress?.city && shippingAddress?.country && shippingAddress?.postalCode);

      return {
        id: pledge.id,
        projectId: pledge.projectId,
        backerNumber: pledge.backerNumber || 0,
        name: pledge.user.name || "Anonymous",
        email: pledge.user.email || "",
        avatar: pledge.user.image || undefined,
        pledgeAmount: pledgeTotal,
        reward: pledge.reward?.title || "No Reward",
        rewardId: pledge.reward?.id,
        rewardAmount: pledge.reward ? Number(pledge.reward.amount) : 0,
        status,
        chargeStatus,
        paymentProcessor: pledge.paymentProcessor,
        surveyCompleted: surveyResponse?.isComplete || false,
        addressComplete,
        pledgeDate: pledge.createdAt.toISOString(),
        shippingAddress: shippingAddress ? {
          name: shippingAddress.name || "",
          line1: shippingAddress.line1 || "",
          line2: shippingAddress.line2 || "",
          city: shippingAddress.city || "",
          state: shippingAddress.state || "",
          country: shippingAddress.country || "",
          postalCode: shippingAddress.postalCode || "",
          phone: shippingAddress.phone || "",
        } : undefined,
        balance: {
          pledgeAmount: pledgeTotal,
          pledgeLevelAmount: rewardAmt,
          addonsAmount: addonsAmt,
          shippingAmount: shippingAmt,
          totalCharged: pledgeTotal,
          balanceDue,
        },
        items,
        addons,
        digitalDownloads: [], // Would be populated from digital file distribution records
        activity: [], // Would be populated from activity logs
        needsModifierAssignment,
        modifierAssignments,
      };
    });

    // Generate package groups based on reward tiers and locations
    // This is a simplified version - in production you'd have actual package configurations
    const rewardGroups = new Map<string, { backers: typeof processedBackers; rewardTitle: string }>();
    processedBackers.forEach(backer => {
      const key = backer.reward;
      if (!rewardGroups.has(key)) {
        rewardGroups.set(key, { backers: [], rewardTitle: key });
      }
      rewardGroups.get(key)!.backers.push(backer);
    });

    const packageGroups = Array.from(rewardGroups.entries()).map(([rewardTitle, group], idx) => {
      const notPushedCount = group.backers.filter(b => b.status === "not_pushed").length;
      const erroredCount = group.backers.filter(b => b.status === "push_errored").length;
      const pushedCount = group.backers.filter(b => b.status === "pushed").length;
      const shippedCount = group.backers.filter(b => b.status === "shipped").length;

      let status: "pending" | "processing" | "shipped" = "pending";
      if (shippedCount === group.backers.length) {
        status = "shipped";
      } else if (pushedCount > 0 || shippedCount > 0) {
        status = "processing";
      }

      // Determine type based on shipping addresses
      const hasInternational = group.backers.some(b =>
        b.shippingAddress && b.shippingAddress.country && b.shippingAddress.country !== "US"
      );
      const hasIncomplete = group.backers.some(b => !b.shippingAddress);
      const type: "domestic" | "international" | "incomplete" =
        hasIncomplete ? "incomplete" : hasInternational ? "international" : "domestic";

      // Build items with full structure
      const firstBackerItems = group.backers[0]?.items || [];
      const items = firstBackerItems.map((item: { name: string; quantity: number; sku?: string }) => ({
        name: item.name,
        quantity: item.quantity,
        weight: { lbs: 0, oz: 8 }, // Default weight - would come from product data
        customsValid: true,
        sku: item.sku,
      }));

      // Calculate total weight
      const totalWeight = items.reduce(
        (acc: { lbs: number; oz: number }, item: { weight: { lbs: number; oz: number } }) => ({
          lbs: acc.lbs + item.weight.lbs,
          oz: acc.oz + item.weight.oz,
        }),
        { lbs: 0, oz: 0 }
      );

      return {
        id: `pg-${idx + 1}`,
        name: rewardTitle,
        type,
        itemCount: items.length,
        backerCount: group.backers.length,
        status,
        statusCounts: {
          notPushed: notPushedCount,
          pushErrored: erroredCount,
          pushed: pushedCount,
          shipped: shippedCount,
        },
        lastSentAt: undefined,
        items,
        totalWeight,
      };
    });

    // Calculate workflow context data
    const addressesComplete = surveyResponses.filter(sr => {
      const addr = sr.shippingAddress as { line1?: string; city?: string; country?: string } | null;
      return addr?.line1 && addr?.city && addr?.country;
    }).length;
    const addressesLocked = surveyResponses.filter(sr => sr.addressLocked).length;

    // Determine workflow state based on project/survey state
    const workflowState = getWorkflowState({
      survey,
      totalBackers,
      completedSurveys: surveysCompleted,
      addressesLocked,
      addressesComplete,
      pledges,
      chargeStats: statsChargeStats,
    });

    // Format segments for frontend
    const formattedSegments = segments.map((segment: { id: string; name: string; type: string; criteria: unknown; backerCount: number; createdAt: Date }) => ({
      id: segment.id,
      name: segment.name,
      type: segment.type.toLowerCase(),
      criteria: segment.criteria ? JSON.stringify(segment.criteria) : "",
      backerCount: segment.backerCount,
      createdAt: segment.createdAt.toLocaleDateString(),
    }));

    // Format products for frontend
    type ProductType = { id: string; sku: string; name: string; type: string; weight: number | null; weightUnit: string | null; length: number | null; width: number | null; height: number | null; dimensionUnit: string | null; customsCode: string | null; countryOfOrigin: string | null };
    const formattedProducts = products.map((product: ProductType) => {
      let status: "ready" | "no_weight" | "no_customs" | "error" = "ready";
      if (product.type === "PHYSICAL") {
        if (!product.weight) status = "no_weight";
        else if (!product.customsCode) status = "no_customs";
      }
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        type: product.type.toLowerCase() as "physical" | "digital",
        weight: product.weight || undefined,
        weightUnit: product.weightUnit || "oz",
        dimensions: product.length && product.width && product.height
          ? { length: product.length, width: product.width, height: product.height, unit: product.dimensionUnit || "in" }
          : undefined,
        customsCode: product.customsCode || undefined,
        countryOfOrigin: product.countryOfOrigin || undefined,
        status,
      };
    });

    // Format timeline entries from multiple sources
    // Start with FulfillmentActivity records
    const activityTypeMap: Record<string, string> = {
      SURVEY_SENT: "survey_reminder", SURVEY_REMINDER: "survey_reminder", SURVEY_COMPLETED: "survey_completed",
      ORDERS_LOCKED: "orders_pushed", ADDRESSES_LOCKED: "address_updated", CARDS_CHARGED: "cards_charged",
      CHARGE_FAILED: "charge_failed", ORDERS_PUSHED: "orders_pushed", PUSH_FAILED: "charge_failed",
      ORDER_SHIPPED: "order_shipped", ORDER_DELIVERED: "order_shipped", DIGITAL_DISTRIBUTED: "digital_download",
      ADDRESS_UPDATED: "address_updated", REFUND_ISSUED: "refund", NOTE_ADDED: "comment", BALANCE_ADJUSTED: "cards_charged",
    };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    // Helper to format date label
    const formatDateLabel = (date: Date) => {
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly.getTime() === today.getTime()) return "TODAY";
      if (dateOnly.getTime() === yesterday.getTime()) return "YESTERDAY";
      return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
    };

    // Helper to format time
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    };

    // Build timeline from multiple sources
    type TimelineEntry = {
      id: string;
      type: string;
      time: string;
      title: string;
      detail: string;
      date: string;
      sortDate: Date;
    };

    const timelineEntries: TimelineEntry[] = [];

    // Add FulfillmentActivity records if any exist
    type ActivityType = { id: string; type: string; createdAt: Date; title: string; description: string | null };
    recentActivity.forEach((activity: ActivityType) => {
      timelineEntries.push({
        id: activity.id,
        type: activityTypeMap[activity.type] || "comment",
        time: formatTime(activity.createdAt),
        title: activity.title,
        detail: activity.description || "",
        date: formatDateLabel(activity.createdAt),
        sortDate: activity.createdAt,
      });
    });

    // Add recent pledge activity (new backers)
    const recentPledges = pledges
      .filter(p => p.status === "COMPLETED")
      .slice(0, 30); // Last 30 pledges

    recentPledges.forEach(pledge => {
      const pledgeAmount = Number(pledge.amount);
      timelineEntries.push({
        id: `pledge-${pledge.id}`,
        type: "cards_charged",
        time: formatTime(pledge.createdAt),
        title: "New Backer",
        detail: `${pledge.user.name || "Anonymous"} backed ${pledge.reward?.title || "the project"} for $${pledgeAmount.toFixed(2)}`,
        date: formatDateLabel(pledge.createdAt),
        sortDate: pledge.createdAt,
      });
    });

    // Add survey completion activity
    surveyResponses
      .filter(sr => sr.isComplete && sr.completedAt)
      .slice(0, 20)
      .forEach(sr => {
        const pledge = pledges.find(p => p.id === sr.pledgeId);
        const completedAt = sr.completedAt as Date;
        timelineEntries.push({
          id: `survey-${sr.id}`,
          type: "survey_completed",
          time: formatTime(completedAt),
          title: "Survey Completed",
          detail: `${pledge?.user.name || "A backer"} completed their survey`,
          date: formatDateLabel(completedAt),
          sortDate: completedAt,
        });
      });

    // Add email campaign activity
    emailCampaignsData
      .filter((c: { sentAt: Date | null }) => c.sentAt)
      .slice(0, 10)
      .forEach((campaign: { id: string; name: string; sentAt: Date; recipientCount: number }) => {
        timelineEntries.push({
          id: `email-${campaign.id}`,
          type: "survey_reminder",
          time: formatTime(campaign.sentAt),
          title: "Email Campaign Sent",
          detail: `"${campaign.name}" sent to ${campaign.recipientCount} backers`,
          date: formatDateLabel(campaign.sentAt),
          sortDate: campaign.sentAt,
        });
      });

    // Sort all timeline entries by date (newest first) and deduplicate
    const sortedTimeline = timelineEntries
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
      .slice(0, 50); // Limit to 50 entries

    // Remove sortDate from output (it was only used for sorting)
    const formattedTimeline = sortedTimeline.map((item) => ({
      id: item.id,
      type: item.type,
      time: item.time,
      title: item.title,
      detail: item.detail,
      date: item.date,
    }));

    // Format digital files
    type DigitalFileType = { id: string; name: string; fileSize: number; mimeType: string | null; createdAt: Date; distributedCount: number; totalEligible: number };
    const formattedDigitalFiles = digitalFilesData.map((file: DigitalFileType) => ({
      id: file.id, name: file.name, size: formatFileSize(file.fileSize), type: file.mimeType?.split("/")[1]?.toUpperCase() || "FILE",
      uploadedAt: file.createdAt.toLocaleDateString(), distributedTo: file.distributedCount, totalEligible: file.totalEligible,
    }));

    // Format distribution rules
    type DistributionRuleType = {
      id: string;
      name: string;
      triggerType: string;
      triggerRewardId: string | null;
      triggerAddonId: string | null;
      requiresPayment: boolean;
      status: string;
      distributedCount: number;
      totalEligible: number;
      startedAt: Date | null;
      digitalFile: { name: string } | null;
    };
    const formattedDistributionRules = await Promise.all(
      distributionRulesData.map(async (rule: DistributionRuleType) => {
        let triggerProductName = "All Backers";
        if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
          const reward = await db.reward.findUnique({
            where: { id: rule.triggerRewardId },
            select: { title: true },
          });
          triggerProductName = reward?.title || "Unknown Reward";
        } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
          const addon = await db.reward.findUnique({
            where: { id: rule.triggerAddonId },
            select: { title: true },
          });
          triggerProductName = addon?.title || "Unknown Add-on";
        }

        // Convert status to lowercase with underscores for frontend
        const statusMap: Record<string, "not_started" | "started" | "completed"> = {
          NOT_STARTED: "not_started",
          STARTED: "started",
          COMPLETED: "completed",
        };

        return {
          id: rule.id,
          name: rule.name,
          condition: rule.triggerType,
          triggerProduct: triggerProductName,
          distributeFile: rule.digitalFile?.name || "Unknown File",
          requiresPayment: rule.requiresPayment,
          status: statusMap[rule.status] || "not_started",
          distributedCount: rule.distributedCount,
          totalEligible: rule.totalEligible,
          startedAt: rule.startedAt?.toISOString(),
        };
      })
    );

    // Format email campaigns with full stats
    type CampaignType = { id: string; name: string; status: string; sentAt: Date | null; scheduledFor: Date | null; recipientCount: number; sentCount: number; openCount: number; clickCount: number };
    const formattedEmailCampaigns = emailCampaignsData.map((campaign: CampaignType) => ({
      id: campaign.id,
      title: campaign.name,
      status: campaign.status.toLowerCase(),
      sentAt: campaign.sentAt?.toLocaleDateString(),
      scheduledFor: campaign.scheduledFor?.toLocaleDateString(),
      recipients: campaign.recipientCount,
      sentCount: campaign.sentCount,
      openCount: campaign.openCount,
      clickCount: campaign.clickCount,
      openRate: campaign.sentCount > 0 ? Math.round((campaign.openCount / campaign.sentCount) * 100) : undefined,
      clickRate: campaign.sentCount > 0 ? Math.round((campaign.clickCount / campaign.sentCount) * 100) : undefined,
    }));

    return NextResponse.json({
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        prelaunchActive: (p as { prelaunchActive?: boolean }).prelaunchActive || false,
        imageUrl: (p as { imageUrl?: string }).imageUrl || null,
        backerCount: (p as { backerCount?: number }).backerCount || 0,
        totalRaised: Number((p as { currentAmount?: number | string }).currentAmount) || 0,
        vanityUrl: (p as { creator?: { vanityUrl?: string | null } }).creator?.vanityUrl || null,
      })),
      stats,
      backers: processedBackers,
      packageGroups,
      segments: formattedSegments,
      products: formattedProducts,
      timeline: formattedTimeline,
      digitalFiles: formattedDigitalFiles,
      distributionRules: formattedDistributionRules,
      emailCampaigns: formattedEmailCampaigns,
      workflowState,
      emailMemberCount,
      userEmail: session.user.email || "",
      userRole,
      hasApprovedProject,
      rewards: projectRewards.map((r: { id: string; title: string; amount: unknown }) => ({ id: r.id, name: r.title, amount: Number(r.amount) })),
      addons: projectAddons.filter((a: { visibility?: string }) => a.visibility !== "HIDDEN").map((a: { id: string; title: string; amount: unknown }) => ({ id: a.id, name: a.title, price: Number(a.amount) })),
      surveyAddons: projectAddons.filter((a: { showInSurvey?: boolean }) => a.showInSurvey).map((a: { id: string; title: string; description?: string; amount: unknown; imageUrl?: string | null; quantityAvailable?: number | null; quantityClaimed?: number; isEnded?: boolean }) => ({
        id: a.id,
        name: a.title,
        description: a.description || "",
        price: Number(a.amount),
        imageUrl: a.imageUrl || undefined,
        available: !a.isEnded,
        quantityLimit: a.quantityAvailable || undefined,
        purchasedCount: a.quantityClaimed || 0,
      })),
    });
  } catch (error) {
    console.error("IndieKit API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch IndieKit data" },
      { status: 500 }
    );
  }
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + " KB";
  const mb = kb / 1024;
  if (mb < 1024) return mb.toFixed(1) + " MB";
  return (mb / 1024).toFixed(1) + " GB";
}

// Helper to determine workflow state
type WorkflowStatus = "completed" | "in_progress" | "pending" | "locked";

interface WorkflowContext {
  survey: { status: string; lockedAt?: Date | null } | null;
  totalBackers: number;
  completedSurveys: number;
  addressesLocked: number;
  addressesComplete: number;
  pledges: { fulfillmentStatus: string | null; chargeStatus?: string }[];
  chargeStats: { notCharged: number; errored: number; charged: number };
}

function getWorkflowState(ctx: WorkflowContext) {
  const steps: { id: string; label: string; description: string; icon: string; status: WorkflowStatus; actionCount?: number }[] = [
    { id: "surveys", label: "Send & Remind", description: "Collect backer surveys", icon: "Mail", status: "pending", actionCount: 0 },
    { id: "lock_orders", label: "Lock Orders", description: "Finalize backer selections", icon: "Lock", status: "locked", actionCount: 0 },
    { id: "charge_cards", label: "Charge Cards", description: "Process additional payments", icon: "CreditCard", status: "locked", actionCount: 0 },
    { id: "lock_addresses", label: "Lock Addresses", description: "Confirm shipping details", icon: "MapPin", status: "locked", actionCount: 0 },
    { id: "start_shipping", label: "Start Shipping", description: "Push orders to fulfillment", icon: "Truck", status: "locked", actionCount: 0 },
    { id: "shipped", label: "Shipped", description: "Mark orders as complete", icon: "CheckCircle2", status: "locked", actionCount: 0 },
  ];

  const { survey, totalBackers, completedSurveys, addressesLocked, addressesComplete, pledges, chargeStats } = ctx;

  // Calculate fulfillment counts
  const notPushedCount = pledges.filter(p => !p.fulfillmentStatus || p.fulfillmentStatus === "PENDING").length;
  const inProgressCount = pledges.filter(p => p.fulfillmentStatus === "IN_PROGRESS").length;
  const shippedCount = pledges.filter(p => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED").length;
  const pendingSurveys = totalBackers - completedSurveys;

  // STEP 1: Surveys
  // Always available - show pending surveys count
  steps[0].actionCount = pendingSurveys;
  if (!survey || survey.status === "DRAFT") {
    steps[0].status = "pending";
  } else if (survey.status === "SENT") {
    steps[0].status = completedSurveys > 0 ? "in_progress" : "pending";
    if (completedSurveys >= totalBackers * 0.9) {
      steps[0].status = "completed";
    }
  } else if (survey.status === "LOCKED") {
    steps[0].status = "completed";
  }

  // STEP 2: Lock Orders
  // Available once survey has responses (some surveys completed)
  const unlockedOrders = totalBackers - (survey?.status === "LOCKED" ? totalBackers : 0);
  steps[1].actionCount = completedSurveys > 0 ? unlockedOrders : 0;
  if (completedSurveys > 0) {
    if (survey?.status === "LOCKED") {
      steps[1].status = "completed";
    } else {
      steps[1].status = "pending";
    }
  }

  // STEP 3: Charge Cards
  // Available once orders are locked OR if we have completed surveys
  steps[2].actionCount = chargeStats.notCharged;
  if (survey?.status === "LOCKED" || completedSurveys > 0) {
    if (chargeStats.notCharged === 0 && chargeStats.charged > 0) {
      steps[2].status = "completed";
    } else if (chargeStats.charged > 0) {
      steps[2].status = "in_progress";
    } else {
      steps[2].status = "pending";
    }
  }

  // STEP 4: Lock Addresses
  // Available once we have addresses to lock
  const unlockedAddresses = addressesComplete - addressesLocked;
  steps[3].actionCount = unlockedAddresses > 0 ? unlockedAddresses : addressesComplete;
  if (addressesComplete > 0) {
    if (addressesLocked >= addressesComplete && addressesComplete > 0) {
      steps[3].status = "completed";
    } else if (addressesLocked > 0) {
      steps[3].status = "in_progress";
    } else {
      steps[3].status = "pending";
    }
  }

  // STEP 5: Start Shipping
  // Available once addresses are complete
  steps[4].actionCount = notPushedCount;
  if (addressesComplete > 0) {
    if (notPushedCount === 0 && (inProgressCount > 0 || shippedCount > 0)) {
      steps[4].status = "completed";
    } else if (inProgressCount > 0 || shippedCount > 0) {
      steps[4].status = "in_progress";
    } else {
      steps[4].status = "pending";
    }
  }

  // STEP 6: Shipped
  // Available once some orders are pushed
  steps[5].actionCount = inProgressCount;
  if (inProgressCount > 0 || shippedCount > 0) {
    if (shippedCount === totalBackers && totalBackers > 0) {
      steps[5].status = "completed";
    } else if (shippedCount > 0) {
      steps[5].status = "in_progress";
    } else {
      steps[5].status = "pending";
    }
  }

  return steps;
}
