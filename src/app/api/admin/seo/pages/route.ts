import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSeoPagesLogger = logger.child({ module: "admin-seo-pages" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - List all SeoPageMeta entries with optional search
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    const where = query
      ? {
          OR: [
            { path: { contains: query, mode: "insensitive" as const } },
            { title: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [pages, total] = await Promise.all([
      db.seoPageMeta.findMany({
        where,
        orderBy: { path: "asc" },
      }),
      db.seoPageMeta.count({ where }),
    ]);

    return NextResponse.json({
      data: pages,
      stats: {
        total,
        withTitle: pages.filter((p: { title: string | null }) => p.title).length,
        withDescription: pages.filter((p: { description: string | null }) => p.description).length,
        withOgTags: pages.filter((p: { ogTitle: string | null; ogDescription: string | null }) => p.ogTitle && p.ogDescription).length,
        noIndexCount: pages.filter((p: { noIndex: boolean }) => p.noIndex).length,
      },
    });
  } catch (error) {
    adminSeoPagesLogger.error({ err: String(error) }, "Error fetching SEO pages:");
    return NextResponse.json(
      { error: "Failed to fetch SEO pages" },
      { status: 500 }
    );
  }
}

// POST - Create or update a SeoPageMeta entry (upsert by path)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      path,
      title,
      description,
      ogTitle,
      ogDescription,
      ogImage,
      twitterTitle,
      twitterDesc,
      canonicalUrl,
      noIndex,
      noFollow,
      keywords,
      jsonLd,
    } = body;

    if (!path || typeof path !== "string") {
      return NextResponse.json(
        { error: "Path is required and must be a string" },
        { status: 400 }
      );
    }

    // Normalize path to start with /
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // Use findFirst + create/update pattern to avoid composite key issues
    const existing = await db.seoPageMeta.findFirst({
      where: { path: normalizedPath },
    });

    const data = {
      title: title ?? null,
      description: description ?? null,
      ogTitle: ogTitle ?? null,
      ogDescription: ogDescription ?? null,
      ogImage: ogImage ?? null,
      twitterTitle: twitterTitle ?? null,
      twitterDesc: twitterDesc ?? null,
      canonicalUrl: canonicalUrl ?? null,
      noIndex: noIndex ?? false,
      noFollow: noFollow ?? false,
      keywords: keywords ?? [],
      jsonLd: jsonLd ?? null,
    };

    let pageMeta;
    if (existing) {
      pageMeta = await db.seoPageMeta.update({
        where: { id: existing.id },
        data,
      });
    } else {
      // Catch P2002 unique violation on path — another concurrent request
      // may have created this record between our findFirst and now.
      try {
        pageMeta = await db.seoPageMeta.create({
          data: {
            path: normalizedPath,
            ...data,
          },
        });
      } catch (createErr) {
        const isUniqueViolation =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr &&
          (createErr as { code?: string }).code === "P2002";
        if (isUniqueViolation) {
          // Row was created concurrently — update it instead.
          const concurrentMeta = await db.seoPageMeta.findFirst({ where: { path: normalizedPath } });
          if (concurrentMeta) {
            pageMeta = await db.seoPageMeta.update({ where: { id: concurrentMeta.id }, data });
          } else {
            throw createErr;
          }
        } else {
          throw createErr;
        }
      }
    }

    return NextResponse.json({
      data: pageMeta,
      stats: {
        action: existing ? "updated" : "created",
        path: normalizedPath,
      },
    });
  } catch (error) {
    adminSeoPagesLogger.error({ err: String(error) }, "Error saving SEO page meta:");
    return NextResponse.json(
      { error: "Failed to save SEO page meta" },
      { status: 500 }
    );
  }
}
