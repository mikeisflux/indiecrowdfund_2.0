/**
 * User Interest Calculation Service
 *
 * Calculates user interests based on:
 * - Projects they've backed (weighted heavily)
 * - Projects they've viewed (weighted by engagement)
 * - Search queries
 * - Time spent on project pages
 */

import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const aiUserInterestsLogger = logger.child({ module: "ai-user-interests" });


interface CategoryInterests {
  [category: string]: number; // 0-1 score
}

interface TagInterests {
  [tag: string]: number; // 0-1 score
}

interface UserInterestData {
  categoryInterests: CategoryInterests;
  tagInterests: TagInterests;
  searchInterests: string[];
  totalProjectsViewed: number;
  totalProjectsBacked: number;
  avgPledgeAmount: number;
  preferredGoalRange: { min: number; max: number } | null;
  activeHours: number[];
  activeDays: number[];
  profileScore: number;
}

/**
 * Calculate interest profile for a single user
 */
export async function calculateUserInterests(userId: string): Promise<UserInterestData> {
  // Get user's pledges with project data
  const pledges = await db.pledge.findMany({
    where: { userId, status: "COMPLETED" },
    include: {
      project: {
        select: {
          category: true,
          subcategory: true,
          secondaryCategory: true,
          tags: true,
          goalAmount: true,
        },
      },
    },
  });

  // Get user's behavior data (last 90 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const behaviors = await db.userBehavior.findMany({
    where: {
      userId,
      timestamp: { gte: ninetyDaysAgo },
    },
    include: {
      project: {
        select: {
          category: true,
          subcategory: true,
          tags: true,
          goalAmount: true,
        },
      },
    },
  });

  // Calculate category interests
  const categoryScores: { [key: string]: { score: number; count: number } } = {};

  // Weight backed projects heavily (3x)
  for (const pledge of pledges) {
    if (pledge.project.category) {
      const cat = pledge.project.category.toUpperCase();
      if (!categoryScores[cat]) categoryScores[cat] = { score: 0, count: 0 };
      categoryScores[cat].score += 3;
      categoryScores[cat].count += 1;
    }
    if (pledge.project.subcategory) {
      const subcat = pledge.project.subcategory.toUpperCase();
      if (!categoryScores[subcat]) categoryScores[subcat] = { score: 0, count: 0 };
      categoryScores[subcat].score += 2;
      categoryScores[subcat].count += 1;
    }
    if (pledge.project.secondaryCategory) {
      const secCat = pledge.project.secondaryCategory.toUpperCase();
      if (!categoryScores[secCat]) categoryScores[secCat] = { score: 0, count: 0 };
      categoryScores[secCat].score += 1.5;
      categoryScores[secCat].count += 1;
    }
  }

  // Add viewed projects (1x weight, with time-based decay)
  for (const behavior of behaviors) {
    if (behavior.eventType === "PROJECT_VIEW" && behavior.project) {
      const daysSince = (Date.now() - behavior.timestamp.getTime()) / (24 * 60 * 60 * 1000);
      const decayFactor = Math.max(0.1, 1 - daysSince / 90);
      const timeBonus = behavior.timeSpent ? Math.min(1, behavior.timeSpent / 120) : 0.5;
      const weight = decayFactor * timeBonus;

      if (behavior.project.category) {
        const cat = behavior.project.category.toUpperCase();
        if (!categoryScores[cat]) categoryScores[cat] = { score: 0, count: 0 };
        categoryScores[cat].score += weight;
        categoryScores[cat].count += 1;
      }
      if (behavior.project.subcategory) {
        const subcat = behavior.project.subcategory.toUpperCase();
        if (!categoryScores[subcat]) categoryScores[subcat] = { score: 0, count: 0 };
        categoryScores[subcat].score += weight * 0.5;
        categoryScores[subcat].count += 1;
      }
    }
  }

  // Normalize category scores to 0-1
  const maxCategoryScore = Math.max(...Object.values(categoryScores).map((c) => c.score), 1);
  const categoryInterests: CategoryInterests = {};
  for (const [cat, data] of Object.entries(categoryScores)) {
    categoryInterests[cat] = Math.round((data.score / maxCategoryScore) * 100) / 100;
  }

  // Calculate tag interests
  const tagScores: { [key: string]: { score: number; count: number } } = {};

  // From backed projects (high weight)
  for (const pledge of pledges) {
    const tags = pledge.project.tags as string[] || [];
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase();
      if (!tagScores[normalizedTag]) tagScores[normalizedTag] = { score: 0, count: 0 };
      tagScores[normalizedTag].score += 3;
      tagScores[normalizedTag].count += 1;
    }
  }

  // From viewed projects
  for (const behavior of behaviors) {
    if (behavior.eventType === "PROJECT_VIEW" && behavior.project) {
      const daysSince = (Date.now() - behavior.timestamp.getTime()) / (24 * 60 * 60 * 1000);
      const decayFactor = Math.max(0.1, 1 - daysSince / 90);
      const tags = behavior.project.tags as string[] || [];

      for (const tag of tags) {
        const normalizedTag = tag.toLowerCase();
        if (!tagScores[normalizedTag]) tagScores[normalizedTag] = { score: 0, count: 0 };
        tagScores[normalizedTag].score += decayFactor;
        tagScores[normalizedTag].count += 1;
      }
    }
  }

  // Normalize tag scores
  const maxTagScore = Math.max(...Object.values(tagScores).map((t) => t.score), 1);
  const tagInterests: TagInterests = {};
  for (const [tag, data] of Object.entries(tagScores)) {
    tagInterests[tag] = Math.round((data.score / maxTagScore) * 100) / 100;
  }

  // Extract search interests
  const searchQueries = behaviors
    .filter((b) => b.eventType === "SEARCH" && b.searchQuery)
    .map((b) => (b.searchQuery || "").toLowerCase())
    .reduce((acc: string[], query) => {
      // Extract keywords (simple tokenization)
      const words = query.split(/\s+/).filter((w: string) => w.length > 2);
      return [...acc, ...words];
    }, []);

  // Count and get top search terms
  const searchCounts: { [key: string]: number } = {};
  for (const term of searchQueries) {
    searchCounts[term] = (searchCounts[term] || 0) + 1;
  }
  const searchInterests = Object.entries(searchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term]) => term);

  // Calculate pledge statistics - convert Decimals to numbers
  const pledgeAmounts = pledges.map((p) => Number(p.amount));
  const avgPledgeAmount = pledgeAmounts.length > 0
    ? pledgeAmounts.reduce((a, b) => a + b, 0) / pledgeAmounts.length
    : 0;

  // Calculate preferred goal range from backed projects - convert Decimals to numbers
  const backedGoals = pledges.map((p) => Number(p.project.goalAmount));
  const preferredGoalRange = backedGoals.length >= 3
    ? {
        min: Math.min(...backedGoals) * 0.5,
        max: Math.max(...backedGoals) * 1.5,
      }
    : null;

  // Calculate active hours and days from behavior timestamps
  const hourCounts: { [hour: number]: number } = {};
  const dayCounts: { [day: number]: number } = {};

  for (const behavior of behaviors) {
    const hour = behavior.timestamp.getHours();
    const day = behavior.timestamp.getDay();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  // Get top 6 active hours
  const activeHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hour]) => parseInt(hour));

  // Get top 4 active days
  const activeDays = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([day]) => parseInt(day));

  // Count unique projects
  const viewedProjectIds = new Set(
    behaviors.filter((b) => b.eventType === "PROJECT_VIEW" && b.projectId).map((b) => b.projectId)
  );

  // Calculate profile quality score
  let profileScore = 0;
  profileScore += Math.min(25, pledges.length * 5); // Up to 25 points for pledges
  profileScore += Math.min(25, viewedProjectIds.size); // Up to 25 points for views
  profileScore += Math.min(15, Object.keys(categoryInterests).length * 3); // Up to 15 for categories
  profileScore += Math.min(15, Object.keys(tagInterests).length); // Up to 15 for tags
  profileScore += Math.min(10, searchInterests.length * 2); // Up to 10 for searches
  profileScore += activeHours.length > 0 ? 5 : 0; // 5 for having time data
  profileScore += activeDays.length > 0 ? 5 : 0; // 5 for having day data

  return {
    categoryInterests,
    tagInterests,
    searchInterests,
    totalProjectsViewed: viewedProjectIds.size,
    totalProjectsBacked: pledges.length,
    avgPledgeAmount,
    preferredGoalRange,
    activeHours,
    activeDays,
    profileScore: Math.min(100, profileScore),
  };
}

/**
 * Update or create user interest profile in database
 */
export async function updateUserInterestProfile(userId: string): Promise<void> {
  const interests = await calculateUserInterests(userId);

  await db.userInterestProfile.upsert({
    where: { userId },
    create: {
      userId,
      categoryInterests: interests.categoryInterests,
      tagInterests: interests.tagInterests,
      searchInterests: interests.searchInterests,
      totalProjectsViewed: interests.totalProjectsViewed,
      totalProjectsBacked: interests.totalProjectsBacked,
      avgPledgeAmount: interests.avgPledgeAmount,
      preferredGoalRange: interests.preferredGoalRange,
      activeHours: interests.activeHours,
      activeDays: interests.activeDays,
      profileScore: interests.profileScore,
      lastCalculatedAt: new Date(),
    },
    update: {
      categoryInterests: interests.categoryInterests,
      tagInterests: interests.tagInterests,
      searchInterests: interests.searchInterests,
      totalProjectsViewed: interests.totalProjectsViewed,
      totalProjectsBacked: interests.totalProjectsBacked,
      avgPledgeAmount: interests.avgPledgeAmount,
      preferredGoalRange: interests.preferredGoalRange,
      activeHours: interests.activeHours,
      activeDays: interests.activeDays,
      profileScore: interests.profileScore,
      lastCalculatedAt: new Date(),
    },
  });
}

/**
 * Batch update interest profiles for multiple users
 */
export async function batchUpdateUserInterests(userIds: string[]): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await updateUserInterestProfile(userId);
      processed++;
    } catch (error) {
      aiUserInterestsLogger.error({ err: error }, `Failed to update interests for user ${userId}:`);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Calculate match score between a user's interests and a project
 */
export function calculateProjectMatchScore(
  userInterests: {
    categoryInterests: CategoryInterests;
    tagInterests: TagInterests;
  },
  project: {
    category: string;
    subcategory?: string | null;
    tags?: string[];
  }
): number {
  let score = 0;
  let maxPossibleScore = 0;

  // Category match (up to 40 points)
  const categoryUpper = project.category.toUpperCase();
  if (userInterests.categoryInterests[categoryUpper]) {
    score += userInterests.categoryInterests[categoryUpper] * 40;
  }
  maxPossibleScore += 40;

  // Subcategory match (up to 20 points)
  if (project.subcategory) {
    const subcatUpper = project.subcategory.toUpperCase();
    if (userInterests.categoryInterests[subcatUpper]) {
      score += userInterests.categoryInterests[subcatUpper] * 20;
    }
  }
  maxPossibleScore += 20;

  // Tag matches (up to 40 points total)
  if (project.tags && project.tags.length > 0) {
    const tagMatches: number[] = [];
    for (const tag of project.tags) {
      const normalizedTag = tag.toLowerCase();
      if (userInterests.tagInterests[normalizedTag]) {
        tagMatches.push(userInterests.tagInterests[normalizedTag]);
      }
    }

    if (tagMatches.length > 0) {
      // Average of top 5 tag matches
      const topMatches = tagMatches.sort((a, b) => b - a).slice(0, 5);
      const avgTagScore = topMatches.reduce((a, b) => a + b, 0) / topMatches.length;
      score += avgTagScore * 40;
    }
  }
  maxPossibleScore += 40;

  // Return percentage score (0-100)
  return Math.round((score / maxPossibleScore) * 100);
}

/**
 * Find best matching projects for a user
 */
export async function findMatchingProjectsForUser(
  userId: string,
  options: {
    limit?: number;
    minMatchScore?: number;
    excludeBackedProjects?: boolean;
    status?: "LIVE" | "PRELAUNCH" | "ALL";
  } = {}
): Promise<Array<{ projectId: string; matchScore: number }>> {
  const {
    limit = 10,
    minMatchScore = 30,
    excludeBackedProjects = true,
    status = "LIVE",
  } = options;

  // Get user's interest profile
  const profile = await db.userInterestProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    // Calculate profile if not exists
    await updateUserInterestProfile(userId);
    const newProfile = await db.userInterestProfile.findUnique({
      where: { userId },
    });
    if (!newProfile) return [];
  }

  const userProfile = profile ?? await db.userInterestProfile.findUnique({ where: { userId } });
  if (!userProfile) return [];

  // Get user's backed project IDs if excluding
  let backedProjectIds: string[] = [];
  if (excludeBackedProjects) {
    const pledges = await db.pledge.findMany({
      where: { userId },
      select: { projectId: true },
    });
    backedProjectIds = pledges.map((p) => p.projectId);
  }

  // Get candidate projects
  const whereClause: { status?: string; id?: { notIn: string[] } } = {};
  if (status !== "ALL") {
    whereClause.status = status;
  }
  if (backedProjectIds.length > 0) {
    whereClause.id = { notIn: backedProjectIds };
  }

  const projects = await db.project.findMany({
    where: whereClause,
    select: {
      id: true,
      category: true,
      subcategory: true,
      tags: true,
    },
    take: 100, // Get a batch to score
  });

  // Calculate match scores
  const categoryInterests = userProfile.categoryInterests as CategoryInterests;
  const tagInterests = userProfile.tagInterests as TagInterests;

  const scoredProjects = projects.map((project) => ({
    projectId: project.id,
    matchScore: calculateProjectMatchScore(
      { categoryInterests, tagInterests },
      {
        category: project.category,
        subcategory: project.subcategory,
        tags: project.tags as string[],
      }
    ),
  }));

  // Filter by min score and sort
  return scoredProjects
    .filter((p) => p.matchScore >= minMatchScore)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Find best users to target for a specific project
 */
export async function findMatchingUsersForProject(
  projectId: string,
  options: {
    limit?: number;
    minMatchScore?: number;
    minProfileScore?: number;
  } = {}
): Promise<Array<{ userId: string; matchScore: number }>> {
  const { limit = 100, minMatchScore = 30, minProfileScore = 20 } = options;

  // Get project details
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      category: true,
      subcategory: true,
      tags: true,
    },
  });

  if (!project) return [];

  // Get users with interest profiles
  const profiles = await db.userInterestProfile.findMany({
    where: {
      profileScore: { gte: minProfileScore },
    },
    select: {
      userId: true,
      categoryInterests: true,
      tagInterests: true,
    },
    take: 500, // Limit for performance
  });

  // Calculate match scores
  const scoredUsers = profiles.map((profile: { userId: string; categoryInterests: unknown; tagInterests: unknown }) => ({
    userId: profile.userId,
    matchScore: calculateProjectMatchScore(
      {
        categoryInterests: profile.categoryInterests as CategoryInterests,
        tagInterests: profile.tagInterests as TagInterests,
      },
      {
        category: project.category,
        subcategory: project.subcategory,
        tags: project.tags as string[],
      }
    ),
  }));

  // Filter and sort
  return scoredUsers
    .filter((u: { userId: string; matchScore: number }) => u.matchScore >= minMatchScore)
    .sort((a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
