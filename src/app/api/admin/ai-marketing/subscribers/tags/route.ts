import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminAiMarketingSubscribersTagsLogger = logger.child({ module: "admin-ai-marketing-subscribers-tags" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper to check admin role
async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
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

    // Create segment groups dynamically from actual data
    const segments: Array<{
      id: string;
      name: string;
      description: string;
      count: number;
      filterType: "source" | "tag";
      filterValues: string[];
    }> = [];

    // Add source-based segments for each unique source
    for (const [source, count] of Object.entries(sourceCounts)) {
      if (count === 0) continue;

      // Format the source name nicely
      let displayName = source;
      let description = `Subscribers with source "${source}"`;

      if (source === "creator_import") {
        displayName = "Creator Imports";
        description = "Subscribers imported by creators";
      } else if (source === "csv_import") {
        displayName = "CSV Imports";
        description = "Subscribers imported via CSV upload";
      } else if (source === "website_signup" || source === "self_signup") {
        displayName = "Website Sign-ups";
        description = "Users who signed up directly on the website";
      } else if (source === "footer_signup") {
        displayName = "Footer Sign-ups";
        description = "Users who signed up via the website footer";
      } else if (source === "teaser_signup") {
        displayName = "Teaser Sign-ups";
        description = "Users who signed up via project teasers";
      } else if (source === "registered") {
        displayName = "Registered Users";
        description = "Users with verified accounts on the platform";
      } else if (source === "manual") {
        displayName = "Manually Added";
        description = "Subscribers added manually by admins";
      }

      segments.push({
        id: `source-${source}`,
        name: displayName,
        description,
        count,
        filterType: "source",
        filterValues: [source],
      });
    }

    // Add tag-based segments
    for (const tag of tags) {
      segments.push({
        id: `tag-${tag.name}`,
        name: tag.name,
        description: `Subscribers tagged with "${tag.name}"`,
        count: tag.count,
        filterType: "tag",
        filterValues: [tag.name],
      });
    }

    // Sort segments by count (highest first)
    segments.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      tags,
      sources,
      segments,
      totalSubscribers: subscribers.length,
    });
  } catch (error) {
    adminAiMarketingSubscribersTagsLogger.error({ err: formatError(error) }, "Error fetching subscriber tags:");
    return NextResponse.json(
      { error: "Failed to fetch subscriber tags" },
      { status: 500 }
    );
  }
}
