import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Allows safe HTML tags commonly used in rich text content.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "a",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code",
      "pre",
      "img",
      "figure",
      "figcaption",
      "div",
      "span",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "video",
      "iframe",
      "source",
    ],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "title",
      "class",
      "id",
      "style",
      "width",
      "height",
      "frameborder",
      "allowfullscreen",
      "allow",
      "loading",
      "type",
      "controls",
      "autoplay",
      "muted",
      "loop",
      "poster",
    ],
    // Only allow safe URL protocols
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Allow YouTube and Vimeo embeds
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
  });
}

/**
 * Sanitizes HTML for email display - more restrictive than general HTML.
 * Removes tracking pixels and fixes Mixed Content issues.
 * Allows data: URLs for inline images.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";

  // First apply DOMPurify sanitization
  let sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "a",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "div",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
    ],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "title",
      "class",
      "style",
      "width",
      "height",
    ],
    // Allow data: URLs for inline images (base64 embedded)
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Allow data scheme specifically
    ADD_DATA_URI_TAGS: ["img"],
  });

  // Remove tracking pixels (specific tracking domains)
  sanitized = sanitized.replace(
    /<img[^>]*src=["'][^"']*url\d+\.indiecrowdfund\.com[^"']*["'][^>]*>/gi,
    ""
  );
  sanitized = sanitized.replace(
    /<img[^>]*src=["'][^"']*sendgrid\.net[^"']*["'][^>]*>/gi,
    ""
  );
  sanitized = sanitized.replace(
    /<img[^>]*src=["'][^"']*mailgun[^"']*\/o\.gif[^"']*["'][^>]*>/gi,
    ""
  );
  // Only remove 1x1 tracking pixels that have BOTH width and height as 1
  sanitized = sanitized.replace(
    /<img[^>]*width=["']?1(?:px)?["']?[^>]*height=["']?1(?:px)?["']?[^>]*>/gi,
    ""
  );
  sanitized = sanitized.replace(
    /<img[^>]*height=["']?1(?:px)?["']?[^>]*width=["']?1(?:px)?["']?[^>]*>/gi,
    ""
  );

  // Remove cid: images (Content-ID references to inline attachments that we don't have access to)
  // Replace them with a placeholder indicating there was an embedded image
  sanitized = sanitized.replace(
    /<img[^>]*src=["']cid:[^"']*["'][^>]*>/gi,
    '<span style="display:inline-block;padding:8px 12px;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:4px;color:#6b7280;font-size:12px;">[Embedded image not available]</span>'
  );

  // Fix Mixed Content by upgrading http to https (except localhost and data:)
  sanitized = sanitized.replace(/http:\/\/(?!localhost)/gi, "https://");

  return sanitized;
}

/**
 * Strips all HTML tags, leaving only plain text.
 * Useful for previews and meta descriptions.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}
