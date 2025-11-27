import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.RETAILER_JWT_SECRET || "retailer-secret-key-change-in-production"
);

// Helper to verify retailer authentication
async function verifyRetailer() {
  const cookieStore = await cookies();
  const token = cookieStore.get("retailer_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { retailerId: string };
  } catch {
    return null;
  }
}

// GET - Get single project details for retailer
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const retailerData = await verifyRetailer();

    if (!retailerData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const projectId = params.id;

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        shortDescription: true,
        description: true,
        imageUrl: true,
        images: true,
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
            itemsIncluded: true,
            limitedQuantity: true,
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

    // Calculate retailer prices for rewards
    const rewardsWithPrices = project.rewards.map((reward) => ({
      ...reward,
      retailerPrice: reward.amount * (1 - project.retailerDiscount / 100),
      itemsIncluded: reward.itemsIncluded || [],
    }));

    return NextResponse.json({
      project: {
        ...project,
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
    console.error("Error fetching project for retailer:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
