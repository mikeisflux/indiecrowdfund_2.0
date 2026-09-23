import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminSocialPostLogger = logger.child({ module: "admin-social-post" });

export const dynamic = "force-dynamic";

// Edit / approve / reject a queued post. POSTED rows are immutable —
// the row is the audit record of what actually went out publicly.
const patchSchema = z
  .object({
    content: z.string().trim().min(1).max(280).optional(),
    status: z.enum(["APPROVED", "REJECTED", "PENDING"]).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { content, status } = parsed.data;
    if (content === undefined && status === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const post = await db.socialPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.status === "POSTED") {
      return NextResponse.json(
        { error: "This post has already been published and cannot be changed" },
        { status: 409 }
      );
    }

    const updated = await db.socialPost.update({
      where: { id },
      data: {
        ...(content !== undefined ? { content } : {}),
        // Re-approving a FAILED post clears the old error so a later
        // failure isn't misread against a stale message.
        ...(status !== undefined ? { status, error: null } : {}),
      },
    });

    return NextResponse.json({ post: updated });
  } catch (error) {
    adminSocialPostLogger.error({ err: formatError(error) }, "Failed to update social post");
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const post = await db.socialPost.findUnique({ where: { id }, select: { status: true } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.status === "POSTED") {
      // Deleting the row wouldn't delete the tweet; keep the record.
      return NextResponse.json(
        { error: "Published posts are kept as an audit record" },
        { status: 409 }
      );
    }

    await db.socialPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    adminSocialPostLogger.error({ err: formatError(error) }, "Failed to delete social post");
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
