import { db } from "@/lib/db";
import {
  personalizeEmailForUser,
  predictUserBehavior,
  generateSmartSegments,
  getOptimalSendTime,
  batchOptimalSendTimes,
  generateContentVariants,
  createABTest,
} from "@/lib/ai/marketing-services";
import { logger } from "@/lib/logger";

const aiSettingsIntegrationLogger = logger.child({ module: "ai-settings-integration" });

/**
 * AI Settings cache to avoid repeated DB calls
 */
let settingsCache: AISettings | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

export interface AISettings {
  emailPersonalization: boolean;
  predictiveAnalytics: boolean;
  smartSegmentation: boolean;
  sendTimeOptimization: boolean;
  contentOptimization: boolean;
  abTesting: boolean;
  autoTagging: boolean;
  autoTagConfidence: number;
  maxTags: number;
  emailFrequencyCap: number;
  dailyEmailLimit: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

/**
 * Get current AI settings from database
 */
export async function getAISettings(): Promise<AISettings> {
  // Return cached settings if fresh
  if (settingsCache && Date.now() - settingsCacheTime < CACHE_TTL) {
    return settingsCache;
  }

  const settings = await db.platformSettings.findFirst({
    select: {
      aiEmailPersonalization: true,
      aiPredictiveAnalytics: true,
      aiSmartSegmentation: true,
      aiSendTimeOptimization: true,
      aiContentOptimization: true,
      aiAbTesting: true,
      aiAutoTagging: true,
      aiAutoTagConfidence: true,
      aiMaxTags: true,
      aiEmailFrequencyCap: true,
      aiDailyEmailLimit: true,
      aiQuietHoursStart: true,
      aiQuietHoursEnd: true,
    },
  });

  const aiSettings: AISettings = {
    emailPersonalization: settings?.aiEmailPersonalization ?? false,
    predictiveAnalytics: settings?.aiPredictiveAnalytics ?? false,
    smartSegmentation: settings?.aiSmartSegmentation ?? false,
    sendTimeOptimization: settings?.aiSendTimeOptimization ?? false,
    contentOptimization: settings?.aiContentOptimization ?? false,
    abTesting: settings?.aiAbTesting ?? false,
    autoTagging: settings?.aiAutoTagging ?? true,
    autoTagConfidence: settings?.aiAutoTagConfidence ?? 75,
    maxTags: settings?.aiMaxTags ?? 10,
    emailFrequencyCap: settings?.aiEmailFrequencyCap ?? 3,
    dailyEmailLimit: settings?.aiDailyEmailLimit ?? 1000,
    quietHoursStart: settings?.aiQuietHoursStart ?? "22:00",
    quietHoursEnd: settings?.aiQuietHoursEnd ?? "08:00",
  };

  settingsCache = aiSettings;
  settingsCacheTime = Date.now();

  return aiSettings;
}

/**
 * Clear settings cache (call after settings update)
 */
export function clearSettingsCache() {
  settingsCache = null;
  settingsCacheTime = 0;
}

/**
 * Check if a specific AI feature is enabled
 */
export async function isFeatureEnabled(feature: keyof AISettings): Promise<boolean> {
  const settings = await getAISettings();
  return !!settings[feature];
}

/**
 * Apply AI personalization to email content if enabled
 */
export async function applyEmailPersonalization(
  userId: string,
  campaignType: string,
  projects: Array<{ id: string; title: string; description: string; category: string }>
) {
  const settings = await getAISettings();

  if (!settings.emailPersonalization) {
    return null; // Feature disabled, return null to use default content
  }

  try {
    return await personalizeEmailForUser(userId, campaignType, projects);
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "Email personalization failed:");
    return null; // Fallback to default content on error
  }
}

/**
 * Get optimal send time for user if enabled
 */
export async function getOptimalTime(userId: string) {
  const settings = await getAISettings();

  if (!settings.sendTimeOptimization) {
    return null; // Feature disabled
  }

  try {
    return await getOptimalSendTime(userId);
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "Send time optimization failed:");
    return null;
  }
}

/**
 * Schedule emails with optimal send times if enabled
 */
export async function scheduleWithOptimalTimes(
  userIds: string[]
): Promise<Map<string, { hour: number; day: number }> | null> {
  const settings = await getAISettings();

  if (!settings.sendTimeOptimization) {
    return null; // Feature disabled, send immediately
  }

  try {
    const times = await batchOptimalSendTimes(userIds);
    const schedule = new Map<string, { hour: number; day: number }>();

    Array.from(times.entries()).forEach(([userId, time]) => {
      schedule.set(userId, { hour: time.optimalHour, day: time.optimalDay });
    });

    return schedule;
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "Batch send time optimization failed:");
    return null;
  }
}

/**
 * Generate content variants for A/B testing if enabled
 */
export async function generateVariantsIfEnabled(
  content: string,
  contentType: "subject" | "body" | "cta",
  context: { campaignType: string; targetAudience: string }
) {
  const settings = await getAISettings();

  if (!settings.contentOptimization) {
    return null; // Feature disabled
  }

  try {
    return await generateContentVariants(content, contentType, context);
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "Content optimization failed:");
    return null;
  }
}

/**
 * Create A/B test for campaign if enabled
 */
export async function createABTestIfEnabled(
  campaignId: string,
  testName: string,
  variants: Array<{ name: string; content: Record<string, string> }>
) {
  const settings = await getAISettings();

  if (!settings.abTesting) {
    return null; // Feature disabled
  }

  try {
    return await createABTest(campaignId, testName, variants);
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "A/B test creation failed:");
    return null;
  }
}

/**
 * Get user predictions if enabled
 */
export async function getPredictionsIfEnabled(userId: string) {
  const settings = await getAISettings();

  if (!settings.predictiveAnalytics) {
    return null; // Feature disabled
  }

  try {
    return await predictUserBehavior(userId);
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "Predictive analytics failed:");
    return null;
  }
}

/**
 * Generate smart segments if enabled
 */
export async function generateSegmentsIfEnabled() {
  const settings = await getAISettings();

  if (!settings.smartSegmentation) {
    return null; // Feature disabled
  }

  try {
    return await generateSmartSegments();
  } catch (error) {
    aiSettingsIntegrationLogger.error({ err: error }, "Smart segmentation failed:");
    return null;
  }
}

/**
 * Check if current time is within quiet hours
 */
export async function isQuietHours(userTimezone?: string): Promise<boolean> {
  const settings = await getAISettings();

  const now = new Date();
  const timezone = userTimezone || "America/New_York";

  // Get current hour in user's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone,
  });
  const currentHour = parseInt(formatter.format(now));

  const [startHour] = settings.quietHoursStart.split(":").map(Number);
  const [endHour] = settings.quietHoursEnd.split(":").map(Number);

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  }

  return currentHour >= startHour && currentHour < endHour;
}

/**
 * Check if user has exceeded email frequency cap
 */
export async function hasExceededFrequencyCap(userId: string): Promise<boolean> {
  const settings = await getAISettings();

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const emailCount = await db.emailLog.count({
    where: {
      userId,
      sentAt: { gte: oneWeekAgo },
    },
  });

  return emailCount >= settings.emailFrequencyCap;
}

/**
 * Check if daily email limit has been reached
 */
export async function hasReachedDailyLimit(): Promise<boolean> {
  const settings = await getAISettings();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const emailCount = await db.emailLog.count({
    where: {
      sentAt: { gte: today },
    },
  });

  return emailCount >= settings.dailyEmailLimit;
}

/**
 * Full pre-send check - returns true if email can be sent
 */
export async function canSendEmail(userId: string): Promise<{
  canSend: boolean;
  reason?: string;
}> {
  // Check daily limit
  if (await hasReachedDailyLimit()) {
    return { canSend: false, reason: "Daily email limit reached" };
  }

  // Check user frequency cap
  if (await hasExceededFrequencyCap(userId)) {
    return { canSend: false, reason: "User frequency cap exceeded" };
  }

  // Check quiet hours
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });

  if (await isQuietHours(user?.timezone || undefined)) {
    return { canSend: false, reason: "Currently in quiet hours" };
  }

  return { canSend: true };
}
