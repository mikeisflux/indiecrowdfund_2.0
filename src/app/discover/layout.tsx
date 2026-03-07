import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";

export const metadata: Metadata = {
  title: "Discover Crowdfunding Projects - Browse Campaigns",
  description:
    "Explore and discover crowdfunding projects on IndieCrowdfund. Browse creative campaigns, back innovative ideas, and find the next big thing. The best Kickstarter alternative for discovering indie projects.",
  alternates: {
    canonical: `${SITE_URL}/discover`,
  },
  openGraph: {
    title: "Discover Projects on IndieCrowdfund",
    description:
      "Browse hundreds of crowdfunding campaigns from independent creators. Find and back projects you believe in.",
    url: `${SITE_URL}/discover`,
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Discover Projects on IndieCrowdfund",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover Projects on IndieCrowdfund",
    description:
      "Browse hundreds of crowdfunding campaigns from independent creators. Find and back projects you believe in.",
    images: ["/og-default.png"],
  },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
