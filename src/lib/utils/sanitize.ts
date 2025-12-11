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
  });

  // Remove tracking pixels (1x1 images, tracking domains)
  sanitized = sanitized.replace(
    /<img[^>]*src=["'][^"']*url\d+\.indiecrowdfund\.com[^"']*["'][^>]*>/gi,
    ""
  );
  sanitized = sanitized.replace(
    /<img[^>]*src=["'][^"']*sendgrid\.net[^"']*["'][^>]*>/gi,
    ""
  );
  sanitized = sanitized.replace(
    /<img[^>]*(?:width=["']?1["']?|height=["']?1["']?)[^>]*>/gi,
    ""
  );

  // Fix Mixed Content by upgrading http to https (except localhost)
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
