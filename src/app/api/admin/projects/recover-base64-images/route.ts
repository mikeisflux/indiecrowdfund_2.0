import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const recoverLogger = logger.child({ module: "admin-recover-base64-images" });

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — decoding 18 multi-MB base64 blobs takes a moment

const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

/**
 * POST /api/admin/projects/recover-base64-images
 *
 * Finds every Project whose imageUrl field contains a base64 data: URI
 * (corruption from the old ImageUpload fallback), decodes the base64,
 * re-encodes as WebP via sharp, writes it to uploads/projects/<id>/project/<hash>.webp,
 * and updates imageUrl to the proper /api/uploads/... path. Also creates a
 * MediaFile tracking record.
 *
 * Idempotent — running it twice does nothing on already-recovered rows.
 * Super-admin only.
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

    // Find all projects with corrupt imageUrl (base64 data URIs or concatenated junk)
    const corruptProjects = await db.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { imageUrl: { contains: "data:" } },
          { imageUrl: { contains: "base64" } },
          { imageUrl: { startsWith: "/https" } },
        ],
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        creatorId: true,
      },
    });

    if (corruptProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No corrupt imageUrl rows found",
        recovered: 0,
        failed: 0,
        projects: [],
      });
    }

    recoverLogger.info(`[Recover] Found ${corruptProjects.length} projects with corrupt imageUrl`);

    const results: Array<{
      id: string;
      title: string;
      action: "recovered" | "skipped" | "failed";
      reason?: string;
      newUrl?: string;
      sizeBytes?: number;
    }> = [];

    for (const project of corruptProjects) {
      try {
        const raw = project.imageUrl || "";

        // Extract the data URI — it might be preceded by garbage
        // (e.g. "https://indiecrowdfund.com/https:/indiecrowdfund.comdata:image/png;base64,...")
        const dataUriMatch = raw.match(/data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)/);
        if (!dataUriMatch) {
          results.push({
            id: project.id,
            title: project.title,
            action: "skipped",
            reason: "No valid data:image base64 payload found in imageUrl",
          });
          continue;
        }

        const base64Data = dataUriMatch[2];
        const sourceBuffer = Buffer.from(base64Data, "base64");

        if (sourceBuffer.length === 0) {
          results.push({
            id: project.id,
            title: project.title,
            action: "failed",
            reason: "Decoded buffer is empty",
          });
          continue;
        }

        // Re-encode as WebP at quality 85 (matches /api/upload behavior)
        const webpBuffer = await sharp(sourceBuffer)
          .webp({ quality: 85 })
          .toBuffer();

        // Generate a stable filename from the buffer hash so re-running
        // this endpoint doesn't create duplicate files for the same content
        const filename = `${crypto.createHash("sha1").update(webpBuffer).digest("hex").slice(0, 32)}.webp`;

        // Write to uploads/projects/<id>/project/<filename>
        const projectDir = path.join(UPLOADS_BASE, "projects", project.id, "project");
        if (!existsSync(projectDir)) {
          await mkdir(projectDir, { recursive: true });
        }
        const filePath = path.join(projectDir, filename);
        await writeFile(filePath, webpBuffer);

        const newUrl = `/api/uploads/projects/${project.id}/project/${filename}`;

        // Update the Project row
        await db.project.update({
          where: { id: project.id },
          data: { imageUrl: newUrl },
        });

        // Create a MediaFile tracking record so the image shows up in
        // the admin media library and future lookups find it.
        try {
          await db.mediaFile.create({
            data: {
              uploaderId: project.creatorId,
              filename,
              originalName: `${project.title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 40)}-cover.webp`,
              mimeType: "image/webp",
              size: webpBuffer.length,
              url: newUrl,
              thumbnailUrl: newUrl,
              width: null,
              height: null,
              duration: null,
              folder: "projects",
              tags: [`project:${project.id}`, "recovered-from-base64"],
              altText: null,
            },
          });
        } catch (dbErr) {
          // Non-fatal — the file and imageUrl update still succeeded
          recoverLogger.warn(
            { err: String(dbErr), projectId: project.id },
            "MediaFile creation failed for recovered project image"
          );
        }

        results.push({
          id: project.id,
          title: project.title,
          action: "recovered",
          newUrl,
          sizeBytes: webpBuffer.length,
        });

        recoverLogger.info(
          { projectId: project.id, title: project.title, sizeBytes: webpBuffer.length, newUrl },
          "[Recover] Project cover image recovered from base64"
        );
      } catch (err) {
        results.push({
          id: project.id,
          title: project.title,
          action: "failed",
          reason: err instanceof Error ? err.message : String(err),
        });
        recoverLogger.error(
          { err: String(err), projectId: project.id, title: project.title },
          "[Recover] Failed to recover project image"
        );
      }
    }

    const recovered = results.filter((r) => r.action === "recovered").length;
    const failed = results.filter((r) => r.action === "failed").length;
    const skipped = results.filter((r) => r.action === "skipped").length;

    return NextResponse.json({
      success: true,
      message: `Recovered ${recovered} of ${corruptProjects.length} projects (${failed} failed, ${skipped} skipped)`,
      recovered,
      failed,
      skipped,
      total: corruptProjects.length,
      projects: results,
    });
  } catch (error) {
    recoverLogger.error({ err: formatError(error) }, "Error recovering base64 images");
    return NextResponse.json(
      { error: "Failed to recover images", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
