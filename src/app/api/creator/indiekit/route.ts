import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withCorrelation, CORRELATION_HEADER } from "@/lib/correlation";

const creatorIndiekitLogger = logger.child({ module: "creator-indiekit" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getWorkflowState,
  formatSegments,
  formatProducts,
  formatTimeline,
  formatDigitalFiles,
  formatDistributionRules,
  formatEmailCampaigns,
  processBackers,
  buildPackageGroups,
  computeStats,
  computePostCampaignSales,
} from "./helpers";
import type {
  ProductType,
  DigitalFileType,
  DistributionRuleType,
  CampaignType,
} from "./helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withCorrelation(req, async (correlationId) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    // IndieKit's Backers tab is a fulfillment view — every feature on
    // it (filter by addon/SKU/location, bulk-action checkboxes, segment
    // builder, CSV export) needs the full backer set in scope. Keep
    // pagination params on the wire for back-compat but raise the cap
    // way past any realistic campaign size, and let callers ask for
    // "everything" by passing backersLimit=0 / "all".
    //
    // Background: with the previous 50-row default, a client-side
    // addon filter only saw page 1 of pledges and silently missed
    // matches on later pages — a 6-foil order showed up as "1 backer
    // has the foil addon" because 5 of the 6 foil pledges were on
    // pages 2+ that the dashboard never loaded.
    const rawLimit = searchParams.get("backersLimit");
    const backersLimit =
      rawLimit === "0" || rawLimit === "all"
        ? 100000
        : Math.min(Math.max(1, parseInt(rawLimit || "10000", 10) || 10000), 100000);
    const backersPage = Math.max(1, parseInt(searchParams.get("backersPage") || "1", 10) || 1);
    const backersOffset = (backersPage - 1) * backersLimit;
    // Field selection: comma-separated list of sections to include
    // e.g. ?fields=backers,stats,emails — if omitted, all sections are returned
    const fieldsParam = searchParams.get("fields");
    const requestedFields = fieldsParam
      ? new Set(fieldsParam.split(",").map((f) => f.trim()))
      : null; // null = return all
    const shouldInclude = (field: string) => !requestedFields || requestedFields.has(field);

    // Get user role and check if they have at least one approved prelaunch page or campaign
    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });
    const userRole = user?.role || "USER";

    const approvedProjectCount = await db.project.count({
      where: {
        creatorId: session.user.id,
        deletedAt: null,
        OR: [
          // Currently approved, live, or funded
          { status: { in: ["APPROVED", "LIVE", "FUNDED"] } },
          // Approved or active prelaunch page
          { prelaunchStatus: "APPROVED" },
          { prelaunchActive: true },
          // Prior campaigns (launched at some point) — grants perpetual access
          { status: { in: ["PAUSED", "FAILED", "CANCELLED"] } },
        ],
      },
    });
    const hasApprovedProject = approvedProjectCount > 0;

    // Get user's own projects that are funded/completed (eligible for fulfillment)
    // Also include DRAFT projects with prelaunchActive=true
    const ownProjects = await db.project.findMany({
      where: {
        creatorId: session.user.id,
        deletedAt: null,
        OR: [
          { status: { in: ["FUNDED", "LIVE", "APPROVED"] } },
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
        campaignType: true,
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
            campaignType: true,
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
        userRole,
        hasApprovedProject,
      }, {
        headers: { [CORRELATION_HEADER]: correlationId },
      });
    }

    // Select project — always resolve to a project the user actually owns
    const selectedProject = (projectId ? projects.find(p => p.id === projectId) : null) || projects[0];
    const selectedProjectId = selectedProject.id;

    // Compute post-campaign sales
    const { postCampaignTotal, postCampaignPerProject } = await computePostCampaignSales(projects);

    // Fetch all IndieKit data in parallel
    // Each section is conditionally loaded based on ?fields= parameter
    const [
      pledges,
      totalBackersCount,
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
      // Get paginated COMPLETED + committed PENDING pledges for the
      // project with user info. Same commit-marker filter as lib/stats
      // so IndieKit shows the same backer set as the public total —
      // no abandoned-cart PENDING noise.
      shouldInclude("backers") || shouldInclude("stats") ? db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          deletedAt: null,
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
          ],
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
                  isModifier: true,
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
        skip: backersOffset,
        take: backersLimit,
      }) : Promise.resolve([]),

      // Count total backers for pagination metadata. Same committed-
      // PENDING filter as the list above.
      shouldInclude("backers") ? db.pledge.count({
        where: {
          projectId: selectedProjectId,
          deletedAt: null,
          OR: [
            { status: "COMPLETED" },
            { status: "PENDING", confirmationEmailSent: true },
          ],
        },
      }) : Promise.resolve(0),

      // Get survey for this project
      shouldInclude("survey") || shouldInclude("stats") ? db.survey.findUnique({
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
      }) : Promise.resolve(null),

      // Get survey responses
      shouldInclude("survey") || shouldInclude("stats") || shouldInclude("backers") ? db.surveyResponse.findMany({
        where: {
          survey: {
            projectId: selectedProjectId,
          },
        },
        include: {
          survey: true,
        },
      }) : Promise.resolve([]),

      // Calculate add-on sales total and counts. Same committed-
      // PENDING filter so add-on revenue matches the headline.
      shouldInclude("stats") ? db.pledgeAddon.aggregate({
        where: {
          pledge: {
            projectId: selectedProjectId,
            deletedAt: null,
            OR: [
              { status: "COMPLETED" },
              { status: "PENDING", confirmationEmailSent: true },
              ],
          },
        },
        _sum: { amount: true, quantity: true },
        _count: true,
      }) : Promise.resolve({ _sum: { amount: null, quantity: null }, _count: 0 }),

      // Get segments for this project
      shouldInclude("segments") ? db.backerSegment.findMany({
        where: { projectId: selectedProjectId },
        orderBy: { createdAt: "desc" },
      }) : Promise.resolve([]),

      // Get products for this project
      shouldInclude("products") ? db.fulfillmentProduct.findMany({
        where: { projectId: selectedProjectId },
        orderBy: { createdAt: "desc" },
      }) : Promise.resolve([]),

      // Get recent activity
      shouldInclude("timeline") ? db.fulfillmentActivity.findMany({
        where: { projectId: selectedProjectId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }) : Promise.resolve([]),

      // Get digital files
      shouldInclude("digital_files") ? db.digitalFile.findMany({
        where: { projectId: selectedProjectId },
        include: {
          distributions: true,
        },
        orderBy: { createdAt: "desc" },
      }) : Promise.resolve([]),

      // Get distribution rules (wrapped in catch to handle missing table before migration)
      shouldInclude("distribution_rules") ? db.distributionRule.findMany({
        where: { projectId: selectedProjectId },
        include: {
          digitalFile: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }).catch(() => []) : Promise.resolve([]),

      // Get email campaigns - either created by this user OR associated with the selected project
      shouldInclude("emails") || shouldInclude("timeline") ? db.emailCampaign.findMany({
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
      }) : Promise.resolve([]),

      // Get email list member count for this creator (using EmailListSubscriber table)
      shouldInclude("emails") ? db.emailListSubscriber.count({
        where: {
          creatorId: session.user.id,
          status: "subscribed",
        },
      }) : Promise.resolve(0),

      // Get rewards for this project (type: TIER)
      shouldInclude("rewards") || shouldInclude("backers") ? db.reward.findMany({
        where: { projectId: selectedProjectId, type: "TIER" },
        select: { id: true, title: true, amount: true },
        orderBy: { amount: "asc" },
      }) : Promise.resolve([]),

      // Get addons for this project (type: ADDON) - include all for admin view
      shouldInclude("addons") || shouldInclude("backers") ? db.reward.findMany({
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
      }) : Promise.resolve([]),
    ]);

    // Build survey response map for quick lookup
    const surveyResponseMap = new Map(
      surveyResponses.map(sr => [sr.pledgeId, sr])
    );

    // Compute stats
    const { stats, chargeStats: statsChargeStats, totalBackers, surveysCompleted } = computeStats({
      pledges,
      surveyResponses,
      addOnSales,
      selectedProject,
      postCampaignTotal,
      postCampaignPerProject,
    });

    // Process backers for display
    const processedBackers = processBackers(pledges, surveyResponseMap, selectedProject.campaignType);

    // Build package groups
    const packageGroups = buildPackageGroups(processedBackers);

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

    // Format all data sections using helpers
    const formattedSegments = formatSegments(segments as { id: string; name: string; type: string; criteria: unknown; backerCount: number; createdAt: Date }[]);
    const formattedProducts = formatProducts(products as ProductType[]);
    const formattedTimeline = formatTimeline({
      recentActivity: recentActivity as { id: string; type: string; createdAt: Date; title: string; description: string | null }[],
      pledges,
      surveyResponses,
      emailCampaignsData: emailCampaignsData as { id: string; name: string; sentAt: Date | null; recipientCount: number }[],
    });
    const formattedDigitalFiles = formatDigitalFiles(digitalFilesData as DigitalFileType[]);
    const formattedDistributionRules = await formatDistributionRules(distributionRulesData as DistributionRuleType[], selectedProjectId);
    const formattedEmailCampaigns = formatEmailCampaigns(emailCampaignsData as CampaignType[]);

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
      backersPagination: {
        page: backersPage,
        limit: backersLimit,
        total: totalBackersCount,
        totalPages: Math.ceil(totalBackersCount / backersLimit),
      },
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
    }, {
      headers: { [CORRELATION_HEADER]: correlationId },
    });
  } catch (error) {
    creatorIndiekitLogger.error({ correlationId, err: String(error) }, "IndieKit API error:");
    return NextResponse.json(
      { error: "Failed to fetch IndieKit data", correlationId },
      { status: 500, headers: { [CORRELATION_HEADER]: correlationId } }
    );
  }
  });
}
