import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

import { logger } from "@/lib/logger";

const aiAnthropicLogger = logger.child({ module: "ai-anthropic" });


// Lazy initialization to avoid build-time errors
let anthropicClient: Anthropic | null = null;
let cachedApiKey: string | null = null;

async function getAnthropic(): Promise<Anthropic> {
  // Try to get key from database first, fall back to env
  const settings = await db.platformSettings.findFirst({
    select: { anthropicApiKey: true },
  });
  const apiKey = settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Set it in Admin Settings > AI.");
  }

  // Re-create client if key changed
  if (!anthropicClient || cachedApiKey !== apiKey) {
    anthropicClient = new Anthropic({ apiKey });
    cachedApiKey = apiKey;
  }
  return anthropicClient;
}

/** Helper: call Claude and parse JSON from the response */
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

interface ModerationResult {
  isApproved: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
  flags: string[];
  explanation: string;
  suggestedAction: "approve" | "review" | "reject";
  confidence: number;
}

interface FraudAnalysisResult {
  fraudScore: number; // 0-100, higher = more likely fraud
  riskFactors: Array<{
    factor: string;
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  recommendation: "approve" | "manual_review" | "reject";
  explanation: string;
}

interface ProjectContent {
  title: string;
  description: string;
  risks?: string;
  rewards?: Array<{ title: string; description: string; amount: number }>;
  goalAmount?: number;
  creatorName?: string;
  creatorEmail?: string;
  creatorProjectCount?: number;
}

/**
 * Moderate project content for policy violations
 */
export async function moderateContent(
  content: ProjectContent
): Promise<ModerationResult> {
  const prompt = `You are a content moderator for a crowdfunding platform similar to Kickstarter.
Analyze this project submission for policy violations.

POLICIES TO CHECK:
1. No illegal products or services
2. No weapons, drugs, or dangerous items
3. No adult content or explicit material
4. No hate speech or discrimination
5. No misleading claims or false advertising
6. No pyramid schemes or investment scams
7. No reselling of existing products without permission
8. No AI-generated content presented as original art (unless disclosed)
9. No charity projects (we're not a charity platform)
10. Must be a tangible project with clear deliverables

PROJECT TO REVIEW:
Title: ${content.title}
Description: ${content.description}
${content.risks ? `Risks Section: ${content.risks}` : ""}
${content.rewards?.length ? `Rewards: ${content.rewards.map((r) => `${r.title}: ${r.description} ($${r.amount})`).join("\n")}` : ""}
Goal Amount: $${content.goalAmount?.toLocaleString() || "Not specified"}

Respond in JSON format:
{
  "isApproved": true/false,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "flags": ["list of specific policy concerns if any"],
  "explanation": "brief explanation of decision",
  "suggestedAction": "approve" | "review" | "reject",
  "confidence": 0.0-1.0
}`;

  try {
    const anthropic = await getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      isApproved: result.isApproved ?? true,
      riskLevel: result.riskLevel || "low",
      flags: result.flags || [],
      explanation: result.explanation || "",
      suggestedAction: result.suggestedAction || "approve",
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Anthropic moderation error:");
    // Fail safe - flag for manual review
    return {
      isApproved: false,
      riskLevel: "medium",
      flags: ["moderation_error"],
      explanation: "Automated moderation failed - flagged for manual review",
      suggestedAction: "review",
      confidence: 0,
    };
  }
}

/**
 * Analyze project for potential fraud
 */
export async function analyzeFraud(
  content: ProjectContent
): Promise<FraudAnalysisResult> {
  const prompt = `You are a fraud detection specialist for a crowdfunding platform.
Analyze this project submission for potential fraud indicators.

FRAUD INDICATORS TO CHECK:
1. Unrealistic promises or guarantees
2. Claims of "guaranteed returns" or "no risk"
3. Vague or copied descriptions
4. Unrealistic timelines
5. Goal amounts that don't match project scope
6. New creator with ambitious claims
7. Rewards that seem too good to be true
8. Missing or vague risk disclosures
9. Cryptocurrency/NFT projects with investment language
10. Impersonation of known brands or creators

PROJECT DETAILS:
Title: ${content.title}
Description: ${content.description}
${content.risks ? `Risks Disclosed: ${content.risks}` : "No risks disclosed"}
Goal Amount: $${content.goalAmount?.toLocaleString() || "Not specified"}
${content.rewards?.length ? `Rewards: ${content.rewards.map((r) => `${r.title}: $${r.amount}`).join(", ")}` : "No rewards"}

CREATOR INFO:
Name: ${content.creatorName || "Unknown"}
Previous Projects: ${content.creatorProjectCount || 0}

Respond in JSON format:
{
  "fraudScore": 0-100 (higher = more likely fraud),
  "riskFactors": [
    {
      "factor": "name of risk factor",
      "severity": "low" | "medium" | "high",
      "description": "specific concern"
    }
  ],
  "recommendation": "approve" | "manual_review" | "reject",
  "explanation": "overall assessment"
}`;

  try {
    const anthropic = await getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      fraudScore: result.fraudScore ?? 50,
      riskFactors: result.riskFactors || [],
      recommendation: result.recommendation || "manual_review",
      explanation: result.explanation || "",
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Anthropic fraud analysis error:");
    return {
      fraudScore: 50,
      riskFactors: [
        {
          factor: "analysis_error",
          severity: "medium",
          description: "Automated fraud analysis failed",
        },
      ],
      recommendation: "manual_review",
      explanation: "Automated fraud analysis failed - requires manual review",
    };
  }
}

/**
 * Safety review for project content before going live
 */
export async function safetyReview(
  content: ProjectContent
): Promise<{
  safe: boolean;
  concerns: string[];
  suggestions: string[];
}> {
  const prompt = `Review this crowdfunding project for safety and quality before it goes live.

Project:
Title: ${content.title}
Description: ${content.description}
${content.risks ? `Risks: ${content.risks}` : ""}

Check for:
1. Clear project goals and deliverables
2. Realistic timelines
3. Adequate risk disclosure
4. No harmful or dangerous elements
5. Professional presentation

Respond in JSON:
{
  "safe": true/false,
  "concerns": ["list any safety/quality concerns"],
  "suggestions": ["constructive suggestions for improvement"]
}`;

  try {
    const anthropic = await getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      safe: result.safe ?? true,
      concerns: result.concerns || [],
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Anthropic safety review error:");
    return {
      safe: true,
      concerns: ["Automated review failed"],
      suggestions: ["Manual review recommended"],
    };
  }
}

/**
 * Analyze backer comment for toxicity
 */
export async function moderateComment(comment: string): Promise<{
  isAllowed: boolean;
  reason?: string;
  toxicityScore: number;
}> {
  const prompt = `Analyze this comment for a crowdfunding project for toxicity and policy violations.

Comment: "${comment}"

Check for:
1. Hate speech or discrimination
2. Personal attacks or harassment
3. Spam or promotional content
4. Misinformation
5. Threats or calls to violence

Respond in JSON:
{
  "isAllowed": true/false,
  "reason": "explanation if not allowed",
  "toxicityScore": 0-100
}`;

  try {
    const anthropic = await getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const responseText = textContent?.type === "text" ? textContent.text : "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isAllowed: true, toxicityScore: 0 };
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      isAllowed: result.isAllowed ?? true,
      reason: result.reason,
      toxicityScore: result.toxicityScore ?? 0,
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Anthropic comment moderation error:");
    return { isAllowed: true, toxicityScore: 0 };
  }
}

// ============================================
// CONTENT GENERATION
// ============================================

// Available project categories for auto-tagging
const PROJECT_CATEGORIES = [
  "Technology",
  "Games",
  "Design",
  "Film",
  "Music",
  "Art",
  "Publishing",
  "Fashion",
  "Food",
  "Crafts",
  "Photography",
  "Comics",
  "Theater",
  "Dance",
  "Journalism",
] as const;

type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

interface AutoTagResult {
  primaryCategory: ProjectCategory;
  suggestedCategories: ProjectCategory[];
  tags: string[];
  confidence: number;
}

interface MarketingCopyResult {
  tagline: string;
  subtitle: string;
  emailSubject: string;
  socialPosts: {
    twitter: string;
    facebook: string;
    instagram: string;
  };
  callToAction: string;
}

interface ProjectDetails {
  title: string;
  description: string;
  category?: string;
  goalAmount?: number;
  rewards?: Array<{ title: string; description: string; amount: number }>;
}

/**
 * Auto-tag a project based on its content
 */
export async function autoTagProject(
  project: ProjectDetails
): Promise<AutoTagResult> {
  const prompt = `Analyze this crowdfunding project and suggest appropriate categories and SPECIFIC thematic/content tags.

Project Title: ${project.title}
Description: ${project.description}
${project.rewards?.length ? `Rewards: ${project.rewards.map((r) => r.title).join(", ")}` : ""}

Available categories: ${PROJECT_CATEGORIES.join(", ")}

IMPORTANT TAG GUIDELINES:
- DO NOT use generic format/medium tags like "comics", "comic book", "graphic novel", "indie game", "board game", "music album", etc.
- Instead, focus on THEMATIC and CONTENT-BASED tags that describe what the project is ABOUT
- Use tags that describe: genres, themes, settings, character types, art styles, emotional tones, story elements
- Examples of GOOD thematic tags: "sci-fi", "dystopian", "noir", "female protagonist", "space exploration", "steampunk", "post-apocalyptic", "mystery", "romance", "coming-of-age", "psychological horror", "political thriller", "slice-of-life", "cyberpunk", "fantasy adventure", "supernatural", "time travel", "heist", "survival", "dark comedy"
- Examples of BAD generic tags to AVOID: "comics", "comic", "graphic novel", "indie", "crowdfunding", "book", "game", "music", "art", "creative"

Respond in JSON format:
{
  "primaryCategory": "most appropriate category from the list",
  "suggestedCategories": ["up to 3 other relevant categories"],
  "tags": ["8-12 specific thematic/content tags that describe what this project is ABOUT, not what format it is"],
  "confidence": 0.0-1.0 confidence score
}`;

  try {
    const result = await claudeJSON<AutoTagResult>(
      "You are an expert at categorizing crowdfunding projects and generating specific, thematic tags. Focus on what projects are ABOUT (themes, genres, settings, character types, story elements, art styles) rather than what format they are in. Never suggest generic format tags like 'comics', 'graphic novel', 'indie game', etc. Respond only with valid JSON.",
      prompt,
      { temperature: 0.3 }
    );

    return {
      primaryCategory: result.primaryCategory || "Technology",
      suggestedCategories: result.suggestedCategories || [],
      tags: result.tags || [],
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Auto-tag error:");
    throw new Error("Failed to auto-tag project");
  }
}

/**
 * Generate marketing copy for a project
 */
export async function generateMarketingCopy(
  project: ProjectDetails
): Promise<MarketingCopyResult> {
  const prompt = `Generate compelling marketing copy for this crowdfunding project.

Project Title: ${project.title}
Description: ${project.description}
Category: ${project.category || "General"}
Goal: $${project.goalAmount?.toLocaleString() || "TBD"}
${project.rewards?.length ? `Top Rewards: ${project.rewards.slice(0, 3).map((r) => `${r.title} ($${r.amount})`).join(", ")}` : ""}

Generate marketing copy that is:
- Authentic and not overly salesy
- Focused on the project's unique value
- Appropriate for a crowdfunding audience
- Compliant with advertising standards (no false claims)

Respond in JSON format:
{
  "tagline": "A catchy 5-10 word tagline",
  "subtitle": "A compelling 2-3 sentence pitch (max 280 chars)",
  "emailSubject": "An email subject line that drives opens",
  "socialPosts": {
    "twitter": "280 char tweet with relevant hashtags",
    "facebook": "Engaging Facebook post (2-3 paragraphs)",
    "instagram": "Instagram caption with emojis and hashtags"
  },
  "callToAction": "A compelling CTA phrase"
}`;

  try {
    const result = await claudeJSON<MarketingCopyResult>(
      "You are an expert crowdfunding marketing copywriter. Create authentic, compelling copy that resonates with backers. Respond only with valid JSON.",
      prompt,
      { temperature: 0.7 }
    );

    return {
      tagline: result.tagline || "",
      subtitle: result.subtitle || "",
      emailSubject: result.emailSubject || "",
      socialPosts: {
        twitter: result.socialPosts?.twitter || "",
        facebook: result.socialPosts?.facebook || "",
        instagram: result.socialPosts?.instagram || "",
      },
      callToAction: result.callToAction || "Back this project",
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Marketing copy error:");
    throw new Error("Failed to generate marketing copy");
  }
}

/**
 * Improve project description with AI suggestions
 */
export async function improveDescription(
  currentDescription: string
): Promise<{
  improved: string;
  suggestions: string[];
}> {
  const prompt = `Review this crowdfunding project description and suggest improvements:

"${currentDescription}"

Provide:
1. An improved version that is more compelling while keeping the same meaning
2. 3-5 specific actionable suggestions

Respond in JSON format:
{
  "improved": "the improved description",
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

  try {
    const result = await claudeJSON<{ improved: string; suggestions: string[] }>(
      "You are an expert at improving crowdfunding project descriptions. Focus on clarity, emotional appeal, and authenticity. Respond only with valid JSON.",
      prompt,
      { temperature: 0.5 }
    );

    return {
      improved: result.improved || currentDescription,
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Improve description error:");
    throw new Error("Failed to improve description");
  }
}

/**
 * Generate personalized email campaign content using AI
 */
export async function generateCampaignContent(params: {
  campaignName: string;
  targetAudience: string;
  projectCategory: string;
  subjectTemplate: string;
  introMessage: string;
  projects: Array<{ title: string; description: string; category?: string; goalAmount?: number }>;
}): Promise<{
  subject: string;
  preheader: string;
  personalizedIntro: string;
  projectRecommendations: Array<{
    projectTitle: string;
    recommendationReason: string;
    callToAction: string;
  }>;
  footer: string;
}> {
  const prompt = `Generate personalized email campaign content for a crowdfunding platform.

Campaign Details:
- Name: ${params.campaignName}
- Target Audience: ${params.targetAudience}
- Category Filter: ${params.projectCategory}
- Subject Template: ${params.subjectTemplate || "Projects you'll love this week"}
- Intro Message: ${params.introMessage || "Check out these amazing projects we picked just for you."}

Available Projects to Recommend:
${params.projects.slice(0, 5).map((p, i) => `${i + 1}. "${p.title}" - ${p.description?.substring(0, 200) || "No description"}`).join("\n")}

Generate compelling email content that:
- Feels personal and authentic, not generic or salesy
- Creates urgency without being pushy
- Highlights what makes each project special
- Includes clear calls-to-action

Respond in JSON format:
{
  "subject": "An engaging email subject line",
  "preheader": "A compelling preheader text (max 100 chars)",
  "personalizedIntro": "A warm, personalized introduction paragraph",
  "projectRecommendations": [
    {
      "projectTitle": "Project title",
      "recommendationReason": "Why this project is perfect for this audience (1-2 sentences)",
      "callToAction": "A compelling CTA for this project"
    }
  ],
  "footer": "A friendly sign-off message"
}`;

  try {
    const result = await claudeJSON<{
      subject: string;
      preheader: string;
      personalizedIntro: string;
      projectRecommendations: Array<{
        projectTitle: string;
        recommendationReason: string;
        callToAction: string;
      }>;
      footer: string;
    }>(
      "You are an expert email marketing specialist for crowdfunding platforms. Create authentic, personalized content that drives engagement without being pushy or salesy. Respond only with valid JSON.",
      prompt,
      { temperature: 0.7 }
    );

    return {
      subject: result.subject || params.subjectTemplate || "Projects you'll love",
      preheader: result.preheader || "Discover amazing projects tailored for you",
      personalizedIntro: result.personalizedIntro || params.introMessage,
      projectRecommendations: result.projectRecommendations || [],
      footer: result.footer || "Happy exploring!",
    };
  } catch (error) {
    aiAnthropicLogger.error({ err: error }, "Campaign content error:");
    throw new Error("Failed to generate campaign content");
  }
}

export { PROJECT_CATEGORIES, type ProjectCategory };
