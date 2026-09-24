import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  decryptAccountCredentials,
  generateCreatorPostCopy,
  publishCreatorPost,
  CREATOR_PROJECT_SELECT,
  type CreatorPostType,
} from "@/lib/social/creator-social";

const creatorSocialPostsLogger = logger.child({ module: "creator-social-posts" });

// X's hard limit; the composer counts against the same number.
const MAX_POST_LENGTH = 280;

/**
 * Creator Social Hub posts.
 *
 * GET  — the creator's recent posts plus real counts for the analytics
 *        cards (posted / scheduled / failed, this-month posted).
 * POST — actions:
 *   post_now  {content, projectId?, imageUrl?}       publish immediately
 *   schedule  {content, scheduledFor, projectId?, imageUrl?}
 *   generate  {projectId, postType?}                 AI copy (not saved)
 *   cancel    {postId}                               cancel a scheduled post
 *   retry     {postId}                               re-queue a failed post
 *   delete    {postId}                               remove a non-posted row
 */

async function getAccount(userId: string) {
  return db.creatorSocialAccount.findUnique({
    where: { userId_platform: { userId, platform: "twitter" } },
  });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [posts, postedTotal, postedThisMonth, scheduled, failed] = await Promise.all([
      db.creatorSocialPost.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          content: true,
          imageUrl: true,
          projectId: true,
          scheduledFor: true,
          status: true,
          error: true,
          externalId: true,
          postedAt: true,
          createdAt: true,
        },
      }),
      db.creatorSocialPost.count({ where: { userId, status: "POSTED" } }),
      db.creatorSocialPost.count({
        where: { userId, status: "POSTED", postedAt: { gte: monthStart } },
      }),
      db.creatorSocialPost.count({ where: { userId, status: "SCHEDULED" } }),
      db.creatorSocialPost.count({ where: { userId, status: "FAILED" } }),
    ]);

    return NextResponse.json({
      posts,
      stats: { postedTotal, postedThisMonth, scheduled, failed },
    });
  } catch (error) {
    creatorSocialPostsLogger.error({ err: formatError(error) }, "Social posts GET failed");
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await req.json();
    const action = String(body.action || "");

    // Verify project ownership whenever a projectId rides along, so a
    // post can't be attributed to (or generated from) someone else's
    // campaign.
    const projectId: string | null = body.projectId || null;
    if (projectId) {
      const owns = await db.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          OR: [
            { creatorId: userId },
            { collaborators: { some: { userId, status: "ACCEPTED" } } },
          ],
        },
        select: { id: true },
      });
      if (!owns) {
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
      }
    }

    if (action === "generate") {
      if (!projectId) {
        return NextResponse.json(
          { error: "Pick a campaign first — the AI writes from its live data" },
          { status: 400 }
        );
      }
      const project = await db.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: CREATOR_PROJECT_SELECT,
      });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const validTypes: CreatorPostType[] = ["launch", "milestone_50", "milestone_100", "ending_soon"];
      const requested = String(body.postType || "");
      // Default angle from where the campaign actually is.
      const pct = Number(project.goalAmount) > 0
        ? (Number(project.currentAmount) / Number(project.goalAmount)) * 100
        : 0;
      const inferred: CreatorPostType =
        pct >= 100 ? "milestone_100" : pct >= 50 ? "milestone_50" : "launch";
      const postType = (validTypes as string[]).includes(requested)
        ? (requested as CreatorPostType)
        : inferred;

      try {
        const content = await generateCreatorPostCopy(project, postType);
        return NextResponse.json({ content, postType });
      } catch (error) {
        // Most common cause: no Anthropic key configured platform-side.
        return NextResponse.json(
          { error: `Couldn't generate copy: ${error instanceof Error ? error.message : "unknown error"}` },
          { status: 502 }
        );
      }
    }

    if (action === "post_now" || action === "schedule") {
      const account = await getAccount(userId);
      if (!account) {
        return NextResponse.json(
          { error: "Connect your X account first (Connect Account card)" },
          { status: 400 }
        );
      }

      const content = String(body.content || "").trim();
      if (!content) {
        return NextResponse.json({ error: "Post text is required" }, { status: 400 });
      }
      if (content.length > MAX_POST_LENGTH) {
        return NextResponse.json(
          { error: `Post is ${content.length} characters — X allows ${MAX_POST_LENGTH}` },
          { status: 400 }
        );
      }

      const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim()
        ? body.imageUrl.trim()
        : null;

      let scheduledFor: Date | null = null;
      if (action === "schedule") {
        scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
        if (!scheduledFor || isNaN(scheduledFor.getTime())) {
          return NextResponse.json({ error: "A valid schedule time is required" }, { status: 400 });
        }
        if (scheduledFor.getTime() < Date.now() - 60_000) {
          return NextResponse.json({ error: "Schedule time is in the past" }, { status: 400 });
        }
      }

      const post = await db.creatorSocialPost.create({
        data: {
          userId,
          accountId: account.id,
          platform: "twitter",
          projectId,
          content,
          imageUrl,
          scheduledFor,
          status: "SCHEDULED",
        },
      });

      if (action === "post_now") {
        const result = await publishCreatorPost(post, decryptAccountCredentials(account));
        if (!result.ok) {
          return NextResponse.json(
            { error: `X rejected the post: ${result.error}` },
            { status: 502 }
          );
        }
        return NextResponse.json({ success: true, posted: true, postId: post.id });
      }

      return NextResponse.json({ success: true, scheduled: true, postId: post.id });
    }

    if (action === "cancel" || action === "retry" || action === "delete") {
      const postId = String(body.postId || "");
      const post = await db.creatorSocialPost.findFirst({
        where: { id: postId, userId },
        select: { id: true, status: true },
      });
      if (!post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      if (action === "cancel") {
        if (post.status !== "SCHEDULED") {
          return NextResponse.json({ error: "Only scheduled posts can be cancelled" }, { status: 400 });
        }
        await db.creatorSocialPost.update({
          where: { id: post.id },
          data: { status: "CANCELLED" },
        });
        return NextResponse.json({ success: true });
      }

      if (action === "retry") {
        if (post.status !== "FAILED") {
          return NextResponse.json({ error: "Only failed posts can be retried" }, { status: 400 });
        }
        await db.creatorSocialPost.update({
          where: { id: post.id },
          data: { status: "SCHEDULED", scheduledFor: null, error: null },
        });
        return NextResponse.json({ success: true, message: "Re-queued — it goes out on the next publish tick" });
      }

      // delete — never delete a POSTED row; it's the audit trail of what
      // went out publicly.
      if (post.status === "POSTED") {
        return NextResponse.json(
          { error: "Posted posts stay in the history — delete the tweet on X if needed" },
          { status: 400 }
        );
      }
      await db.creatorSocialPost.delete({ where: { id: post.id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    creatorSocialPostsLogger.error({ err: formatError(error) }, "Social posts POST failed");
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
