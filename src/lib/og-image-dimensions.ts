import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";

/**
 * Get actual image dimensions for an og:image URL by reading the file from disk.
 *
 * Social media scrapers (Facebook especially) can reject link previews when
 * the dimensions declared in <meta property="og:image:width/height"> don't
 * match the actual image bytes. Previously we hardcoded 1200x630 on every
 * project, but recovered project covers often have different dimensions
 * (e.g. 1044x562 for base64-recovered images from old projects). Reading
 * the real dimensions at generateMetadata() time eliminates the mismatch
 * entirely.
 *
 * Only works for site-local /api/uploads/... URLs — external URLs fall back
 * to the default 1200x630. Cached per file path so we don't hit disk on
 * every render of the same project page.
 */
const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

const DEFAULT_DIMENSIONS = { width: 1200, height: 630 };

// Process-local cache: file path → dimensions. Small footprint, survives
// within a single Node process, cleared on redeploy.
const dimensionCache = new Map<string, { width: number; height: number }>();

export async function getOgImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number }> {
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
    const cached = dimensionCache.get(filePath);
    if (cached) return cached;

    // Try the exact file first
    let readPath = filePath;
    if (!existsSync(readPath)) {
      // If caller asked for .jpg but only .webp exists, fall back to webp
      // (the image is the same, just a different encoding)
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

    const dims = { width: metadata.width, height: metadata.height };
    dimensionCache.set(filePath, dims);
    return dims;
  } catch {
    return DEFAULT_DIMENSIONS;
  }
}
