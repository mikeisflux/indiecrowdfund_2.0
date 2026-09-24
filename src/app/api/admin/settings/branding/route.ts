import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { invalidateBranding } from "@/lib/branding";

const brandingLogger = logger.child({ module: "admin-settings-branding" });

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Site logo / favicon upload. The Logo & Branding card rendered upload
 * buttons for months with no handler behind them — this is the handler.
 *
 * POST multipart: { file, kind: "logo" | "favicon" }. Stores the file
 * under uploads/branding/images/ (served by /api/uploads/[...path]),
 * writes the URL straight onto PlatformSettings, and returns it — no
 * separate Save step, so the upload can't be half-done.
 *
 * DELETE ?kind=logo|favicon clears the stored URL (reverting the site
 * to its built-in branding). The file itself is left on disk — it may
 * still be referenced by cached pages, and orphans are harmless.
 */

const KIND_CONFIG = {
  logo: {
    column: "logoUrl" as const,
    // Raster images only — SVG can script and is blocked platform-wide.
    types: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 2 * 1024 * 1024,
  },
  favicon: {
    column: "faviconUrl" as const,
    types: ["image/png", "image/x-icon", "image/vnd.microsoft.icon"],
    maxBytes: 512 * 1024,
  },
};

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind") as string | null;

    if (!file || (kind !== "logo" && kind !== "favicon")) {
      return NextResponse.json(
        { error: "A file and a kind of 'logo' or 'favicon' are required" },
        { status: 400 }
      );
    }

    const config = KIND_CONFIG[kind];
    // Browsers sometimes report no MIME type for .ico files — go by the
    // extension in that case rather than rejecting a valid favicon.
    const effectiveType =
      !file.type && kind === "favicon" && file.name.toLowerCase().endsWith(".ico")
        ? "image/x-icon"
        : file.type;
    if (!config.types.includes(effectiveType)) {
      return NextResponse.json(
        {
          error:
            kind === "logo"
              ? "Logo must be a PNG, JPEG, or WebP image"
              : "Favicon must be a PNG or ICO file",
        },
        { status: 400 }
      );
    }
    if (file.size > config.maxBytes) {
      return NextResponse.json(
        { error: `File exceeds the ${Math.round(config.maxBytes / 1024)}KB limit for a ${kind}` },
        { status: 400 }
      );
    }

    // Same base the serving route uses — honoring UPLOADS_DIR keeps
    // uploads readable when production points it elsewhere.
    const dir = path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"), "branding", "images");
    await mkdir(dir, { recursive: true });
    const filename = `${kind}-${crypto.randomUUID()}${EXT_BY_TYPE[effectiveType] || ""}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

    const url = `/api/uploads/branding/images/${filename}`;

    await db.platformSettings.upsert({
      where: { id: "default" },
      create: { id: "default", [config.column]: url },
      update: { [config.column]: url },
    });
    invalidateBranding();

    brandingLogger.info({ kind, url }, "Branding asset updated");
    return NextResponse.json({ success: true, url });
  } catch (error) {
    brandingLogger.error({ err: formatError(error) }, "Branding upload failed");
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const kind = req.nextUrl.searchParams.get("kind");
    if (kind !== "logo" && kind !== "favicon") {
      return NextResponse.json({ error: "kind must be 'logo' or 'favicon'" }, { status: 400 });
    }

    await db.platformSettings.updateMany({
      where: { id: "default" },
      data: { [KIND_CONFIG[kind].column]: null },
    });
    invalidateBranding();

    return NextResponse.json({ success: true });
  } catch (error) {
    brandingLogger.error({ err: formatError(error) }, "Branding clear failed");
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}
