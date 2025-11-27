import OpenAI from "openai";

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

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
  const prompt = `Analyze this crowdfunding project and suggest appropriate categories and tags.

Project Title: ${project.title}
Description: ${project.description}
${project.rewards?.length ? `Rewards: ${project.rewards.map((r) => r.title).join(", ")}` : ""}

Available categories: ${PROJECT_CATEGORIES.join(", ")}

Respond in JSON format:
{
  "primaryCategory": "most appropriate category from the list",
  "suggestedCategories": ["up to 3 other relevant categories"],
  "tags": ["5-10 relevant keyword tags for discoverability"],
  "confidence": 0.0-1.0 confidence score
}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at categorizing crowdfunding projects. Respond only with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      primaryCategory: result.primaryCategory || "Technology",
      suggestedCategories: result.suggestedCategories || [],
      tags: result.tags || [],
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error("OpenAI auto-tag error:", error);
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
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert crowdfunding marketing copywriter. Create authentic, compelling copy that resonates with backers. Respond only with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

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
    console.error("OpenAI marketing copy error:", error);
    throw new Error("Failed to generate marketing copy");
  }
}

/**
 * Generate personalized project recommendations description
 */
export async function generateRecommendationReason(
  project: ProjectDetails,
  userInterests: string[]
): Promise<string> {
  const prompt = `Given a user interested in: ${userInterests.join(", ")}

And this project:
Title: ${project.title}
Description: ${project.description.substring(0, 500)}

Write a brief, personalized 1-sentence explanation of why this project might interest them. Be specific and genuine.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write brief, personalized recommendation explanations for crowdfunding projects. Be genuine and specific.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 100,
      temperature: 0.6,
    });

    return (
      response.choices[0].message.content ||
      "Based on your interests, you might like this project."
    );
  } catch (error) {
    console.error("OpenAI recommendation reason error:", error);
    return "Recommended for you based on your activity.";
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
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at improving crowdfunding project descriptions. Focus on clarity, emotional appeal, and authenticity. Respond only with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      improved: result.improved || currentDescription,
      suggestions: result.suggestions || [],
    };
  } catch (error) {
    console.error("OpenAI improve description error:", error);
    throw new Error("Failed to improve description");
  }
}

export { PROJECT_CATEGORIES, type ProjectCategory };
