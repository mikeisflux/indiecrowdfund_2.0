import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminSeoAuditLogger = logger.child({ module: "admin-seo-audit" });
import { auth } from "@/lib/auth";
import { runSeoAudit } from "@/lib/seo-audit";

export const dynamic = "force-dynamic";

// GET - List all audits with pagination
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = (page - 1) * limit;

    const { db } = await import("@/lib/db");

    const [audits, total] = await Promise.all([
      db.seoAudit.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.seoAudit.count(),
    ]);

    return NextResponse.json({
      data: audits,
      stats: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    adminSeoAuditLogger.error({ err: String(error) }, "Error fetching SEO audits:");
    return NextResponse.json(
      { error: "Failed to fetch SEO audits" },
      { status: 500 }
    );
  }
}

// POST - Run a new SEO audit
export async function POST() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { auditId, overallScore, results } = await runSeoAudit(
      "manual",
      session.user.id ?? "admin"
    );

    return NextResponse.json({
      data: {
        auditId,
        overallScore,
        pagesAudited: results.length,
        results,
      },
      stats: {
        overallScore,
        pagesAudited: results.length,
        criticalPages: results.filter((r) => r.score < 30).length,
        warningPages: results.filter((r) => r.score >= 30 && r.score < 70).length,
        passedPages: results.filter((r) => r.score >= 70).length,
      },
    });
  } catch (error) {
    adminSeoAuditLogger.error({ err: String(error) }, "Error running SEO audit:");
    return NextResponse.json(
      { error: "Failed to run SEO audit" },
      { status: 500 }
    );
  }
}
