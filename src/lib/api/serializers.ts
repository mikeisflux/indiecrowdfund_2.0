/**
 * Public shapes for the Data API.
 *
 * These are ALLOWLISTS, not omit-lists, and that is the entire safety model.
 * A `select` that names every safe field cannot start leaking a new one when
 * somebody adds a column to Project — whereas an omit-list silently would.
 * Nothing in this file may return a field that isn't already visible to an
 * anonymous visitor on the public site.
 *
 * Deliberately never exposed, all of which live on the same rows:
 *   contactEmail, bankAccountId, stripeAccountId, paymentProcessor,
 *   googleAnalyticsId/Secret, metaPixelId, metaConversionsToken,
 *   customReferralTags, and anything reachable through pledges — no backer
 *   identities, amounts, addresses or survey answers are queryable at all.
 */

/** Project columns safe to read. Pass straight to a Prisma `select`. */
export const PUBLIC_PROJECT_SELECT = {
  id: true,
  title: true,
  subtitle: true,
  slug: true,
  category: true,
  subcategory: true,
  secondaryCategory: true,
  secondarySubcategory: true,
  location: true,
  imageUrl: true,
  videoUrl: true,
  goalAmount: true,
  currency: true,
  endDate: true,
  launchDate: true,
  usesAI: true,
  projectType: true,
  campaignType: true,
  hasAdultContent: true,
  status: true,
  currentAmount: true,
  backerCount: true,
  followerCount: true,
  isStaffPick: true,
  tags: true,
  createdAt: true,
  creator: {
    select: {
      name: true,
      vanityUrl: true,
      image: true,
      // Not returned. Read so the creator's own display preference is
      // honoured by the API exactly as it is by the site.
      showNameOnly: true,
    },
  },
} as const;

type Money = number | string | { toString(): string } | null | undefined;
const num = (v: Money): number => (v == null ? 0 : Number(v.toString()));

export interface PublicProject {
  id: string;
  slug: string;
  url: string;
  title: string;
  subtitle: string | null;
  category: string;
  subcategory: string | null;
  secondary_category: string | null;
  location: string | null;
  image_url: string | null;
  video_url: string | null;
  currency: string;
  goal_amount: number;
  pledged_amount: number;
  percent_funded: number;
  backer_count: number;
  follower_count: number;
  status: string;
  campaign_type: string;
  project_type: string;
  is_staff_pick: boolean;
  has_adult_content: boolean;
  uses_ai: boolean;
  tags: string[];
  launch_date: string | null;
  end_date: string | null;
  days_remaining: number | null;
  created_at: string;
  creator: { name: string | null; profile_url: string | null; avatar_url: string | null };
}

/**
 * `stats` overrides the denormalized counters when supplied. The site renders
 * live aggregates from the pledge table rather than Project.currentAmount, and
 * an API that disagreed with the page it describes would be worse than no API.
 */
export function serializeProject(
  p: Record<string, unknown>,
  stats?: { currentAmount: number; backerCount: number }
): PublicProject {
  const creator = (p.creator ?? {}) as {
    name?: string | null;
    vanityUrl?: string | null;
    image?: string | null;
    showNameOnly?: boolean;
  };

  const goal = num(p.goalAmount as Money);
  const pledged = stats ? stats.currentAmount : num(p.currentAmount as Money);
  const backers = stats ? stats.backerCount : Number(p.backerCount ?? 0);

  const endDate = p.endDate ? new Date(p.endDate as string | Date) : null;
  const daysRemaining = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000))
    : null;

  const slug = String(p.slug);
  const vanity = creator.vanityUrl || null;

  return {
    id: String(p.id),
    slug,
    url: vanity
      ? `https://indiecrowdfund.com/projects/${vanity}/${slug}`
      : `https://indiecrowdfund.com/projects/${slug}`,
    title: String(p.title),
    subtitle: (p.subtitle as string) ?? null,
    category: String(p.category),
    subcategory: (p.subcategory as string) ?? null,
    secondary_category: (p.secondaryCategory as string) ?? null,
    location: (p.location as string) ?? null,
    image_url: (p.imageUrl as string) ?? null,
    video_url: (p.videoUrl as string) ?? null,
    currency: String(p.currency ?? "USD"),
    goal_amount: goal,
    pledged_amount: pledged,
    percent_funded: goal > 0 ? Math.round((pledged / goal) * 1000) / 10 : 0,
    backer_count: backers,
    follower_count: Number(p.followerCount ?? 0),
    status: String(p.status),
    campaign_type: String(p.campaignType),
    project_type: String(p.projectType),
    is_staff_pick: Boolean(p.isStaffPick),
    has_adult_content: Boolean(p.hasAdultContent),
    uses_ai: Boolean(p.usesAI),
    tags: (p.tags as string[]) ?? [],
    launch_date: p.launchDate ? new Date(p.launchDate as string | Date).toISOString() : null,
    end_date: endDate ? endDate.toISOString() : null,
    days_remaining: daysRemaining,
    created_at: new Date(p.createdAt as string | Date).toISOString(),
    creator: {
      name: creator.name ?? null,
      // A creator with no vanity URL has no public profile page to link to,
      // so this is null rather than a URL that 404s.
      profile_url: vanity ? `https://indiecrowdfund.com/${vanity}` : null,
      // showNameOnly is the creator's own "don't show my picture" setting.
      avatar_url: creator.showNameOnly ? null : (creator.image ?? null),
    },
  };
}

/**
 * Statuses an unauthenticated visitor can already browse. DRAFT, SUBMITTED and
 * APPROVED campaigns are not public yet and must never appear in the API —
 * publishing an unlaunched campaign's existence would leak a creator's plans.
 */
export const PUBLIC_PROJECT_STATUSES = ["LIVE", "FUNDED", "FAILED", "CANCELLED"] as const;
