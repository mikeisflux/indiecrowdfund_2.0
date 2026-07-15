// Reuse the same social card for the Twitter/X large-image card. Without
// this, the page would inherit the root layout's generic twitter.images
// (/api/og) instead of the page-specific "How We Stack Up" scoreboard.
export { default, runtime, alt, size, contentType } from "./opengraph-image";
