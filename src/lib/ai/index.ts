// AI Services Index
// OpenAI - Used for content generation tasks
export {
  autoTagProject,
  generateMarketingCopy,
  generateRecommendationReason,
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
  autoSelectWinner,
  type ABTest,
} from "./marketing-services";

// Configuration check
export function checkAIConfiguration(): {
  openai: boolean;
  anthropic: boolean;
  fullyConfigured: boolean;
} {
  const openai = !!process.env.OPENAI_API_KEY;
  const anthropic = !!process.env.ANTHROPIC_API_KEY;

  return {
    openai,
    anthropic,
    fullyConfigured: openai && anthropic,
  };
}
