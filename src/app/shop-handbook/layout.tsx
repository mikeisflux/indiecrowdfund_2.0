import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Shop Handbook",
  description:
    "Complete guide to the IndieCrowdfund Marketplace. Learn how to buy and sell indie books, comics, and creator products.",
};

export default function MarketplaceHandbookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
