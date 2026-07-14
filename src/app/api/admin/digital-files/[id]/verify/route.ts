import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getR2Storage } from "@/lib/r2";

const log = logger.child({ module: "admin-digital-file-verify" });

export const dynamic = "force-dynamic";

// Auth: an ADMIN/SUPER_ADMIN session, OR a server-to-server call carrying
// the internal secret or the cron secret (so it can be curled locally on
// the box without a browser session). Mirrors the internal cron auth model.
async function authorize(req: NextRequest): Promise<{ ok: true } | { error: string; status: number }> {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers.get("x-internal-secret") === internalSecret) {
    return { ok: true };
  }
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return { ok: true };
  }
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Admin access required", status: 403 };
  }
  return { ok: true };
}

// GET /api/admin/digital-files/[id]/verify
//
// Integrity check for a stored digital file. HEADs the R2 object and
// compares its real byte size to the DigitalFile.fileSize recorded in the
// DB, then reads the first/last bytes to confirm a valid PDF header
// (%PDF-) and trailer (%%EOF). A size mismatch means the upload stored a
// truncated/corrupt object (e.g. a multipart part failed mid-upload) and
// the file must be re-uploaded — every download of it will be corrupt.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authorize(req);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const file = await db.digitalFile.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        r2StorageKey: true,
        fileUrl: true,
        updatedAt: true,
      },
    });
    if (!file) {
      return NextResponse.json({ error: "Digital file not found" }, { status: 404 });
    }

    if (!file.r2StorageKey) {
      return NextResponse.json({
        file: { id: file.id, name: file.name, fileName: file.fileName },
        storage: "legacy-url",
        fileUrl: file.fileUrl || null,
        verdict: "NOT_IN_R2",
        message:
          "This file has no r2StorageKey — it's served from a legacy fileUrl, not R2. Integrity can't be verified here.",
      });
    }

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json({ error: "R2 storage not configured" }, { status: 500 });
    }

    const meta = await r2.getFileMetadata(file.r2StorageKey);
    if (!meta) {
      return NextResponse.json({
        file: { id: file.id, name: file.name, fileName: file.fileName },
        storageKey: file.r2StorageKey,
        verdict: "MISSING_IN_R2",
        message:
          "The object does not exist in R2 (HEAD failed). The upload never completed — re-upload required.",
      });
    }

    const dbSize = file.fileSize;
    const r2Size = meta.size;
    const sizeMatch = dbSize === r2Size;

    // Read header (first 8 bytes) and trailer (last 2KB) to sanity-check
    // that the object is a structurally complete PDF.
    const isPdf = (file.mimeType || "").includes("pdf") ||
      file.fileName.toLowerCase().endsWith(".pdf");
    let pdfHeaderOk: boolean | null = null;
    let pdfTrailerOk: boolean | null = null;
    if (isPdf && r2Size > 16) {
      const head = await r2.getFileRange(file.r2StorageKey, 0, 7);
      pdfHeaderOk = head ? head.toString("latin1").startsWith("%PDF-") : null;
      const tailStart = Math.max(0, r2Size - 2048);
      const tail = await r2.getFileRange(file.r2StorageKey, tailStart, r2Size - 1);
      pdfTrailerOk = tail ? tail.toString("latin1").includes("%%EOF") : null;
    }

    // Overall verdict
    let verdict: "OK" | "TRUNCATED" | "CORRUPT" | "SUSPECT";
    let message: string;
    if (!sizeMatch) {
      verdict = r2Size < dbSize ? "TRUNCATED" : "SUSPECT";
      message =
        r2Size < dbSize
          ? `R2 object is ${dbSize - r2Size} bytes SHORTER than the DB record — the upload stored a truncated object. Every download will be corrupt. Re-upload required.`
          : `R2 object is LARGER than the DB record by ${r2Size - dbSize} bytes — unexpected; inspect before trusting.`;
    } else if (isPdf && (pdfHeaderOk === false || pdfTrailerOk === false)) {
      verdict = "CORRUPT";
      message = `Size matches but PDF structure is broken (header ok: ${pdfHeaderOk}, trailer ok: ${pdfTrailerOk}). Re-upload recommended.`;
    } else {
      verdict = "OK";
      message =
        "Stored object size matches the DB record" +
        (isPdf ? " and the PDF header/trailer are intact." : ".") +
        " If backers still get failed/corrupt downloads, the transfer is dying client-side (large direct download with no resume) rather than the object being bad.";
    }

    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        fileName: file.fileName,
        mimeType: file.mimeType,
        updatedAt: file.updatedAt,
      },
      storageKey: file.r2StorageKey,
      dbFileSize: dbSize,
      r2ObjectSize: r2Size,
      sizeMatch,
      r2ContentType: meta.contentType ?? null,
      r2LastModified: meta.lastModified ?? null,
      pdfHeaderOk,
      pdfTrailerOk,
      verdict,
      message,
    });
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "digital file verify failed");
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
