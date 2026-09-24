import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { generateSocialPostCopy } from "@/lib/ai/anthropic";
import {
  postTweet,
  uploadTwitterMedia,
  type TwitterCredentials,
} from "@/lib/social/twitter";
import { fetchImage } from "@/lib/social/publicist";

const creatorSocialLogger = logger.child({ module: "creator-social" });

/**
 * Creator Social Hub — per-creator X posting.
 *
 * Creators connect their OWN X developer credentials (X's API has no
 * post-on-behalf grant without an approved OAuth partner app, so each
 * account brings its own keys, same as the platform account under Admin
 * Settings > Social). Posts written or scheduled in the dashboard's
 * Social Hub live in CreatorSocialPost and are published here — called
 * every tick of /api/cron/social-publicist and directly by "Post now".
 */

// Per cron tick, across all creators — the same conservative pacing the
// platform queue uses, applied per account below.
const MAX_CREATOR_PUBLISHES_PER_RUN = 10;
const MAX_PER_ACCOUNT_PER_RUN = 2;
// Auto-post moments per account per tick.
const MAX_AUTO_POSTS_PER_ACCOUNT = 2;

const LAUNCH_WINDOW_HOURS = 48;
const ENDING_SOON_HOURS = 72;

export function decryptAccountCredentials(account: {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}): TwitterCredentials {
  const read = (raw: string): string => {
    try {
      return decryptSecret(raw);
    } catch {
      return raw;
    }
  };
  return {
    apiKey: read(account.apiKey),
    apiSecret: read(account.apiSecret),
    accessToken: read(account.accessToken),
    accessSecret: read(account.accessSecret),
  };
}

/** Publish one CreatorSocialPost row with the given credentials. */
export async function publishCreatorPost(
  post: { id: string; content: string; imageUrl: string | null },
  creds: TwitterCredentials
): Promise<{ ok: boolean; error?: string }> {
  try {
    const mediaIds: string[] = [];
    if (post.imageUrl) {
      const image = await fetchImage(post.imageUrl);
      if (image) {
        try {
          mediaIds.push(await uploadTwitterMedia(creds, image.buffer, image.contentType));
        } catch (err) {
          // Post without the image rather than not at all.
          creatorSocialLogger.warn(
            { err: formatError(err), postId: post.id },
            "Creator media upload failed; posting text-only"
          );
        }
      }
    }

    const tweetId = await postTweet(creds, post.content, mediaIds.length ? mediaIds : undefined);
    await db.creatorSocialPost.update({
      where: { id: post.id },
      data: { status: "POSTED", externalId: tweetId, postedAt: new Date(), error: null },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.creatorSocialPost
      .update({
        where: { id: post.id },
        data: { status: "FAILED", error: message.slice(0, 2000) },
      })
      .catch(() => {});
    return { ok: false, error: message };
  }
}

export interface CreatorPublishResult {
  posted: number;
  failed: number;
  notes: string[];
}

/**
 * Publish due creator posts (scheduledFor null or in the past) using
 * each creator's own credentials. Credentials are loaded once per
 * account per run; an account whose keys stopped working fails its
 * posts with the API error so the Social Hub shows why.
 */
export async function publishDueCreatorPosts(): Promise<CreatorPublishResult> {
  const now = new Date();
  const due = await db.creatorSocialPost.findMany({
    where: {
      status: "SCHEDULED",
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: MAX_CREATOR_PUBLISHES_PER_RUN,
  });
  if (due.length === 0) return { posted: 0, failed: 0, notes: [] };

  const accountIds = Array.from(new Set(due.map((p: { accountId: string }) => p.accountId)));
  const accounts = await db.creatorSocialAccount.findMany({
    where: { id: { in: accountIds } },
  });
  const credsByAccount = new Map<string, TwitterCredentials>(
    accounts.map((a: { id: string; apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }) => [
      a.id,
      decryptAccountCredentials(a),
    ])
  );

  let posted = 0;
  let failed = 0;
  const notes: string[] = [];
  const perAccount = new Map<string, number>();

  for (const post of due) {
    const soFar = perAccount.get(post.accountId) ?? 0;
    if (soFar >= MAX_PER_ACCOUNT_PER_RUN) continue;

    const creds = credsByAccount.get(post.accountId);
    if (!creds) {
      await db.creatorSocialPost.update({
        where: { id: post.id },
        data: { status: "FAILED", error: "X account disconnected before this post went out" },
      });
      failed++;
      continue;
    }

    perAccount.set(post.accountId, soFar + 1);
    const result = await publishCreatorPost(post, creds);
    if (result.ok) posted++;
    else {
      failed++;
      notes.push(`Post ${post.id}: ${result.error}`);
    }
  }

  return { posted, failed, notes };
}

type CreatorPromotableProject = {
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

function projectUrl(p: CreatorPromotableProject): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  return p.creator?.vanityUrl
    ? `${base}/projects/${p.creator.vanityUrl}/${p.slug}`
    : `${base}/projects/${p.slug}`;
}

function percentFunded(p: CreatorPromotableProject): number {
  const goal = Number(p.goalAmount);
  if (!goal || goal <= 0) return 0;
  return (Number(p.currentAmount) / goal) * 100;
}

function daysLeft(p: CreatorPromotableProject): number | null {
  if (!p.endDate) return null;
  return Math.max(0, Math.ceil((p.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export type CreatorPostType = "launch" | "milestone_50" | "milestone_100" | "ending_soon";

/** AI copy for one of the creator's campaigns, in the creator's voice. */
export async function generateCreatorPostCopy(
  project: CreatorPromotableProject,
  postType: CreatorPostType
): Promise<string> {
  return generateSocialPostCopy({
    postType,
    project: {
      title: project.title,
      category: project.category,
      description: project.description,
      percentFunded: percentFunded(project),
      backerCount: project.backerCount,
      daysLeft: daysLeft(project),
    },
    url: projectUrl(project),
    voice: "creator",
  });
}

export const CREATOR_PROJECT_SELECT = {
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
} as const;

export interface CreatorGenerateResult {
  queued: number;
  notes: string[];
}

/**
 * Auto-post: queue milestone posts for creators who turned the switch
 * on, using the same moments the platform publicist watches — but for
 * the creator's OWN campaigns only, posted from THEIR account. No SFW
 * gate here: what a creator posts to their own X account about their
 * own campaign is their call (X permits adult-adjacent content).
 */
export async function generateCreatorAutoPosts(): Promise<CreatorGenerateResult> {
  const accounts = await db.creatorSocialAccount.findMany({
    where: { autoPostEnabled: true, platform: "twitter" },
    select: { id: true, userId: true },
  });
  if (accounts.length === 0) return { queued: 0, notes: [] };

  const now = new Date();
  let queued = 0;
  const notes: string[] = [];

  for (const account of accounts) {
    const projects = (await db.project.findMany({
      where: { creatorId: account.userId, status: "LIVE", deletedAt: null },
      select: CREATOR_PROJECT_SELECT,
    })) as CreatorPromotableProject[];
    if (projects.length === 0) continue;

    const moments: { postType: CreatorPostType; dedupeKey: string; project: CreatorPromotableProject }[] = [];
    for (const p of projects) {
      const pct = percentFunded(p);
      if (
        p.launchDate &&
        now.getTime() - p.launchDate.getTime() < LAUNCH_WINDOW_HOURS * 60 * 60 * 1000
      ) {
        moments.push({ postType: "launch", dedupeKey: `twitter:${account.userId}:launch:${p.id}`, project: p });
      }
      if (pct >= 100) {
        moments.push({ postType: "milestone_100", dedupeKey: `twitter:${account.userId}:milestone_100:${p.id}`, project: p });
      } else if (pct >= 50) {
        moments.push({ postType: "milestone_50", dedupeKey: `twitter:${account.userId}:milestone_50:${p.id}`, project: p });
      }
      if (
        p.endDate &&
        p.endDate > now &&
        p.endDate.getTime() - now.getTime() < ENDING_SOON_HOURS * 60 * 60 * 1000
      ) {
        moments.push({ postType: "ending_soon", dedupeKey: `twitter:${account.userId}:ending_soon:${p.id}`, project: p });
      }
    }
    if (moments.length === 0) continue;

    const existing = await db.creatorSocialPost.findMany({
      where: { dedupeKey: { in: moments.map((m) => m.dedupeKey) } },
      select: { dedupeKey: true },
    });
    const seen = new Set(existing.map((e: { dedupeKey: string | null }) => e.dedupeKey));
    const fresh = moments.filter((m) => !seen.has(m.dedupeKey));

    for (const moment of fresh.slice(0, MAX_AUTO_POSTS_PER_ACCOUNT)) {
      try {
        const content = await generateCreatorPostCopy(moment.project, moment.postType);
        await db.creatorSocialPost.create({
          data: {
            userId: account.userId,
            accountId: account.id,
            platform: "twitter",
            projectId: moment.project.id,
            content,
            imageUrl: moment.project.imageUrl,
            dedupeKey: moment.dedupeKey,
            scheduledFor: null, // next publish pass sends it
            status: "SCHEDULED",
          },
        });
        queued++;
      } catch (error) {
        notes.push(
          `Auto-post for ${moment.project.title} (${moment.postType}) failed to generate: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  if (queued > 0 || notes.length > 0) {
    creatorSocialLogger.info({ queued, notes }, "Creator auto-posts generated");
  }
  return { queued, notes };
}
