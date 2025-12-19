import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRetailerRequest } from "@/lib/retailer-auth";

export const dynamic = "force-dynamic";

// GET - Get retailer-eligible projects
export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateRetailerRequest();

    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") || "ending_soon";
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      status: "LIVE",
      allowRetailerPledges: true,
    };

    if (category && category !== "All Categories") {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { subtitle: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy clause
    let orderBy: Record<string, string>;
    switch (sort) {
      case "ending_soon":
        orderBy = { endDate: "asc" };
        break;
      case "most_funded":
        orderBy = { currentAmount: "desc" };
        break;
      case "newest":
        orderBy = { launchedAt: "desc" };
        break;
      case "most_backed":
        orderBy = { backerCount: "desc" };
        break;
      case "highest_discount":
        orderBy = { retailerDiscount: "desc" };
        break;
      default:
        orderBy = { endDate: "asc" };
    }

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          subtitle: true,
          imageUrl: true,
          category: true,
          goalAmount: true,
          currentAmount: true,
          backerCount: true,
          endDate: true,
          retailerDiscount: true,
          retailerMinQuantity: true,
          retailerMaxQuantity: true,
          rewards: {
            select: {
              id: true,
              title: true,
              amount: true,
            },
          },
          creator: {
            select: {
              name: true,
            },
          },
        },
      }),
      db.project.count({ where }),
    ]);

    // Calculate additional fields
    interface ProjectResult {
      endDate: Date | null;
      retailerDiscount: number;
      rewards: Array<{ amount: number } & Record<string, unknown>>;
      [key: string]: unknown;
    }

    const projectsWithCalculations = projects.map((project: ProjectResult) => {
      const endDate = project.endDate ? new Date(project.endDate) : null;
      const daysLeft = endDate
        ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Calculate retailer prices for rewards
      const rewardsWithPrices = project.rewards.map((reward: { amount: number } & Record<string, unknown>) => ({
        ...reward,
        retailerPrice: reward.amount * (1 - project.retailerDiscount / 100),
      }));

      return {
        ...project,
        daysLeft,
        endDate: project.endDate?.toISOString() || null,
        rewards: rewardsWithPrices,
      };
    });

    return NextResponse.json({
      projects: projectsWithCalculations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching retailer projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
