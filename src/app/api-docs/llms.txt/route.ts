import { apiDocsMarkdown } from "@/lib/api/docs-content";

/**
 * The API reference as raw Markdown.
 *
 * Serves two callers: the docs page's "View raw Markdown" fallback for when
 * the clipboard API is unavailable, and any agent or crawler that would
 * rather fetch the reference than scrape the rendered page.
 */
export function GET() {
  return new Response(apiDocsMarkdown, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
