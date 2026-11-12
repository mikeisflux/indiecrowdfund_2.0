/**
 * Which surface a browser should use for DivinityCoin hosted checkout.
 *
 * "embed": DC's hosted page in an iframe on our pledge page (desktop).
 * "redirect": the browser navigates to DC's page and DC sends it back to
 * our returnUrl with ?session_id=… when it's done.
 *
 * Mobile WebKit cannot be trusted with a card form inside a cross-origin
 * iframe: iOS Safari drops keyboard focus on inputs nested two iframes
 * deep (DC's page hosts Stripe's own frames), and in-app browsers
 * (Facebook, Instagram, X) block the popup DC opens as its workaround. A
 * backer on an iPhone reported tapping the card field and getting no
 * keyboard at all. Those browsers get the plain top-level page, which has
 * no nesting and no popup.
 *
 * Pure; safe on the client and the server (pass navigator.userAgent or the
 * User-Agent header). The client also knows about iPadOS, which identifies
 * as a Mac: pass `touchPoints` from navigator.maxTouchPoints there.
 */
export type DcCheckoutSurface = "embed" | "redirect";

const IOS = /iPhone|iPad|iPod/i;
// Facebook / Messenger, Instagram, X (Twitter), LINE, Snapchat, TikTok,
// Pinterest, generic Android WebView ("; wv)"), Gmail's in-app browser.
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Twitter|TwitterAndroid|Line\/|Snapchat|TikTok|musical_ly|Pinterest|; wv\)|GSA\//i;

export function dcCheckoutSurfaceFor(userAgent: string | null | undefined, touchPoints = 0): DcCheckoutSurface {
  const ua = userAgent || "";
  if (IOS.test(ua)) return "redirect";
  // iPadOS 13+ reports as a desktop Mac; the touch screen gives it away.
  if (/Macintosh/i.test(ua) && touchPoints > 1) return "redirect";
  if (IN_APP.test(ua)) return "redirect";
  return "embed";
}
