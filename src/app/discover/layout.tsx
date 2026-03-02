import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover Crowdfunding Projects - Browse Campaigns",
  description:
    "Explore and discover crowdfunding projects on IndieCrowdfund. Browse creative campaigns, back innovative ideas, and find the next big thing. The best Kickstarter alternative for discovering indie projects.",
  openGraph: {
    title: "Discover Projects on IndieCrowdfund",
    description:
      "Browse hundreds of crowdfunding campaigns from independent creators. Find and back projects you believe in.",
  },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
