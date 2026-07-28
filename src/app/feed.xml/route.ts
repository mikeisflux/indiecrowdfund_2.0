import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "rss-feed" });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
const FEED_LIMIT = 50;

// Cache for an hour — feed readers poll frequently and campaign listings
// don't change minute to minute.
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// RSS 2.0 feed of live + recently funded campaigns, requested by a backer who
// wanted to follow new offerings without checking /crowdfunds by hand.
export async function GET() {
  try {
    const projects = await db.project.findMany({
      where: {
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
      },
      select: {
        title: true,
        subtitle: true,
        slug: true,
        category: true,
        imageUrl: true,
        launchDate: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { name: true, vanityUrl: true } },
      },
      orderBy: { launchDate: "desc" },
      take: FEED_LIMIT,
    });

    const items = projects
      .map((project) => {
        const path = project.creator.vanityUrl
          ? `/projects/${project.creator.vanityUrl}/${project.slug}`
          : `/projects/${project.slug}`;
        const url = `${SITE_URL}${path}`;
        const pubDate = (project.launchDate || project.createdAt).toUTCString();
        const description = [
          project.subtitle || "",
          project.creator.name ? `by ${project.creator.name}` : "",
        ]
          .filter(Boolean)
          .join(" — ");

        return `    <item>
      <title>${escapeXml(project.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>${
        project.category ? `\n      <category>${escapeXml(project.category)}</category>` : ""
      }${
        project.imageUrl
          ? `\n      <enclosure url="${escapeXml(project.imageUrl)}" type="image/jpeg" />`
          : ""
      }
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>IndieCrowdfund — Crowdfunds</title>
    <link>${SITE_URL}/crowdfunds</link>
    <description>New and active crowdfunding campaigns on IndieCrowdfund.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to build RSS feed");
    return new Response("Failed to build feed", { status: 500 });
  }
}
