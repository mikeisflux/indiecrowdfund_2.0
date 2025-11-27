import { db } from "@/lib/db";

interface ProjectWithCount {
  id: string;
  category: string;
  currentAmount: number;
  goalAmount: number;
  endDate: Date | null;
  launchedAt: Date | null;
  creator: { id: string; name: string | null };
  _count: { pledges: number };
}

interface ProjectWithCreator {
  id: string;
  creator: { id: string; name: string | null };
}

interface PledgeGroupResult {
  projectId: string;
  _count: { projectId: number };
}

interface RecommendationContext {
  userId?: string;
  sessionId?: string;
  currentPage?: string;
  limit?: number;
  excludeProjectIds?: string[];
}

interface ScoredProject {
  projectId: string;
  score: number;
  reasons: string[];
  project: unknown;
}

export class RecommendationEngine {
  /**
   * Main recommendation function
   */
  async getRecommendations(
    context: RecommendationContext
  ): Promise<ScoredProject[]> {
    const {
      userId,
      sessionId,
      limit = 12,
      excludeProjectIds = [],
    } = context;

    // Get user preferences
    const preferences = userId
      ? await this.getUserPreferences(userId)
      : await this.getSessionPreferences(sessionId);

    // Run parallel scoring algorithms
    const [
      collaborativeScores,
      contentBasedScores,
      trendingScores,
      creatorBasedScores,
    ] = await Promise.all([
      this.collaborativeFiltering(preferences, userId),
      this.contentBasedFiltering(preferences),
      this.getTrendingProjects(),
      this.creatorBasedRecommendations(userId),
    ]);

    // Combine scores with weights
    const combinedScores = this.combineScores({
      collaborative: { scores: collaborativeScores, weight: 0.35 },
      contentBased: { scores: contentBasedScores, weight: 0.25 },
      trending: { scores: trendingScores, weight: 0.20 },
      creatorBased: { scores: creatorBasedScores, weight: 0.20 },
    });

    // Apply diversity filter
    const diverseScores = this.applyDiversityFilter(combinedScores);

    // Filter out excluded projects
    const filtered = diverseScores.filter(
      (s) => !excludeProjectIds.includes(s.projectId)
    );

    // Sort by score and limit
    return filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Collaborative filtering: "Users like you also backed..."
   */
  async collaborativeFiltering(
    preferences: unknown,
    userId?: string
  ): Promise<ScoredProject[]> {
    if (!userId) return [];

    try {
      // Find users who backed the same projects
      const userPledges = await db.pledge.findMany({
        where: { userId, status: "COMPLETED" },
        select: { projectId: true },
      });

      const backedProjectIds = userPledges.map((p: { projectId: string }) => p.projectId);

      if (backedProjectIds.length === 0) return [];

      // Find similar users
      const similarUserPledges = await db.pledge.findMany({
        where: {
          projectId: { in: backedProjectIds },
          userId: { not: userId },
          status: "COMPLETED",
        },
        select: { userId: true },
        distinct: ["userId"],
        take: 100,
      });

      const similarUserIds = similarUserPledges.map((p: { userId: string }) => p.userId);

      if (similarUserIds.length === 0) return [];

      // Get projects backed by similar users that current user hasn't backed
      const recommendedProjects = await db.project.findMany({
        where: {
          status: "LIVE",
          id: { notIn: backedProjectIds },
          pledges: {
            some: {
              userId: { in: similarUserIds },
              status: "COMPLETED",
            },
          },
        },
        include: {
          creator: true,
          _count: { select: { pledges: true } },
        },
        take: 50,
      });

      return recommendedProjects.map((project: ProjectWithCount) => ({
        projectId: project.id,
        score: Math.min(project._count.pledges * 2, 100),
        reasons: ["Backed by users with similar taste"],
        project,
      }));
    } catch (error) {
      console.error("Collaborative filtering error:", error);
      return [];
    }
  }

  /**
   * Content-based filtering: Match project attributes to preferences
   */
  async contentBasedFiltering(preferences: unknown): Promise<ScoredProject[]> {
    const prefs = preferences as { categoryScores?: Record<string, number> } | null;
    const categoryScores = prefs?.categoryScores || {};
    const categories = Object.keys(categoryScores);

    if (categories.length === 0) {
      // Return popular projects if no preferences
      return this.getTrendingProjects();
    }

    const projects = await db.project.findMany({
      where: {
        status: "LIVE",
        category: { in: categories },
      },
      include: {
        creator: true,
        _count: { select: { pledges: true } },
      },
      take: 100,
    });

    return projects.map((project: ProjectWithCount) => {
      let score = 0;
      const reasons: string[] = [];

      // Category match
      const categoryScore = categoryScores[project.category] || 0;
      score += categoryScore * 40;
      if (categoryScore > 0.7) {
        reasons.push(`High interest in ${project.category}`);
      }

      // Funding progress
      const fundingPercent = (project.currentAmount / project.goalAmount) * 100;
      if (fundingPercent >= 50 && fundingPercent < 100) {
        score += 20;
        reasons.push("Nearly funded");
      }

      // Social proof
      const backerCount = project._count.pledges;
      if (backerCount > 100) {
        score += 20;
        reasons.push("Popular project");
      } else if (backerCount > 50) {
        score += 10;
      }

      // Time remaining
      if (project.endDate) {
        const daysRemaining = this.getDaysRemaining(project.endDate);
        if (daysRemaining <= 7 && daysRemaining > 0) {
          score += 10;
          reasons.push("Ending soon");
        }
      }

      // New project bonus
      if (project.launchedAt) {
        const projectAge = Date.now() - project.launchedAt.getTime();
        const daysOld = projectAge / (1000 * 60 * 60 * 24);
        if (daysOld <= 3) {
          score += 10;
          reasons.push("Just launched");
        }
      }

      return {
        projectId: project.id,
        score,
        reasons,
        project,
      };
    });
  }

  /**
   * Trending projects: Hot right now
   */
  async getTrendingProjects(): Promise<ScoredProject[]> {
    // Get projects with high recent activity
    const recentPledges = await db.pledge.groupBy({
      by: ["projectId"],
      where: {
        createdAt: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Last 48 hours
        },
        status: "COMPLETED",
      },
      _count: { projectId: true },
      orderBy: { _count: { projectId: "desc" } },
      take: 50,
    });

    const projectIds = recentPledges.map((p: PledgeGroupResult) => p.projectId);

    const projects = await db.project.findMany({
      where: {
        id: { in: projectIds },
        status: "LIVE",
      },
      include: {
        creator: true,
        _count: { select: { pledges: true } },
      },
    });

    return projects.map((project: ProjectWithCount) => {
      const recentCount = recentPledges.find(
        (p: PledgeGroupResult) => p.projectId === project.id
      )?._count.projectId || 0;

      return {
        projectId: project.id,
        score: Math.min(recentCount * 10, 100),
        reasons: ["Trending right now", "High activity"],
        project,
      };
    });
  }

  /**
   * Creator-based: Projects by creators user has backed before
   */
  async creatorBasedRecommendations(userId?: string): Promise<ScoredProject[]> {
    if (!userId) return [];

    // Get creators user has backed
    const backedProjects = await db.pledge.findMany({
      where: { userId, status: "COMPLETED" },
      select: { project: { select: { creatorId: true } } },
      distinct: ["projectId"],
    });

    const backedCreatorIds = Array.from(
      new Set(backedProjects.map((p: { project: { creatorId: string } }) => p.project.creatorId))
    );

    if (backedCreatorIds.length === 0) return [];

    // Get new projects by these creators
    const projects = await db.project.findMany({
      where: {
        creatorId: { in: backedCreatorIds },
        status: "LIVE",
        pledges: { none: { userId } },
      },
      include: {
        creator: true,
      },
      take: 20,
    });

    return projects.map((project: ProjectWithCreator) => ({
      projectId: project.id,
      score: 100,
      reasons: [
        `New project by ${project.creator.name}`,
        "You've backed their projects before",
      ],
      project,
    }));
  }

  /**
   * Combine multiple scoring algorithms with weights
   */
  combineScores(
    algorithms: Record<string, { scores: ScoredProject[]; weight: number }>
  ): ScoredProject[] {
    const projectScores = new Map<
      string,
      { totalScore: number; reasons: Set<string>; project: unknown }
    >();

    for (const [, { scores, weight }] of Object.entries(algorithms)) {
      for (const scored of scores) {
        const existing = projectScores.get(scored.projectId);

        if (existing) {
          existing.totalScore += scored.score * weight;
          scored.reasons.forEach((r) => existing.reasons.add(r));
        } else {
          projectScores.set(scored.projectId, {
            totalScore: scored.score * weight,
            reasons: new Set(scored.reasons),
            project: scored.project,
          });
        }
      }
    }

    return Array.from(projectScores.entries()).map(([projectId, data]) => ({
      projectId,
      score: data.totalScore,
      reasons: Array.from(data.reasons),
      project: data.project,
    }));
  }

  /**
   * Apply diversity filter to avoid too many projects from same category
   */
  applyDiversityFilter(projects: ScoredProject[]): ScoredProject[] {
    const categoryCounts = new Map<string, number>();
    const maxPerCategory = 3;

    return projects.filter((project) => {
      const category = (project.project as { category?: string })?.category || "unknown";
      const count = categoryCounts.get(category) || 0;

      if (count >= maxPerCategory) {
        return false;
      }

      categoryCounts.set(category, count + 1);
      return true;
    });
  }

  async getUserPreferences(userId: string) {
    let preferences = await db.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences || this.isStale(preferences.lastUpdated)) {
      preferences = await this.buildUserPreferences(userId);
    }

    return preferences;
  }

  async buildUserPreferences(userId: string) {
    const pledges = await db.pledge.findMany({
      where: { userId, status: "COMPLETED" },
      include: { project: true },
    });

    const categoryScores: Record<string, number> = {};
    const categoryBacks: Record<string, number> = {};

    for (const pledge of pledges) {
      const category = pledge.project.category;
      categoryBacks[category] = (categoryBacks[category] || 0) + 1;
    }

    const maxBacks = Math.max(...Object.values(categoryBacks), 1);

    for (const [category, backs] of Object.entries(categoryBacks)) {
      categoryScores[category] = backs / maxBacks;
    }

    const pledgeAmounts = pledges.map((p: { amount: number }) => p.amount);
    const avgPledge = pledgeAmounts.length
      ? pledgeAmounts.reduce((a: number, b: number) => a + b, 0) / pledgeAmounts.length
      : null;

    return db.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        categoryScores: categoryScores as object,
        avgPledge,
        engagementScore: Math.min(pledges.length * 10, 100),
        backedCreators: Array.from(new Set(pledges.map((p: { project: { creatorId: string } }) => p.project.creatorId))),
      },
      update: {
        categoryScores: categoryScores as object,
        avgPledge,
        engagementScore: Math.min(pledges.length * 10, 100),
        backedCreators: Array.from(new Set(pledges.map((p: { project: { creatorId: string } }) => p.project.creatorId))),
        lastUpdated: new Date(),
      },
    });
  }

  async getSessionPreferences(sessionId?: string) {
    if (!sessionId) {
      return { categoryScores: {}, engagementScore: 50 };
    }

    const behavior = await db.userBehavior.findMany({
      where: { sessionId },
      include: { project: true },
    });

    const categoryViews: Record<string, number> = {};

    for (const event of behavior) {
      if (event.project) {
        const category = event.project.category;
        categoryViews[category] = (categoryViews[category] || 0) + 1;
      }
    }

    const maxViews = Math.max(...Object.values(categoryViews), 1);
    const categoryScores: Record<string, number> = {};

    for (const [category, views] of Object.entries(categoryViews)) {
      categoryScores[category] = views / maxViews;
    }

    return {
      categoryScores,
      engagementScore: Math.min(behavior.length * 5, 100),
    };
  }

  isStale(lastUpdated: Date): boolean {
    return Date.now() - lastUpdated.getTime() > 24 * 60 * 60 * 1000;
  }

  getDaysRemaining(endDate: Date): number {
    return Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
}

export const recommendationEngine = new RecommendationEngine();
