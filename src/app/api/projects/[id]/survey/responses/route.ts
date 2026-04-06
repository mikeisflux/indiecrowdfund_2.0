import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const projectsSurveyResponsesLogger = logger.child({ module: "projects-survey-responses" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET - Get all survey responses for a project (creator view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;

    // Verify project ownership or collaborator access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          where: {
            userId: session.user.id,
            status: "ACCEPTED",
            canCoordinateFulfillment: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.creatorId === session.user.id;
    const hasPermission = project.collaborators.length > 0;

    if (!isOwner && !hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const filter = searchParams.get("filter") || "all"; // all, complete, incomplete
    const rewardId = searchParams.get("rewardId");

    const skip = (page - 1) * limit;

    // Build where clause
    interface WhereClause {
      surveyId: string;
      isComplete?: boolean;
    }

    const where: WhereClause = { surveyId: survey.id };
    if (filter === "complete") {
      where.isComplete = true;
    } else if (filter === "incomplete") {
      where.isComplete = false;
    }

    // Get responses with pledge and user info
    const responses = await db.surveyResponse.findMany({
      where,
      include: {
        survey: false,
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Get pledge and user info for each response
    const responsesWithDetails = await Promise.all(
      responses.map(async (response) => {
        const pledge = await db.pledge.findUnique({
          where: { id: response.pledgeId },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            reward: {
              select: { id: true, title: true },
            },
            addons: {
              include: {
                addon: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        });

        // Filter by reward if specified
        if (rewardId && pledge?.rewardId !== rewardId) {
          return null;
        }

        return {
          ...response,
          pledge,
        };
      })
    );

    // Filter out nulls from reward filtering
    const filteredResponses = responsesWithDetails.filter(Boolean);

    // Get totals
    const total = await db.surveyResponse.count({ where });
    const completedCount = await db.surveyResponse.count({
      where: { surveyId: survey.id, isComplete: true },
    });
    const incompleteCount = await db.surveyResponse.count({
      where: { surveyId: survey.id, isComplete: false },
    });

    return NextResponse.json({
      responses: filteredResponses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        completed: completedCount,
        incomplete: incompleteCount,
        responseRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      },
    });
  } catch (error) {
    projectsSurveyResponsesLogger.error({ err: String(error) }, "Error fetching survey responses:");
    return NextResponse.json(
      { error: "Failed to fetch survey responses" },
      { status: 500 }
    );
  }
}

// GET export data (CSV format)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = id;
    const body = await req.json();
    const { format = "json" } = body;

    // Verify project ownership or collaborator access
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          where: {
            userId: session.user.id,
            status: "ACCEPTED",
            canCoordinateFulfillment: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isOwner = project.creatorId === session.user.id;
    const hasPermission = project.collaborators.length > 0;

    if (!isOwner && !hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const survey = await db.survey.findUnique({
      where: { projectId },
      include: {
        itemQuestions: {
          include: {
            variants: true,
            customQuestions: true,
          },
        },
        backerQuestions: true,
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    // Get all responses with full details (capped at 10000 to prevent memory exhaustion)
    const responses = await db.surveyResponse.findMany({
      where: { surveyId: survey.id },
      take: 10000,
      include: {
        pledge: {
          include: {
            user: { select: { name: true, email: true } },
            reward: { select: { title: true, amount: true } },
          },
        },
      },
    });

    const responsesWithDetails = responses.map((response) => {
      const pledge = response.pledge;
      return {
        backerName: pledge?.user.name || "Unknown",
        backerEmail: pledge?.user.email || "Unknown",
        rewardTitle: pledge?.reward?.title || "Unknown",
        pledgeAmount: Number(pledge?.amount) || 0,
        isComplete: response.isComplete,
        completedAt: response.completedAt,
        itemResponses: response.itemResponses,
        backerResponses: response.backerResponses,
        shippingAddress: response.shippingAddress,
      };
    });

    if (format === "csv") {
      // Build CSV
      const headers = [
        "Backer Name",
        "Backer Email",
        "Reward",
        "Pledge Amount",
        "Survey Complete",
        "Completed At",
      ];

      // Add shipping address fields if collecting addresses
      if (survey.collectAddresses) {
        headers.push(
          "Shipping Name",
          "Address Line 1",
          "Address Line 2",
          "City",
          "State",
          "Postal Code",
          "Country",
          "Phone"
        );
      }

      // Add backer question headers
      for (const question of survey.backerQuestions) {
        headers.push(question.question);
      }

      // Add item question headers
      for (const itemQuestion of survey.itemQuestions) {
        for (const variant of itemQuestion.variants) {
          headers.push(`${itemQuestion.itemName} - ${variant.variantType}`);
        }
        for (const customQ of itemQuestion.customQuestions) {
          headers.push(`${itemQuestion.itemName} - ${customQ.question}`);
        }
      }

      const rows = responsesWithDetails.map((r) => {
        const row: string[] = [
          r.backerName,
          r.backerEmail,
          r.rewardTitle,
          r.pledgeAmount.toString(),
          r.isComplete ? "Yes" : "No",
          r.completedAt?.toISOString() || "",
        ];

        // Add shipping address
        if (survey.collectAddresses) {
          const addr = r.shippingAddress as Record<string, string> | null;
          row.push(
            addr?.name || "",
            addr?.line1 || "",
            addr?.line2 || "",
            addr?.city || "",
            addr?.state || "",
            addr?.postalCode || "",
            addr?.country || "",
            addr?.phone || ""
          );
        }

        // Add backer responses
        const backerResponses = r.backerResponses as Record<string, string | string[]> | null;
        for (const question of survey.backerQuestions) {
          const answer = backerResponses?.[question.id];
          row.push(Array.isArray(answer) ? answer.join("; ") : (answer || ""));
        }

        // Add item responses
        const itemResponses = r.itemResponses as Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }> | null;
        for (const itemQuestion of survey.itemQuestions) {
          const itemResp = itemResponses?.[itemQuestion.id];
          for (const variant of itemQuestion.variants) {
            row.push(itemResp?.variants?.[variant.id] || "");
          }
          for (const customQ of itemQuestion.customQuestions) {
            const answer = itemResp?.customAnswers?.[customQ.id];
            row.push(Array.isArray(answer) ? answer.join("; ") : (answer || ""));
          }
        }

        return row;
      });

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="survey-responses-${projectId}.csv"`,
        },
      });
    }

    return NextResponse.json({
      responses: responsesWithDetails,
      survey: {
        itemQuestions: survey.itemQuestions,
        backerQuestions: survey.backerQuestions,
        collectAddresses: survey.collectAddresses,
      },
    });
  } catch (error) {
    projectsSurveyResponsesLogger.error({ err: String(error) }, "Error exporting survey responses:");
    return NextResponse.json(
      { error: "Failed to export survey responses" },
      { status: 500 }
    );
  }
}
