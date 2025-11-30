import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recommendationEngine } from "@/lib/recommendations/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);

    const limit = parseInt(searchParams.get("limit") || "12");
    const excludeIds = searchParams.get("exclude")?.split(",") || [];
    const sessionId = searchParams.get("sessionId") || undefined;
    const currentPage = searchParams.get("page") || undefined;

    const recommendations = await recommendationEngine.getRecommendations({
      userId: session?.user?.id,
      sessionId,
      currentPage,
      limit,
      excludeProjectIds: excludeIds,
    });

    return NextResponse.json({
      projects: recommendations.map((r) => ({
        ...(r.project as Record<string, unknown>),
        score: r.score,
        reasons: r.reasons,
      })),
    });
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 }
    );
  }
}
