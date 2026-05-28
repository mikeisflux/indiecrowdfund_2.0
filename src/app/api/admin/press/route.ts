import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const adminPressLogger = logger.child({ module: "admin-press" });

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true, id: true },
  });
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return null;
  return user;
}

// GET — list press releases (admin view sees drafts too).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const releases = await db.pressRelease.findMany({
      where: { deletedAt: null },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        // Include content too so the admin edit dialog can prefill
        // without a second round-trip. Press releases are few + each
        // body is well under the bandwidth budget of an admin view.
        content: true,
        imageUrl: true,
        authorName: true,
        isPublished: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ releases });
  } catch (error) {
    adminPressLogger.error({ err: formatError(error) }, "Failed to list press releases");
    return NextResponse.json(
      { error: "Failed to list press releases" },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(1000).optional().nullable(),
  content: z.string().min(1),
  imageUrl: z.string().max(2000).optional().nullable(),
  authorName: z.string().max(200).optional().nullable(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime().optional().nullable(),
});

// POST — create a press release.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const parse = createSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") },
        { status: 400 }
      );
    }
    const data = parse.data;

    // Unique-slug check up front for a friendly error (the @unique
    // constraint would catch it anyway with a P2002, but this skips the
    // round-trip-and-rethrow dance).
    const existing = await db.pressRelease.findFirst({
      where: { slug: data.slug, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A press release with slug "${data.slug}" already exists` },
        { status: 409 }
      );
    }

    // Default publishedAt to now when isPublished flips on and the
    // admin didn't supply one. This is what the changelog and most
    // blog-style CMSs do — saves the admin a click on the common path.
    const isPublished = data.isPublished ?? false;
    const publishedAt = data.publishedAt
      ? new Date(data.publishedAt)
      : isPublished
        ? new Date()
        : null;

    const release = await db.pressRelease.create({
      data: {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt ?? null,
        content: data.content,
        imageUrl: data.imageUrl ?? null,
        authorName: data.authorName ?? null,
        isPublished,
        publishedAt,
      },
    });
    return NextResponse.json({ release });
  } catch (error) {
    adminPressLogger.error({ err: formatError(error) }, "Failed to create press release");
    return NextResponse.json(
      { error: "Failed to create press release" },
      { status: 500 }
    );
  }
}
