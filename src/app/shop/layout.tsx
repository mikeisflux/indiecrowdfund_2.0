import type { Metadata } from "next";
import { MusicPlayerProvider } from "@/components/marketplace/music-player";

export const metadata: Metadata = {
  title: "Marketplace - Digital & Physical Products from Creators",
  description:
    "Shop the IndieCrowdfund Marketplace for comics, music, movies, physical media, and more from independent creators. Support indie creators directly.",
  openGraph: {
    title: "IndieCrowdfund Marketplace",
    description:
      "Discover and buy comics, music, movies, and physical media from independent creators on the IndieCrowdfund Marketplace.",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <MusicPlayerProvider>{children}</MusicPlayerProvider>;
}
