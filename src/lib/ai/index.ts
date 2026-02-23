// AI Services Index
// OpenAI - Used for content generation tasks
export {
  autoTagProject,
  generateMarketingCopy,
  improveDescription,
  generateCampaignContent,
  PROJECT_CATEGORIES,
  type ProjectCategory,
} from "./openai";

// Anthropic Claude - Used for moderation and safety
export {
  moderateContent,
  analyzeFraud,
  safetyReview,
  moderateComment,
} from "./anthropic";

// Marketing AI Services
export {
  // Email Personalization
  personalizeEmailForUser,
  type PersonalizedEmailContent,
  type UserProfile,
  // Predictive Analytics
  predictUserBehavior,
  batchPredictUsers,
  type PredictionResult,
  // Smart Segmentation
  generateSmartSegments,
  type UserSegment,
  // Send Time Optimization
  getOptimalSendTime,
  batchOptimalSendTimes,
  type OptimalSendTime,
  // Content Optimization
  generateContentVariants,
  type ContentVariant,
  type ContentOptimizationResult,
  // A/B Testing
  createABTest,
  analyzeABTestResults,
  type ABTest,
} from "./marketing-services";

// Configuration check - reads from database first, falls back to env
export async function checkAIConfiguration(): Promise<{
  openai: boolean;
  anthropic: boolean;
  fullyConfigured: boolean;
}> {
  const { db } = await import("@/lib/db");
  const settings = await db.platformSettings.findFirst({
    select: { openaiApiKey: true, anthropicApiKey: true },
  });

  const openai = !!(settings?.openaiApiKey || process.env.OPENAI_API_KEY);
  const anthropic = !!(settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY);

  return {
    openai,
    anthropic,
    fullyConfigured: openai && anthropic,
  };
}
