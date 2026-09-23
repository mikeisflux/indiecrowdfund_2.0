import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getTwitterCredentials, postTweet, uploadTwitterMedia } from "@/lib/social/twitter";

const adminSocialPublishLogger = logger.child({ module: "admin-social-post-publish" });

export const dynamic = "force-dynamic";

// "Post Now" — publish a single queued post immediately, bypassing the
// cron's pacing. Approving-and-posting in one click also covers retry
// of a FAILED post. Deliberately does NOT check autoPostEnabled: that
// switch gates the AUTOMATIC pipeline, not an admin explicitly
// clicking a button.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const post = await db.socialPost.findUnique({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.status === "POSTED") {
      return NextResponse.json({ error: "Already posted" }, { status: 409 });
    }
    if (post.status === "REJECTED") {
      return NextResponse.json(
        { error: "This post was rejected — set it back to pending first" },
        { status: 409 }
      );
    }

    const creds = await getTwitterCredentials();
    if (!creds) {
      return NextResponse.json(
        {
          error:
            "X credentials are not configured. Add API Key, API Secret, Access Token, and Access Token Secret under Admin Settings > Social.",
        },
        { status: 400 }
      );
    }

    const mediaIds: string[] = [];
    if (post.imageUrl) {
      try {
        const base = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
        const url = post.imageUrl.startsWith("/") ? `${base}${post.imageUrl}` : post.imageUrl;
        const res = await fetch(url);
        const contentType = res.headers.get("content-type") || "image/jpeg";
        if (res.ok && contentType.startsWith("image/")) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
            mediaIds.push(await uploadTwitterMedia(creds, buffer, contentType));
          }
        }
      } catch (err) {
        adminSocialPublishLogger.warn({ err, postId: id }, "Media upload failed; posting text-only");
      }
    }

    try {
      const tweetId = await postTweet(creds, post.content, mediaIds.length ? mediaIds : undefined);
      const updated = await db.socialPost.update({
        where: { id },
        data: { status: "POSTED", externalId: tweetId, postedAt: new Date(), error: null },
      });
      return NextResponse.json({ post: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const updated = await db.socialPost.update({
        where: { id },
        data: { status: "FAILED", error: msg.slice(0, 2000) },
      });
      return NextResponse.json({ error: msg, post: updated }, { status: 502 });
    }
  } catch (error) {
    adminSocialPublishLogger.error({ err: formatError(error) }, "Post-now failed");
    return NextResponse.json({ error: "Failed to publish post" }, { status: 500 });
  }
}
