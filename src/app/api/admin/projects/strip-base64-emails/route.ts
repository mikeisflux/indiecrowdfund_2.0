import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripBase64FromHtml } from "@/lib/email/strip-base64-html";

const stripLogger = logger.child({ module: "admin-strip-base64-emails" });

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 minutes

// Process this many rows per Prisma findMany call. Smaller = less chance
// of hitting Node's N-API string-size limit when rows contain multi-MB
// base64 bodies. Larger = fewer round trips. 25 is safe for rows up to
// ~12 MB each (≤ 300 MB per batch payload).
const BATCH_SIZE = 25;

/**
 * POST /api/admin/projects/strip-base64-emails
 *
 * Bulk cleanup: finds every row in AdminEmail, EmailLog, EmailQueue, and
 * EmailCampaign that has a base64 data: URI embedded in its HTML body,
 * extracts each embedded image to disk under /uploads/email-extracted/,
 * and rewrites the row's HTML to point at the extracted file URL.
 *
 * Processes each table in batches of BATCH_SIZE rows at a time using the
 * WHERE filter itself as the termination condition — each processed row
 * no longer matches `contains: "data:image/"`, so `findMany` naturally
 * yields fewer and fewer rows until zero.
 *
 * Idempotent. Super-admin only.
 *
 * After this endpoint completes, you MUST run VACUUM FULL on the affected
 * tables from psql to actually reclaim disk space.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    type TableStats = {
      table: string;
      scanned: number;
      updated: number;
      failed: number;
      bytesRemoved: number;
      bytesWritten: number;
      extractedImages: number;
    };
    const summary: TableStats[] = [];

    // Generic batched processor: reads + writes chunked through Prisma
    async function processTable<TRow extends { id: string }>(
      tableName: string,
      selectHtml: (id: string) => Promise<{ id: string; html: string | null }[]>,
      updateRow: (id: string, newHtml: string) => Promise<void>
    ): Promise<TableStats> {
      const stats: TableStats = {
        table: tableName,
        scanned: 0,
        updated: 0,
        failed: 0,
        bytesRemoved: 0,
        bytesWritten: 0,
        extractedImages: 0,
      };

      let batchNum = 0;
      // Cap the total number of iterations defensively — if somehow the
      // filter never shrinks (e.g. our regex didn't match the actual data
      // URI format in a row), break out instead of spinning forever.
      const MAX_BATCHES = 10000;

      while (batchNum < MAX_BATCHES) {
        batchNum++;
        let rows: { id: string; html: string | null }[];
        try {
          rows = await selectHtml("");
        } catch (err) {
          stripLogger.error(
            { err: String(err), table: tableName, batchNum },
            `[Strip] ${tableName} findMany batch failed`
          );
          break; // can't read more from this table, move on
        }

        if (rows.length === 0) break;
        stats.scanned += rows.length;

        let updatedInBatch = 0;
        for (const row of rows) {
          if (!row.html || !row.html.includes("data:image/")) continue;
          try {
            const result = await stripBase64FromHtml(row.html);
            if (result.extracted === 0) {
              // Row matched the filter but our regex didn't extract anything
              // (malformed data URI?). Mark it to prevent infinite looping:
              // replace the literal "data:image/" substring with a sanitized
              // marker so it no longer matches the WHERE clause.
              const sanitized = row.html.replace(
                /data:image\//gi,
                "data-image-legacy/"
              );
              await updateRow(row.id, sanitized);
              updatedInBatch++;
              continue;
            }
            await updateRow(row.id, result.html);
            stats.updated++;
            updatedInBatch++;
            stats.bytesRemoved += result.bytesRemoved;
            stats.bytesWritten += result.bytesWritten;
            stats.extractedImages += result.extracted;
          } catch (err) {
            stats.failed++;
            stripLogger.error(
              { err: String(err), id: row.id, table: tableName },
              `[Strip] ${tableName} row update failed`
            );
          }
        }

        // Safety: if we read rows but didn't change any of them, break to
        // avoid an infinite loop (shouldn't happen with the sanitization
        // fallback above, but be defensive).
        if (updatedInBatch === 0) break;
      }

      stripLogger.info(
        { ...stats, batches: batchNum },
        `[Strip] ${tableName} cleanup done`
      );
      return stats;
    }

    // -------- AdminEmail (bodyHtml) --------
    summary.push(
      await processTable(
        "AdminEmail",
        async () =>
          (await db.adminEmail.findMany({
            where: { bodyHtml: { contains: "data:image/" } },
            select: { id: true, bodyHtml: true },
            take: BATCH_SIZE,
          })).map((r) => ({ id: r.id, html: r.bodyHtml })),
        async (id, newHtml) => {
          await db.adminEmail.update({
            where: { id },
            data: { bodyHtml: newHtml },
          });
        }
      )
    );

    // -------- EmailLog (htmlContent) --------
    summary.push(
      await processTable(
        "EmailLog",
        async () =>
          (await db.emailLog.findMany({
            where: { htmlContent: { contains: "data:image/" } },
            select: { id: true, htmlContent: true },
            take: BATCH_SIZE,
          })).map((r) => ({ id: r.id, html: r.htmlContent })),
        async (id, newHtml) => {
          await db.emailLog.update({
            where: { id },
            data: { htmlContent: newHtml },
          });
        }
      )
    );

    // -------- EmailQueue (bodyHtml) --------
    summary.push(
      await processTable(
        "EmailQueue",
        async () =>
          (await db.emailQueue.findMany({
            where: { bodyHtml: { contains: "data:image/" } },
            select: { id: true, bodyHtml: true },
            take: BATCH_SIZE,
          })).map((r) => ({ id: r.id, html: r.bodyHtml })),
        async (id, newHtml) => {
          await db.emailQueue.update({
            where: { id },
            data: { bodyHtml: newHtml },
          });
        }
      )
    );

    // -------- EmailCampaign (htmlContent) --------
    summary.push(
      await processTable(
        "EmailCampaign",
        async () =>
          (await db.emailCampaign.findMany({
            where: { htmlContent: { contains: "data:image/" } },
            select: { id: true, htmlContent: true },
            take: BATCH_SIZE,
          })).map((r) => ({ id: r.id, html: r.htmlContent })),
        async (id, newHtml) => {
          await db.emailCampaign.update({
            where: { id },
            data: { htmlContent: newHtml },
          });
        }
      )
    );

    const totalScanned = summary.reduce((s, r) => s + r.scanned, 0);
    const totalUpdated = summary.reduce((s, r) => s + r.updated, 0);
    const totalFailed = summary.reduce((s, r) => s + r.failed, 0);
    const totalBytesRemoved = summary.reduce((s, r) => s + r.bytesRemoved, 0);
    const totalBytesWritten = summary.reduce((s, r) => s + r.bytesWritten, 0);
    const totalImages = summary.reduce((s, r) => s + r.extractedImages, 0);

    stripLogger.info(
      {
        totalScanned,
        totalUpdated,
        totalFailed,
        totalImages,
        bytesRemovedMB: (totalBytesRemoved / 1024 / 1024).toFixed(1),
        bytesWrittenMB: (totalBytesWritten / 1024 / 1024).toFixed(1),
      },
      "[Strip] Email base64 cleanup complete"
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${totalScanned} rows across 4 tables. Updated ${totalUpdated}, extracted ${totalImages} images. Run VACUUM FULL to reclaim disk.`,
      totalScanned,
      totalUpdated,
      totalFailed,
      totalImages,
      bytesRemovedMB: Math.round(totalBytesRemoved / 1024 / 1024),
      bytesWrittenMB: Math.round(totalBytesWritten / 1024 / 1024),
      estimatedReclaimedMB: Math.round(
        (totalBytesRemoved - totalBytesWritten) / 1024 / 1024
      ),
      perTable: summary,
    });
  } catch (error) {
    stripLogger.error(
      { err: String(error) },
      "Error stripping base64 from emails"
    );
    return NextResponse.json(
      {
        error: "Failed to strip base64 from emails",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
