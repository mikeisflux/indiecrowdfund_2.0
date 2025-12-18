import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }

  return { user: session.user };
}

// GET - Get all subscribers with categorization
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "all";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Get counts for each category
    const [
      newsletterCount,
      verifiedUsersCount,
      backersCount,
      creatorsCount,
      retailersCount,
    ] = await Promise.all([
      db.newsletterSubscriber.count({
        where: {
          isActive: true,
          OR: [
            { source: null },
            { source: { not: { contains: "retailer" }, mode: "insensitive" } },
          ],
        },
      }),
      db.user.count({ where: { emailVerified: { not: null } } }),
      db.pledge.findMany({
        where: { status: "COMPLETED" },
        select: { userId: true },
        distinct: ["userId"],
      }).then(pledges => pledges.length),
      db.user.count({ where: { projects: { some: {} } } }),
      db.newsletterSubscriber.count({ where: { isActive: true, source: { contains: "retailer", mode: "insensitive" } } }),
    ]);

    // Build the response based on category
    let subscribers: Array<{
      id: string;
      email: string;
      name: string | null;
      source: string;
      subscribedAt: Date | null;
      category: string;
    }> = [];
    let total = 0;

    const searchFilter = search
      ? { OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ]}
      : {};

    if (category === "all" || category === "newsletter") {
      const nlSubs = await db.newsletterSubscriber.findMany({
        where: {
          isActive: true,
          OR: [
            { source: null },
            { source: { not: { contains: "retailer" }, mode: "insensitive" } },
          ],
          ...searchFilter,
        },
        select: {
          id: true,
          email: true,
          name: true,
          source: true,
          subscribedAt: true,
        },
        orderBy: { subscribedAt: "desc" },
        take: category === "all" ? Math.floor(limit / 5) : limit,
        skip: category === "newsletter" ? offset : 0,
      });

      subscribers = subscribers.concat(
        nlSubs.map((s: { id: string; email: string; name: string | null; source: string | null; subscribedAt: Date | null }) => ({
          ...s,
          source: s.source || "imported",
          category: "newsletter",
        }))
      );

      if (category === "newsletter") {
        total = await db.newsletterSubscriber.count({
          where: {
            isActive: true,
            OR: [
              { source: null },
              { source: { not: { contains: "retailer" }, mode: "insensitive" } },
            ],
            ...searchFilter,
          },
        });
      }
    }

    if (category === "all" || category === "verified") {
      const verifiedUsers = await db.user.findMany({
        where: {
          emailVerified: { not: null },
          ...(search ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: category === "all" ? Math.floor(limit / 5) : limit,
        skip: category === "verified" ? offset : 0,
      });

      subscribers = subscribers.concat(
        verifiedUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          source: "registered",
          subscribedAt: u.createdAt,
          category: "verified",
        }))
      );

      if (category === "verified") {
        total = await db.user.count({
          where: {
            emailVerified: { not: null },
            ...(search ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            } : {}),
          },
        });
      }
    }

    if (category === "all" || category === "backers") {
      const backerUserIds = await db.pledge.findMany({
        where: { status: "COMPLETED" },
        select: { userId: true },
        distinct: ["userId"],
      });

      const backerUsers = await db.user.findMany({
        where: {
          id: { in: backerUserIds.map(b => b.userId) },
          ...(search ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: category === "all" ? Math.floor(limit / 5) : limit,
        skip: category === "backers" ? offset : 0,
      });

      subscribers = subscribers.concat(
        backerUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          source: "backer",
          subscribedAt: u.createdAt,
          category: "backers",
        }))
      );

      if (category === "backers") {
        total = backerUserIds.length;
      }
    }

    if (category === "all" || category === "creators") {
      const creatorUsers = await db.user.findMany({
        where: {
          projects: { some: {} },
          ...(search ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: category === "all" ? Math.floor(limit / 5) : limit,
        skip: category === "creators" ? offset : 0,
      });

      subscribers = subscribers.concat(
        creatorUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          source: "creator",
          subscribedAt: u.createdAt,
          category: "creators",
        }))
      );

      if (category === "creators") {
        total = await db.user.count({
          where: {
            projects: { some: {} },
            ...(search ? {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            } : {}),
          },
        });
      }
    }

    if (category === "all" || category === "retailers") {
      const retailerSubs = await db.newsletterSubscriber.findMany({
        where: {
          isActive: true,
          source: { contains: "retailer", mode: "insensitive" },
          ...searchFilter,
        },
        select: {
          id: true,
          email: true,
          name: true,
          source: true,
          subscribedAt: true,
        },
        orderBy: { subscribedAt: "desc" },
        take: category === "all" ? Math.floor(limit / 5) : limit,
        skip: category === "retailers" ? offset : 0,
      });

      subscribers = subscribers.concat(
        retailerSubs.map((s: { id: string; email: string; name: string | null; source: string; subscribedAt: Date | null }) => ({
          ...s,
          category: "retailers",
        }))
      );

      if (category === "retailers") {
        total = await db.newsletterSubscriber.count({
          where: { isActive: true, source: { contains: "retailer", mode: "insensitive" }, ...searchFilter },
        });
      }
    }

    if (category === "all") {
      total = newsletterCount + verifiedUsersCount + retailersCount; // Rough estimate for all
    }

    return NextResponse.json({
      subscribers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        newsletter: newsletterCount,
        verified: verifiedUsersCount,
        backers: backersCount,
        creators: creatorsCount,
        retailers: retailersCount,
        total: newsletterCount + verifiedUsersCount + retailersCount, // Dedupe would be ideal but this is estimate
      },
    });
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscribers" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a newsletter subscriber
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const category = searchParams.get("category");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (category === "newsletter") {
      await db.newsletterSubscriber.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriber" },
      { status: 500 }
    );
  }
}
