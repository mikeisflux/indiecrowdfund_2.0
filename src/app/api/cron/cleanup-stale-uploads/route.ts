import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { getR2Storage } from "@/lib/r2";

const log = logger.child({ module: "cron-cleanup-stale-uploads" });

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Digital-file multipart uploads that were started and never completed.
// They can be resumed for a day (the creator re-selects the same file);
// after that the R2 parts are freed and the row is marked FAILED so the
// creator sees it and deletes it. R2 bills for abandoned parts.
//
//   30 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://indiecrowdfund.com/api/cron/cleanup-stale-uploads
const STALE_AFTER_HOURS = 24;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);
    const stale = await db.digitalFile.findMany({
      where: { uploadStatus: "UPLOADING", updatedAt: { lt: cutoff } },
      select: { id: true, name: true, projectId: true, r2StorageKey: true, multipartUploadId: true },
      take: 200,
    });

    const r2 = await getR2Storage();
    let aborted = 0;
    for (const file of stale as {
      id: string;
      name: string;
      projectId: string;
      r2StorageKey: string | null;
      multipartUploadId: string | null;
    }[]) {
      if (r2 && file.r2StorageKey && file.multipartUploadId) {
        await r2.abortMultipartUpload(file.r2StorageKey, file.multipartUploadId);
      }
      await db.digitalFile.update({
        where: { id: file.id },
        data: { uploadStatus: "FAILED", multipartUploadId: null, uploadedParts: null },
      });
      aborted++;
      log.info({ fileId: file.id, projectId: file.projectId, name: file.name }, "Stale upload marked FAILED");
    }

    return NextResponse.json({ success: true, checked: stale.length, aborted });
  } catch (error) {
    log.error({ err: formatError(error) }, "cleanup-stale-uploads failed");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
