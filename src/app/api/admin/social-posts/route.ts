import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminSocialPostsLogger = logger.child({ module: "admin-social-posts" });

// AI Publicist queue, list view. Project titles are joined in
// application code because SocialPost.projectId is a plain column
// (no FK — see the schema comment).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const status = req.nextUrl.searchParams.get("status");
    const posts = await db.socialPost.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const projectIds = [
      ...new Set(
        posts.map((p: { projectId: string | null }) => p.projectId).filter((id: string | null): id is string => !!id)
      ),
    ];
    const projects = projectIds.length
      ? await db.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true,
            title: true,
            slug: true,
            creator: { select: { vanityUrl: true } },
          },
        })
      : [];
    const projectById = new Map(
      projects.map((p: { id: string; title: string; slug: string; creator: { vanityUrl: string | null } | null }) => [
        p.id,
        {
          title: p.title,
          url: p.creator?.vanityUrl ? `/projects/${p.creator.vanityUrl}/${p.slug}` : `/projects/${p.slug}`,
        },
      ])
    );

    const counts = await db.socialPost.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return NextResponse.json({
      posts: posts.map((p: (typeof posts)[number]) => ({
        ...p,
        project: p.projectId ? (projectById.get(p.projectId) ?? null) : null,
      })),
      counts: Object.fromEntries(
        counts.map((c: { status: string; _count: { _all: number } }) => [c.status, c._count._all])
      ),
    });
  } catch (error) {
    adminSocialPostsLogger.error({ err: formatError(error) }, "Failed to list social posts");
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}
