/**
 * Is this value something next/image can actually load?
 *
 * A truthiness check is not enough. next/image is handed whatever is in the
 * database, and a field holding "/" or " " is truthy, passes `{x.imageUrl &&
 * ...}`, and then fails in the optimizer with "The requested resource isn't a
 * valid image ... received null" — because it fetched the homepage HTML and
 * found no image in it. The render warns on every request until the row is
 * fixed, and the page shows a broken frame.
 *
 * Accepts an absolute http(s) URL, a root-relative path with something after
 * the slash, or a data: URI. Everything else is treated as absent, so the
 * caller falls back to whatever it already renders when there is no image.
 */
export function isDisplayableImage(src: string | null | undefined): src is string {
  if (typeof src !== "string") return false;
  const value = src.trim();
  // "/" alone is the homepage, not an image — the exact case seen in prod.
  if (value.length < 2) return false;
  if (value.startsWith("data:image/")) return true;
  if (value.startsWith("/")) return !value.startsWith("//");
  return /^https?:\/\/.+/i.test(value);
}
