import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getR2Storage } from "@/lib/r2";

const log = logger.child({ module: "digital-file-replace" });

const escapeMap: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => escapeMap[c] ?? c);

/**
 * Point an existing DigitalFile at a newly uploaded object, drop the old
 * object, and optionally tell every backer who already has the file.
 *
 * Shared by the multipart `complete` step (replacement uploads) and the
 * legacy PATCH confirm_replace action. Reading progress and distributions
 * are keyed on the DigitalFile id, so swapping the storage key preserves
 * them.
 */
export async function applyFileReplacement(params: {
  fileId: string;
  newStorageKey: string;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  notifyBackers: boolean;
}): Promise<{ affectedCount: number; notifiedCount: number }> {
  const file = await db.digitalFile.findUnique({
    where: { id: params.fileId },
    select: { id: true, name: true, fileName: true, fileSize: true, mimeType: true, r2StorageKey: true },
  });
  if (!file) throw new Error("File to replace no longer exists");

  const r2 = await getR2Storage();
  const oldStorageKey = file.r2StorageKey;

  await db.digitalFile.update({
    where: { id: file.id },
    data: {
      r2StorageKey: params.newStorageKey,
      fileName: params.fileName || file.fileName,
      fileSize: params.fileSize || file.fileSize,
      mimeType: params.mimeType || file.mimeType,
      uploadStatus: "READY",
      uploadedAt: new Date(),
      // New file may have different pages; re-extract the cover.
      coverImageUrl: null,
      coverExtractedAt: null,
      coverExtractionFailed: false,
      updatedAt: new Date(),
    },
  });

  if (oldStorageKey && oldStorageKey !== params.newStorageKey && r2) {
    await r2.deleteFile(oldStorageKey).catch((err: unknown) =>
      log.warn({ err: String(err), oldStorageKey }, "Failed to delete old R2 file after replacement")
    );
  }

  let notifiedCount = 0;
  if (params.notifyBackers) {
    const distributions = await db.digitalDistribution.findMany({
      where: { digitalFileId: file.id, distributedAt: { not: null } },
      select: { pledgeId: true },
    });
    const pledgeIds = distributions.map((d: { pledgeId: string }) => d.pledgeId);
    const pledges =
      pledgeIds.length > 0
        ? await db.pledge.findMany({
            where: { id: { in: pledgeIds } },
            select: { user: { select: { email: true, name: true, deletedAt: true } } },
          })
        : [];
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
    const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
    const safeFileName = esc(file.name);
    const downloadsUrl = `${APP_URL}/dashboard/backer?tab=downloads`;
    const results = await Promise.allSettled(
      (pledges as { user: { email: string | null; name: string | null; deletedAt: Date | null } | null }[])
        .filter((p) => p.user && !p.user.deletedAt && p.user.email)
        .map((p) => {
          const user = p.user!;
          const safeName = esc(user.name || "Backer");
          return sendEmail({
            to: user.email!,
            subject: `Updated file available: ${file.name}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#333;">Updated File Available</h2>
                <p>Hi ${safeName},</p>
                <p>The creator has uploaded a corrected version of <strong>${safeFileName}</strong>.</p>
                <p>The updated file is now available in your digital downloads. Your reading progress has been preserved.</p>
                <p style="margin:24px 0;">
                  <a href="${downloadsUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    View Downloads
                  </a>
                </p>
                <p style="color:#666;font-size:12px;">— The ${APP_NAME} Team</p>
              </div>
            `,
            text: `Hi ${user.name || "Backer"},\n\nThe creator has uploaded a corrected version of "${file.name}".\n\nThe updated file is now available in your digital downloads at: ${downloadsUrl}\n\n— The ${APP_NAME} Team`,
          });
        })
    );
    notifiedCount = results.filter((r) => r.status === "fulfilled").length;
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        log.warn({ err: String(r.reason), index: i }, "Failed to send replacement notification email");
      }
    });
  }

  const affectedCount = await db.digitalDistribution.count({
    where: { digitalFileId: file.id, distributedAt: { not: null } },
  });
  log.info({ fileId: file.id, affectedCount, notifiedCount }, "Digital file replaced");
  return { affectedCount, notifiedCount };
}
