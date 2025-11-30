import Anthropic from "@anthropic-ai/sdk";

// Lazy initialization to avoid build-time errors
let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
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
    const response = await getAnthropic().messages.create({
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
    console.error("Anthropic moderation error:", error);
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
    const response = await getAnthropic().messages.create({
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
    console.error("Anthropic fraud analysis error:", error);
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
    const response = await getAnthropic().messages.create({
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
    console.error("Anthropic safety review error:", error);
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
    const response = await getAnthropic().messages.create({
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
    console.error("Anthropic comment moderation error:", error);
    return { isAllowed: true, toxicityScore: 0 };
  }
}
