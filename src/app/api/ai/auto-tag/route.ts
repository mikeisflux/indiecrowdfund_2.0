import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { autoTagProject } from "@/lib/ai/openai";

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
    console.error("Auto-tag error:", error);
    return NextResponse.json(
      { error: "Failed to auto-tag project" },
      { status: 500 }
    );
  }
}
