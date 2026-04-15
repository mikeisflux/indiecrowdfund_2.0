import { existsSync, statSync } from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Get actual image dimensions + a version string for an og:image URL by
 * reading the file from disk.
 *
 * Returns:
 *   - width / height: actual dimensions (for og:image:width/height tags)
 *   - version: file mtime as a unix timestamp string, used as a cache-
 *     busting query param so Facebook/Meta treat regenerated files as
 *     new URLs and bypass their aggressive image CDN cache
 *
 * Social media scrapers (Facebook especially) aggressively cache
 * og:image URLs via their own CDN. Our uploads route sets
 * Cache-Control: immutable, which FB respects — meaning once FB has
 * fetched an image URL once, they will NEVER refetch it even if you
 * click Scrape Again. Regenerating the file on disk produces new bytes
 * at the same URL, but FB's cache layer serves the old version. The
 * cache-buster query param forces FB to treat each regeneration as a
 * distinct URL so the new bytes actually flow through.
 *
 * Only works for site-local /api/uploads/... URLs — external URLs fall
 * back to the default 1200x630 and no version string.
 */
const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

const DEFAULT_DIMENSIONS = { width: 1200, height: 630, version: null as string | null };

// Process-local cache: file path → { dimensions, version }
const imageInfoCache = new Map<
  string,
  { width: number; height: number; version: string | null }
>();

export async function getOgImageInfo(
  imageUrl: string
): Promise<{ width: number; height: number; version: string | null }> {
  if (!imageUrl) return DEFAULT_DIMENSIONS;

  try {
    // Extract the pathname portion regardless of absolute/relative URL
    let urlPath: string;
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      try {
        urlPath = new URL(imageUrl).pathname;
      } catch {
        return DEFAULT_DIMENSIONS;
      }
    } else {
      urlPath = imageUrl.split("?")[0]; // strip any query string
    }

    // Only support our local uploads paths
    if (!urlPath.startsWith("/api/uploads/")) {
      return DEFAULT_DIMENSIONS;
    }

    // /api/uploads/projects/foo/project/bar.jpg → uploads/projects/foo/project/bar.jpg
    const relativePath = urlPath.replace(/^\/api\/uploads\//, "");

    // Reject path traversal attempts
    if (relativePath.includes("..")) return DEFAULT_DIMENSIONS;

    const filePath = path.join(UPLOADS_BASE, relativePath);

    // Check cache
    const cached = imageInfoCache.get(filePath);
    if (cached) return cached;

    // Try the exact file first
    let readPath = filePath;
    if (!existsSync(readPath)) {
      // If caller asked for .jpg but only .webp exists, fall back to webp
      if (/\.jpe?g$/i.test(filePath)) {
        const webpPath = filePath.replace(/\.jpe?g$/i, ".webp");
        if (existsSync(webpPath)) {
          readPath = webpPath;
        } else {
          return DEFAULT_DIMENSIONS;
        }
      } else {
        return DEFAULT_DIMENSIONS;
      }
    }

    const metadata = await sharp(readPath).metadata();
    if (!metadata.width || !metadata.height) return DEFAULT_DIMENSIONS;

    // mtime as unix seconds — stable per-file-version cache buster
    let version: string | null = null;
    try {
      const stats = statSync(readPath);
      version = Math.floor(stats.mtimeMs / 1000).toString();
    } catch {
      // non-fatal
    }

    const info = { width: metadata.width, height: metadata.height, version };
    imageInfoCache.set(filePath, info);
    return info;
  } catch {
    return DEFAULT_DIMENSIONS;
  }
}

// Backwards-compat alias — older call sites expect { width, height } only
export async function getOgImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number }> {
  const info = await getOgImageInfo(imageUrl);
  return { width: info.width, height: info.height };
}

