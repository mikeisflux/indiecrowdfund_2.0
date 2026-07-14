// Chunked, retryable file download.
//
// Mirrors the multipart UPLOAD path: instead of pulling a large file in a
// single browser request (which fails/corrupts on flaky networks with no
// resume), we fetch it from our same-origin, Range-capable download
// endpoint in bounded chunks, retrying each chunk independently with
// exponential backoff. Each chunk is kept as its own Blob so the browser
// can offload it to disk — peak memory stays around one chunk, not the
// whole file — then the chunks are stitched into the final download.

export interface ChunkedDownloadOptions {
  /** Same-origin endpoint that honors HTTP Range, e.g. /api/backer/digital-files/download?fileId=xxx */
  url: string;
  fileName: string;
  mimeType?: string;
  /** Bytes per chunk. Default 25MB. */
  chunkSize?: number;
  /** Retries per chunk before giving up. Default 5. */
  maxRetries?: number;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function downloadFileInChunks(opts: ChunkedDownloadOptions): Promise<void> {
  const { url, fileName, mimeType, onProgress, signal } = opts;
  const chunkSize = opts.chunkSize ?? 25 * 1024 * 1024;
  const maxRetries = opts.maxRetries ?? 5;

  const fetchRange = async (start: number, end: number): Promise<Response> => {
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const res = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal,
          cache: "no-store",
        });
        if (res.status === 206 || res.status === 200) return res;
        throw new Error(`Unexpected status ${res.status}`);
      } catch (err) {
        if (signal?.aborted) throw err;
        if (attempt >= maxRetries) throw err;
        await sleep(Math.min(1000 * 2 ** (attempt - 1), 16000));
      }
    }
  };

  const parts: Blob[] = [];
  let loaded = 0;

  // First chunk also tells us the total size via Content-Range.
  const first = await fetchRange(0, chunkSize - 1);
  if (first.status === 200) {
    // Endpoint didn't honor Range — fall back to the single full body.
    const blob = await first.blob();
    saveBlob(blob, fileName);
    onProgress?.(blob.size, blob.size);
    return;
  }

  const contentRange = first.headers.get("Content-Range"); // "bytes 0-x/TOTAL"
  const total = contentRange ? Number(contentRange.split("/")[1]) : 0;
  const firstBlob = await first.blob();
  parts.push(firstBlob);
  loaded += firstBlob.size;
  onProgress?.(loaded, total || loaded);

  if (total > 0) {
    let start = firstBlob.size;
    while (start < total) {
      const end = Math.min(start + chunkSize, total) - 1;
      const res = await fetchRange(start, end);
      const blob = await res.blob();
      parts.push(blob);
      loaded += blob.size;
      start = end + 1;
      onProgress?.(loaded, total);
    }
  }

  saveBlob(new Blob(parts, { type: mimeType || "application/octet-stream" }), fileName);
}

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the browser has had time to start the save.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}
