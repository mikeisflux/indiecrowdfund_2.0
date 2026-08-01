import type { Metadata } from "next";

// Must match the origin used everywhere else (no "www"): a canonical on a
// different host splits ranking signals between two URLs Google treats as
// separate pages.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

export const metadata: Metadata = {
  title: "Comic Book Crowdfunding Campaigns — Browse Indie Comics",
  description:
    "Browse comic book crowdfunding campaigns from independent creators. Back indie comics, graphic novels, and art books, or launch your own comic crowdfunding campaign with lower fees than Kickstarter.",
  alternates: {
    // Self-canonical. This previously pointed at /discover — a page that does
    // not exist on this site — which told Google to drop /crowdfunds from the
    // index in favour of a URL that 404s. That single line was enough to keep
    // the main browse page out of search results entirely.
    canonical: `${SITE_URL}/crowdfunds`,
  },
  openGraph: {
    title: "Comic Book Crowdfunding Campaigns on IndieCrowdfund",
    description:
      "Browse indie comic and graphic novel crowdfunding campaigns. Find and back projects you believe in.",
    url: `${SITE_URL}/crowdfunds`,
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Discover Projects on IndieCrowdfund",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Comic Book Crowdfunding Campaigns on IndieCrowdfund",
    description:
      "Browse indie comic and graphic novel crowdfunding campaigns. Find and back projects you believe in.",
    images: ["/api/og"],
  },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
