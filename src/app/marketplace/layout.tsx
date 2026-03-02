import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace - Digital & Physical Products from Creators",
  description:
    "Shop the IndieCrowdfund Marketplace for books, comics, physical media, and more from independent creators. Support indie creators directly.",
  openGraph: {
    title: "IndieCrowdfund Marketplace",
    description:
      "Discover and buy books, comics, and physical media from independent creators on the IndieCrowdfund Marketplace.",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
