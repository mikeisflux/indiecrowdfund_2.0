import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripBase64FromHtml } from "@/lib/email/strip-base64-html";

const stripLogger = logger.child({ module: "admin-strip-base64-emails" });

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 minutes — processing large email tables

/**
 * POST /api/admin/projects/strip-base64-emails
 *
 * Bulk cleanup: finds every row in AdminEmail, EmailLog, EmailQueue, and
 * EmailCampaign that has a base64 data: URI embedded in its HTML body,
 * extracts each embedded image to disk under /uploads/email-extracted/,
 * and rewrites the row's HTML to point at the extracted file URL instead.
 *
 * Built after discovering on 2026-04-15 that the DB was 2.1 GB — 1.8 GB of
 * which was email bodies bloated by up to 12 MB per message because of the
 * corrupted base64 project.imageUrl values we fixed earlier that day.
 *
 * Idempotent — re-running just processes any new rows that drifted in.
 * Super-admin only.
 *
 * After this endpoint completes, you MUST run VACUUM FULL on the affected
 * tables from psql to actually reclaim disk space. PostgreSQL doesn't
 * return disk space from UPDATE operations until VACUUM FULL.
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

    const summary: {
      table: string;
      scanned: number;
      updated: number;
      failed: number;
      bytesRemoved: number;
      bytesWritten: number;
      extractedImages: number;
    }[] = [];

    // Helper to process one row — runs stripBase64FromHtml and updates if
    // anything was extracted
    async function processBody(
      html: string | null,
      updateFn: (newHtml: string) => Promise<void>
    ): Promise<{ changed: boolean; bytesRemoved: number; bytesWritten: number; extracted: number }> {
      if (!html || !html.includes("data:image/")) {
        return { changed: false, bytesRemoved: 0, bytesWritten: 0, extracted: 0 };
      }
      const result = await stripBase64FromHtml(html);
      if (result.extracted === 0) {
        return { changed: false, bytesRemoved: 0, bytesWritten: 0, extracted: 0 };
      }
      await updateFn(result.html);
      return {
        changed: true,
        bytesRemoved: result.bytesRemoved,
        bytesWritten: result.bytesWritten,
        extracted: result.extracted,
      };
    }

    // -------- AdminEmail (bodyHtml) --------
    {
      const rows = await db.adminEmail.findMany({
        where: { bodyHtml: { contains: "data:image/" } },
        select: { id: true, bodyHtml: true },
      });
      let updated = 0, failed = 0, bytesRemoved = 0, bytesWritten = 0, extractedImages = 0;
      for (const row of rows) {
        try {
          const r = await processBody(row.bodyHtml, async (newHtml) => {
            await db.adminEmail.update({ where: { id: row.id }, data: { bodyHtml: newHtml } });
          });
          if (r.changed) {
            updated++;
            bytesRemoved += r.bytesRemoved;
            bytesWritten += r.bytesWritten;
            extractedImages += r.extracted;
          }
        } catch (err) {
          failed++;
          stripLogger.error({ err: String(err), id: row.id }, "[Strip] AdminEmail update failed");
        }
      }
      summary.push({ table: "AdminEmail", scanned: rows.length, updated, failed, bytesRemoved, bytesWritten, extractedImages });
    }

    // -------- EmailLog (htmlContent) --------
    {
      const rows = await db.emailLog.findMany({
        where: { htmlContent: { contains: "data:image/" } },
        select: { id: true, htmlContent: true },
      });
      let updated = 0, failed = 0, bytesRemoved = 0, bytesWritten = 0, extractedImages = 0;
      for (const row of rows) {
        try {
          const r = await processBody(row.htmlContent, async (newHtml) => {
            await db.emailLog.update({ where: { id: row.id }, data: { htmlContent: newHtml } });
          });
          if (r.changed) {
            updated++;
            bytesRemoved += r.bytesRemoved;
            bytesWritten += r.bytesWritten;
            extractedImages += r.extracted;
          }
        } catch (err) {
          failed++;
          stripLogger.error({ err: String(err), id: row.id }, "[Strip] EmailLog update failed");
        }
      }
      summary.push({ table: "EmailLog", scanned: rows.length, updated, failed, bytesRemoved, bytesWritten, extractedImages });
    }

    // -------- EmailQueue (bodyHtml) --------
    {
      const rows = await db.emailQueue.findMany({
        where: { bodyHtml: { contains: "data:image/" } },
        select: { id: true, bodyHtml: true },
      });
      let updated = 0, failed = 0, bytesRemoved = 0, bytesWritten = 0, extractedImages = 0;
      for (const row of rows) {
        try {
          const r = await processBody(row.bodyHtml, async (newHtml) => {
            await db.emailQueue.update({ where: { id: row.id }, data: { bodyHtml: newHtml } });
          });
          if (r.changed) {
            updated++;
            bytesRemoved += r.bytesRemoved;
            bytesWritten += r.bytesWritten;
            extractedImages += r.extracted;
          }
        } catch (err) {
          failed++;
          stripLogger.error({ err: String(err), id: row.id }, "[Strip] EmailQueue update failed");
        }
      }
      summary.push({ table: "EmailQueue", scanned: rows.length, updated, failed, bytesRemoved, bytesWritten, extractedImages });
    }

    // -------- EmailCampaign (htmlContent) --------
    {
      const rows = await db.emailCampaign.findMany({
        where: { htmlContent: { contains: "data:image/" } },
        select: { id: true, htmlContent: true },
      });
      let updated = 0, failed = 0, bytesRemoved = 0, bytesWritten = 0, extractedImages = 0;
      for (const row of rows) {
        try {
          const r = await processBody(row.htmlContent, async (newHtml) => {
            await db.emailCampaign.update({ where: { id: row.id }, data: { htmlContent: newHtml } });
          });
          if (r.changed) {
            updated++;
            bytesRemoved += r.bytesRemoved;
            bytesWritten += r.bytesWritten;
            extractedImages += r.extracted;
          }
        } catch (err) {
          failed++;
          stripLogger.error({ err: String(err), id: row.id }, "[Strip] EmailCampaign update failed");
        }
      }
      summary.push({ table: "EmailCampaign", scanned: rows.length, updated, failed, bytesRemoved, bytesWritten, extractedImages });
    }

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
      estimatedReclaimedMB: Math.round((totalBytesRemoved - totalBytesWritten) / 1024 / 1024),
      perTable: summary,
    });
  } catch (error) {
    stripLogger.error({ err: String(error) }, "Error stripping base64 from emails");
    return NextResponse.json(
      { error: "Failed to strip base64 from emails", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
