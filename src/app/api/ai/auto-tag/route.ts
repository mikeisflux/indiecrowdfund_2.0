import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const aiAutoTagLogger = logger.child({ module: "ai-auto-tag" });
import { auth } from "@/lib/auth";
import { autoTagProject } from "@/lib/ai/anthropic";

// POST - Auto-tag a project
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, rewards } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.length > 300) {
      return NextResponse.json({ error: "Title must be 300 characters or less" }, { status: 400 });
    }
    if (typeof description !== "string" || description.length > 10000) {
      return NextResponse.json({ error: "Description must be 10000 characters or less" }, { status: 400 });
    }

    const result = await autoTagProject({
      title,
      description,
      rewards,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    aiAutoTagLogger.error({ err: String(error) }, "Auto-tag error:");
    return NextResponse.json(
      { error: "Failed to auto-tag project" },
      { status: 500 }
    );
  }
}
