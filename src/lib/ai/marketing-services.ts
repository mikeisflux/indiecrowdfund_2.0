import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";

import { logger } from "@/lib/logger";

const aiMarketingServicesLogger = logger.child({ module: "ai-marketing-services" });


// Lazy initialization to avoid build-time errors
let anthropicClient: Anthropic | null = null;
let cachedApiKey: string | null = null;

async function getAnthropic(): Promise<Anthropic> {
  const settings = await db.platformSettings.findFirst({
    select: { anthropicApiKey: true },
  });
  // Decrypt the stored key — the settings route encrypts it on save,
  // so reading it raw fed the SDK an encrypted blob and produced a
  // 401. getSecret decrypts (and passes through legacy plaintext).
  const apiKey =
    getSecret("anthropic_api_key", settings?.anthropicApiKey) ||
    process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Set it in Admin Settings > AI.");
  }

  if (!anthropicClient || cachedApiKey !== apiKey) {
    anthropicClient = new Anthropic({ apiKey });
    cachedApiKey = apiKey;
  }
  return anthropicClient;
}

/** Call Claude and parse JSON from the response */
async function claudeJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { model?: string; maxTokens?: number; temperature?: number }
): Promise<T> {
  const anthropic = await getAnthropic();
  const response = await anthropic.messages.create({
    model: options?.model || "claude-sonnet-4-20250514",
    max_tokens: options?.maxTokens || 1024,
    ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  const responseText = textContent?.type === "text" ? textContent.text : "";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Claude response");
  }

  return JSON.parse(jsonMatch[0]) as T;
}

// ============================================
// EMAIL PERSONALIZATION
// ============================================

export interface PersonalizedEmailContent {
  subject: string;
  preheader: string;
  greeting: string;
  body: string;
  projectRecommendations: Array<{
    projectId: string;
    reason: string;
    cta: string;
  }>;
  signOff: string;
}

export interface UserProfile {
  id: string;
  name?: string | null;
  email: string;
  interests: string[];
  backedCategories: string[];
  avgPledgeAmount: number;
  totalPledges: number;
  lastActiveAt?: Date;
  engagementLevel: "high" | "medium" | "low" | "at-risk";
}

/**
 * Generate personalized email content for a specific user
 */
export async function personalizeEmailForUser(
  userId: string,
  campaignType: string,
  projects: Array<{ id: string; title: string; description: string; category: string }>
): Promise<PersonalizedEmailContent> {
  // Get user profile and behavior
  const userProfile = await getUserProfile(userId);

  const prompt = `Generate a personalized email for a crowdfunding platform user.

User Profile:
- Name: ${userProfile.name || "Valued Backer"}
- Interests: ${userProfile.interests.join(", ") || "General"}
- Previously backed categories: ${userProfile.backedCategories.join(", ") || "None yet"}
- Average pledge: $${userProfile.avgPledgeAmount.toFixed(0)}
- Total pledges: ${userProfile.totalPledges}
- Engagement level: ${userProfile.engagementLevel}

Campaign Type: ${campaignType}

Available Projects to Recommend:
${projects.slice(0, 5).map((p, i) => `${i + 1}. [${p.id}] "${p.title}" (${p.category}) - ${p.description.substring(0, 150)}`).join("\n")}

Create highly personalized email content that:
- Uses their name naturally (not just "Hi [Name]!")
- References their actual interests and backing history
- Recommends 2-3 most relevant projects with personal reasons
- Matches tone to their engagement level (${userProfile.engagementLevel})
- Feels like a message from a friend, not marketing

Respond in JSON:
{
  "subject": "Personalized subject line mentioning their interests",
  "preheader": "Compelling preview text (max 90 chars)",
  "greeting": "Warm, personal greeting",
  "body": "Main message body (2-3 short paragraphs)",
  "projectRecommendations": [
    {
      "projectId": "the project id from the list",
      "reason": "Why THIS user would love this project specifically",
      "cta": "Personalized call-to-action"
    }
  ],
  "signOff": "Friendly sign-off matching their engagement level"
}`;

  try {
    const result = await claudeJSON<PersonalizedEmailContent>(
      "You are an expert at writing personalized emails that feel genuine and human, not like marketing automation. Each email should feel like it was written specifically for this person. Respond only with valid JSON.",
      prompt,
      { temperature: 0.8 }
    );

    return {
      subject: result.subject || "Projects picked just for you",
      preheader: result.preheader || "Based on what you love",
      greeting: result.greeting || `Hi ${userProfile.name || "there"}!`,
      body: result.body || "",
      projectRecommendations: result.projectRecommendations || [],
      signOff: result.signOff || "Happy backing!",
    };
  } catch (error) {
    aiMarketingServicesLogger.error({ err: error }, "Email personalization error:");
    throw new Error("Failed to personalize email");
  }
}

/**
 * Get user profile for personalization
 */
async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      pledges: {
        include: {
          project: { select: { category: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      behaviors: {
        where: {
          eventType: { in: ["PROJECT_VIEW", "PROJECT_CLICK", "SEARCH"] },
        },
        orderBy: { timestamp: "desc" },
        take: 100,
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Calculate interests from behavior
  const searchTerms: string[] = [];

  for (const behavior of user.behaviors) {
    if (behavior.searchQuery) {
      searchTerms.push(behavior.searchQuery);
    }
  }

  // Get backed categories
  const backedCategories = Array.from(new Set(user.pledges.map((p: { project: { category: string | null } }) => p.project.category).filter(Boolean))) as string[];

  // Calculate average pledge
  const totalAmount = user.pledges.reduce((sum: number, p: { amount: number | string }) => sum + Number(p.amount), 0);
  const avgPledgeAmount = user.pledges.length > 0 ? totalAmount / user.pledges.length : 0;

  // Determine engagement level
  const recentPledges = user.pledges.filter(
    (p: { createdAt: Date }) => p.createdAt > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  ).length;
  const recentActivity = user.behaviors.filter(
    (b: { timestamp: Date }) => b.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  let engagementLevel: "high" | "medium" | "low" | "at-risk";
  if (recentPledges >= 2 || recentActivity >= 20) {
    engagementLevel = "high";
  } else if (recentPledges >= 1 || recentActivity >= 5) {
    engagementLevel = "medium";
  } else if (recentActivity >= 1) {
    engagementLevel = "low";
  } else {
    engagementLevel = "at-risk";
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    interests: searchTerms.slice(0, 5),
    backedCategories,
    avgPledgeAmount,
    totalPledges: user.pledges.length,
    lastActiveAt: user.behaviors[0]?.timestamp,
    engagementLevel,
  };
}

// ============================================
// PREDICTIVE ANALYTICS
// ============================================

export interface PredictionResult {
  userId: string;
  conversionProbability: number;
  churnRisk: number;
  predictedLifetimeValue: number;
  nextActionPrediction: string;
  confidence: number;
  factors: Array<{ factor: string; impact: "positive" | "negative"; weight: number }>;
}

/**
 * Predict user behavior and conversion likelihood
 */
export async function predictUserBehavior(userId: string): Promise<PredictionResult> {
  const profile = await getUserProfile(userId);

  // Get additional signals
  const recentBehaviors = await db.userBehavior.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  // Calculate behavioral signals
  const pageViews = recentBehaviors.filter(b => b.eventType === "PAGE_VIEW").length;
  const projectViews = recentBehaviors.filter(b => b.eventType === "PROJECT_VIEW").length;
  const pledgeStarts = recentBehaviors.filter(b => b.eventType === "PLEDGE_START").length;
  const pledgeCompletes = recentBehaviors.filter(b => b.eventType === "PLEDGE_COMPLETE").length;
  const avgTimeOnSite = recentBehaviors
    .filter((b: { timeSpent?: number | null }) => b.timeSpent)
    .reduce((sum: number, b: { timeSpent?: number | null }) => sum + (b.timeSpent || 0), 0) / Math.max(pageViews, 1);

  // Calculate conversion probability based on signals
  let conversionScore = 0;
  const factors: Array<{ factor: string; impact: "positive" | "negative"; weight: number }> = [];

  // Recent activity factor
  if (recentBehaviors.length > 20) {
    conversionScore += 0.2;
    factors.push({ factor: "High recent activity", impact: "positive", weight: 0.2 });
  } else if (recentBehaviors.length < 5) {
    conversionScore -= 0.1;
    factors.push({ factor: "Low recent activity", impact: "negative", weight: 0.1 });
  }

  // Project engagement factor
  if (projectViews > 5) {
    conversionScore += 0.15;
    factors.push({ factor: "Actively browsing projects", impact: "positive", weight: 0.15 });
  }

  // Pledge intent signals
  if (pledgeStarts > 0) {
    conversionScore += 0.25;
    factors.push({ factor: "Started pledge process", impact: "positive", weight: 0.25 });
  }

  // Past behavior factor
  if (profile.totalPledges > 0) {
    conversionScore += 0.2 + Math.min(profile.totalPledges * 0.02, 0.1);
    factors.push({ factor: `Previous backer (${profile.totalPledges} pledges)`, impact: "positive", weight: 0.2 });
  }

  // Time on site factor
  if (avgTimeOnSite > 120) {
    conversionScore += 0.1;
    factors.push({ factor: "High engagement time", impact: "positive", weight: 0.1 });
  }

  // Calculate churn risk
  const daysSinceActive = profile.lastActiveAt
    ? Math.floor((Date.now() - profile.lastActiveAt.getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  let churnRisk = 0;
  if (daysSinceActive > 60) {
    churnRisk = 0.8;
  } else if (daysSinceActive > 30) {
    churnRisk = 0.5;
  } else if (daysSinceActive > 14) {
    churnRisk = 0.3;
  } else {
    churnRisk = 0.1;
  }

  // Calculate predicted lifetime value
  const predictedLTV = profile.avgPledgeAmount * (profile.totalPledges + conversionScore * 2) *
    (1 - churnRisk * 0.5);

  // Predict next action
  let nextAction = "Browse projects";
  if (pledgeStarts > pledgeCompletes) {
    nextAction = "Complete abandoned pledge";
  } else if (projectViews > pageViews * 0.5) {
    nextAction = "Back a project";
  } else if (churnRisk > 0.5) {
    nextAction = "Re-engage with platform";
  }

  return {
    userId,
    conversionProbability: Math.min(Math.max(conversionScore, 0), 1),
    churnRisk,
    predictedLifetimeValue: Math.round(predictedLTV * 100) / 100,
    nextActionPrediction: nextAction,
    confidence: 0.7 + (recentBehaviors.length > 20 ? 0.15 : 0),
    factors,
  };
}

/**
 * Get batch predictions for multiple users
 */
export async function batchPredictUsers(
  userIds: string[]
): Promise<PredictionResult[]> {
  const predictions = await Promise.all(
    userIds.map(id => predictUserBehavior(id).catch(() => null))
  );
  return predictions.filter((p): p is PredictionResult => p !== null);
}

// ============================================
// SMART SEGMENTATION
// ============================================

export interface UserSegment {
  id: string;
  name: string;
  description: string;
  criteria: Record<string, unknown>;
  userCount: number;
  avgValue: number;
  characteristics: string[];
}

/**
 * Automatically create user segments based on behavior patterns
 */
export async function generateSmartSegments(): Promise<UserSegment[]> {
  // Get aggregate user data
  const users = await db.user.findMany({
    where: { deletedAt: null },
    include: {
      pledges: true,
      behaviors: {
        orderBy: { timestamp: "desc" },
        take: 50,
      },
    },
    take: 1000,
  });

  // Analyze patterns and create segments
  const segments: UserSegment[] = [];

  // Segment 1: High-Value Backers
  const highValueUsers = users.filter((u: { pledges: Array<{ amount: number | string }> }) => {
    const totalPledged = u.pledges.reduce((sum: number, p: { amount: number | string }) => sum + Number(p.amount), 0);
    return totalPledged > 500 || u.pledges.length >= 5;
  });

  if (highValueUsers.length > 0) {
    const avgValue = highValueUsers.reduce(
      (sum: number, u: { pledges: Array<{ amount: number | string }> }) => sum + u.pledges.reduce((s: number, p: { amount: number | string }) => s + Number(p.amount), 0),
      0
    ) / highValueUsers.length;

    segments.push({
      id: "high-value-backers",
      name: "High-Value Backers",
      description: "Users who have backed $500+ or 5+ projects",
      criteria: { minTotalPledged: 500, minPledgeCount: 5 },
      userCount: highValueUsers.length,
      avgValue,
      characteristics: ["High lifetime value", "Frequent backers", "Likely to back again"],
    });
  }

  // Segment 2: Active Explorers
  const activeExplorers = users.filter((u: { behaviors: Array<{ eventType: string; timestamp: Date }>; pledges: Array<{ amount: number | string }> }) => {
    const recentViews = u.behaviors.filter(
      (b: { eventType: string; timestamp: Date }) => b.eventType === "PROJECT_VIEW" &&
           b.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    return recentViews >= 10 && u.pledges.length === 0;
  });

  if (activeExplorers.length > 0) {
    segments.push({
      id: "active-explorers",
      name: "Active Explorers",
      description: "Users actively browsing but haven't backed yet",
      criteria: { minRecentViews: 10, pledgeCount: 0 },
      userCount: activeExplorers.length,
      avgValue: 0,
      characteristics: ["High engagement", "No conversions yet", "Good nurture candidates"],
    });
  }

  // Segment 3: At-Risk Churners
  const atRiskUsers = users.filter((u: { behaviors: Array<{ timestamp: Date }>; pledges: Array<{ amount: number | string }> }) => {
    const lastActivity = u.behaviors[0]?.timestamp;
    if (!lastActivity) return false;
    const daysSince = (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
    return daysSince > 30 && u.pledges.length > 0;
  });

  if (atRiskUsers.length > 0) {
    const avgValue = atRiskUsers.reduce(
      (sum: number, u: { pledges: Array<{ amount: number | string }> }) => sum + u.pledges.reduce((s: number, p: { amount: number | string }) => s + Number(p.amount), 0),
      0
    ) / atRiskUsers.length;

    segments.push({
      id: "at-risk-churners",
      name: "At-Risk Churners",
      description: "Previous backers who haven't been active in 30+ days",
      criteria: { daysSinceActive: 30, minPledgeCount: 1 },
      userCount: atRiskUsers.length,
      avgValue,
      characteristics: ["Previously engaged", "Declining activity", "Win-back opportunity"],
    });
  }

  // Segment 4: New Users
  const newUsers = users.filter(u => {
    const daysSinceCreated = (Date.now() - u.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceCreated <= 14;
  });

  if (newUsers.length > 0) {
    segments.push({
      id: "new-users",
      name: "New Users",
      description: "Users who joined in the last 14 days",
      criteria: { maxDaysSinceCreated: 14 },
      userCount: newUsers.length,
      avgValue: 0,
      characteristics: ["Fresh signups", "Onboarding opportunity", "First impression critical"],
    });
  }

  // Segment 5: Tech Enthusiasts (placeholder for future implementation)
  // Would need project category data to properly segment

  // Use AI to identify additional segments
  const aiSegments = await identifyAISegments(users.slice(0, 100));
  segments.push(...aiSegments);

  return segments;
}

/**
 * Use AI to identify additional behavioral segments
 */
async function identifyAISegments(
  users: Array<{
    id: string;
    pledges: Array<{ amount: number | string }>;
    behaviors: Array<{ eventType: string; timestamp: Date }>;
  }>
): Promise<UserSegment[]> {
  // Prepare anonymized user patterns
  const patterns = users.map((u) => ({
    pledgeCount: u.pledges.length,
    totalValue: u.pledges.reduce((sum: number, p) => sum + Number(p.amount), 0),
    recentActivity: u.behaviors.filter(
      (b) => b.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length,
    eventTypes: Array.from(new Set(u.behaviors.map((b) => b.eventType))),
  }));

  const prompt = `Analyze these user behavior patterns and identify 2-3 meaningful segments for a crowdfunding platform.

User Patterns (sample of ${patterns.length} users):
${JSON.stringify(patterns.slice(0, 20), null, 2)}

Identify segments that would be useful for marketing, excluding these already-identified segments:
- High-Value Backers (500+ pledged)
- Active Explorers (browsing but not backing)
- At-Risk Churners (30+ days inactive)
- New Users (joined in 14 days)

Respond in JSON:
{
  "segments": [
    {
      "id": "segment-id",
      "name": "Segment Name",
      "description": "What defines this segment",
      "criteria": {"key": "value"},
      "characteristics": ["trait 1", "trait 2", "trait 3"]
    }
  ]
}`;

  try {
    const result = await claudeJSON<{
      segments: Array<{
        id: string;
        name: string;
        description: string;
        criteria: Record<string, unknown>;
        characteristics: string[];
      }>;
    }>(
      "You are a data analyst specializing in user segmentation for crowdfunding platforms. Identify actionable segments based on behavioral patterns. Respond only with valid JSON.",
      prompt,
      { model: "claude-haiku-4-5-20251001", temperature: 0.5 }
    );

    return (result.segments || []).map((s) => ({
      ...s,
      userCount: 0,
      avgValue: 0,
    }));
  } catch (error) {
    aiMarketingServicesLogger.error({ err: error }, "AI segment identification error:");
    return [];
  }
}

// ============================================
// SEND TIME OPTIMIZATION
// ============================================

export interface OptimalSendTime {
  userId: string;
  optimalHour: number; // 0-23
  optimalDay: number; // 0-6 (Sunday-Saturday)
  timezone: string;
  confidence: number;
  reason: string;
}

/**
 * Calculate optimal send time for a user based on their activity patterns
 */
export async function getOptimalSendTime(userId: string): Promise<OptimalSendTime> {
  // Get user's activity timestamps
  const behaviors = await db.userBehavior.findMany({
    where: { userId },
    select: { timestamp: true, eventType: true },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  const timezone = user?.timezone || "America/New_York";

  if (behaviors.length < 10) {
    // Not enough data, return default
    return {
      userId,
      optimalHour: 10, // 10 AM
      optimalDay: 2, // Tuesday
      timezone,
      confidence: 0.3,
      reason: "Default time (insufficient activity data)",
    };
  }

  // Analyze activity patterns
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);

  for (const behavior of behaviors) {
    const date = new Date(behavior.timestamp);
    hourCounts[date.getHours()]++;
    dayCounts[date.getDay()]++;
  }

  // Find peak hour and day
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakDay = dayCounts.indexOf(Math.max(...dayCounts));

  // Calculate confidence based on data consistency
  const totalEvents = behaviors.length;
  const peakHourRatio = hourCounts[peakHour] / totalEvents;
  const confidence = Math.min(0.5 + peakHourRatio, 0.95);

  // Determine reason
  let reason = `Based on ${totalEvents} activity events`;
  if (peakHourRatio > 0.2) {
    reason += `, consistently active around ${peakHour}:00`;
  }

  return {
    userId,
    optimalHour: peakHour,
    optimalDay: peakDay,
    timezone,
    confidence,
    reason,
  };
}

/**
 * Get optimal send times for multiple users
 */
export async function batchOptimalSendTimes(
  userIds: string[]
): Promise<Map<string, OptimalSendTime>> {
  const results = new Map<string, OptimalSendTime>();

  const times = await Promise.all(
    userIds.map(id => getOptimalSendTime(id).catch(() => null))
  );

  times.forEach((time, index) => {
    if (time) {
      results.set(userIds[index], time);
    }
  });

  return results;
}

// ============================================
// CONTENT OPTIMIZATION (A/B VARIANTS)
// ============================================

export interface ContentVariant {
  id: string;
  type: "subject" | "body" | "cta";
  content: string;
  tone: string;
  expectedPerformance: number;
}

export interface ContentOptimizationResult {
  originalContent: string;
  variants: ContentVariant[];
  recommendation: string;
}

/**
 * Generate optimized content variants for A/B testing
 */
export async function generateContentVariants(
  content: string,
  contentType: "subject" | "body" | "cta",
  context: { campaignType: string; targetAudience: string }
): Promise<ContentOptimizationResult> {
  const prompt = `Generate 3 A/B test variants for this ${contentType} in an email campaign.

Original ${contentType}: "${content}"

Campaign Context:
- Type: ${context.campaignType}
- Target Audience: ${context.targetAudience}

Create variants with different approaches:
1. Emotional/Benefit-focused
2. Urgency/Scarcity
3. Curiosity/Question-based

Respond in JSON:
{
  "variants": [
    {
      "id": "variant-1",
      "type": "${contentType}",
      "content": "The variant content",
      "tone": "emotional|urgent|curious",
      "expectedPerformance": 0.0-1.0
    }
  ],
  "recommendation": "Which variant to test first and why"
}`;

  try {
    const result = await claudeJSON<ContentOptimizationResult>(
      "You are an expert email marketing optimizer. Create compelling A/B test variants that feel authentic, not manipulative. Respond only with valid JSON.",
      prompt,
      { temperature: 0.8 }
    );

    return {
      originalContent: content,
      variants: result.variants || [],
      recommendation: result.recommendation || "Test variant 1 first",
    };
  } catch (error) {
    aiMarketingServicesLogger.error({ err: error }, "Content optimization error:");
    throw new Error("Failed to generate content variants");
  }
}

// ============================================
// A/B TESTING SERVICE
// ============================================

export interface ABTest {
  id: string;
  campaignId: string;
  name: string;
  status: "draft" | "running" | "completed";
  variants: Array<{
    id: string;
    name: string;
    content: Record<string, string>;
    allocation: number; // 0-1
    metrics: {
      sent: number;
      opens: number;
      clicks: number;
      conversions: number;
    };
  }>;
  winner?: string;
  confidence?: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Create an A/B test for a campaign
 */
export async function createABTest(
  campaignId: string,
  testName: string,
  variants: Array<{ name: string; content: Record<string, string> }>
): Promise<ABTest> {
  // Allocate traffic equally
  const allocation = 1 / variants.length;

  const test: ABTest = {
    id: `ab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    campaignId,
    name: testName,
    status: "draft",
    variants: variants.map((v, i) => ({
      id: `variant-${i}`,
      name: v.name,
      content: v.content,
      allocation,
      metrics: {
        sent: 0,
        opens: 0,
        clicks: 0,
        conversions: 0,
      },
    })),
  };

  // Store in database (would need ABTest model)
  // For now, return the structure
  return test;
}

/**
 * Analyze A/B test results and determine winner
 */
export async function analyzeABTestResults(test: ABTest): Promise<{
  winner: string | null;
  confidence: number;
  analysis: string;
  recommendation: string;
}> {
  // Calculate metrics for each variant
  const variantMetrics = test.variants.map(v => {
    const openRate = v.metrics.sent > 0 ? v.metrics.opens / v.metrics.sent : 0;
    const clickRate = v.metrics.opens > 0 ? v.metrics.clicks / v.metrics.opens : 0;
    const conversionRate = v.metrics.clicks > 0 ? v.metrics.conversions / v.metrics.clicks : 0;

    // Composite score
    const score = openRate * 0.3 + clickRate * 0.4 + conversionRate * 0.3;

    return {
      ...v,
      openRate,
      clickRate,
      conversionRate,
      score,
    };
  });

  // Find winner
  const sorted = variantMetrics.sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const runnerUp = sorted[1];

  // Calculate statistical confidence (simplified)
  const totalSamples = test.variants.reduce((sum, v) => sum + v.metrics.sent, 0);
  let confidence = 0;

  if (totalSamples > 100 && winner && runnerUp) {
    const lift = (winner.score - runnerUp.score) / Math.max(runnerUp.score, 0.001);
    confidence = Math.min(0.5 + lift * 2 + totalSamples / 10000, 0.99);
  }

  const hasWinner = confidence >= 0.95;

  return {
    winner: hasWinner ? winner.id : null,
    confidence,
    analysis: winner
      ? `After ${totalSamples} sends, "${winner.name}" leads with ${(winner.openRate * 100).toFixed(1)}% open rate and ${(winner.clickRate * 100).toFixed(1)}% click rate.`
      : `Not enough data yet (${totalSamples} sends).`,
    recommendation: hasWinner && winner
      ? `Deploy "${winner.name}" as the winner with ${(confidence * 100).toFixed(0)}% confidence.`
      : `Continue testing. Need ${Math.ceil((0.95 - confidence) * 1000)} more samples for statistical significance.`,
  };
}
