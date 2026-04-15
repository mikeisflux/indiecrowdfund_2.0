/**
 * Strip base64 data: URIs out of HTML, write each extracted image to disk
 * as a real file under /uploads/email-extracted/, and rewrite the <img src>
 * attributes to point at the extracted file URLs.
 *
 * Used by:
 *   1. Email save endpoints (indiekit campaigns, AI marketing campaigns)
 *     to prevent new base64 blobs from being persisted to the DB.
 *   2. The bulk cleanup endpoint that scans AdminEmail/EmailLog/EmailQueue/
 *      EmailCampaign for existing bloated rows and rewrites them in place.
 *
 * Design:
 *   - Matches <img src="data:image/X;base64,Y">  with single or double quotes
 *   - Decodes base64 → Buffer
 *   - Hashes the Buffer with SHA-1 for a stable content-addressed filename
 *     so the same image content never gets written twice
 *   - Writes to UPLOADS_BASE/email-extracted/<hash>.<ext>
 *   - Returns both the processed HTML and a count of extracted images
 *
 * Fire-and-forget safe — if disk write fails for any image, that one
 * <img> tag is left as-is rather than blowing up the whole save.
 */

import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOADS_BASE =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

const EMAIL_EXTRACTED_DIR = path.join(UPLOADS_BASE, "email-extracted");

// <img src="data:image/png;base64,IVBO..."> → captures [ext, base64]
// Matches both single and double quoted src attributes.
const BASE64_IMG_PATTERN = /<img[^>]*\ssrc=(["'])data:image\/(png|jpe?g|gif|webp);base64,([^"']+)\1/gi;

export interface StripResult {
  html: string;
  extracted: number;
  bytesRemoved: number;
  bytesWritten: number;
}

export async function stripBase64FromHtml(
  html: string | null | undefined
): Promise<StripResult> {
  if (!html || typeof html !== "string") {
    return { html: html || "", extracted: 0, bytesRemoved: 0, bytesWritten: 0 };
  }
  if (!html.includes("data:image/")) {
    return { html, extracted: 0, bytesRemoved: 0, bytesWritten: 0 };
  }

  // Ensure the extraction directory exists once per call (idempotent)
  try {
    if (!existsSync(EMAIL_EXTRACTED_DIR)) {
      await mkdir(EMAIL_EXTRACTED_DIR, { recursive: true });
    }
  } catch {
    // If we can't create the dir, return the HTML unchanged
    return { html, extracted: 0, bytesRemoved: 0, bytesWritten: 0 };
  }

  const replacements: Array<{ from: string; to: string; bytesIn: number; bytesOut: number }> = [];

  // Collect all matches first (can't modify string while iterating regex state)
  BASE64_IMG_PATTERN.lastIndex = 0;
  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = BASE64_IMG_PATTERN.exec(html)) !== null) {
    matches.push(m);
  }

  for (const match of matches) {
    try {
      const extRaw = match[2].toLowerCase();
      const ext = extRaw === "jpeg" ? "jpg" : extRaw;
      const base64Data = match[3];

      if (!base64Data || base64Data.length < 100) {
        // Too small to bother extracting — probably a tracking pixel
        continue;
      }

      const buf = Buffer.from(base64Data, "base64");
      if (buf.length === 0) continue;

      // Content-addressed filename — same image content → same file
      const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 32);
      const filename = `${hash}.${ext}`;
      const filePath = path.join(EMAIL_EXTRACTED_DIR, filename);

      // Only write if the file doesn't already exist (idempotent dedup)
      if (!existsSync(filePath)) {
        await writeFile(filePath, buf);
      }

      const newUrl = `/api/uploads/email-extracted/${filename}`;
      // Rebuild the full src="..." attribute with the new URL
      const quote = match[1];
      const oldSrc = `src=${quote}data:image/${match[2]};base64,${base64Data}${quote}`;
      const newSrc = `src=${quote}${newUrl}${quote}`;

      replacements.push({
        from: oldSrc,
        to: newSrc,
        bytesIn: oldSrc.length,
        bytesOut: newSrc.length,
      });
    } catch {
      // Non-fatal per-image failure — leave that <img> in the HTML as-is
    }
  }

  let processed = html;
  let bytesRemoved = 0;
  let bytesWritten = 0;
  for (const r of replacements) {
    processed = processed.replace(r.from, r.to);
    bytesRemoved += r.bytesIn;
    bytesWritten += r.bytesOut;
  }

  return {
    html: processed,
    extracted: replacements.length,
    bytesRemoved,
    bytesWritten,
  };
}
