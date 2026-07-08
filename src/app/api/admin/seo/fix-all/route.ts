import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { fixSeoPages } from "@/lib/seo-fix";

const adminSeoFixAllLogger = logger.child({ module: "admin-seo-fix-all" });

export const dynamic = "force-dynamic";

// POST - Bulk auto-fix SEO issues for all pages (or specific pages).
// Fills missing fields AND repairs out-of-range descriptions from the
// curated defaults. The shared engine lives in src/lib/seo-fix.ts so the
// admin button and the daily cron stay in lockstep.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      paths,
      fixMissing = true,
      overwriteExisting = false,
    } = body as {
      paths?: string[];
      fixMissing?: boolean;
      overwriteExisting?: boolean;
    };

    const { results, summary } = await fixSeoPages({
      paths,
      fixMissing,
      overwriteExisting,
    });

    return NextResponse.json({ data: { results, summary } });
  } catch (error) {
    adminSeoFixAllLogger.error({ err: formatError(error) }, "Error in bulk SEO fix:");
    return NextResponse.json(
      { error: "Failed to apply SEO fixes" },
      { status: 500 }
    );
  }
}
