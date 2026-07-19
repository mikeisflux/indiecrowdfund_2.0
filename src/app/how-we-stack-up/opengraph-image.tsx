import { renderSocialCard } from "./social-card";

// Social-share card for /how-we-stack-up. Next.js auto-wires this into the
// page's og:image, resolved against the metadataBase set in the root layout.
// The config below must be inline literals so Turbopack can statically parse
// them; the image itself is rendered by the shared ./social-card module.
export const runtime = "edge";
export const alt = "How IndieCrowdfund stacks up against Kickstarter, Indiegogo, and Fund My Comic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderSocialCard();
}
