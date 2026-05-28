import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const adminPressIdLogger = logger.child({ module: "admin-press-id" });

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

const updateSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(1).max(300).optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  content: z.string().min(1).optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  authorName: z.string().max(200).nullable().optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

// PATCH — update a press release.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parse = updateSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") },
        { status: 400 }
      );
    }
    const data = parse.data;

    const existing = await db.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, isPublished: true, publishedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Press release not found" }, { status: 404 });
    }

    if (data.slug) {
      const slugTaken = await db.pressRelease.findFirst({
        where: { slug: data.slug, NOT: { id }, deletedAt: null },
        select: { id: true },
      });
      if (slugTaken) {
        return NextResponse.json(
          { error: `A press release with slug "${data.slug}" already exists` },
          { status: 409 }
        );
      }
    }

    // Auto-stamp publishedAt the first time isPublished flips on, unless
    // the admin sent one explicitly. Matches the create-route default.
    let publishedAt = data.publishedAt !== undefined
      ? (data.publishedAt ? new Date(data.publishedAt) : null)
      : undefined;
    if (
      publishedAt === undefined &&
      data.isPublished === true &&
      !existing.isPublished &&
      !existing.publishedAt
    ) {
      publishedAt = new Date();
    }

    const release = await db.pressRelease.update({
      where: { id },
      data: {
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.authorName !== undefined ? { authorName: data.authorName } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(publishedAt !== undefined ? { publishedAt } : {}),
      },
    });
    return NextResponse.json({ release });
  } catch (error) {
    adminPressIdLogger.error({ err: formatError(error) }, "Failed to update press release");
    return NextResponse.json(
      { error: "Failed to update press release" },
      { status: 500 }
    );
  }
}

// DELETE — soft-delete a press release (matches the codebase convention).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await db.pressRelease.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Press release not found" }, { status: 404 });
    }
    await db.pressRelease.update({
      where: { id },
      data: { deletedAt: new Date(), isPublished: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    adminPressIdLogger.error({ err: formatError(error) }, "Failed to delete press release");
    return NextResponse.json(
      { error: "Failed to delete press release" },
      { status: 500 }
    );
  }
}
