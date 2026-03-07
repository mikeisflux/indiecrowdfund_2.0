import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const retailersProjectsLogger = logger.child({ module: "retailers-projects" });
import { db } from "@/lib/db";
import { authenticateRetailerRequest } from "@/lib/retailer-auth";

// GET - Get single project details for retailer
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRetailerRequest();

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        imageUrl: true,
        videoUrl: true,
        category: true,
        goalAmount: true,
        currentAmount: true,
        backerCount: true,
        endDate: true,
        status: true,
        allowRetailerPledges: true,
        retailerDiscount: true,
        retailerMinQuantity: true,
        retailerMaxQuantity: true,
        rewards: {
          select: {
            id: true,
            title: true,
            description: true,
            amount: true,
            estimatedDelivery: true,
            quantityAvailable: true,
            quantityClaimed: true,
          },
          orderBy: { amount: "asc" },
        },
        creator: {
          select: {
            id: true,
            name: true,
            bio: true,
            _count: {
              select: {
                createdProjects: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (!project.allowRetailerPledges) {
      return NextResponse.json(
        { error: "This project is not available for retailer orders" },
        { status: 403 }
      );
    }

    if (project.status !== "LIVE") {
      return NextResponse.json(
        { error: "This project is not currently accepting orders" },
        { status: 403 }
      );
    }

    // Calculate additional fields
    const endDate = project.endDate ? new Date(project.endDate) : null;
    const daysLeft = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Calculate retailer prices for rewards - convert Decimals to numbers
    const discountNum = Number(project.retailerDiscount);
    const rewardsWithPrices = project.rewards.map((reward: { amount: unknown } & Record<string, unknown>) => {
      const amountNum = Number(reward.amount);
      return {
        ...reward,
        amount: amountNum,
        retailerPrice: amountNum * (1 - discountNum / 100),
      };
    });

    return NextResponse.json({
      project: {
        ...project,
        goalAmount: Number(project.goalAmount),
        currentAmount: Number(project.currentAmount),
        retailerDiscount: discountNum,
        daysLeft,
        endDate: project.endDate?.toISOString(),
        rewards: rewardsWithPrices,
        creator: {
          name: project.creator?.name || "Unknown Creator",
          bio: project.creator?.bio || "",
          projectCount: project.creator?._count?.createdProjects || 0,
        },
      },
    });
  } catch (error) {
    retailersProjectsLogger.error({ err: String(error) }, "Error fetching project for retailer:");
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
