import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Server-side storage for message attachments.
 *
 * The messaging system had no attachment storage at all: outbound emails
 * carried files fine (base64 straight to Mailgun) but the mirrored Message
 * row recorded nothing, inbound email attachments were dropped in the
 * creator branch, and the direct-message API silently ignored them. A
 * backer "sent pictures" and every in-app surface showed nothing.
 *
 * Files land under uploads/message-attachments/files/ — the same local
 * store the media uploader uses — and are served by the existing
 * /api/uploads/[...path] route, so URLs are same-origin. The manifest
 * ({ filename, contentType, size, url }[]) is stored on
 * Message.attachments.
 */

export interface StoredMessageAttachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

export interface IncomingAttachment {
  filename?: string | null;
  contentType?: string | null;
  /** base64 (data-URL prefix tolerated) or a raw Buffer (inbound email). */
  data: string | Buffer;
}

export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024; // matches the compose UI

// Types that execute or script when opened from our origin. Everything else
// is allowed — creators trade PDFs, PSDs, ZIPs of pages, CBZs.
const BLOCKED_TYPE = /(text\/html|image\/svg|javascript|application\/x-msdownload|application\/x-sh)/i;
const BLOCKED_EXT = /\.(html?|svg|js|mjs|exe|sh|bat|cmd)$/i;

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "attachment").slice(0, 120);
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_") || "attachment";
}

/**
 * Validate and persist attachments; returns the manifest to store on the
 * Message. Throws with a human-readable message naming the offending file —
 * callers surface it as a 400 so the sender learns why, instead of the
 * attachment silently vanishing (which is the failure mode this replaces).
 */
export async function storeMessageAttachments(
  incoming: IncomingAttachment[]
): Promise<StoredMessageAttachment[]> {
  if (incoming.length === 0) return [];
  if (incoming.length > MAX_MESSAGE_ATTACHMENTS) {
    throw new Error(`Too many attachments — up to ${MAX_MESSAGE_ATTACHMENTS} per message`);
  }

  const dir = path.join(process.cwd(), "uploads", "message-attachments", "files");
  await mkdir(dir, { recursive: true });

  const stored: StoredMessageAttachment[] = [];
  for (const att of incoming) {
    const filename = sanitizeFilename(att.filename || "attachment");
    const contentType = (att.contentType || "application/octet-stream").slice(0, 100);

    if (BLOCKED_TYPE.test(contentType) || BLOCKED_EXT.test(filename)) {
      throw new Error(`"${filename}" (${contentType}) is not an allowed attachment type`);
    }

    const buffer = Buffer.isBuffer(att.data)
      ? att.data
      : Buffer.from(String(att.data).replace(/^data:[^;]+;base64,/, ""), "base64");

    if (buffer.length === 0) {
      throw new Error(`"${filename}" is empty or could not be decoded`);
    }
    if (buffer.length > MAX_MESSAGE_ATTACHMENT_BYTES) {
      throw new Error(`"${filename}" exceeds the 10MB attachment limit`);
    }

    const storedName = `${crypto.randomUUID()}-${filename}`;
    await writeFile(path.join(dir, storedName), buffer);

    stored.push({
      filename,
      contentType,
      size: buffer.length,
      url: `/api/uploads/message-attachments/files/${storedName}`,
    });
  }
  return stored;
}

/** Best-effort read of a stored manifest; garbage in, empty list out. */
export function readMessageAttachments(value: unknown): StoredMessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is StoredMessageAttachment =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as StoredMessageAttachment).url === "string" &&
      typeof (a as StoredMessageAttachment).filename === "string"
  );
}
