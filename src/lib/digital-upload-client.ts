"use client";

import { apiFetch } from "@/lib/fetch-utils";

// Browser-side engine for digital file uploads (new files and replacements).
//
// Same-origin chunked multipart: each part is POSTed to our server, which
// forwards it to R2. Parts are small (8MB) so every request finishes in
// seconds on a slow link and well inside any proxy timeout; a few run in
// parallel for throughput; each has its own deadline and retry, so a
// stalled connection fails fast and resumes instead of hanging. The server
// records every accepted part, so the same file picked again after a
// refresh carries on from the last good part.
//
// Replacements ride the same path with `replaceOfFileId`: the server keeps
// the new bytes on a hidden carrier row and swaps them onto the original
// file at completion. (The old flow PUT the whole file from the browser
// straight to the R2 host, which many home networks and browsers refuse —
// "network error" with nothing in our logs.)

const CHUNK_SIZE = 8 * 1024 * 1024;
const CONCURRENCY = 3;
const PART_TIMEOUT_MS = 120_000;
const MAX_PART_RETRIES = 5;

export type UploadPhase = "starting" | "uploading" | "finalizing";

export interface ChunkedUploadOptions {
  file: File;
  projectId: string;
  /** Replace this file's bytes instead of creating a new file. */
  replaceOfFileId?: string;
  /** Replacement only: email backers who already have the file. */
  notifyBackers?: boolean;
  onProgress?: (percent: number) => void;
  onPhase?: (phase: UploadPhase) => void;
  onNote?: (note: string | null) => void;
}

export interface ChunkedUploadResult {
  fileId: string;
  replaced: boolean;
  affectedCount?: number;
  notifiedCount?: number;
  resumedParts: number;
}

export class ChunkedUploadError extends Error {
  /** The server has the parts so far; picking the same file again resumes. */
  resumable: boolean;
  constructor(message: string, resumable: boolean) {
    super(message);
    this.resumable = resumable;
  }
}

function reportClientFailure(file: File, reason: string, extra: Record<string, unknown> = {}) {
  try {
    void fetch("/api/error-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `[digital-file-upload] ${reason}`,
        url: typeof window !== "undefined" ? window.location.href : "",
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
          userAgent: navigator.userAgent,
          ...extra,
        },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export async function uploadDigitalFileChunked(opts: ChunkedUploadOptions): Promise<ChunkedUploadResult> {
  const { file, projectId, replaceOfFileId } = opts;
  const progress = opts.onProgress ?? (() => {});
  const phase = opts.onPhase ?? (() => {});
  const note = opts.onNote ?? (() => {});

  phase("starting");
  progress(1);
  note(null);

  const csrfToken =
    typeof document !== "undefined" ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] || "" : "";

  const postJson = async (payload: Record<string, unknown>) => {
    const res = await apiFetch("/api/creator/digital-files/multipart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const etags = new Map<number, string>();
  let fileId: string;
  let uploadId: string;
  let resumedParts = 0;

  // 1. Resume if the server already has parts of this exact file.
  const pending = await postJson({
    action: "find-pending",
    projectId,
    fileName: file.name,
    fileSize: file.size,
    ...(replaceOfFileId ? { replaceOfFileId } : {}),
  });
  if (pending.res.ok && pending.data.found && pending.data.fileId && pending.data.uploadId) {
    fileId = pending.data.fileId as string;
    uploadId = pending.data.uploadId as string;
    for (const [k, v] of Object.entries((pending.data.uploadedParts || {}) as Record<string, string>)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= totalParts) etags.set(n, v);
    }
    resumedParts = etags.size;
    if (resumedParts > 0) note(`Resuming — ${resumedParts} of ${totalParts} parts were already uploaded.`);
  } else {
    const init = await postJson({
      action: "init",
      projectId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      name: file.name,
      ...(replaceOfFileId ? { replaceOfFileId } : {}),
    });
    if (!init.res.ok) {
      throw new ChunkedUploadError(init.data.error || "Failed to start upload", false);
    }
    fileId = init.data.fileId as string;
    uploadId = init.data.uploadId as string;
  }

  // 2. Upload the missing parts, a few at a time.
  phase("uploading");
  const partProgress = new Map<number, number>();
  let doneBytes = 0;
  for (const n of etags.keys()) doneBytes += Math.min(CHUNK_SIZE, file.size - (n - 1) * CHUNK_SIZE);
  const paint = () => {
    let inFlight = 0;
    for (const v of partProgress.values()) inFlight += v;
    progress(Math.max(1, Math.min(99, Math.round(((doneBytes + inFlight) / file.size) * 100))));
  };
  paint();

  const uploadPart = (partNumber: number, chunk: Blob) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `/api/creator/digital-files/multipart?action=upload-part&fileId=${encodeURIComponent(
          fileId
        )}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`
      );
      xhr.timeout = PART_TIMEOUT_MS;
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          partProgress.set(partNumber, event.loaded);
          paint();
        }
      };
      const fail = (message: string, retryable: boolean) =>
        reject(Object.assign(new Error(message), { retryable }));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (!data.etag) return fail(`Part ${partNumber} returned no etag`, true);
            resolve(data.etag as string);
          } catch {
            fail(`Part ${partNumber} returned an unreadable response`, true);
          }
        } else if (xhr.status === 409) {
          fail("This upload was closed elsewhere. Choose the file again to restart.", false);
        } else {
          const transient = xhr.status >= 500 || xhr.status === 408 || xhr.status === 429;
          fail(`Part ${partNumber} failed (HTTP ${xhr.status})`, transient);
        }
      };
      xhr.ontimeout = () => fail(`Part ${partNumber} timed out`, true);
      xhr.onerror = () => fail(`Network error on part ${partNumber}`, true);
      xhr.onabort = () => fail("Upload cancelled", false);
      xhr.send(chunk);
    });

  const uploadPartWithRetry = async (partNumber: number) => {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt++) {
      try {
        const etag = await uploadPart(partNumber, chunk);
        etags.set(partNumber, etag);
        partProgress.delete(partNumber);
        doneBytes += end - start;
        paint();
        return;
      } catch (err) {
        lastErr = err as Error;
        partProgress.delete(partNumber);
        paint();
        const retryable = (err as { retryable?: boolean }).retryable === true;
        if (!retryable || attempt >= MAX_PART_RETRIES) {
          reportClientFailure(file, "Upload part failed after retries", {
            partNumber,
            attempt,
            phase: "proxy-upload-part",
            replacement: !!replaceOfFileId,
            error: lastErr.message,
          });
          throw lastErr;
        }
        note(`Connection hiccup on part ${partNumber} — retrying (${attempt}/${MAX_PART_RETRIES - 1})…`);
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 15000)));
      }
    }
    throw lastErr ?? new Error("Upload failed");
  };

  const queue: number[] = [];
  for (let n = 1; n <= totalParts; n++) if (!etags.has(n)) queue.push(n);
  let firstError: Error | null = null;
  const worker = async () => {
    while (queue.length > 0 && !firstError) {
      const n = queue.shift() as number;
      try {
        await uploadPartWithRetry(n);
      } catch (err) {
        firstError = firstError ?? (err as Error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
  if (firstError) {
    const e = firstError as Error;
    throw new ChunkedUploadError(e.message, (e as { retryable?: boolean }).retryable !== false);
  }

  // 3. Finalize. The server also knows every part it accepted, so a lost
  // response here is safe to retry.
  phase("finalizing");
  progress(99);
  note(null);
  let lastError = "Failed to complete upload";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const done = await postJson({
      action: "complete",
      fileId,
      uploadId,
      parts: Array.from(etags.entries()).map(([partNumber, etag]) => ({ partNumber, etag })),
      ...(replaceOfFileId ? { notifyBackers: opts.notifyBackers === true } : {}),
    });
    if (done.res.ok) {
      progress(100);
      return {
        fileId: (done.data.fileId as string) || fileId,
        replaced: done.data.replaced === true,
        affectedCount: typeof done.data.affectedCount === "number" ? done.data.affectedCount : undefined,
        notifiedCount: typeof done.data.notifiedCount === "number" ? done.data.notifiedCount : undefined,
        resumedParts,
      };
    }
    lastError = done.data.error || lastError;
    if (done.res.status === 400 && typeof done.data.missingPart === "number") {
      await uploadPartWithRetry(done.data.missingPart as number);
    } else if (done.res.status < 500) {
      break;
    } else {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new ChunkedUploadError(lastError, true);
}
