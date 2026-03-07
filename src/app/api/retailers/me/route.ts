import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const retailersMeLogger = logger.child({ module: "retailers-me" });
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getJwtSecret(): Uint8Array {
  const secret = process.env.RETAILER_JWT_SECRET;
  if (!secret) {
    throw new Error("RETAILER_JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

// Helper to get retailer from token
async function getRetailerFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("retailer_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as { retailerId: string; email: string; businessName: string };
  } catch {
    return null;
  }
}

// Helper to check user's access level and get linked retailer
async function checkUserAccess() {
  const session = await auth();
  if (!session?.user?.id) return { hasAccess: false };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      retailerAccess: true
    }
  });

  if (!user) return { hasAccess: false };

  // Super admins can access in preview mode
  if (user.role === "SUPER_ADMIN") {
    return { hasAccess: true, isSuperAdmin: true, user };
  }

  // Check if user has retailerAccess enabled
  if (user.retailerAccess) {
    // Find linked retailer
    let retailer = await db.retailer.findFirst({
      where: { userId: user.id }
    });

    // If no linked retailer, try to find by email
    if (!retailer && user.email) {
      retailer = await db.retailer.findUnique({
        where: { email: user.email }
      });

      // Link the retailer to the user
      if (retailer) {
        await db.retailer.update({
          where: { id: retailer.id },
          data: { userId: user.id }
        });
      }
    }

    if (retailer && retailer.status === "APPROVED") {
      return { hasAccess: true, hasRetailerAccess: true, retailerId: retailer.id, user };
    }
  }

  return { hasAccess: false, user };
}

// GET - Get current retailer data
export async function GET() {
  try {
    const tokenData = await getRetailerFromToken();
    const userAccess = await checkUserAccess();

    // If not a retailer token, not a super admin, and doesn't have retailerAccess, unauthorized
    if (!tokenData && !userAccess.hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // If super admin viewing retailer dashboard, show admin preview with all retailers' aggregate data
    if (userAccess.isSuperAdmin && !tokenData) {
      // Get aggregate stats for admin view
      const [totalRetailers, activeRetailers, totalOrders, pendingOrders, activeProjects] = await Promise.all([
        db.retailer.count(),
        db.retailer.count({ where: { status: "APPROVED" } }),
        db.retailerPledge.count(),
        db.retailerPledge.count({ where: { status: { in: ["PENDING", "INVOICED", "PAID", "PROCESSING"] } } }),
        db.project.count({ where: { status: "LIVE", allowRetailerPledges: true } }),
      ]);

      // Get recent orders across all retailers
      const recentOrders = await db.retailerPledge.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          project: { select: { id: true, title: true, imageUrl: true } },
          retailer: { select: { businessName: true } },
        },
      });

      // Get featured projects (exclude deleted)
      const featuredProjects = await db.project.findMany({
        where: { deletedAt: null, status: "LIVE", allowRetailerPledges: true },
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

      const projectsWithDaysLeft = featuredProjects.map((project) => {
        const endDate = project.endDate ? new Date(project.endDate) : null;
        const daysLeft = endDate
          ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;
        const goalAmountNum = Number(project.goalAmount);
        const currentAmountNum = Number(project.currentAmount);
        const fundingPercent = goalAmountNum
          ? Math.round((currentAmountNum / goalAmountNum) * 100)
          : 0;
        return { ...project, goalAmount: goalAmountNum, currentAmount: currentAmountNum, retailerDiscount: Number(project.retailerDiscount) || 0, daysLeft, endDate: project.endDate?.toISOString() || null, fundingPercent };
      });

      return NextResponse.json({
        retailer: {
          id: "admin-preview",
          businessName: "Admin Preview (All Retailers)",
          businessType: "ADMIN",
          status: "APPROVED",
          totalOrders,
          pendingOrders,
          completedOrders: totalOrders - pendingOrders,
          totalSavings: 0,
          activeProjects,
          isAdminPreview: true,
          totalRetailers,
          activeRetailers,
        },
        recentOrders: recentOrders.map((order: { id: string; project: { title: string; imageUrl: string | null }; retailer: { businessName: string }; quantity: number; totalAmount: unknown; originalAmount: unknown; status: string; fulfillmentStatus: string; createdAt: Date }) => ({
          id: order.id,
          projectTitle: order.project.title,
          projectImage: order.project.imageUrl,
          quantity: order.quantity,
          totalAmount: Number(order.totalAmount),
          originalAmount: Number(order.originalAmount),
          status: order.status,
          fulfillmentStatus: order.fulfillmentStatus,
          createdAt: order.createdAt.toISOString(),
          retailerName: order.retailer.businessName,
        })),
        featuredProjects: projectsWithDaysLeft,
      });
    }

    // Get retailer ID from token or from user's retailerAccess
    let retailerId: string | null = tokenData?.retailerId || null;

    // If no token but user has retailerAccess, use their linked retailer
    if (!retailerId && userAccess.hasRetailerAccess && userAccess.retailerId) {
      retailerId = userAccess.retailerId;
    }

    if (!retailerId) {
      return NextResponse.json(
        { error: "No retailer found" },
        { status: 401 }
      );
    }

    const retailer = await db.retailer.findUnique({
      where: { id: retailerId },
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

    const calculatedSavings = Number(totalSavings._sum.originalAmount || 0) - Number(totalSpent._sum.totalAmount || 0);

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

    // Get count of retailer-eligible live projects (exclude deleted)
    const activeProjects = await db.project.count({
      where: {
        deletedAt: null,
        status: "LIVE",
        allowRetailerPledges: true,
      },
    });

    // Get featured projects (exclude deleted)
    const featuredProjects = await db.project.findMany({
      where: {
        deletedAt: null,
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
    const projectsWithDaysLeft = featuredProjects.map((project: { endDate: Date | null; goalAmount: unknown; currentAmount: unknown; id: string; title: string; imageUrl: string | null; retailerDiscount: unknown }) => {
      const endDate = project.endDate ? new Date(project.endDate) : null;
      const daysLeft = endDate
        ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;
      const goalAmountNum = Number(project.goalAmount);
      const currentAmountNum = Number(project.currentAmount);
      const fundingPercent = goalAmountNum
        ? Math.round((currentAmountNum / goalAmountNum) * 100)
        : 0;

      return {
        ...project,
        goalAmount: goalAmountNum,
        currentAmount: currentAmountNum,
        retailerDiscount: Number(project.retailerDiscount) || 0,
        daysLeft,
        endDate: project.endDate?.toISOString() || null,
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
      recentOrders: recentOrders.map((order: { id: string; project: { title: string; imageUrl: string | null }; quantity: number; totalAmount: unknown; originalAmount: unknown; status: string; fulfillmentStatus: string; createdAt: Date }) => ({
        id: order.id,
        projectTitle: order.project.title,
        projectImage: order.project.imageUrl,
        quantity: order.quantity,
        totalAmount: Number(order.totalAmount),
        originalAmount: Number(order.originalAmount),
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        createdAt: order.createdAt.toISOString(),
      })),
      featuredProjects: projectsWithDaysLeft,
    });
  } catch (error) {
    retailersMeLogger.error({ err: String(error) }, "Error fetching retailer data:");
    return NextResponse.json(
      { error: "Failed to fetch retailer data" },
      { status: 500 }
    );
  }
}
