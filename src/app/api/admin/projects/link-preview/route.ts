import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/projects/link-preview?url=...
 *
 * Given an indiecrowdfund project URL, returns the project's main
 * campaign image and title for use in the email editor's auto-image
 * feature. The data returned (title + imageUrl) is already public on
 * the project page, so this only requires any authenticated user
 * rather than SUPER_ADMIN — creators use the same email editor in
 * IndieKit and were getting 403s when pasting their own project
 * URLs.
 *
 * Handles both URL formats:
 *   /projects/[vanityname]/[slug]
 *   /projects/[slug]
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  // Extract path from full URL or relative path
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Already a relative path
  }

  // Match /projects/[vanityname]/[slug] or /projects/[slug]
  const match = path.match(/\/projects\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (!match) {
    return NextResponse.json({ found: false });
  }

  const [, segment1, segment2] = match;
  // If two segments: segment1 = vanityname, segment2 = slug
  // If one segment: segment1 = slug
  const slug = segment2 || segment1;

  const project = await db.project.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, title: true, imageUrl: true, slug: true },
  });

  if (!project) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    imageUrl: project.imageUrl,
    title: project.title,
  });
}
