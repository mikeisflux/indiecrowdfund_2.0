import { NextRequest, NextResponse } from "next/server";
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
    aiModerateLogger.error({ err: String(error) }, "Moderation error:");
    return NextResponse.json(
      { error: "Failed to moderate content" },
      { status: 500 }
    );
  }
}
