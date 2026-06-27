import { db } from "@/lib/db";
import { SEO_PAGE_DEFAULTS } from "@/lib/seo-defaults";
import { STATIC_PAGES } from "@/lib/seo-audit";

// Shared SEO auto-fix engine.
//
// Used by BOTH the admin "Fix All" button (/api/admin/seo/fix-all) and the
// daily SEO cron (/api/admin/seo/cron) so the two can never drift.
//
// The old behavior only filled EMPTY fields from the curated defaults, so a
// description that already existed but failed the audit's 50–160 length rule
// (e.g. a 170-char homepage description) was skipped forever — "Fix All" did
// nothing for it. This engine also REPAIRS out-of-range descriptions by
// replacing them with the curated (in-range) default, which is what actually
// clears the "Meta description too long/short" issues.

export interface SeoFixResult {
  path: string;
  action: "created" | "updated" | "skipped";
  fieldsFixed: string[];
}

export interface SeoFixSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  totalFieldsFixed: number;
}

export interface SeoFixOptions {
  /** Restrict to these paths. Defaults to all STATIC_PAGES. */
  paths?: string[];
  /** Fill empty fields AND repair out-of-range descriptions. Default true. */
  fixMissing?: boolean;
  /** Overwrite every field with its default, even if already set. Default false. */
  overwriteExisting?: boolean;
}

// The meta-description window the audit enforces (see seo-audit.ts).
const DESC_MIN = 50;
const DESC_MAX = 160;

/** Trim a description to <= max chars at a word boundary (never mid-word). */
function clampDescription(text: string, max = DESC_MAX): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice)
    .replace(/[\s,;:.!-]+$/, "")
    .trim();
}

type ExistingMeta = {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  keywords: string[];
};

function isEmptyValue(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  );
}

export async function fixSeoPages(
  options: SeoFixOptions = {}
): Promise<{ results: SeoFixResult[]; summary: SeoFixSummary }> {
  const { paths, fixMissing = true, overwriteExisting = false } = options;
  const targetPaths = paths && paths.length > 0 ? paths : STATIC_PAGES;
  const results: SeoFixResult[] = [];
  let totalFieldsFixed = 0;

  const existingMetas = await db.seoPageMeta.findMany({
    where: { path: { in: targetPaths } },
  });
  const metaMap = new Map<string, ExistingMeta>(
    existingMetas.map((m: ExistingMeta): [string, ExistingMeta] => [m.path, m])
  );

  for (const path of targetPaths) {
    const defaults = SEO_PAGE_DEFAULTS[path];
    if (!defaults) {
      results.push({ path, action: "skipped", fieldsFixed: [] });
      continue;
    }

    const existing = metaMap.get(path);
    const fieldsFixed: string[] = [];
    const data: Record<string, unknown> = {};

    // --- Description: fix when empty OR out-of-range (the audit rule) ---
    const currentDesc = existing?.description ?? null;
    const descLen = currentDesc ? currentDesc.trim().length : 0;
    const descEmpty = isEmptyValue(currentDesc);
    const descOutOfRange = !descEmpty && (descLen < DESC_MIN || descLen > DESC_MAX);
    if ((fixMissing && (descEmpty || descOutOfRange)) || overwriteExisting) {
      data.description = clampDescription(defaults.description);
      fieldsFixed.push("description");
    }

    // --- Other fields: fill when empty (or overwrite) from defaults ---
    const simpleFields: Array<{ key: keyof ExistingMeta; defaultValue: string | string[] }> = [
      { key: "title", defaultValue: defaults.title },
      { key: "ogTitle", defaultValue: defaults.ogTitle },
      { key: "ogDescription", defaultValue: defaults.ogDescription },
      { key: "ogImage", defaultValue: defaults.ogImage },
      { key: "keywords", defaultValue: defaults.keywords },
    ];
    for (const field of simpleFields) {
      const currentValue = existing ? existing[field.key] : null;
      if ((fixMissing && isEmptyValue(currentValue)) || overwriteExisting) {
        data[field.key] = field.defaultValue;
        fieldsFixed.push(field.key as string);
      }
    }

    // Mirror OG title/description into the Twitter fields when blank.
    if (data.ogTitle && (!existing || !existing.ogTitle)) {
      data.twitterTitle = data.ogTitle;
    }
    if (data.ogDescription && (!existing || !existing.ogDescription)) {
      data.twitterDesc = data.ogDescription;
    }

    if (fieldsFixed.length === 0) {
      results.push({ path, action: "skipped", fieldsFixed: [] });
      continue;
    }

    if (existing) {
      await db.seoPageMeta.update({ where: { id: existing.id }, data });
      results.push({ path, action: "updated", fieldsFixed });
    } else {
      // Catch P2002 — a concurrent fix may have created this row between
      // our findMany and now.
      try {
        await db.seoPageMeta.create({ data: { path, ...data } });
        results.push({ path, action: "created", fieldsFixed });
      } catch (createErr) {
        const isUniqueViolation =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr &&
          (createErr as { code?: string }).code === "P2002";
        if (isUniqueViolation) {
          const concurrentMeta = await db.seoPageMeta.findFirst({ where: { path } });
          if (concurrentMeta) {
            await db.seoPageMeta.update({ where: { id: concurrentMeta.id }, data });
          }
          results.push({ path, action: "updated", fieldsFixed });
        } else {
          throw createErr;
        }
      }
    }

    totalFieldsFixed += fieldsFixed.length;
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const skipped = results.filter((r) => r.action === "skipped").length;

  return {
    results,
    summary: { total: targetPaths.length, created, updated, skipped, totalFieldsFixed },
  };
}
