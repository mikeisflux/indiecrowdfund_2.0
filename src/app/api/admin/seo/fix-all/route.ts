import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminSeoFixAllLogger = logger.child({ module: "admin-seo-fix-all" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SEO_PAGE_DEFAULTS } from "@/lib/seo-defaults";
import { STATIC_PAGES } from "@/lib/seo-audit";

export const dynamic = "force-dynamic";

interface FixResult {
  path: string;
  action: "created" | "updated" | "skipped";
  fieldsFixed: string[];
}

// POST - Bulk auto-fix SEO issues for all pages (or specific pages/fields)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      paths,
      fixMissing = true,
      overwriteExisting = false,
    } = body as {
      paths?: string[];       // If provided, only fix these paths. Otherwise fix all.
      fixMissing?: boolean;   // Fill in missing/empty fields (default: true)
      overwriteExisting?: boolean; // Overwrite fields that already have values (default: false)
    };

    const targetPaths = paths && paths.length > 0 ? paths : STATIC_PAGES;
    const results: FixResult[] = [];
    let totalFieldsFixed = 0;

    // Fetch all existing metas in one query
    const existingMetas = await db.seoPageMeta.findMany({
      where: { path: { in: targetPaths } },
    });
    const metaMap = new Map(
      existingMetas.map((m: { path: string }) => [m.path, m])
    );

    for (const path of targetPaths) {
      const defaults = SEO_PAGE_DEFAULTS[path];
      if (!defaults) {
        results.push({ path, action: "skipped", fieldsFixed: [] });
        continue;
      }

      const existing = metaMap.get(path) as {
        id: string;
        title: string | null;
        description: string | null;
        ogTitle: string | null;
        ogDescription: string | null;
        ogImage: string | null;
        keywords: string[];
      } | undefined;

      const fieldsFixed: string[] = [];

      // Determine what data to set
      const data: Record<string, unknown> = {};

      const fields: Array<{ key: string; defaultValue: string | string[] }> = [
        { key: "title", defaultValue: defaults.title },
        { key: "description", defaultValue: defaults.description },
        { key: "ogTitle", defaultValue: defaults.ogTitle },
        { key: "ogDescription", defaultValue: defaults.ogDescription },
        { key: "ogImage", defaultValue: defaults.ogImage },
        { key: "keywords", defaultValue: defaults.keywords },
      ];

      for (const field of fields) {
        const currentValue = existing
          ? (existing as Record<string, unknown>)[field.key]
          : null;

        const isEmpty =
          currentValue === null ||
          currentValue === undefined ||
          currentValue === "" ||
          (Array.isArray(currentValue) && currentValue.length === 0);

        if ((fixMissing && isEmpty) || overwriteExisting) {
          data[field.key] = field.defaultValue;
          fieldsFixed.push(field.key);
        }
      }

      // Also set OG title/description as twitter title/desc if missing
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
        await db.seoPageMeta.update({
          where: { id: existing.id },
          data,
        });
        results.push({ path, action: "updated", fieldsFixed });
      } else {
        // Catch P2002 unique violation on path — another concurrent fix-all
        // request may have created this record between our findMany and now.
        try {
          await db.seoPageMeta.create({
            data: {
              path,
              ...data,
            },
          });
          results.push({ path, action: "created", fieldsFixed });
        } catch (createErr) {
          const isUniqueViolation =
            createErr &&
            typeof createErr === "object" &&
            "code" in createErr &&
            (createErr as { code?: string }).code === "P2002";
          if (isUniqueViolation) {
            // Row was created concurrently — update it instead.
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

    return NextResponse.json({
      data: {
        results,
        summary: {
          total: targetPaths.length,
          created,
          updated,
          skipped,
          totalFieldsFixed,
        },
      },
    });
  } catch (error) {
    adminSeoFixAllLogger.error({ err: formatError(error) }, "Error in bulk SEO fix:");
    return NextResponse.json(
      { error: "Failed to apply SEO fixes" },
      { status: 500 }
    );
  }
}
