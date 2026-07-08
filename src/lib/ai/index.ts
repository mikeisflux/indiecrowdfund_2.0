// AI Services Index - All powered by Anthropic Claude
export {
  // Content Generation
  autoTagProject,
  generateMarketingCopy,
  improveDescription,
  generateCampaignContent,
  PROJECT_CATEGORIES,
  type ProjectCategory,
  // Moderation & Safety
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

// Configuration check
export async function checkAIConfiguration(): Promise<{
  anthropic: boolean;
  fullyConfigured: boolean;
}> {
  const { db } = await import("@/lib/db");
  const settings = await db.platformSettings.findFirst({
    select: { anthropicApiKey: true },
  });

  const anthropic = !!(settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY);

  return {
    anthropic,
    fullyConfigured: anthropic,
  };
}
