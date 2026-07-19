import { renderSocialCard } from "./social-card";

// Reuse the same social card for the Twitter/X large-image card. Without this,
// the page would inherit the root layout's generic twitter.images (/api/og)
// instead of the page-specific "How We Stack Up" scoreboard.
//
// Config is declared as inline literals (not imported or re-exported) because
// Turbopack must statically parse runtime/alt/size/contentType at build time.
export const runtime = "edge";
export const alt = "How IndieCrowdfund stacks up against Kickstarter, Indiegogo, and Fund My Comic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderSocialCard();
}
