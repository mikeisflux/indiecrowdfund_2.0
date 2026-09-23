import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateSocialPostCopy } from "@/lib/ai/anthropic";
import { getTwitterCredentials, postTweet, uploadTwitterMedia } from "@/lib/social/twitter";

const publicistLogger = logger.child({ module: "social-publicist" });

/**
 * The AI publicist: advertises the platform outward, on its own.
 *
 * The email automation (src/lib/ai/automation.ts) markets to people
 * already in the database. This module is the other half — it watches
 * the platform for moments worth telling the PUBLIC about, writes the
 * post with the same Anthropic pipeline, and publishes to the
 * platform's X account:
 *
 *   launch         — a campaign went live in the last 48h
 *   milestone_50   — a live campaign crossed half funded
 *   milestone_100  — a live campaign fully funded
 *   ending_soon    — a live campaign is inside its final 72h
 *   weekly_roundup — Sunday platform pulse (live count, week's pledges)
 *
 * Every moment gets exactly one post ever (SocialPost.dedupeKey is
 * unique), so re-runs are idempotent. PlatformSettings gates:
 * autoPostEnabled is the master switch; postApprovalRequired decides
 * whether posts wait in /admin/social-publicist or go out on the next
 * cron tick.
 *
 * Content safety: X permits this platform's subject matter, but only
 * projects whose creator agreed their PROMO materials are SFW
 * (promoContentSfw) are auto-promoted at all — a public feed is not
 * the place to gamble on someone else's cover art.
 */

const LAUNCH_WINDOW_HOURS = 48;
const ENDING_SOON_HOURS = 72;
// Never queue more than this many new posts per generation run — a
// backlog of eligible moments (first run ever, say) should trickle
// out, not firehose the account.
const MAX_NEW_POSTS_PER_RUN = 3;
// And never PUBLISH more than this many per run (cron runs hourly, so
// this caps the account at a civilized posting rate).
const MAX_PUBLISHES_PER_RUN = 2;

interface PublicistSettings {
  autoPostEnabled: boolean;
  postApprovalRequired: boolean;
}

async function getPublicistSettings(): Promise<PublicistSettings | null> {
  const settings = await db.platformSettings.findFirst({
    select: { autoPostEnabled: true, postApprovalRequired: true },
  });
  if (!settings) return null;
  return {
    autoPostEnabled: settings.autoPostEnabled,
    postApprovalRequired: settings.postApprovalRequired,
  };
}

type PromotableProject = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  imageUrl: string | null;
  goalAmount: unknown;
  currentAmount: unknown;
  backerCount: number;
  endDate: Date | null;
  launchDate: Date | null;
  creator: { vanityUrl: string | null } | null;
};

function projectUrl(p: PromotableProject): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  return p.creator?.vanityUrl
    ? `${base}/projects/${p.creator.vanityUrl}/${p.slug}`
    : `${base}/projects/${p.slug}`;
}

function percentFunded(p: PromotableProject): number {
  const goal = Number(p.goalAmount);
  const current = Number(p.currentAmount);
  if (!goal || goal <= 0) return 0;
  return (current / goal) * 100;
}

function daysLeft(p: PromotableProject): number | null {
  if (!p.endDate) return null;
  return Math.max(0, Math.ceil((p.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

interface Moment {
  postType: "launch" | "milestone_50" | "milestone_100" | "ending_soon" | "weekly_roundup";
  dedupeKey: string;
  project?: PromotableProject;
}

/** ISO week key like "2026-W39" for the roundup dedupe. */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function findMoments(): Promise<Moment[]> {
  const now = new Date();
  const moments: Moment[] = [];

  const liveProjects = (await db.project.findMany({
    where: {
      status: "LIVE",
      deletedAt: null,
      promoContentSfw: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      imageUrl: true,
      goalAmount: true,
      currentAmount: true,
      backerCount: true,
      endDate: true,
      launchDate: true,
      creator: { select: { vanityUrl: true } },
    },
  })) as PromotableProject[];

  for (const p of liveProjects) {
    const pct = percentFunded(p);
    const launched = p.launchDate ?? null;

    if (
      launched &&
      now.getTime() - launched.getTime() < LAUNCH_WINDOW_HOURS * 60 * 60 * 1000
    ) {
      moments.push({ postType: "launch", dedupeKey: `twitter:launch:${p.id}`, project: p });
    }

    if (pct >= 100) {
      moments.push({
        postType: "milestone_100",
        dedupeKey: `twitter:milestone_100:${p.id}`,
        project: p,
      });
    } else if (pct >= 50) {
      moments.push({
        postType: "milestone_50",
        dedupeKey: `twitter:milestone_50:${p.id}`,
        project: p,
      });
    }

    if (
      p.endDate &&
      p.endDate > now &&
      p.endDate.getTime() - now.getTime() < ENDING_SOON_HOURS * 60 * 60 * 1000
    ) {
      moments.push({
        postType: "ending_soon",
        dedupeKey: `twitter:ending_soon:${p.id}`,
        project: p,
      });
    }
  }

  // Sunday platform pulse — only when there's something live to point at.
  if (now.getDay() === 0 && liveProjects.length > 0) {
    moments.push({
      postType: "weekly_roundup",
      dedupeKey: `twitter:weekly_roundup:${isoWeekKey(now)}`,
    });
  }

  return moments;
}

export interface GenerateResult {
  queued: number;
  skippedExisting: number;
  notes: string[];
}

/**
 * Phase 1 — find moments and queue posts for them. Idempotent: a
 * moment already in SocialPost (any status, including REJECTED) is
 * never queued again.
 */
export async function generateSocialPosts(): Promise<GenerateResult> {
  const settings = await getPublicistSettings();
  if (!settings?.autoPostEnabled) {
    return { queued: 0, skippedExisting: 0, notes: ["autoPostEnabled is off — nothing generated"] };
  }

  const moments = await findMoments();
  if (moments.length === 0) {
    return { queued: 0, skippedExisting: 0, notes: ["No postable moments right now"] };
  }

  const existing = await db.socialPost.findMany({
    where: { dedupeKey: { in: moments.map((m) => m.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const seen = new Set(existing.map((e: { dedupeKey: string }) => e.dedupeKey));
  const fresh = moments.filter((m) => !seen.has(m.dedupeKey));

  const notes: string[] = [];
  let queued = 0;

  for (const moment of fresh.slice(0, MAX_NEW_POSTS_PER_RUN)) {
    try {
      let content: string;
      let imageUrl: string | null = null;
      let projectId: string | null = null;

      if (moment.project) {
        content = await generateSocialPostCopy({
          postType: moment.postType,
          project: {
            title: moment.project.title,
            category: moment.project.category,
            description: moment.project.description,
            percentFunded: percentFunded(moment.project),
            backerCount: moment.project.backerCount,
            daysLeft: daysLeft(moment.project),
          },
          url: projectUrl(moment.project),
        });
        imageUrl = moment.project.imageUrl;
        projectId = moment.project.id;
      } else {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [liveCampaigns, pledged, newCampaigns] = await Promise.all([
          db.project.count({ where: { status: "LIVE", deletedAt: null } }),
          db.pledge.aggregate({
            where: { status: "COMPLETED", deletedAt: null, createdAt: { gte: weekAgo } },
            _sum: { amount: true },
          }),
          db.project.count({
            where: { status: "LIVE", deletedAt: null, launchDate: { gte: weekAgo } },
          }),
        ]);
        content = await generateSocialPostCopy({
          postType: "weekly_roundup",
          platformStats: {
            liveCampaigns,
            totalPledgedThisWeek: Number(pledged._sum.amount ?? 0),
            newCampaignsThisWeek: newCampaigns,
          },
          url: `${process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com"}/projects`,
        });
      }

      await db.socialPost.create({
        data: {
          platform: "twitter",
          postType: moment.postType,
          dedupeKey: moment.dedupeKey,
          projectId,
          content,
          imageUrl,
          status: settings.postApprovalRequired ? "PENDING" : "APPROVED",
        },
      });
      queued++;
    } catch (err) {
      // One failed generation must not stop the rest; the moment stays
      // unclaimed and the next run retries it.
      const msg = err instanceof Error ? err.message : String(err);
      publicistLogger.error({ err, dedupeKey: moment.dedupeKey }, "Post generation failed");
      notes.push(`${moment.dedupeKey}: ${msg}`);
    }
  }

  if (fresh.length > MAX_NEW_POSTS_PER_RUN) {
    notes.push(`${fresh.length - MAX_NEW_POSTS_PER_RUN} more moment(s) deferred to next run`);
  }

  return { queued, skippedExisting: moments.length - fresh.length, notes };
}

export interface PublishResult {
  posted: number;
  failed: number;
  notes: string[];
}

/** Fetch a post image, tolerant of same-origin paths and remote URLs. */
async function fetchImage(
  imageUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  const url = imageUrl.startsWith("/") ? `${base}${imageUrl}` : imageUrl;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    // X caps images at 5MB.
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return null;
    return { buffer, contentType };
  } catch {
    return null;
  }
}

/**
 * Phase 2 — publish APPROVED posts, oldest first. A failed post is
 * marked FAILED with the API error and never retried automatically
 * (the admin queue has a Post Now button for that) — silent retry
 * loops against a posting API are how accounts get suspended.
 */
export async function publishApprovedPosts(): Promise<PublishResult> {
  const settings = await getPublicistSettings();
  if (!settings?.autoPostEnabled) {
    return { posted: 0, failed: 0, notes: ["autoPostEnabled is off — nothing published"] };
  }

  const approved = await db.socialPost.findMany({
    where: { status: "APPROVED", platform: "twitter" },
    orderBy: { createdAt: "asc" },
    take: MAX_PUBLISHES_PER_RUN,
  });
  if (approved.length === 0) {
    return { posted: 0, failed: 0, notes: [] };
  }

  const creds = await getTwitterCredentials();
  if (!creds) {
    return {
      posted: 0,
      failed: 0,
      notes: [
        `${approved.length} approved post(s) waiting, but X credentials are not configured (Admin Settings > Social: API Key, API Secret, Access Token, Access Token Secret)`,
      ],
    };
  }

  let posted = 0;
  let failed = 0;
  const notes: string[] = [];

  for (const post of approved) {
    try {
      const mediaIds: string[] = [];
      if (post.imageUrl) {
        const image = await fetchImage(post.imageUrl);
        if (image) {
          try {
            mediaIds.push(await uploadTwitterMedia(creds, image.buffer, image.contentType));
          } catch (err) {
            // Post without the image rather than not at all.
            publicistLogger.warn({ err, postId: post.id }, "Media upload failed; posting text-only");
          }
        }
      }

      const tweetId = await postTweet(creds, post.content, mediaIds.length ? mediaIds : undefined);
      await db.socialPost.update({
        where: { id: post.id },
        data: { status: "POSTED", externalId: tweetId, postedAt: new Date(), error: null },
      });
      posted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.socialPost.update({
        where: { id: post.id },
        data: { status: "FAILED", error: msg.slice(0, 2000) },
      });
      failed++;
      notes.push(`${post.id}: ${msg}`);
      publicistLogger.error({ err, postId: post.id }, "Publish failed");
    }
  }

  return { posted, failed, notes };
}
