/**
 * Sanitize a project image URL before embedding it in an email template's
 * <img src> attribute.
 *
 * WHY: Some DB rows historically contained corrupted `imageUrl` values —
 * base64 `data:` URIs, or concatenated junk like
 * `/https:/indiecrowdfund.comdata:image/png;base64,...`. Naively
 * interpolating these into an <img src> attribute produces a multi-megabyte
 * email body per project cover, which then gets persisted into AdminEmail,
 * EmailLog, and EmailQueue rows. Pre-2026-04-15 this bloated the database
 * by ~1.8 GB across ~170K email rows for a single ~12 MB corrupt project.
 *
 * The root ImageUpload bug was fixed on 2026-04-15 and the 18 corrupt
 * `Project.imageUrl` values were recovered, but every email template must
 * still guard against the pattern as defense-in-depth so a future
 * regression can't reintroduce the bloat.
 *
 * Returns:
 *   - An absolute https?:// URL when the input looks valid
 *   - A `${appUrl}/<relative-path>` URL when the input is a clean site-relative path
 *   - null when the input is a data: URI, concatenated garbage, or empty
 *     (the caller should skip rendering the <img> tag in that case)
 */
export function safeEmailImageUrl(
  imageUrl: string | null | undefined,
  appUrl: string
): string | null {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  // Reject base64 data URIs — would bloat the email body by MBs
  if (trimmed.startsWith("data:")) return null;

  // Reject concatenated junk (e.g. "/https:/foo.comdata:image/...")
  if (trimmed.slice(1).includes("data:")) return null;

  // Reject a second http scheme embedded in the string (concatenation bug)
  if (trimmed.slice(8).includes("http")) return null;

  // Absolute http(s) URL — use as-is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Site-relative path: must start with a single `/` followed by a safe char.
  // Reject `/https:`, `/data:`, `//`, etc.
  if (/^\/[a-zA-Z0-9_\-]/.test(trimmed)) {
    return `${appUrl}${trimmed}`;
  }

  // Unsafe or malformed — skip the image entirely
  return null;
}
