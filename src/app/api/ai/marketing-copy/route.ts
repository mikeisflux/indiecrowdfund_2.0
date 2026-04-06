import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const aiMarketingCopyLogger = logger.child({ module: "ai-marketing-copy" });
import { auth } from "@/lib/auth";
import { generateMarketingCopy, improveDescription } from "@/lib/ai/anthropic";

// POST - Generate marketing copy for a project
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, category, goalAmount, rewards, action } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    // Enforce input size limits to prevent prompt injection and cost abuse
    if (typeof title !== "string" || title.length > 300) {
      return NextResponse.json({ error: "Title must be 300 characters or less" }, { status: 400 });
    }
    if (typeof description !== "string" || description.length > 10000) {
      return NextResponse.json({ error: "Description must be 10000 characters or less" }, { status: 400 });
    }

    // Different actions for different AI features
    if (action === "improve") {
      // Improve description
      const result = await improveDescription(description);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // Default: Generate marketing copy
    const result = await generateMarketingCopy({
      title,
      description,
      category,
      goalAmount,
      rewards,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    aiMarketingCopyLogger.error({ err: String(error) }, "Marketing copy error:");
    return NextResponse.json(
      { error: "Failed to generate marketing copy" },
      { status: 500 }
    );
  }
}
