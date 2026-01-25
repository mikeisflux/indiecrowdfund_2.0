import { NextResponse } from "next/server";
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

// GET - Get all unique subscriber tags with counts
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // Get all subscribers with their tags
    const subscribers = await db.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { tags: true, source: true },
    });

    // Count tags
    const tagCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    for (const subscriber of subscribers) {
      // Count tags
      if (subscriber.tags && Array.isArray(subscriber.tags)) {
        for (const tag of subscriber.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
      // Count sources
      if (subscriber.source) {
        sourceCounts[subscriber.source] = (sourceCounts[subscriber.source] || 0) + 1;
      }
    }

    // Convert to arrays sorted by count
    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count, type: "tag" as const }))
      .sort((a, b) => b.count - a.count);

    const sources = Object.entries(sourceCounts)
      .map(([name, count]) => ({ name, count, type: "source" as const }))
      .sort((a, b) => b.count - a.count);

    // Create segment groups
    const segments = [
      {
        id: "self-signup",
        name: "Self Sign-ups",
        description: "Users who signed up directly via the website",
        count: sourceCounts["website_signup"] || sourceCounts["self_signup"] || 0,
        filterType: "source",
        filterValues: ["website_signup", "self_signup", "footer_signup", "teaser_signup"],
      },
      {
        id: "csv-import",
        name: "CSV Imports (Untagged)",
        description: "Imported subscribers without creator tags",
        count: sourceCounts["csv_import"] || 0,
        filterType: "source",
        filterValues: ["csv_import"],
      },
      // Add creator-specific segments from tags
      ...tags
        .filter(t => !["csv_import", "website_signup", "self_signup"].includes(t.name))
        .map(t => ({
          id: `tag-${t.name.toLowerCase().replace(/\s+/g, "-")}`,
          name: t.name,
          description: `Subscribers tagged with "${t.name}"`,
          count: t.count,
          filterType: "tag" as const,
          filterValues: [t.name],
        })),
    ];

    return NextResponse.json({
      tags,
      sources,
      segments,
      totalSubscribers: subscribers.length,
    });
  } catch (error) {
    console.error("Error fetching subscriber tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriber tags" },
      { status: 500 }
    );
  }
}
