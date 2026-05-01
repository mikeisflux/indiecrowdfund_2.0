import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { uploadPrintFileFromR2 } from "@/lib/printingcomics/upload";
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

// POST — push an existing R2 PDF up to Printing Comics so it can be
// referenced from order line items. Body:
//   { r2Key: string, purpose: string, notes?: string, filename?: string }
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
