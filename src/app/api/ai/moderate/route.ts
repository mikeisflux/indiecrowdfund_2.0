import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const aiModerateLogger = logger.child({ module: "ai-moderate" });
import { auth } from "@/lib/auth";
import { moderateContent, analyzeFraud, safetyReview, moderateComment } from "@/lib/ai/anthropic";

// POST - Moderate content using Claude AI
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      type, // "project" | "comment" | "fraud" | "safety"
      content,
    } = body;

    if (!type || !content) {
      return NextResponse.json(
        { error: "Type and content are required" },
        { status: 400 }
      );
    }

    // Enforce input size limits to prevent prompt injection and cost abuse
    if (type === "comment") {
      if (typeof content !== "string" || content.length > 5000) {
        return NextResponse.json({ error: "Comment content must be 5000 characters or less" }, { status: 400 });
      }
    } else if (typeof content === "object" && content !== null) {
      if (typeof content.description === "string" && content.description.length > 50000) {
        return NextResponse.json({ error: "Description exceeds maximum length" }, { status: 400 });
      }
      if (typeof content.title === "string" && content.title.length > 300) {
        return NextResponse.json({ error: "Title exceeds maximum length" }, { status: 400 });
      }
    }

    let result;

    switch (type) {
      case "project":
        // Full content moderation for a project
        result = await moderateContent({
          title: content.title,
          description: content.description,
          risks: content.risks,
          rewards: content.rewards,
          goalAmount: content.goalAmount,
          creatorName: content.creatorName,
          creatorEmail: content.creatorEmail,
          creatorProjectCount: content.creatorProjectCount,
        });
        break;

      case "fraud":
        // Fraud analysis for a project
        result = await analyzeFraud({
          title: content.title,
          description: content.description,
          risks: content.risks,
          rewards: content.rewards,
          goalAmount: content.goalAmount,
          creatorName: content.creatorName,
          creatorEmail: content.creatorEmail,
          creatorProjectCount: content.creatorProjectCount,
        });
        break;

      case "safety":
        // Safety review for a project
        result = await safetyReview({
          title: content.title,
          description: content.description,
          risks: content.risks,
        });
        break;

      case "comment":
        // Comment moderation
        if (typeof content !== "string") {
          return NextResponse.json(
            { error: "Content must be a string for comment moderation" },
            { status: 400 }
          );
        }
        result = await moderateComment(content);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid moderation type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type,
      ...result,
    });
  } catch (error) {
    aiModerateLogger.error({ err: formatError(error) }, "Moderation error:");
    return NextResponse.json(
      { error: "Failed to moderate content" },
      { status: 500 }
    );
  }
}
