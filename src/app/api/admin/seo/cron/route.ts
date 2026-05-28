import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminSeoCronLogger = logger.child({ module: "admin-seo-cron" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { runSeoAudit } from "@/lib/seo-audit";

export const dynamic = "force-dynamic";

// POST - Run the daily SEO cron job
// Accepts either admin session auth OR apiKey query param
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth: allow either admin session or API key
    const { searchParams } = new URL(req.url);
    const apiKey = searchParams.get("apiKey");
    let triggeredBy = "cron";

    if (apiKey) {
      // Validate API key for external cron services
      const expectedKey = process.env.SEO_CRON_API_KEY;
      if (!expectedKey || apiKey !== expectedKey) {
        return NextResponse.json(
          { error: "Invalid API key" },
          { status: 401 }
        );
      }
      triggeredBy = "cron-external";
    } else {
      // Fall back to admin session auth
      const session = await auth();
      if (session?.user?.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      triggeredBy = session.user.id ?? "admin";
    }

    const errors: string[] = [];
    let auditId: string | null = null;
    let auditScore = 0;
    let auditPagesCount = 0;
    let projectIssuesFound = 0;

    // Step 1: Run a full SEO audit (reuse audit logic)
    try {
      const auditResult = await runSeoAudit("cron", triggeredBy);
      auditId = auditResult.auditId;
      auditScore = auditResult.overallScore;
      auditPagesCount = auditResult.results.length;
    } catch (auditError) {
      const msg = auditError instanceof Error ? auditError.message : "Unknown audit error";
      errors.push(`Audit failed: ${msg}`);
      adminSeoCronLogger.error({ err: String(auditError) }, "SEO cron audit error:");
    }

    // Step 2: Check all live projects have proper meta
    try {
      const liveProjects = await db.project.findMany({
        where: {
          status: "LIVE",
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          imageUrl: true,
        },
      });

      for (const project of liveProjects) {
        const projectIssues: string[] = [];

        if (!project.title || project.title.trim().length === 0) {
          projectIssues.push(`Project "${project.slug}" is missing a title`);
        }

        if (!project.description || project.description.trim().length === 0) {
          projectIssues.push(`Project "${project.slug}" is missing a description`);
        }

        if (!project.imageUrl || project.imageUrl.trim().length === 0) {
          projectIssues.push(`Project "${project.slug}" is missing an image`);
        }

        if (projectIssues.length > 0) {
          projectIssuesFound += projectIssues.length;
          errors.push(...projectIssues);
        }
      }
    } catch (projectError) {
      const msg = projectError instanceof Error ? projectError.message : "Unknown project check error";
      errors.push(`Project meta check failed: ${msg}`);
      adminSeoCronLogger.error({ err: String(projectError) }, "SEO cron project check error:");
    }

    // Step 3: Check marketplace books have proper meta
    try {
      const publishedBooks = await db.marketplaceBook.findMany({
        where: {
          status: { in: ["APPROVED", "LIVE"] },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          coverImageUrl: true,
        },
      });

      for (const book of publishedBooks) {
        const bookIssues: string[] = [];

        if (!book.title || book.title.trim().length === 0) {
          bookIssues.push(`Book "${book.slug}" is missing a title`);
        }

        if (!book.description || book.description.trim().length === 0) {
          bookIssues.push(`Book "${book.slug}" is missing a description`);
        }

        if (!book.coverImageUrl || book.coverImageUrl.trim().length === 0) {
          bookIssues.push(`Book "${book.slug}" is missing a cover image`);
        }

        if (bookIssues.length > 0) {
          projectIssuesFound += bookIssues.length;
          errors.push(...bookIssues);
        }
      }
    } catch (bookError) {
      const msg = bookError instanceof Error ? bookError.message : "Unknown book check error";
      errors.push(`Marketplace book check failed: ${msg}`);
      adminSeoCronLogger.error({ err: String(bookError) }, "SEO cron book check error:");
    }

    const duration = Date.now() - startTime;
    const totalIssues = (auditId ? 0 : 1) + projectIssuesFound;
    const status = errors.length === 0 ? "success" : auditId ? "partial" : "error";

    // Build output summary
    const outputParts: string[] = [];
    outputParts.push(`SEO Cron Job completed in ${duration}ms.`);
    if (auditId) {
      outputParts.push(`Audit: ${auditPagesCount} pages audited, overall score: ${auditScore}/100.`);
    }
    outputParts.push(`Project/Book issues found: ${projectIssuesFound}.`);
    if (errors.length > 0) {
      outputParts.push(`Errors: ${errors.length}.`);
    }
    const output = outputParts.join(" ");

    // Step 4: Log results to SeoCronLog
    const cronLog = await db.seoCronLog.create({
      data: {
        status,
        auditId: auditId || null,
        pagesProcessed: auditPagesCount,
        issuesFound: totalIssues + projectIssuesFound,
        autoFixed: 0,
        errors,
        duration,
        output,
      },
    });

    return NextResponse.json({
      data: {
        cronLogId: cronLog.id,
        auditId,
        auditScore,
        pagesProcessed: auditPagesCount,
        projectIssuesFound,
        errors,
        duration,
        status,
      },
      stats: {
        status,
        duration,
        auditScore,
        pagesProcessed: auditPagesCount,
        issuesFound: totalIssues + projectIssuesFound,
        errorCount: errors.length,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    adminSeoCronLogger.error({ err: formatError(error) }, "Error running SEO cron job:");

    // Attempt to log the failure
    try {
      await db.seoCronLog.create({
        data: {
          status: "error",
          pagesProcessed: 0,
          issuesFound: 0,
          autoFixed: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
          duration,
          output: `SEO cron job failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      });
    } catch (logError) {
      adminSeoCronLogger.error({ err: String(logError) }, "Failed to log SEO cron error:");
    }

    return NextResponse.json(
      { error: "Failed to run SEO cron job" },
      { status: 500 }
    );
  }
}
