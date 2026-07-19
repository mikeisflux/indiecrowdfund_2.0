// Reuse the same social card for the Twitter/X large-image card. Without this,
// the page would inherit the root layout's generic twitter.images (/api/og)
// instead of the page-specific "How We Stack Up" scoreboard.
//
// The image generator itself is shared from ./opengraph-image, but the route
// config (runtime/alt/size/contentType) is declared here directly rather than
// re-exported — Next.js can't statically analyze a re-exported `runtime` and
// warns + falls back to the default runtime when it's re-exported.
export { default } from "./opengraph-image";

export const runtime = "edge";
export const alt = "How IndieCrowdfund stacks up against Kickstarter, Indiegogo, and Fund My Comic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
