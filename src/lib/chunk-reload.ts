/**
 * Recovery for stale-chunk errors after a deploy.
 *
 * Next.js fingerprints every JS chunk, and build-and-swap replaces .next
 * wholesale — so the moment a deploy lands, the hashed chunk filenames a
 * already-open tab is holding stop existing. The next lazy import that tab
 * makes 404s and React throws ChunkLoadError. Nothing is broken; the browser
 * is just asking for a build that no longer exists.
 *
 * The right response is to reload, not to show an error page. The five
 * ChunkLoadErrors logged from one backer in seventeen seconds were that user
 * hitting "Try again" — which calls reset() and re-runs the same doomed import
 * against the same dead URL — during a deploy.
 *
 * Guarded against a reload loop. A genuine, permanent chunk failure (a CDN
 * serving 404s, a half-written deploy) would otherwise refresh forever and
 * never show the person anything. One attempt per minute per tab; after that
 * the real error page is shown and reported, which is the signal that this is
 * not a stale chunk.
 */

const RELOAD_KEY = "icf:chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;

/** True when this looks like a chunk that vanished under an open tab. */
export function isStaleChunkError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "ChunkLoadError") return true;

  const message = err.message ?? "";
  return (
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /ChunkLoadError/i.test(message) ||
    // Native ESM equivalent, thrown by browsers rather than by webpack.
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

/**
 * Reload once to pick up the new build. Returns true when a reload was
 * started, so the caller can render a "updating" state instead of an error.
 */
export function recoverFromStaleChunk(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      // Already tried within the cooldown — this is not a stale chunk, or the
      // reload is not fixing it. Fall through to the real error page.
      return false;
    }
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Private mode, or storage disabled. Without the guard a loop is possible,
    // so don't reload at all — a visible error beats an infinite refresh.
    return false;
  }

  // location.reload() can be served from cache. Re-requesting the same URL
  // goes through the normal navigation path and picks up the new HTML, which
  // is what carries the new chunk manifest.
  window.location.replace(window.location.href);
  return true;
}
