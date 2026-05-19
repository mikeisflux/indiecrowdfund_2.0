import { db } from "@/lib/db";

// All known static pages on the site
const STATIC_PAGES = [
  "/",
  "/crowdfunds",
  "/about-us",
  "/faq",
  "/fees",
  "/contact",
  "/privacy",
  "/terms",
  "/trust-safety",
  "/backer-handbook",
  "/creator-handbook",
  "/indiekit-handbook",
  "/shop",
  "/shop/books",
  "/retailers",
  "/success-stories",
  "/help",
  "/changelog",
  "/what-is-divinitycoin",
  "/shop-handbook/creators",
  "/shop-handbook/backers",
  "/lcs-locator",
  "/collaborate",
  "/bug-report",
  "/login",
  "/register",
];

export { STATIC_PAGES };

export interface PageAuditResult {
  path: string;
  score: number;
  hasPageMeta: boolean;
  hasTitle: boolean;
  hasDescription: boolean;
  descriptionLength: number | null;
  descriptionLengthOk: boolean;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;
  hasKeywords: boolean;
  noIndex: boolean;
  issues: string[];
}

type PageMeta = {
  path: string;
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  keywords: string[];
  noIndex: boolean;
};

/**
 * Score a page based on its SEO metadata.
 * Returns a score from 0-100 and a list of issues.
 */
function scorePage(
  path: string,
  meta: PageMeta | null
): PageAuditResult {
  const issues: string[] = [];
  let score = 0;
  const maxPoints = 7; // Total scoring criteria
  let earnedPoints = 0;

  const hasPageMeta = meta !== null;
  if (!hasPageMeta) {
    issues.push("No SeoPageMeta record exists for this page");
    return {
      path,
      score: 0,
      hasPageMeta: false,
      hasTitle: false,
      hasDescription: false,
      descriptionLength: null,
      descriptionLengthOk: false,
      hasOgTitle: false,
      hasOgDescription: false,
      hasOgImage: false,
      hasKeywords: false,
      noIndex: false,
      issues,
    };
  }

  // 1. Has title
  const hasTitle = !!meta.title && meta.title.trim().length > 0;
  if (hasTitle) {
    earnedPoints++;
  } else {
    issues.push("Missing page title");
  }

  // 2. Has description
  const hasDescription = !!meta.description && meta.description.trim().length > 0;
  if (hasDescription) {
    earnedPoints++;
  } else {
    issues.push("Missing meta description");
  }

  // 3. Description length 50-160 chars
  const descriptionLength = meta.description ? meta.description.trim().length : null;
  const descriptionLengthOk =
    descriptionLength !== null && descriptionLength >= 50 && descriptionLength <= 160;
  if (descriptionLengthOk) {
    earnedPoints++;
  } else if (hasDescription) {
    if (descriptionLength !== null && descriptionLength < 50) {
      issues.push(`Meta description too short (${descriptionLength} chars, recommended 50-160)`);
    } else if (descriptionLength !== null && descriptionLength > 160) {
      issues.push(`Meta description too long (${descriptionLength} chars, recommended 50-160)`);
    }
  }

  // 4. Has OG tags (title + description + image)
  const hasOgTitle = !!meta.ogTitle && meta.ogTitle.trim().length > 0;
  const hasOgDescription = !!meta.ogDescription && meta.ogDescription.trim().length > 0;
  const hasOgImage = !!meta.ogImage && meta.ogImage.trim().length > 0;

  if (hasOgTitle) {
    earnedPoints += 0.33;
  } else {
    issues.push("Missing Open Graph title");
  }
  if (hasOgDescription) {
    earnedPoints += 0.33;
  } else {
    issues.push("Missing Open Graph description");
  }
  if (hasOgImage) {
    earnedPoints += 0.34;
  } else {
    issues.push("Missing Open Graph image");
  }

  // 5. Has keywords
  const hasKeywords = meta.keywords && meta.keywords.length > 0;
  if (hasKeywords) {
    earnedPoints++;
  } else {
    issues.push("No keywords defined");
  }

  // 6. Not noIndex (unless intentionally set)
  if (!meta.noIndex) {
    earnedPoints++;
  } else {
    issues.push("Page is set to noIndex");
  }

  score = Math.round((earnedPoints / maxPoints) * 100);

  return {
    path,
    score,
    hasPageMeta,
    hasTitle,
    hasDescription,
    descriptionLength,
    descriptionLengthOk,
    hasOgTitle,
    hasOgDescription,
    hasOgImage,
    hasKeywords,
    noIndex: meta.noIndex,
    issues,
  };
}

/**
 * Run a full SEO audit across all static pages.
 */
export async function runSeoAudit(
  runType: string = "manual",
  triggeredBy: string = "admin"
): Promise<{ auditId: string; overallScore: number; results: PageAuditResult[] }> {
  const startTime = Date.now();

  // Create the audit record
  const audit = await db.seoAudit.create({
    data: {
      runType,
      status: "running",
      totalPages: STATIC_PAGES.length,
      triggeredBy,
    },
  });

  try {
    // Fetch all existing page metas in one query
    const existingMetas = await db.seoPageMeta.findMany({
      where: { path: { in: STATIC_PAGES } },
    });

    const metaMap = new Map<string, PageMeta>(
      existingMetas.map((m: PageMeta) => [m.path, m])
    );

    // Score each page
    const results: PageAuditResult[] = STATIC_PAGES.map((path) => {
      const meta: PageMeta | null = metaMap.get(path) ?? null;
      return scorePage(path, meta);
    });

    // Calculate aggregate stats
    const overallScore = Math.round(
      results.reduce((sum, r) => sum + r.score, 0) / results.length
    );

    let criticalIssues = 0;
    let warnings = 0;
    let passed = 0;
    let totalIssues = 0;

    results.forEach((r) => {
      totalIssues += r.issues.length;
      if (r.score < 30) {
        criticalIssues++;
      } else if (r.score < 70) {
        warnings++;
      } else {
        passed++;
      }
    });

    const duration = Date.now() - startTime;

    // Build summary
    const summary = `Audited ${STATIC_PAGES.length} pages. Overall score: ${overallScore}/100. Critical: ${criticalIssues}, Warnings: ${warnings}, Passed: ${passed}. Total issues found: ${totalIssues}.`;

    // Update audit record
    await db.seoAudit.update({
      where: { id: audit.id },
      data: {
        status: "completed",
        pagesAudited: STATIC_PAGES.length,
        overallScore,
        issuesFound: totalIssues,
        criticalIssues,
        warnings,
        passed,
        results: results as unknown as Record<string, unknown>[],
        summary,
        duration,
        completedAt: new Date(),
      },
    });

    // Atomic upsert on the @unique path constraint. findFirst+create
    // was racy under two concurrent audits hitting the same new page —
    // the second create would throw P2002.
    await Promise.all(
      results.map((r) =>
        db.seoPageMeta.upsert({
          where: { path: r.path },
          update: { lastAuditScore: r.score },
          create: {
            path: r.path,
            lastAuditScore: r.score,
          },
        })
      )
    );

    return { auditId: audit.id, overallScore, results };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Mark audit as failed
    await db.seoAudit.update({
      where: { id: audit.id },
      data: {
        status: "failed",
        summary: `Audit failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        duration,
      },
    });

    throw error;
  }
}
