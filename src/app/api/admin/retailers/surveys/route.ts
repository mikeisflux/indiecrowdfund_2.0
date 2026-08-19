import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminRetailersSurveysLogger = logger.child({ module: "admin-retailers-surveys" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SurveyRecord {
  id: string;
  retailerId: string;
  retailerPledgeId: string;
  rating: number | null;
  feedback: string | null;
  productQuality: number | null;
  shippingSpeed: number | null;
  packaging: number | null;
  communication: number | null;
  overallExperience: number | null;
  wouldRecommend: boolean | null;
  sentAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  retailer: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin
    const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null } });
    if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const status = searchParams.get("status") || "all"; // all, completed, pending

    // Build where clause
    const where: Record<string, unknown> = {};
    if (status === "completed") {
      where.completedAt = { not: null };
    } else if (status === "pending") {
      where.completedAt = null;
      where.sentAt = { not: null };
    }

    // Get total count
    const total = await db.retailerSatisfactionSurvey.count({ where });

    // Get surveys with related data
    const surveys = await db.retailerSatisfactionSurvey.findMany({
      where,
      include: {
        retailer: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { completedAt: "desc" },
        { sentAt: "desc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get the retailer pledge info for each survey
    const surveysWithOrderInfo = await Promise.all(
      surveys.map(async (survey: SurveyRecord) => {
        const retailerPledge = await db.retailerPledge.findFirst({
          where: { id: survey.retailerPledgeId },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                slug: true,
                imageUrl: true,
                // vanityUrl belongs to the creator, not the project. It is
                // flattened back onto the project below so the response shape
                // the client reads is unchanged.
                creator: { select: { vanityUrl: true } },
              },
            },
          },
        });

        // Get the reward info if available
        let rewardInfo = null;
        if (retailerPledge?.rewardId) {
          // Reward's column is `amount`; there is no `price`. Mapped back to
          // `price` so the response keeps the shape the client expects.
          const reward = await db.reward.findUnique({
            where: { id: retailerPledge.rewardId },
            select: {
              id: true,
              title: true,
              amount: true,
            },
          });
          rewardInfo = reward
            ? { id: reward.id, title: reward.title, price: Number(reward.amount) }
            : null;
        }

        return {
          ...survey,
          order: retailerPledge
            ? {
                id: retailerPledge.id,
                quantity: retailerPledge.quantity,
                unitPrice: retailerPledge.unitPrice,
                totalAmount: retailerPledge.totalAmount,
                status: retailerPledge.status,
                invoiceNumber: retailerPledge.invoiceNumber,
                project: retailerPledge.project
                  ? {
                      ...retailerPledge.project,
                      vanityUrl: retailerPledge.project.creator?.vanityUrl ?? null,
                    }
                  : null,
                reward: rewardInfo,
              }
            : null,
        };
      })
    );

    // Get stats
    const totalSurveys = await db.retailerSatisfactionSurvey.count();
    const completedSurveys = await db.retailerSatisfactionSurvey.count({
      where: { completedAt: { not: null } },
    });
    const pendingSurveys = await db.retailerSatisfactionSurvey.count({
      where: { completedAt: null, sentAt: { not: null } },
    });

    // Calculate average rating
    const avgRating = await db.retailerSatisfactionSurvey.aggregate({
      where: { completedAt: { not: null }, rating: { not: null } },
      _avg: { rating: true },
    });

    return NextResponse.json({
      surveys: surveysWithOrderInfo,
      stats: {
        total: totalSurveys,
        completed: completedSurveys,
        pending: pendingSurveys,
        avgRating: avgRating._avg.rating || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    adminRetailersSurveysLogger.error({ err: formatError(error) }, "Error fetching retailer surveys:");
    return NextResponse.json(
      { error: "Failed to fetch surveys" },
      { status: 500 }
    );
  }
}
