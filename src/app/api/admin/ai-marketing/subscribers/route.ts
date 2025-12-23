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

// Helper to extract tags from source field
function extractTags(source: string | null): string[] {
  if (!source) return [];
  const tags: string[] = [];

  // Extract creator tag from "creator_import:creatorName" format
  if (source.startsWith("creator_import:")) {
    const creatorName = source.replace("creator_import:", "");
    if (creatorName) {
      tags.push(creatorName);
    }
  }

  // Add other source-based tags
  if (source.includes("retailer")) {
    tags.push("retailer");
  }

  return tags;
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
    // Validate pagination parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const offset = (page - 1) * limit;

    // Get counts for each category
    // For newsletter subscribers, we want all active subscribers EXCEPT those with "retailer" in source
    const retailerFilter = { source: { contains: "retailer", mode: "insensitive" as const } };

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
          NOT: retailerFilter,
        },
      }),
      db.user.count({ where: { emailVerified: { not: null } } }),
      db.pledge.findMany({
        where: { status: "COMPLETED" },
        select: { userId: true },
        distinct: ["userId"],
      }).then(pledges => pledges.length),
      db.user.count({ where: { createdProjects: { some: {} } } }),
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
      tags: string[];
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
          NOT: retailerFilter,
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
          tags: extractTags(s.source),
        }))
      );

      if (category === "newsletter") {
        total = await db.newsletterSubscriber.count({
          where: {
            isActive: true,
            NOT: retailerFilter,
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
          tags: [],
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
          tags: [],
        }))
      );

      if (category === "backers") {
        total = backerUserIds.length;
      }
    }

    if (category === "all" || category === "creators") {
      const creatorUsers = await db.user.findMany({
        where: {
          createdProjects: { some: {} },
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
          tags: [],
        }))
      );

      if (category === "creators") {
        total = await db.user.count({
          where: {
            createdProjects: { some: {} },
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
          tags: extractTags(s.source),
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

// POST - Create a new newsletter subscriber
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json();
    const { email, name, source } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if subscriber already exists
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json({ error: "Subscriber already exists" }, { status: 409 });
      }
      // Reactivate if previously deactivated
      const updated = await db.newsletterSubscriber.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name: name || existing.name,
          source: source || existing.source || "manual",
        },
      });
      return NextResponse.json({ success: true, subscriber: updated, reactivated: true });
    }

    // Create new subscriber
    const subscriber = await db.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        source: source || "manual",
        isActive: true,
        subscribedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, subscriber });
  } catch (error) {
    console.error("Error creating subscriber:", error);
    return NextResponse.json(
      { error: "Failed to create subscriber" },
      { status: 500 }
    );
  }
}

// PATCH - Update a newsletter subscriber
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json();
    const { id, email, name, source, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Check if subscriber exists
    const existing = await db.newsletterSubscriber.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // If email is changing, check it's not already taken
    if (email && email.toLowerCase() !== existing.email) {
      const emailExists = await db.newsletterSubscriber.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (emailExists) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    // Update subscriber
    const subscriber = await db.newsletterSubscriber.update({
      where: { id },
      data: {
        ...(email && { email: email.toLowerCase() }),
        ...(name !== undefined && { name }),
        ...(source && { source }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, subscriber });
  } catch (error) {
    console.error("Error updating subscriber:", error);
    return NextResponse.json(
      { error: "Failed to update subscriber" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a newsletter subscriber or remove duplicates
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
    const action = searchParams.get("action");

    // Handle remove duplicates action
    if (action === "remove-duplicates") {
      const targetCategory = category || "newsletter";

      if (targetCategory === "newsletter" || targetCategory === "retailers" || targetCategory === "all") {
        // Find all newsletter subscribers
        const allSubscribers = await db.newsletterSubscriber.findMany({
          where: { isActive: true },
          select: { id: true, email: true, createdAt: true },
          orderBy: { createdAt: "asc" }, // Keep oldest
        });

        // Find duplicates (same email, keep oldest)
        const emailMap = new Map<string, string[]>();
        for (const sub of allSubscribers) {
          const email = sub.email.toLowerCase();
          if (!emailMap.has(email)) {
            emailMap.set(email, []);
          }
          emailMap.get(email)!.push(sub.id);
        }

        // Collect IDs to deactivate (all but first/oldest for each email)
        const idsToDeactivate: string[] = [];
        emailMap.forEach((ids) => {
          if (ids.length > 1) {
            // Skip the first (oldest), deactivate the rest
            idsToDeactivate.push(...ids.slice(1));
          }
        });

        if (idsToDeactivate.length > 0) {
          await db.newsletterSubscriber.updateMany({
            where: { id: { in: idsToDeactivate } },
            data: { isActive: false },
          });
        }

        return NextResponse.json({
          success: true,
          removed: idsToDeactivate.length,
          message: `Removed ${idsToDeactivate.length} duplicate subscribers`,
        });
      }

      return NextResponse.json({
        success: true,
        removed: 0,
        message: "No duplicates to remove in this category",
      });
    }

    // Regular delete by ID
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (category === "newsletter" || category === "retailers") {
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
