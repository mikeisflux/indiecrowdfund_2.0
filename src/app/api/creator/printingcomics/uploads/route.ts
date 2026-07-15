import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { uploadPrintFileFromR2, uploadPrintFileDirect } from "@/lib/printingcomics/upload";
import { pcFetch, PrintingComicsApiError } from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-uploads" });

// GET — list uploads on this key (provider returns newest first).
//   ?limit=… ?purpose=cover  (forwarded)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await loadPrintingComicsConfig();
  if (!config) {
    return NextResponse.json({ error: "Printing Comics not configured" }, { status: 502 });
  }
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  for (const k of ["limit", "purpose"]) {
    const v = searchParams.get(k);
    if (v) params.set(k, v);
  }
  const path = "/uploads" + (params.toString() ? "?" + params : "");
  try {
    const data = await pcFetch(config, { method: "GET", path });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof PrintingComicsApiError) {
      return NextResponse.json({ error: err.bodyText }, { status: err.status });
    }
    log.error({ err: String(err) }, "list uploads failed");
    return NextResponse.json({ error: "Failed to list uploads" }, { status: 500 });
  }
}

// Printing Comics caps uploads at 2 GB; mirror that here so we fail
// fast instead of buffering a giant body before the provider rejects it.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const maxDuration = 300; // allow large print PDFs to stream through

// POST — get a creator PDF onto Printing Comics so it can be referenced
// from order line items. Two shapes:
//
//   1. multipart/form-data  { file, purpose, notes? }  (preferred)
//      The browser streams the PDF straight through us to Printing
//      Comics. Nothing is stored on our servers — the file lives only
//      on the printer's side.
//
//   2. application/json  { r2Key, purpose, notes?, filename? }  (legacy)
//      Push a PDF that already lives in the creator's R2 namespace.
//
// Returns the upload metadata + idempotent flag (true if dedupe by hash).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const config = await loadPrintingComicsConfig();
  if (!config) {
    return NextResponse.json({ error: "Printing Comics not configured" }, { status: 502 });
  }

  // ---- Direct pass-through: browser -> us -> Printing Comics ----
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const file = form.get("file");
    const purpose = form.get("purpose");
    const notes = form.get("notes");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (typeof purpose !== "string" || !purpose) {
      return NextResponse.json({ error: "purpose is required (e.g. cover, interior)" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB; Printing Comics cap is 2 GB` },
        { status: 413 }
      );
    }
    if (
      file.type &&
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadPrintFileDirect(config, {
        buffer,
        filename: file.name || "file.pdf",
        purpose,
        notes: typeof notes === "string" ? notes : undefined,
      });
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof PrintingComicsApiError) {
        return NextResponse.json(
          { error: err.bodyText, status: err.status },
          { status: err.status === 401 || err.status === 403 ? err.status : 502 }
        );
      }
      log.error({ err: String(err) }, "direct upload failed");
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        { status: 500 }
      );
    }
  }

  // ---- Legacy: push a PDF already staged in the creator's R2 namespace ----
  let body: { r2Key?: string; purpose?: string; notes?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.r2Key || typeof body.r2Key !== "string") {
    return NextResponse.json({ error: "r2Key is required" }, { status: 400 });
  }
  if (!body.purpose || typeof body.purpose !== "string") {
    return NextResponse.json({ error: "purpose is required (e.g. cover, interior)" }, { status: 400 });
  }
  // Defense-in-depth: a creator should only be uploading PDFs that
  // belong to their own R2 namespace. Our existing marketplace
  // upload flow keys files under marketplace/<userId>/... — enforce
  // the same prefix here so a creator can't reference another
  // creator's PDFs by guessing the path.
  const allowedPrefix = `marketplace/${session.user.id}/`;
  if (!body.r2Key.startsWith(allowedPrefix)) {
    return NextResponse.json(
      { error: "Access denied — r2Key must belong to your own files" },
      { status: 403 }
    );
  }

  try {
    const result = await uploadPrintFileFromR2(config, {
      r2Key: body.r2Key,
      purpose: body.purpose,
      notes: body.notes,
      filename: body.filename,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PrintingComicsApiError) {
      return NextResponse.json(
        { error: err.bodyText, status: err.status },
        { status: err.status === 401 || err.status === 403 ? err.status : 502 }
      );
    }
    log.error({ err: String(err) }, "upload failed");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
