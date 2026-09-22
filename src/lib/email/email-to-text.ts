/**
 * Turn an inbound email body into readable plain text for the messages inbox.
 *
 * The messages UI renders content as plain text (which is correct — it must
 * never dangerouslySetInnerHTML a stranger's email). That puts the burden
 * here: whatever gets stored as Message.content has to already BE text.
 *
 * The previous approach was `html.replace(/<[^>]*>/g, "")`, which removes
 * tags but keeps the CONTENTS of <style> and <script> blocks — so a typical
 * marketing-formatted email became a screenful of CSS rules with the actual
 * sentence buried at the bottom, plus raw &nbsp; entities. And it only ran
 * when the plain-text part was missing; senders that stuff HTML into their
 * "plain" part bled through untouched.
 */

/** True when a string that claims to be plain text is actually HTML. */
export function looksLikeHtml(s: string): boolean {
  if (!s) return false;
  return (
    /<\s*(html|head|body|div|p|br|span|table|tr|td|style|script|a|img|font|meta|center|h[1-6])\b/i.test(s) ||
    /&(nbsp|amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/i.test(s)
  );
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    // Last, so it can't manufacture new entities out of double-encoding.
    .replace(/&amp;/gi, "&");
}

export function htmlToPlainText(html: string): string {
  let s = html;

  // Whole blocks whose CONTENT is code, not prose. This is the line the old
  // regex missed: stripping <style>'s tags but keeping its rules is what put
  // CSS in people's inboxes.
  s = s.replace(/<(style|script|head|title|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // Structure -> line breaks, so paragraphs survive the strip.
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<li\b[^>]*>/gi, "\n• ");
  s = s.replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table|ul|ol|section|header|footer)\s*>/gi, "\n");

  // Inline images survive as a visible reference — flattening a message
  // that is MOSTLY a picture into silence is how "I sent pictures and they
  // didn't come through" happens. Runs before the generic tag strip.
  s = s.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (_, src: string) =>
    src.startsWith("data:") ? "\n[Image]\n" : `\n[Image: ${src}]\n`
  );

  // Keep link targets when they differ from the link text — an emailed link
  // must survive into the plain rendering or the message loses its point.
  s = s.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_, href: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return ` ${href} `;
      if (href.startsWith("mailto:") || text === href || href.includes(text)) return ` ${text} `;
      return ` ${text} (${href}) `;
    }
  );

  // Everything else loses its markup.
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);

  // Tidy: per-line whitespace, trailing spaces, blank-line runs.
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

/**
 * Best plain-text rendering of an email body. Prefers the sender's own text
 * part when it is genuinely text; converts from HTML otherwise — including
 * when the "plain" part is secretly HTML, which real senders do send.
 */
export function emailBodyToPlainText(body: { text?: string | null; html?: string | null }): string {
  const text = body.text?.trim() || "";
  const html = body.html?.trim() || "";

  if (text && !looksLikeHtml(text)) {
    return text
      .split("\n")
      .map((line) => line.replace(/[ \t ]+/g, " ").trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  if (html) return htmlToPlainText(html);
  if (text) return htmlToPlainText(text);
  return "";
}
