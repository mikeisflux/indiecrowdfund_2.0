// Upload a print PDF (cover, interior, etc.) from our R2 bucket to
// Printing Comics so it can be referenced by an order line item.
//
// Per docs (printingcomics.com/developers § Uploads):
//   POST /api/v1/uploads
//     Content-Type: multipart/form-data
//     Headers:
//       Authorization: Bearer pc_live_…
//       X-Upload-Content-Hash: <sha256-hex>   (integrity + dedupe)
//     Form fields:
//       file:    binary
//       purpose: "cover" | "interior" | etc — free-form
//       notes:   optional
//   Response: { upload: { id, url, filename, size, mimeType, contentHash, purpose, notes, createdAt }, idempotent }
//   Cap: 2 GB per file. Re-uploading the same hash returns the
//   existing record byte-free.

import { createHash } from "node:crypto";
import { logger } from "@/lib/logger";
import { getR2Storage } from "@/lib/r2";
import type { PrintingComicsConfig } from "./config";
import { PrintingComicsApiError } from "./client";

const log = logger.child({ module: "printingcomics-upload" });

export interface PCUploadResult {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  contentHash: string;
  purpose?: string;
  notes?: string;
  createdAt: string;
}

interface UploadFromR2Input {
  // R2 object key (the same key our /api/creator/marketplace/files
  // endpoint returns). Must already be uploaded to R2 by the creator
  // through the standard PDF upload flow.
  r2Key: string;
  // Filename shown to Printing Comics. Defaults to the basename of r2Key.
  filename?: string;
  // Free-form tag matching what the order line item will reference.
  purpose: string;
  notes?: string;
}

const TWO_GB = 2 * 1024 * 1024 * 1024;

// Pull the bytes from R2, hash them, and stream them to Printing
// Comics' /uploads endpoint. Returns the upload metadata so the
// caller can stash uploadId on the line item.
//
// Note: this materializes the full file in memory. For most comic
// PDFs that's fine (covers + interiors run 5–200 MB), but a 2 GB
// hardcover wrap file would burn 2 GB of RSS — fine for occasional
// submission, not OK to call from a hot path. Run from a queue or
// from the creator's explicit "submit to printer" click only.
export async function uploadPrintFileFromR2(
  config: PrintingComicsConfig,
  input: UploadFromR2Input
): Promise<{ upload: PCUploadResult; idempotent: boolean }> {
  const r2 = await getR2Storage();
  if (!r2) {
    throw new Error("R2 storage is not configured — cannot read print files");
  }

  const buf = await r2.getFile(input.r2Key);
  if (!buf) {
    throw new Error(`R2 object not found: ${input.r2Key}`);
  }
  if (buf.byteLength > TWO_GB) {
    throw new Error(
      `File is ${(buf.byteLength / 1024 / 1024 / 1024).toFixed(2)} GB; Printing Comics cap is 2 GB`
    );
  }

  const filename = input.filename || input.r2Key.split("/").pop() || "file.pdf";
  const contentHash = createHash("sha256").update(buf).digest("hex");

  // FormData accepts Blob; wrap the Buffer in one. Setting type to
  // application/pdf is a hint — Printing Comics accepts any file
  // type but their print pipeline expects preflighted PDFs.
  const fd = new FormData();
  fd.set(
    "file",
    new Blob([new Uint8Array(buf)], { type: "application/pdf" }),
    filename
  );
  fd.set("purpose", input.purpose);
  if (input.notes) fd.set("notes", input.notes);

  const url = `${config.baseUrl}/uploads`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
      "X-Upload-Content-Hash": contentHash,
    },
    body: fd,
  });

  const text = await res.text();
  if (!res.ok) {
    log.warn(
      { status: res.status, r2Key: input.r2Key, body: text.slice(0, 500) },
      "Printing Comics upload failed"
    );
    throw new PrintingComicsApiError(res.status, text);
  }
  let parsed: { upload: PCUploadResult; idempotent?: boolean };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new PrintingComicsApiError(res.status, `Non-JSON response: ${text.slice(0, 200)}`);
  }
  return { upload: parsed.upload, idempotent: !!parsed.idempotent };
}
