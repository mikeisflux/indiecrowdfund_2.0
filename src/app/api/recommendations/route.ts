import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const recommendationsLogger = logger.child({ module: "recommendations" });
import { auth } from "@/lib/auth";
import { recommendationEngine } from "@/lib/recommendations/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);

    // Validate limit parameter
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12") || 12));
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
    recommendationsLogger.error({ err: String(error) }, "Recommendations error:");
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 }
    );
  }
}
