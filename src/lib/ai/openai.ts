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
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at categorizing crowdfunding projects and generating specific, thematic tags. Focus on what projects are ABOUT (themes, genres, settings, character types, story elements, art styles) rather than what format they are in. Never suggest generic format tags like 'comics', 'graphic novel', 'indie game', etc. Respond only with valid JSON.",
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
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert email marketing specialist for crowdfunding platforms. Create authentic, personalized content that drives engagement without being pushy or salesy. Respond only with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      subject: result.subject || params.subjectTemplate || "Projects you'll love",
      preheader: result.preheader || "Discover amazing projects tailored for you",
      personalizedIntro: result.personalizedIntro || params.introMessage,
      projectRecommendations: result.projectRecommendations || [],
      footer: result.footer || "Happy exploring!",
    };
  } catch (error) {
    console.error("OpenAI campaign content error:", error);
    throw new Error("Failed to generate campaign content");
  }
}

export { PROJECT_CATEGORIES, type ProjectCategory };
