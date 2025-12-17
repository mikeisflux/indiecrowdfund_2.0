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
    const ownProjects = await db.project.findMany({
      where: {
        creatorId: session.user.id,
        status: { in: ["FUNDED", "LIVE", "DRAFT"] }, // Include all for now, filter later
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
      emailCampaignsData,
    ] = await Promise.all([
      // Get all pledges for the project with user info
      db.pledge.findMany({
        where: {
          projectId: selectedProjectId,
          status: { in: ["COMPLETED", "PENDING"] },
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

      // Get email campaigns (if project-specific campaigns exist)
      db.emailCampaign.findMany({
        where: {
          filters: {
            path: ["projectId"],
            equals: selectedProjectId,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
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

    const stats = {
      totalBackers,
      fulfilledBackers,
      surveysCompleted,
      surveysPending,
      totalRaised: selectedProject.currentAmount,
      addOnPurchases: addOnSales._sum.amount || 0,
      digitalDownloads,
      packagesShipped,
    };

    // Process backers for display
    const processedBackers = pledges.map(pledge => {
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
        name: pledge.user.name || "Anonymous",
        email: pledge.user.email || "",
        avatar: pledge.user.image || undefined,
        pledgeAmount: pledge.amount,
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
      const shippedCount = group.backers.filter(b => b.status === "shipped").length;
      const processingCount = group.backers.filter(b => b.status === "pushed").length;

      let status: "pending" | "processing" | "shipped" = "pending";
      if (shippedCount === group.backers.length) {
        status = "shipped";
      } else if (processingCount > 0 || shippedCount > 0) {
        status = "processing";
      }

      return {
        id: `pg-${idx}`,
        name: rewardTitle,
        itemCount: group.backers[0]?.items.length || 1,
        backerCount: group.backers.length,
        status,
        items: group.backers[0]?.items.map(i => i.name) || [],
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

    // Format timeline entries
    const activityTypeMap: Record<string, string> = {
      SURVEY_SENT: "survey_reminder", SURVEY_REMINDER: "survey_reminder", SURVEY_COMPLETED: "survey_completed",
      ORDERS_LOCKED: "orders_pushed", ADDRESSES_LOCKED: "address_updated", CARDS_CHARGED: "cards_charged",
      CHARGE_FAILED: "charge_failed", ORDERS_PUSHED: "orders_pushed", PUSH_FAILED: "charge_failed",
      ORDER_SHIPPED: "order_shipped", ORDER_DELIVERED: "order_shipped", DIGITAL_DISTRIBUTED: "digital_download",
      ADDRESS_UPDATED: "address_updated", REFUND_ISSUED: "refund", NOTE_ADDED: "comment", BALANCE_ADJUSTED: "cards_charged",
    };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    type ActivityType = { id: string; type: string; createdAt: Date; title: string; description: string | null };
    const formattedTimeline = recentActivity.map((activity: ActivityType) => {
      const activityDate = new Date(activity.createdAt); activityDate.setHours(0, 0, 0, 0);
      let dateLabel = activity.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
      if (activityDate.getTime() === today.getTime()) dateLabel = "TODAY";
      else if (activityDate.getTime() === yesterday.getTime()) dateLabel = "YESTERDAY";
      return {
        id: activity.id, type: activityTypeMap[activity.type] || "comment",
        time: activity.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        title: activity.title, detail: activity.description || "", date: dateLabel,
      };
    });

    // Format digital files
    type DigitalFileType = { id: string; name: string; fileSize: number; mimeType: string | null; createdAt: Date; distributedCount: number; totalEligible: number };
    const formattedDigitalFiles = digitalFilesData.map((file: DigitalFileType) => ({
      id: file.id, name: file.name, size: formatFileSize(file.fileSize), type: file.mimeType?.split("/")[1]?.toUpperCase() || "FILE",
      uploadedAt: file.createdAt.toLocaleDateString(), distributedTo: file.distributedCount, totalEligible: file.totalEligible,
    }));

    // Format email campaigns
    type CampaignType = { id: string; name: string; status: string; sentAt: Date | null; scheduledFor: Date | null; recipientCount: number; sentCount: number; openCount: number };
    const formattedEmailCampaigns = emailCampaignsData.map((campaign: CampaignType) => ({
      id: campaign.id, title: campaign.name, status: campaign.status.toLowerCase(),
      sentAt: campaign.sentAt?.toLocaleDateString(), scheduledFor: campaign.scheduledFor?.toLocaleDateString(),
      recipients: campaign.recipientCount, openRate: campaign.sentCount > 0 ? Math.round((campaign.openCount / campaign.sentCount) * 100) : undefined,
    }));

    return NextResponse.json({
      projects: projects.map(p => ({ id: p.id, title: p.title, slug: p.slug, status: p.status })),
      stats,
      backers: processedBackers,
      packageGroups,
      segments: formattedSegments,
      products: formattedProducts,
      timeline: formattedTimeline,
      digitalFiles: formattedDigitalFiles,
      emailCampaigns: formattedEmailCampaigns,
      workflowState,
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
