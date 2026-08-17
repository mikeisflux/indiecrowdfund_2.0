// Turn loosely typed campaign content into styled email blocks.
//
// The editor emits bare HTML — <p>text</p>, <h2>text</h2>, <ul><li>. Mail
// clients apply almost no default styling of their own and strip <style>
// blocks, so that arrives as cramped black Times-ish text. Everything an email
// needs has to be an inline style on the element itself, which is not something
// anyone should be typing by hand.
//
// This runs in the browser deliberately: it uses DOMParser rather than regex
// over HTML, so nested markup, attributes and entities survive intact. Regex
// on HTML gets this wrong the first time someone pastes a link inside a bold
// run inside a list item.

const BRAND = "#05ce78";
const TEXT = "#374151";
const HEADING = "#111827";

const HEADING_SIZES: Record<string, string> = {
  H1: "26px",
  H2: "21px",
  H3: "18px",
};

/**
 * Apply declarations to an element, overwriting rather than appending.
 *
 * Idempotent: formatting twice replaces `font-size` rather than leaving two
 * copies of it. Anything already on the element and not named here —
 * text-align from the alignment buttons, image sizing — is preserved.
 *
 * Done by rewriting the style attribute rather than through el.style, because
 * the CSSOM normalises values on the way in: #05ce78 comes back out as
 * rgb(5, 206, 120), and Outlook's Word engine is unreliable with rgb(). Hex is
 * the safe currency in email, so the string is edited directly to keep it.
 *
 * Splitting on ";" is sound for the styles in play here; none of them contain a
 * semicolon inside a value (no data URIs, no quoted content).
 */
function addStyle(el: HTMLElement, declarations: Record<string, string>) {
  const merged = new Map<string, string>();

  for (const part of (el.getAttribute("style") || "").split(";")) {
    const at = part.indexOf(":");
    if (at === -1) continue;
    const property = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (property && value) merged.set(property, value);
  }

  for (const [property, value] of Object.entries(declarations)) {
    merged.set(property, value);
  }

  el.setAttribute(
    "style",
    Array.from(merged, ([property, value]) => `${property}: ${value}`).join("; ")
  );
}

/**
 * Apply email-safe inline styles to the blocks an operator typed.
 *
 * Alignment already on an element is preserved — the alignment buttons write
 * text-align, and this must not undo them.
 */
export function autoFormatEmailBody(html: string): string {
  if (typeof window === "undefined" || !html.trim()) return html;

  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  // Promote a lone first line to a heading when the operator did not write one.
  // Typing a title on the first line and body underneath is what people
  // actually do, and it should not come out looking like another paragraph.
  const firstBlock = root.firstElementChild;
  const hasHeading = !!root.querySelector("h1, h2, h3");
  if (
    !hasHeading &&
    firstBlock?.tagName === "P" &&
    (firstBlock.textContent || "").trim().length > 0 &&
    (firstBlock.textContent || "").trim().length <= 80 &&
    root.children.length > 1
  ) {
    const heading = doc.createElement("h2");
    heading.innerHTML = firstBlock.innerHTML;
    const align = (firstBlock as HTMLElement).style.textAlign;
    if (align) heading.style.textAlign = align;
    firstBlock.replaceWith(heading);
  }

  root.querySelectorAll("h1, h2, h3").forEach((el) => {
    addStyle(el as HTMLElement, {
      margin: "0 0 12px 0",
      "font-size": HEADING_SIZES[el.tagName] || "20px",
      "line-height": "1.3",
      "font-weight": "700",
      color: HEADING,
    });
  });

  root.querySelectorAll("p").forEach((el) => {
    addStyle(el as HTMLElement, {
      margin: "0 0 16px 0",
      "font-size": "16px",
      "line-height": "1.6",
      color: TEXT,
    });
  });

  root.querySelectorAll("ul, ol").forEach((el) => {
    addStyle(el as HTMLElement, {
      margin: "0 0 16px 0",
      "padding-left": "22px",
      "font-size": "16px",
      "line-height": "1.6",
      color: TEXT,
    });
  });
  root.querySelectorAll("li").forEach((el) => {
    addStyle(el as HTMLElement, { margin: "0 0 6px 0" });
  });

  root.querySelectorAll("a").forEach((el) => {
    addStyle(el as HTMLElement, { color: BRAND, "text-decoration": "underline" });
  });

  root.querySelectorAll("blockquote").forEach((el) => {
    addStyle(el as HTMLElement, {
      margin: "0 0 16px 0",
      padding: "12px 16px",
      "border-left": `3px solid ${BRAND}`,
      background: "#f9fafb",
      color: "#4b5563",
      "font-style": "italic",
    });
  });

  root.querySelectorAll("hr").forEach((el) => {
    addStyle(el as HTMLElement, {
      border: "none",
      "border-top": "1px solid #e5e7eb",
      margin: "24px 0",
    });
  });

  // Images already carry their own styles from the editor's image extension,
  // including alignment, so they are left alone.

  return root.innerHTML;
}
