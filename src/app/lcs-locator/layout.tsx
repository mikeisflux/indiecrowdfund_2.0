import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Local Comic Shop Locator - Find Stores Near You",
  description:
    "Find certified local comic shops and retailers near you. Browse the IndieCrowdfund retailer network for indie comics, books, and creator products.",
  openGraph: {
    title: "LCS Locator - Find Local Comic Shops",
    description:
      "Find certified local comic shops and indie retailers in your area through the IndieCrowdfund network.",
  },
};

export default function LcsLocatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
