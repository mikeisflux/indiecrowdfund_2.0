/**
 * Search engine indexing utilities
 *
 * - Pings Google and Bing when new content is published (sitemap refresh)
 * - Submits individual URLs via IndexNow (Bing, Yandex, and others)
 *
 * All calls are fire-and-forget — failures are logged but never throw.
 */

import { logger } from "@/lib/logger";

const indexingLogger = logger.child({ module: "seo-indexing" });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

// IndexNow key — must match the value at /public/indexnow-key.txt
// Generate a GUID and set this env var (or use the hardcoded default below)
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "indiecrowdfund-indexnow-key";

/**
 * Ping Google and Bing to re-crawl the sitemap.
 * Called whenever new public content is published.
 */
export async function pingSitemapCrawlers(): Promise<void> {
  const endpoints = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
  ];

  await Promise.allSettled(
    endpoints.map((url) =>
      fetch(url, { method: "GET" })
        .then((res) => {
          indexingLogger.info({ url, status: res.status }, "Sitemap ping sent");
        })
        .catch((err) => {
          indexingLogger.warn({ url, err: String(err) }, "Sitemap ping failed");
        })
    )
  );
}

/**
 * Submit specific URLs to IndexNow (Bing, Yandex, Seznam).
 * Google also reads IndexNow submissions via Bing's index.
 *
 * @param urls - Array of full URLs (e.g. https://www.indiecrowdfund.com/projects/...)
 */
export async function submitToIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;

  const host = new URL(SITE_URL).host;

  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };

  // Bing is the canonical IndexNow endpoint — they share with other engines
  const endpoint = "https://api.indexnow.org/indexnow";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    indexingLogger.info(
      { status: res.status, urlCount: urls.length },
      "IndexNow submission sent"
    );
  } catch (err) {
    indexingLogger.warn({ err: String(err) }, "IndexNow submission failed");
  }
}

/**
 * Notify search engines about a newly published project.
 * Submits the project URL + sitemap ping (fire-and-forget).
 */
export function notifyProjectPublished(
  projectSlug: string,
  creatorVanityUrl: string | null
): void {
  const path = creatorVanityUrl
    ? `/projects/${creatorVanityUrl}/${projectSlug}`
    : `/projects/${projectSlug}`;

  const url = `${SITE_URL}${path}`;

  // Fire-and-forget
  Promise.allSettled([
    submitToIndexNow([url]),
    pingSitemapCrawlers(),
  ]).catch((err) => {
    indexingLogger.warn({ err: String(err) }, "Unexpected error notifying search engines");
  });
}

/**
 * Notify search engines about a newly published marketplace book.
 */
export function notifyBookPublished(bookSlug: string): void {
  const url = `${SITE_URL}/marketplace/books/${bookSlug}`;

  Promise.allSettled([
    submitToIndexNow([url]),
    pingSitemapCrawlers(),
  ]).catch((err) => {
    indexingLogger.warn({ err: String(err) }, "Unexpected error notifying search engines");
  });
}

/**
 * Notify search engines about a prelaunch page going live.
 */
export function notifyPrelaunchPublished(
  projectSlug: string,
  creatorVanityUrl: string | null
): void {
  const path = creatorVanityUrl
    ? `/projects/${creatorVanityUrl}/${projectSlug}/prelaunch`
    : `/projects/${projectSlug}/prelaunch`;

  const url = `${SITE_URL}${path}`;

  Promise.allSettled([
    submitToIndexNow([url]),
    pingSitemapCrawlers(),
  ]).catch((err) => {
    indexingLogger.warn({ err: String(err) }, "Unexpected error notifying search engines");
  });
}
