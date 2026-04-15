import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

const generateJpgLogger = logger.child({ module: "admin-generate-jpg-covers" });

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

/**
 * POST /api/admin/projects/generate-jpg-covers
 *
 * Query params:
 *   ?force=true — re-generate even if a .jpg companion already exists.
 *                 Used when the existing companion was produced with a
 *                 sharp config that Facebook's decoder didn't like and
 *                 you need to re-encode with stricter settings.
 *
 * Uses the most conservative JPEG encoding possible to maximize
 * compatibility with Facebook/X/LinkedIn's image decoders:
 *   - Baseline JPEG (not progressive)
 *   - sRGB color space (explicit conversion)
 *   - No ICC profile embedded
 *   - No EXIF/XMP metadata
 *   - Quality 85 (not mozjpeg — some decoders are picky)
 *   - Flatten to white background for transparent WebPs
 */
export async function POST(req: NextRequest) {
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

    const force = req.nextUrl.searchParams.get("force") === "true";

    const projectsBase = path.join(UPLOADS_BASE, "projects");
    if (!existsSync(projectsBase)) {
      return NextResponse.json({
        success: true,
        message: "No uploads/projects directory found",
        generated: 0,
        skipped: 0,
        failed: 0,
      });
    }

    const projectDirs = await readdir(projectsBase);
    const results: Array<{
      projectId: string;
      file: string;
      action: "generated" | "skipped" | "failed";
      reason?: string;
      sizeBytes?: number;
    }> = [];

    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const projectId of projectDirs) {
      const coverDir = path.join(projectsBase, projectId, "project");
      if (!existsSync(coverDir)) continue;

      let dirEntries: string[];
      try {
        dirEntries = await readdir(coverDir);
      } catch {
        continue;
      }

      // Only process .webp files
      const webpFiles = dirEntries.filter((f) => f.toLowerCase().endsWith(".webp"));

      for (const webpFile of webpFiles) {
        const webpPath = path.join(coverDir, webpFile);
        const jpgPath = webpPath.replace(/\.webp$/i, ".jpg");
        const jpgFile = webpFile.replace(/\.webp$/i, ".jpg");

        // Skip if a .jpg companion already exists AND force=false
        if (!force && existsSync(jpgPath)) {
          try {
            const s = await stat(jpgPath);
            if (s.size > 0) {
              skipped++;
              results.push({
                projectId,
                file: jpgFile,
                action: "skipped",
                reason: "JPG companion already exists (use ?force=true to re-encode)",
                sizeBytes: s.size,
              });
              continue;
            }
          } catch {
            // fall through and regenerate
          }
        }

        try {
          const webpBuffer = await readFile(webpPath);
          if (webpBuffer.length === 0) {
            failed++;
            results.push({
              projectId,
              file: webpFile,
              action: "failed",
              reason: "Source WebP is empty",
            });
            continue;
          }

          // Maximum-compatibility JPEG encoding for social media:
          //   - remove ALL metadata (no ICC, no EXIF, no XMP) — sharp
          //     strips by default, as long as we DON'T call .withMetadata()
          //   - explicit sRGB color space
          //   - flatten transparent pixels to white (JPEG has no alpha)
          //   - baseline (not progressive — some decoders choke on progressive)
          //   - standard libjpeg encoder, not mozjpeg
          //   - quality 85
          const jpgBuffer = await sharp(webpBuffer)
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .toColorspace("srgb")
            .jpeg({
              quality: 85,
              progressive: false,
              mozjpeg: false,
              chromaSubsampling: "4:2:0",
            })
            .toBuffer();

          await writeFile(jpgPath, jpgBuffer);
          generated++;
          results.push({
            projectId,
            file: jpgFile,
            action: "generated",
            sizeBytes: jpgBuffer.length,
          });

          generateJpgLogger.info(
            { projectId, file: jpgFile, sizeBytes: jpgBuffer.length, force },
            "[GenerateJPG] Wrote JPG companion for project cover"
          );
        } catch (err) {
          failed++;
          results.push({
            projectId,
            file: webpFile,
            action: "failed",
            reason: err instanceof Error ? err.message : String(err),
          });
          generateJpgLogger.error(
            { err: String(err), projectId, file: webpFile },
            "[GenerateJPG] Failed to convert WebP → JPG"
          );
        }
      }
    }

    const total = generated + skipped + failed;
    return NextResponse.json({
      success: true,
      message: `Processed ${total} cover files: ${generated} generated, ${skipped} skipped, ${failed} failed`,
      generated,
      skipped,
      failed,
      total,
      force,
      results,
    });
  } catch (error) {
    generateJpgLogger.error({ err: String(error) }, "Error generating JPG covers");
    return NextResponse.json(
      { error: "Failed to generate JPG covers", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
