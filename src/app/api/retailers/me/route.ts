import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

const JWT_SECRET = new TextEncoder().encode(
  process.env.RETAILER_JWT_SECRET || "retailer-secret-key-change-in-production"
);

// Helper to get retailer from token
async function getRetailerFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("retailer_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { retailerId: string; email: string; businessName: string };
  } catch {
    return null;
  }
}

// GET - Get current retailer data
export async function GET() {
  try {
    const tokenData = await getRetailerFromToken();

    if (!tokenData) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const retailer = await db.retailer.findUnique({
      where: { id: tokenData.retailerId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        contactName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        websiteUrl: true,
        status: true,
        verifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            pledges: true,
          },
        },
      },
    });

    if (!retailer) {
      return NextResponse.json(
        { error: "Retailer not found" },
        { status: 404 }
      );
    }

    // Get order statistics
    const [totalOrders, pendingOrders, completedOrders, totalSpent, totalSavings] = await Promise.all([
      db.retailerPledge.count({
        where: { retailerId: retailer.id },
      }),
      db.retailerPledge.count({
        where: { retailerId: retailer.id, status: { in: ["PENDING", "INVOICED", "PAID", "PROCESSING"] } },
      }),
      db.retailerPledge.count({
        where: { retailerId: retailer.id, status: "DELIVERED" },
      }),
      db.retailerPledge.aggregate({
        where: { retailerId: retailer.id, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true },
      }),
      db.retailerPledge.aggregate({
        where: { retailerId: retailer.id, status: { not: "CANCELLED" } },
        _sum: { originalAmount: true },
      }),
    ]);

    const calculatedSavings = (totalSavings._sum.originalAmount || 0) - (totalSpent._sum.totalAmount || 0);

    // Get recent orders
    const recentOrders = await db.retailerPledge.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
          },
        },
      },
    });

    // Get count of retailer-eligible live projects
    const activeProjects = await db.project.count({
      where: {
        status: "LIVE",
        allowRetailerPledges: true,
      },
    });

    // Get featured projects
    const featuredProjects = await db.project.findMany({
      where: {
        status: "LIVE",
        allowRetailerPledges: true,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        category: true,
        goalAmount: true,
        currentAmount: true,
        endDate: true,
        retailerDiscount: true,
      },
    });

    // Calculate days left for featured projects
    const projectsWithDaysLeft = featuredProjects.map((project: { endDate: Date | null; goalAmount: number; currentAmount: number; id: string; title: string; imageUrl: string | null; retailerDiscount: number | null }) => {
      const endDate = project.endDate ? new Date(project.endDate) : null;
      const daysLeft = endDate
        ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      const fundingPercent = project.goalAmount
        ? Math.round((project.currentAmount / project.goalAmount) * 100)
        : 0;

      return {
        ...project,
        daysLeft,
        fundingPercent,
      };
    });

    return NextResponse.json({
      retailer: {
        ...retailer,
        totalOrders,
        pendingOrders,
        completedOrders,
        totalSavings: calculatedSavings,
        activeProjects,
      },
      recentOrders: recentOrders.map((order: { id: string; project: { title: string; imageUrl: string | null }; quantity: number; totalAmount: number; originalAmount: number; status: string; fulfillmentStatus: string; createdAt: Date }) => ({
        id: order.id,
        projectTitle: order.project.title,
        projectImage: order.project.imageUrl,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        originalAmount: order.originalAmount,
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        createdAt: order.createdAt.toISOString(),
      })),
      featuredProjects: projectsWithDaysLeft,
    });
  } catch (error) {
    console.error("Error fetching retailer data:", error);
    return NextResponse.json(
      { error: "Failed to fetch retailer data" },
      { status: 500 }
    );
  }
}
