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
            },
          },
          addons: {
            include: {
              addon: {
                select: {
                  id: true,
                  title: true,
                  amount: true,
                },
              },
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

      // Calculate add-on sales total
      db.pledgeAddon.aggregate({
        where: {
          pledge: {
            projectId: selectedProjectId,
            status: "COMPLETED",
          },
        },
        _sum: { amount: true },
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

      // Get addons for this project (type: ADDON)
      db.reward.findMany({
        where: { projectId: selectedProjectId, type: "ADDON" },
        select: { id: true, title: true, amount: true },
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

    const stats = {
      totalBackers,
      fulfilledBackers,
      surveysCompleted,
      surveysPending,
      totalRaised: Number(selectedProject.currentAmount),
      addOnPurchases: Number(addOnSales._sum.amount || 0),
      digitalDownloads,
      packagesShipped,
      preOrderBackers,
      pledgeLevelBreakdown,
      surveyStatusBreakdown,
      shippingRegionBreakdown,
      paymentStatusBreakdown,
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

      // Build items list
      const items = [
        ...(pledge.reward ? [{ name: pledge.reward.title, quantity: 1 }] : []),
        ...pledge.addons.map((a: { addon: { title: string }; quantity: number }) => ({ name: a.addon.title, quantity: a.quantity })),
      ];

      return {
        id: pledge.id,
        backerNumber: pledge.backerNumber || 0,
        name: pledge.user.name || "Anonymous",
        email: pledge.user.email || "",
        avatar: pledge.user.image || undefined,
        pledgeAmount: Number(pledge.amount),
        reward: pledge.reward?.title || "No Reward",
        status,
        surveyCompleted: surveyResponse?.isComplete || false,
        shippingAddress: shippingAddress ? {
          line1: shippingAddress.line1 || "",
          city: shippingAddress.city || "",
          country: shippingAddress.country || "",
          postalCode: shippingAddress.postalCode || "",
        } : undefined,
        items,
        digitalDownloads: [], // Would be populated from digital file distribution records
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

    // Determine workflow state based on project/survey state
    const workflowState = getWorkflowState(survey, surveyResponses.length, surveysCompleted, pledges);

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
      rewards: projectRewards.map((r: { id: string; title: string; amount: unknown }) => ({ id: r.id, name: r.title, amount: Number(r.amount) })),
      addons: projectAddons.map((a: { id: string; title: string; amount: unknown }) => ({ id: a.id, name: a.title, price: Number(a.amount) })),
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

function getWorkflowState(
  survey: { status: string } | null,
  totalResponses: number,
  completedResponses: number,
  pledges: { fulfillmentStatus: string }[]
) {
  const steps: { id: string; label: string; description: string; icon: string; status: WorkflowStatus }[] = [
    { id: "surveys", label: "Send & Remind", description: "Collect backer surveys", icon: "Mail", status: "pending" },
    { id: "lock_orders", label: "Lock Orders", description: "Finalize backer selections", icon: "Lock", status: "locked" },
    { id: "charge_cards", label: "Charge Cards", description: "Process additional payments", icon: "CreditCard", status: "locked" },
    { id: "lock_addresses", label: "Lock Addresses", description: "Confirm shipping details", icon: "MapPin", status: "locked" },
    { id: "start_shipping", label: "Start Shipping", description: "Push orders to fulfillment", icon: "Truck", status: "locked" },
    { id: "shipped", label: "Shipped", description: "Mark orders as complete", icon: "CheckCircle2", status: "locked" },
  ];

  // Determine current step based on state
  if (!survey || survey.status === "DRAFT") {
    steps[0].status = "pending";
  } else if (survey.status === "SENT") {
    if (completedResponses < totalResponses * 0.9) {
      steps[0].status = "in_progress";
    } else {
      steps[0].status = "completed";
      steps[1].status = "pending";
    }
  } else if (survey.status === "LOCKED") {
    steps[0].status = "completed";
    steps[1].status = "completed";
    steps[2].status = "pending";
  }

  // Check fulfillment progress
  const shippedCount = pledges.filter(
    p => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED"
  ).length;
  const inProgressCount = pledges.filter(p => p.fulfillmentStatus === "IN_PROGRESS").length;

  if (shippedCount > 0 || inProgressCount > 0) {
    steps[0].status = "completed";
    steps[1].status = "completed";
    steps[2].status = "completed";
    steps[3].status = "completed";

    if (shippedCount === pledges.length) {
      steps[4].status = "completed";
      steps[5].status = "completed";
    } else if (shippedCount > 0) {
      steps[4].status = "in_progress";
      steps[5].status = "pending";
    } else {
      steps[4].status = "in_progress";
    }
  }

  return steps;
}
